import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  decimal,
  date,
  integer,
  jsonb,
  index,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { clients } from './clients';
import { services } from './services';
import { deals } from './deals';

// Объекты обслуживания клиента (адреса где обрабатываем)
// Например, у "ООО Аппетит" три объекта: 2 столовых в Анапе + база в Архипо-Осиповке
export const clientObjects = pgTable(
  'client_objects',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),

    // Sprint 9: договор, на основании которого создан объект.
    // NULL — старый объект без договора (Регина привяжет вручную). Ленивая ссылка
    // с AnyPgColumn — разрывает циклическую зависимость типов objects↔deals.
    dealId: uuid('deal_id').references((): AnyPgColumn => deals.id, {
      onDelete: 'set null',
    }),

    name: varchar('name', { length: 255 }).notNull(), // "Столовая Эллада", "Кухня Олива Парк"
    address: text('address').notNull(),
    areaM2: decimal('area_m2', { precision: 10, scale: 2 }), // площадь обработки (дробная)

    objectType: varchar('object_type', { length: 64 }), // "столовая", "склад", "офис", "квартира"
    contactPerson: varchar('contact_person', { length: 255 }),
    contactPhone: varchar('contact_phone', { length: 32 }),

    // Sprint 9: плановая дата обработки (на её основе формируются заявки мастерам).
    plannedTreatmentDate: date('planned_treatment_date'),

    notes: text('notes'),
    extraData: jsonb('extra_data'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    dealIdx: index('client_objects_deal_id_idx').on(t.dealId),
  }),
);

// Sprint 9: услуги объекта — несколько услуг на один объект, у каждой свой
// способ обработки. Используется для заявок мастерам и актов АО/АВР.
export const clientObjectServices = pgTable(
  'client_object_services',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    objectId: uuid('object_id')
      .notNull()
      .references(() => clientObjects.id, { onDelete: 'cascade' }),
    serviceId: uuid('service_id').references(() => services.id, { onDelete: 'set null' }),
    customName: varchar('custom_name', { length: 255 }), // если услуга вне каталога
    method: varchar('method', { length: 128 }), // способ обработки (из справочника)
    sortOrder: integer('sort_order').notNull().default(0),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    objectIdx: index('client_object_services_object_idx').on(t.objectId, t.sortOrder),
  }),
);

export type ClientObject = typeof clientObjects.$inferSelect;
export type NewClientObject = typeof clientObjects.$inferInsert;
export type ClientObjectService = typeof clientObjectServices.$inferSelect;
export type NewClientObjectService = typeof clientObjectServices.$inferInsert;
