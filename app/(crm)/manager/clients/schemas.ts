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
  assignedManagerId: z
    .string()
    .uuid('Некорректный ID менеджера')
    .optional()
    .or(z.literal('').transform(() => undefined)),
};

// === Юрлицо ===
export const legalClientSchema = z.object({
  type: z.literal('legal'),
  ...baseFields,
  inn: z
    .string()
    .trim()
    .min(1, 'ИНН обязателен для юрлица')
    .refine((v) => /^\d{10}$/.test(v), 'ИНН юрлица — 10 цифр')
    .refine((v) => validateInn(v), 'ИНН не прошёл проверку контрольной суммы'),
  kpp: z
    .string()
    .trim()
    .min(1, 'КПП обязателен')
    .refine((v) => validateKpp(v), 'КПП должен быть 9 символов в формате XXXX[XX]XXX'),
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
  bankAccount: optionalTrimmed,
  bankCorrAccount: optionalTrimmed.refine(
    (v) => v === undefined || validateCorrAccount(v),
    'Корсчёт должен начинаться на 301 и быть длиной 20 цифр'
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
export const clientFormSchema = z.discriminatedUnion('type', [
  legalClientSchema,
  individualClientSchema,
]);

// === Дополнительные действия по клиенту ===
export const updateClientStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['lead', 'active', 'inactive', 'blocked']),
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
  quantity: z.preprocess(
    (v) => {
      if (v === '' || v === null || v === undefined) return undefined;
      return typeof v === 'string' ? v.replace(',', '.') : v;
    },
    z.coerce.number().positive().max(1_000_000).optional(),
  ),
  // Релиз B: периодичность обработки (из TREATMENT_FREQUENCIES). Пусто → undefined.
  frequency: optionalTrimmed,
});

// === Объект обслуживания ===
export const clientObjectSchema = z.object({
  name: z.string().trim().min(1, 'Название объекта обязательно').max(255),
  address: z.string().trim().min(1, 'Адрес обязателен'),
  // Sprint 9: дробная квадратура. Запятую нормализуем в точку, пусто → undefined.
  areaM2: z.preprocess(
    (v) => {
      if (v === '' || v === null || v === undefined) return undefined;
      return typeof v === 'string' ? v.replace(',', '.') : v;
    },
    z.coerce.number().positive().max(1_000_000).optional(),
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
