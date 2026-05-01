import { pgTable, uuid, varchar, text, timestamp, integer, jsonb } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { clients } from './clients';

// Объекты обслуживания клиента (адреса где обрабатываем)
// Например, у "ООО Аппетит" три объекта: 2 столовых в Анапе + база в Архипо-Осиповке
export const clientObjects = pgTable('client_objects', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  clientId: uuid('client_id')
    .notNull()
    .references(() => clients.id, { onDelete: 'cascade' }),

  name: varchar('name', { length: 255 }).notNull(), // "Столовая Эллада", "Кухня Олива Парк"
  address: text('address').notNull(),
  areaM2: integer('area_m2'), // площадь обработки

  objectType: varchar('object_type', { length: 64 }), // "столовая", "склад", "офис", "квартира"
  contactPerson: varchar('contact_person', { length: 255 }),
  contactPhone: varchar('contact_phone', { length: 32 }),

  notes: text('notes'),
  extraData: jsonb('extra_data'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type ClientObject = typeof clientObjects.$inferSelect;
export type NewClientObject = typeof clientObjects.$inferInsert;
