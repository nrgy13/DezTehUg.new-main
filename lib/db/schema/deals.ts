import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  pgEnum,
  jsonb,
  integer,
  decimal,
  date,
  index,
  boolean,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { clients } from './clients';
import { clientObjects } from './objects';
import { services } from './services';
import { users } from './users';
import { leads } from './leads';

// Статус договора/сделки
export const dealStatusEnum = pgEnum('deal_status', [
  'draft',       // черновик
  'sent',        // отправлен клиенту
  'signed',      // подписан (загружен скан)
  'active',      // действующий
  'completed',   // выполнен
  'terminated',  // расторгнут
]);

// Sprint 6 — статус «выезда» (запись в deal_work_logs стала полноценным
// выездом по позиции прайса). Старые записи получили 'completed' через DEFAULT.
export const workLogStatusEnum = pgEnum('work_log_status', [
  'planned',
  'in_progress',
  'completed',
]);

// Sprint 8/9 — единица измерения для позиции прайса.
// 'm2' — площадь (м²), 'pcs' — единицы (ед.), 'm3' — объём (м³).
// area_m2 трактуется как «количество в этой единице» (может быть дробным).
export const priceItemUnitEnum = pgEnum('price_item_unit', ['m2', 'pcs', 'm3']);

// Договор (сделка)
export const deals = pgTable('deals', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),

  // Реквизиты договора
  contractNumber: varchar('contract_number', { length: 64 }).notNull(), // "ДТЮ-28/01/26-16"
  contractDate: date('contract_date').notNull(),
  contractPlace: varchar('contract_place', { length: 128 }).default('г. Новороссийск'),

  // Клиент
  clientId: uuid('client_id')
    .notNull()
    .references(() => clients.id, { onDelete: 'restrict' }),

  // Лид-источник (если сделка создана конвертацией из лида)
  leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),

  // Назначения
  assignedManagerId: uuid('assigned_manager_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  assignedMasterId: uuid('assigned_master_id').references(() => users.id, {
    onDelete: 'set null',
  }),

  // Период действия (date — для совместимости с формами, оставлены до Sprint 5.1)
  startDate: date('start_date'),
  endDate: date('end_date'),

  // Точные timestamp'ы начала/конца. Если is_all_day=true — время игнорируется на UI.
  // В БД храним UTC (timestamptz), на фронте FullCalendar рендерит в TZ='Europe/Moscow'.
  startAt: timestamp('start_at', { withTimezone: true, mode: 'date' }),
  endAt: timestamp('end_at', { withTimezone: true, mode: 'date' }),
  isAllDay: boolean('is_all_day').notNull().default(true),

  // Статус
  status: dealStatusEnum('status').notNull().default('draft'),

  // Подписанты (можно переопределить для конкретного договора)
  signatoryExecutor: varchar('signatory_executor', { length: 255 }).default(
    'ИП Белавина Ольга Владимировна'
  ),
  signatoryClient: varchar('signatory_client', { length: 255 }), // "Генеральный директор Мороз А.Е."

  // Сумма (опционально, может вычисляться из price_list_items)
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }),
  currency: varchar('currency', { length: 3 }).notNull().default('RUB'),

  // Свободный JSON для специфичных полей (НДС, особые условия и т.д.)
  extraData: jsonb('extra_data'),

  notes: text('notes'),

  createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Позиции прейскуранта в рамках сделки (Приложение №2 договора)
// Связь объект × услуга × тариф
export const dealPriceItems = pgTable('deal_price_items', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),

  dealId: uuid('deal_id')
    .notNull()
    .references(() => deals.id, { onDelete: 'cascade' }),
  objectId: uuid('object_id').references(() => clientObjects.id, { onDelete: 'set null' }),
  serviceId: uuid('service_id').references(() => services.id, { onDelete: 'set null' }),

  // Свободное название услуги (когда менеджер вписывает что-то вне каталога)
  // Если пусто — отображаем services.name. Если оба пусты — UI требует одно из двух.
  customName: varchar('custom_name', { length: 255 }),

  // Параметры
  // Sprint 9: «количество в unit» (м²/ед./м³), дробное. decimal → string в JS,
  // арифметика через Number(), сохранение через String().
  areaM2: decimal('area_m2', { precision: 10, scale: 2 }).notNull(),
  unit: priceItemUnitEnum('unit').notNull().default('m2'),
  method: varchar('method', { length: 128 }), // "Сухая/Точечное орошение/Туман"
  frequency: varchar('frequency', { length: 64 }), // "Ежемесячно", "По заявке" — опционально для разовых работ

  // Цены
  priceNoVat: decimal('price_no_vat', { precision: 12, scale: 2 }).notNull(),
  priceWithVat: decimal('price_with_vat', { precision: 12, scale: 2 }).notNull(),
  vatRate: decimal('vat_rate', { precision: 4, scale: 2 }).notNull().default('5.00'), // НДС 5% по УСН

  sortOrder: integer('sort_order').default(0),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Дополнительные соглашения к договору
