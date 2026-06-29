import { pgTable, uuid, varchar, text, timestamp, pgEnum, jsonb } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

// Тип клиента: физлицо или юрлицо
export const clientTypeEnum = pgEnum('client_type', ['individual', 'legal']);

// Статус клиента в CRM
export const clientStatusEnum = pgEnum('client_status', [
  'lead',
  'active',
  'inactive',
  'blocked',
]);

// Откуда пришёл клиент
export const clientSourceEnum = pgEnum('client_source', [
  'website',
  'phone',
  'manager',
  'recurring',
  'referral',
  'other',
]);

// Категория клиента — информационная метка для директора (НЕ статус жизненного цикла).
// new=Новый, old=Старый, permanent=Постоянный, tender=Тендер.
export const clientCategoryEnum = pgEnum('client_category', [
  'new',
  'old',
  'permanent',
  'tender',
]);

export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),

  type: clientTypeEnum('type').notNull(),

  // Общие поля
  shortName: varchar('short_name', { length: 255 }).notNull(), // "ООО Аппетит" или "Иванов И.И."
  fullName: text('full_name'), // полное название/ФИО
  phone: varchar('phone', { length: 32 }),
  email: varchar('email', { length: 255 }),

  // Юрлицо: реквизиты
  inn: varchar('inn', { length: 12 }),
  kpp: varchar('kpp', { length: 9 }),
  ogrn: varchar('ogrn', { length: 15 }),
  legalAddress: text('legal_address'),
  postalAddress: text('postal_address'),

  // Юрлицо: подписант
  directorName: varchar('director_name', { length: 255 }),
  directorRole: varchar('director_role', { length: 128 }), // "Генеральный директор" / "Директор"
  actingBasis: varchar('acting_basis', { length: 128 }), // "Устава" / "Доверенности №..."

  // Банковские реквизиты
  bankName: text('bank_name'),
  bankAccount: varchar('bank_account', { length: 32 }),
  bankBik: varchar('bank_bik', { length: 9 }),
  bankCorrAccount: varchar('bank_corr_account', { length: 32 }),

  // Метаданные
  source: clientSourceEnum('source').notNull().default('manager'),
  status: clientStatusEnum('status').notNull().default('lead'),
  // Категория для директора. Дефолт 'old' — при миграции 0020 все текущие клиенты = «Старый».
  category: clientCategoryEnum('category').notNull().default('old'),
  notes: text('notes'),

  // Зарезервировано для будущих расширений (не ломая миграции)
  extraData: jsonb('extra_data'),

  // Кто работает с клиентом
  createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
  assignedManagerId: uuid('assigned_manager_id').references(() => users.id, {
    onDelete: 'set null',
  }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type ClientType = (typeof clientTypeEnum.enumValues)[number];
export type ClientStatus = (typeof clientStatusEnum.enumValues)[number];
export type ClientSource = (typeof clientSourceEnum.enumValues)[number];
export type ClientCategory = (typeof clientCategoryEnum.enumValues)[number];
export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
