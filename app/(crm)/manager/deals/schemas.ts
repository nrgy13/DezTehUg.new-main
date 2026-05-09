import { z } from 'zod';
import { dealStatusEnum } from '@/lib/db/schema/deals';

export const dealStatusValues = dealStatusEnum.enumValues;

// Базовая форма создания/редактирования сделки
export const dealFormSchema = z.object({
  clientId: z.string().uuid('Не выбран клиент'),
  leadId: z.string().uuid().optional().nullable(),

  contractDate: z.string().min(1, 'Укажи дату договора'), // YYYY-MM-DD
  contractPlace: z.string().max(128).optional().or(z.literal('')),

  startDate: z.string().optional().or(z.literal('')),
  endDate: z.string().optional().or(z.literal('')),

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

    areaM2: z.coerce.number().int().min(0).max(1_000_000),
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

// Drag-n-drop переноса дат сделки в календаре (manager).
// startDate обязателен, endDate опционален.
export const updateDealDatesSchema = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата должна быть в формате YYYY-MM-DD'),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата должна быть в формате YYYY-MM-DD')
    .nullable()
    .optional(),
});
