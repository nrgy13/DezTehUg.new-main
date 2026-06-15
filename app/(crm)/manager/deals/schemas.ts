import { z } from 'zod';
import { dealStatusEnum } from '@/lib/db/schema/deals';

export const dealStatusValues = dealStatusEnum.enumValues;

// Базовая форма создания/редактирования сделки
export const dealFormSchema = z.object({
  clientId: z.string().uuid('Не выбран клиент'),
  leadId: z.string().uuid().optional().nullable(),

  // Номер договора. Опционален: при СОЗДАНИИ генерируется автоматически
  // (generatePreliminaryDealNumber), правка номера приходит только из формы
  // реквизитов при ОБНОВЛЕНИИ. Не уникален в БД — бизнес допускает повторы.
  contractNumber: z
    .string()
    .trim()
    .max(64, 'Номер договора — до 64 символов')
    .optional()
    .or(z.literal('')),

  contractDate: z.string().min(1, 'Укажи дату договора'), // YYYY-MM-DD
  contractPlace: z.string().max(128).optional().or(z.literal('')),

  // «Сумма договора» — ручное поле (total_amount). Отдельно от «Итого по прайсу»
  // (Σ позиций): у годовых договоров сумма договора ≠ цена разовой обработки.
  // Пусто → undefined (в updateDeal трактуется как «очистить», ставит NULL).
  totalAmount: z.preprocess(
    (v) => {
      if (v === '' || v === null || v === undefined) return undefined;
      return typeof v === 'string' ? v.replace(',', '.') : v;
    },
    z.coerce.number().min(0).max(1_000_000_000).optional(),
  ),

  startDate: z.string().optional().or(z.literal('')),
  endDate: z.string().optional().or(z.literal('')),
  // Опциональное время (МСК) для точечного выезда. HH:MM. Если оба пусты → весь день.
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Формат HH:MM')
    .optional()
    .or(z.literal('')),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Формат HH:MM')
    .optional()
    .or(z.literal('')),

  signatoryClient: z.string().max(255).optional().or(z.literal('')),
  signatoryExecutor: z.string().max(255).optional().or(z.literal('')),

  assignedManagerId: z.string().uuid().optional().nullable(),
  assignedMasterId: z.string().uuid().optional().nullable(),

  notes: z.string().max(5000).optional().or(z.literal('')),
});

export type DealFormInput = z.infer<typeof dealFormSchema>;

// Форма прайс-позиции. Обязательно одно из: serviceId либо customName.
export const priceItemFormSchema = z
  .object({
    objectId: z.string().uuid().optional().nullable(),
    serviceId: z.string().uuid().optional().nullable(),
    customName: z.string().max(255).optional().or(z.literal('')),

    // Sprint 9: дробное кол-во. Запятую из ru-ввода нормализуем в точку.
    areaM2: z.preprocess(
      (v) => (typeof v === 'string' ? v.replace(',', '.') : v),
      z.coerce.number().min(0).max(1_000_000),
    ),
    unit: z.enum(['m2', 'pcs', 'm3']).default('m2'),
    method: z.string().max(128).optional().or(z.literal('')),
    frequency: z.string().max(64).optional().or(z.literal('')),

    priceNoVat: z.coerce.number().min(0).max(1_000_000_000),
    vatRate: z.coerce.number().min(0).max(100).default(5),

    sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  })
  .refine(
    (v) => Boolean(v.serviceId) || (typeof v.customName === 'string' && v.customName.trim().length > 0),
    {
      message: 'Выбери услугу из каталога или впиши своё название',
      path: ['customName'],
    },
  );

export type PriceItemFormInput = z.infer<typeof priceItemFormSchema>;

export const updateDealStatusSchema = z.object({
  status: z.enum(dealStatusValues),
});

// Drag-n-drop переноса дат/времени сделки в календаре (manager).
// startAt — обязателен, endAt — опционален. ISO 8601 с UTC offset.
// isAllDay=true → событие на весь день (UI отображает только дату).
// isAllDay=false → событие на конкретный час (отображается в timeGrid).
export const updateDealDatesSchema = z.object({
  startAt: z.string().datetime({ offset: true }),
  endAt: z.string().datetime({ offset: true }).nullable().optional(),
  isAllDay: z.boolean(),
});
