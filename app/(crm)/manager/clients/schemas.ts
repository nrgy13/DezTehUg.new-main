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

// === Объект обслуживания ===
export const clientObjectSchema = z.object({
  name: z.string().trim().min(1, 'Название объекта обязательно').max(255),
  address: z.string().trim().min(1, 'Адрес обязателен'),
  areaM2: z
    .union([z.number().int().positive().max(1000000), z.nan()])
    .optional()
    .transform((v) => (typeof v === 'number' && !isNaN(v) ? v : undefined)),
  objectType: optionalTrimmed,
  contactPerson: optionalTrimmed,
  contactPhone: phoneSchema,
  notes: optionalTrimmed,
});

export type ClientFormInput = z.infer<typeof clientFormSchema>;
export type ClientObjectInput = z.infer<typeof clientObjectSchema>;
