import { z } from 'zod';
import {
  validateInn,
  validateOgrnAny,
  validateKpp,
  validateBik,
  validateBankAccount,
  validateCorrAccount,
} from '@/lib/validation/inn';

// Помощник: trim + если пусто — undefined (для optional полей)
const optionalTrimmed = z
  .string()
  .optional()
  .transform((v) => {
    const trimmed = v?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : undefined;
  });

const phoneSchema = optionalTrimmed.pipe(
  z.union([z.string().min(5).max(32), z.undefined()])
);

const emailSchema = optionalTrimmed.pipe(
  z.union([z.string().email('Некорректный email'), z.undefined()])
);

// === Базовые поля для всех клиентов ===
const baseFields = {
  shortName: z.string().trim().min(1, 'Обязательно').max(255),
  fullName: optionalTrimmed,
  phone: phoneSchema,
  email: emailSchema,
  legalAddress: optionalTrimmed,
  postalAddress: optionalTrimmed,
  notes: optionalTrimmed,
  source: z.enum(['website', 'phone', 'manager', 'recurring', 'referral', 'other']),
  status: z.enum(['lead', 'active', 'inactive', 'blocked']),
  // Категория-метка для директора. default('old') — safety net, если форма не прислала значение.
  category: z.enum(['new', 'old', 'permanent', 'tender']).default('old'),
  assignedManagerId: z
    .string()
    .uuid('Некорректный ID менеджера')
    .optional()
    .or(z.literal('').transform(() => undefined)),
};

// === Юрлицо (организация ИЛИ ИП) ===
// В CRM под «юрлицом» живут и ООО/АО, и ИП — у обоих есть договорные реквизиты.
// Различает их ДЛИНА ИНН: организация — 10 цифр, ИП — 12 (алгоритм ФНС в validateInn
// поддерживает обе). КПП существует ТОЛЬКО у организаций: ИП его не присваивают,
// поэтому у 12-значного ИНН поле необязательно (иначе приходится вбивать 000000000).
export const legalClientSchema = z.object({
  type: z.literal('legal'),
  ...baseFields,
  inn: z
    .string()
    .trim()
    .min(1, 'ИНН обязателен для юрлица')
    .refine(
      (v) => /^\d{10}$/.test(v) || /^\d{12}$/.test(v),
      'ИНН — 10 цифр у организации, 12 у ИП'
    )
    .refine((v) => validateInn(v), 'ИНН не прошёл проверку контрольной суммы'),
  // Пусто → null (а не undefined), чтобы очистка КПП реально доезжала до БД:
  // drizzle пропускает undefined-поля в UPDATE и оставил бы старое значение.
  kpp: optionalTrimmed
    .refine(
      (v) => v === undefined || validateKpp(v),
      'КПП должен быть 9 символов в формате XXXX[XX]XXX'
    )
    .transform((v) => v ?? null),
  ogrn: optionalTrimmed.refine(
    (v) => v === undefined || validateOgrnAny(v),
    'ОГРН/ОГРНИП не прошёл проверку контрольной суммы'
  ),
  directorName: optionalTrimmed,
  directorRole: optionalTrimmed,
  actingBasis: optionalTrimmed,
  bankName: optionalTrimmed,
  bankBik: optionalTrimmed.refine(
    (v) => v === undefined || validateBik(v),
    'БИК — 9 цифр'
  ),
  // Формат — здесь; сверка контрольной суммы с БИК — в superRefine на union
  // (это межполевая проверка, внутри ветки БИК ещё не виден).
  bankAccount: optionalTrimmed.refine(
    (v) => v === undefined || /^\d{20}$/.test(v),
    'Расчётный счёт — 20 цифр'
  ),
  bankCorrAccount: optionalTrimmed.refine(
    (v) => v === undefined || validateCorrAccount(v),
    'Корсчёт — 20 цифр, начинается на 301 (банк) или 40102 (казначейский)'
  ),
});

// === Физлицо ===
export const individualClientSchema = z.object({
  type: z.literal('individual'),
  ...baseFields,
  // у физлица ИНН опциональный, но если введён — должен быть 12 цифр и пройти проверку
  inn: optionalTrimmed.refine(
    (v) => v === undefined || (/^\d{12}$/.test(v) && validateInn(v)),
    'ИНН физлица — 12 цифр и должен пройти проверку контрольной суммы'
  ),
});

