/**
 * Валидация формы заказ-наряда — общая для создания (createWorkOrderAction) и правки
 * (updateWorkOrderAction). Вынесено из 'use server'-файла: оттуда можно экспортировать
 * только async-функции, а схемы нужны обоим.
 */

import { z } from 'zod';
import { normalizeLinePrice } from '@/lib/visits/create';

export const checklistInputSchema = z.array(
  z.object({
    title: z.string().trim().min(2, 'минимум 2 символа в пункте').max(200),
    description: z.string().trim().max(1000).nullable().optional(),
    required: z.boolean(),
    source: z.enum(['template', 'manager']),
    sourceTemplateId: z.string().uuid().nullable().optional(),
  }),
);

// Валидация услуг наряда (раньше количество шло сырьём → -5/'abc' падали уже на уровне PG).
export const woServiceSchema = z.array(
  z.object({
    serviceId: z.string().uuid().nullable().optional(),
    customName: z.string().trim().max(255).nullable().optional(),
    method: z.string().trim().max(128).nullable().optional(),
    unit: z.enum(['m2', 'pcs', 'm3']).optional(),
    quantity: z
      .union([z.string(), z.number()])
      .nullable()
      .optional()
      .refine(
        (q) => q == null || q === '' || (Number.isFinite(Number(q)) && Number(q) >= 0),
        'количество — неотрицательное число',
      ),
    // Мульти-объектный наряд: объект услуги (один из объектов наряда; null → основной).
    objectId: z.string().uuid().nullable().optional(),
    // Цена строки (11.2026): из договора или своя. Пусто — цена не указана.
    price: z
      .union([z.string(), z.number()])
      .nullable()
      .optional()
      // Тот же нормализатор, что и при записи (пробелы-разделители тысяч, запятая) — иначе
      // «1 500,50» валидатор отвергал, а запись бы приняла.
      .refine(
        (p) =>
          p == null ||
          String(p).trim() === '' ||
          (normalizeLinePrice(p) !== null && Number(normalizeLinePrice(p)) < 100_000_000),
        'цена — неотрицательное число',
      ),
    priceSource: z.enum(['contract', 'manual']).nullable().optional(),
  }),
);

/** Потолок объектов в одном наряде — защита от случайного «выбрать всё» у сетей (Хадыжи: 31 магазин). */
export const MAX_WORK_ORDER_OBJECTS = 30;