export const dealAddendums = pgTable('deal_addendums', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),

  dealId: uuid('deal_id')
    .notNull()
    .references(() => deals.id, { onDelete: 'cascade' }),

  number: integer('number').notNull(), // ДС№4
  date: date('date').notNull(),
  description: text('description'),

  // Структурированные изменения (новые объекты, новые тарифы, и т.п.)
  bodyJson: jsonb('body_json'),

  status: dealStatusEnum('status').notNull().default('draft'),
  signedAt: timestamp('signed_at', { withTimezone: true }),

  createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Журнал выполненных работ мастером по сделке (для акта работ).
// Sprint 6: расширен до «выезда» — со статусом и привязкой к позиции прайса.
// Старые записи имеют status='completed' (через DEFAULT в миграции 0012).
export const dealWorkLogs = pgTable(
  'deal_work_logs',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),

    dealId: uuid('deal_id')
      .notNull()
      .references(() => deals.id, { onDelete: 'cascade' }),
    masterId: uuid('master_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),

    // На какую позицию прайса этот выезд (Sprint 6).
    // NULL — историческая «свободная запись» (legacy записи, плюс ручные мастеровские).
    priceItemId: uuid('price_item_id').references(() => dealPriceItems.id, {
      onDelete: 'set null',
    }),

    // Релиз A (заказ-наряды): объект, на который этот выезд. NULL — legacy/прайс-выезды.
    objectId: uuid('object_id').references(() => clientObjects.id, {
      onDelete: 'set null',
    }),

    // Статус выезда. planned → in_progress → completed.
    status: workLogStatusEnum('status').notNull().default('completed'),

    // Когда запланирован (для planned/in_progress). Может быть null если без даты.
    plannedAt: timestamp('planned_at', { withTimezone: true }),
    // Когда мастер нажал «Начать выезд».
    startedAt: timestamp('started_at', { withTimezone: true }),
    // Когда мастер нажал «Завершить выезд» — после этого read-only.
    finalizedAt: timestamp('finalized_at', { withTimezone: true }),

    // Фактическая дата выполнения. Для planned может быть null.
    performedAt: timestamp('performed_at', { withTimezone: true }),
    // Свободное описание (legacy). Для planned может быть null, мастер пишет
    // через чеклист и заметки.
    description: text('description'),
    areaM2: integer('area_m2'),
    notes: text('notes'),

    // Релиз A: препараты обработки (free-text, заполняется в заказ-наряде).
    preparations: text('preparations'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    dealIdx: index('deal_work_logs_deal_id_idx').on(t.dealId),
    masterIdx: index('deal_work_logs_master_id_idx').on(t.masterId),
    statusIdx: index('deal_work_logs_status_idx').on(t.status),
    priceItemIdx: index('deal_work_logs_price_item_idx').on(t.priceItemId),
    objectIdx: index('deal_work_logs_object_id_idx').on(t.objectId),
  }),
);

// Релиз A (заказ-наряды): услуги конкретного выезда — snapshot услуг объекта на
// момент создания наряда. Несколько услуг на один выезд, каждая со своим способом
// и количеством. Копия (а не ссылка), чтобы история «что делали» не плыла.
export const dealWorkLogServices = pgTable(
  'deal_work_log_services',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workLogId: uuid('work_log_id')
      .notNull()
      .references(() => dealWorkLogs.id, { onDelete: 'cascade' }),
    serviceId: uuid('service_id').references(() => services.id, { onDelete: 'set null' }),
    customName: varchar('custom_name', { length: 255 }),
    method: varchar('method', { length: 128 }),
    unit: priceItemUnitEnum('unit').notNull().default('m2'),
    quantity: decimal('quantity', { precision: 10, scale: 2 }),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    workLogIdx: index('deal_work_log_services_work_log_idx').on(t.workLogId),
  }),
);

export type WorkLogStatus = (typeof workLogStatusEnum.enumValues)[number];
export type PriceItemUnit = (typeof priceItemUnitEnum.enumValues)[number];

export type DealStatus = (typeof dealStatusEnum.enumValues)[number];
export type Deal = typeof deals.$inferSelect;
export type NewDeal = typeof deals.$inferInsert;
export type DealPriceItem = typeof dealPriceItems.$inferSelect;
export type NewDealPriceItem = typeof dealPriceItems.$inferInsert;
export type DealAddendum = typeof dealAddendums.$inferSelect;
export type NewDealAddendum = typeof dealAddendums.$inferInsert;
export type DealWorkLog = typeof dealWorkLogs.$inferSelect;
export type NewDealWorkLog = typeof dealWorkLogs.$inferInsert;
export type DealWorkLogService = typeof dealWorkLogServices.$inferSelect;
export type NewDealWorkLogService = typeof dealWorkLogServices.$inferInsert;
