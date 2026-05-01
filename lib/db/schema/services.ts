import { pgTable, uuid, varchar, text, boolean, timestamp, integer } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Каталог услуг ДезТехЮг
// Дезинсекция, Дератизация, Дезинфекция, Фумигация и т.д.
export const services = pgTable('services', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  code: varchar('code', { length: 64 }).notNull().unique(), // "disinsection", "deratization"
  name: varchar('name', { length: 255 }).notNull(), // "Дезинсекция (уничтожение тараканов)"
  shortName: varchar('short_name', { length: 128 }),
  description: text('description'),

  // Параметры по умолчанию
  defaultMethod: varchar('default_method', { length: 128 }), // "Сухая/Точечное орошение/Туман"

  // Сортировка в UI
  sortOrder: integer('sort_order').notNull().default(0),

  isActive: boolean('is_active').notNull().default(true),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Service = typeof services.$inferSelect;
export type NewService = typeof services.$inferInsert;