// === Дискриминированный union ===
// superRefine вешаем НА UNION, а не на legalClientSchema: discriminatedUnion
// принимает только ZodObject, а .superRefine() превратил бы ветку в ZodEffects.
export const clientFormSchema = z
  .discriminatedUnion('type', [legalClientSchema, individualClientSchema])
  .superRefine((val, ctx) => {
    // КПП обязателен только у организации (ИНН 10 цифр). У ИП (12 цифр) КПП не существует.
    if (val.type === 'legal' && val.inn.length === 10 && !val.kpp) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['kpp'],
        message: 'КПП обязателен для организации (ИНН 10 цифр)',
      });
    }

    // Счёт и корсчёт несут контрольную сумму, завязанную на БИК — она ловит опечатку
    // в номере (100% однозначных опечаток на реальных данных прода). Без этой сверки
    // битый счёт молча уезжал в договор клиенту.
    // Проверяем только когда есть ОБА значения и БИК сам по себе корректен, иначе
    // ошибка «счёт не сходится» лезла бы поверх настоящей причины — кривого БИК.
    if (val.type === 'legal' && val.bankBik && validateBik(val.bankBik)) {
      if (val.bankAccount && /^\d{20}$/.test(val.bankAccount)) {
        if (!validateBankAccount(val.bankAccount, val.bankBik)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['bankAccount'],
            message:
              'Счёт не сходится с БИК — в номере опечатка. Сверь по платёжке или счёту на оплату',
          });
        }
      }
      if (val.bankCorrAccount && validateCorrAccount(val.bankCorrAccount)) {
        if (!validateCorrAccount(val.bankCorrAccount, val.bankBik)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['bankCorrAccount'],
            message: 'Корсчёт не сходится с БИК — проверь оба поля, одно из них с опечаткой',
          });
        }
      }
    }
  });

// === Дополнительные действия по клиенту ===
export const updateClientStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['lead', 'active', 'inactive', 'blocked']),
});

export const updateClientCategorySchema = z.object({
  id: z.string().uuid(),
  category: z.enum(['new', 'old', 'permanent', 'tender']),
});

// === Услуга объекта (Sprint 9: несколько услуг на объект) ===
// Каждая строка — услуга из каталога (serviceId) ИЛИ произвольное название
// (customName) + способ обработки. Пустые строки отсеиваются в action.
export const objectServiceSchema = z.object({
  serviceId: z
    .string()
    .uuid()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  customName: optionalTrimmed,
  method: optionalTrimmed,
  // Sprint 10: единица измерения (по умолчанию м²) — попадает в таблицу АО/АВР.
  unit: z
    .enum(['m2', 'pcs', 'm3'])
    .optional()
    .or(z.literal('').transform(() => undefined))
    .transform((v) => v ?? 'm2'),
  // Sprint 10: количество услуги (дробное). Запятую → точку, пусто → undefined.
  // nonnegative (не positive): 0 — валидное кол-во, не должно молча блокировать сабмит формы.
  quantity: z.preprocess(
    (v) => {
      if (v === '' || v === null || v === undefined) return undefined;
      return typeof v === 'string' ? v.replace(',', '.') : v;
    },
    z.coerce.number().nonnegative('Количество не может быть отрицательным').max(1_000_000).optional(),
  ),
  // Релиз B: периодичность обработки (из TREATMENT_FREQUENCIES). Пусто → undefined.
  frequency: optionalTrimmed,
});

// === Объект обслуживания ===
export const clientObjectSchema = z.object({
  name: z.string().trim().min(1, 'Название объекта обязательно').max(255),
  address: z.string().trim().min(1, 'Адрес обязателен'),
  // Sprint 9: дробная квадратура. Запятую нормализуем в точку, пусто → undefined.
  // nonnegative (не positive): 0 валиден и не должен молча блокировать сохранение объекта.
  areaM2: z.preprocess(
    (v) => {
      if (v === '' || v === null || v === undefined) return undefined;
      return typeof v === 'string' ? v.replace(',', '.') : v;
    },
    z.coerce.number().nonnegative('Площадь не может быть отрицательной').max(1_000_000).optional(),
  ),
  objectType: optionalTrimmed,
  contactPerson: optionalTrimmed,
  contactPhone: phoneSchema,
  // Sprint 9: договор-основание (инъектируется через createObjectForDeal,
  // в форме клиента не редактируется — привязка идёт через attachObjectToDeal).
  dealId: z
    .string()
    .uuid()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  // Sprint 9: плановая дата обработки (ГГГГ-ММ-ДД), пусто → undefined.
  plannedTreatmentDate: z.preprocess(
    (v) => (v === '' || v == null ? undefined : v),
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата в формате ГГГГ-ММ-ДД')
      .optional(),
  ),
  // Sprint 9: услуги объекта (несколько). default → пустой массив.
  services: z.array(objectServiceSchema).optional().default([]),
  notes: optionalTrimmed,
});

export type ClientFormInput = z.infer<typeof clientFormSchema>;
export type ClientObjectInput = z.infer<typeof clientObjectSchema>;
export type ObjectServiceInput = z.infer<typeof objectServiceSchema>;
