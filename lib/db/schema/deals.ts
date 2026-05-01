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
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { clients } from './clients';
import { clientObjects } from './objects';
import { services } from './services';
import { users } from './users';

// Статус договора/сделки
export const dealStatusEnum = pgEnum('deal_status', [
  'draft',       // черновик
  'sent',        // отправлен клиенту
  'signed',      // подписан (загружен скан)
  'active',      // действующий
  'completed',   // выполнен
  'terminated',  // расторгнут
]);

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

  // Период действия
  startDate: date('start_date'),
  endDate: date('end_date'),

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

  // Параметры
  areaM2: integer('area_m2').notNull(),
  method: varchar('method', { length: 128 }), // "Сухая/Точечное орошение/Туман"
  frequency: varchar('frequency', { length: 64 }).notNull(), // "Ежемесячно", "По заявке"

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

export type DealStatus = (typeof dealStatusEnum.enumValues)[number];
export type Deal = typeof deals.$inferSelect;
export type NewDeal = typeof deals.$inferInsert;
export type DealPriceItem = typeof dealPriceItems.$inferSelect;
export type NewDealPriceItem = typeof dealPriceItems.$inferInsert;
export type DealAddendum = typeof dealAddendums.$inferSelect;
export type NewDealAddendum = typeof dealAddendums.$inferInsert;
