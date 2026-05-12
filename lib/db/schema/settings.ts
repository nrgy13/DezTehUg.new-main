import { pgTable, text, jsonb, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

// Generic key-value хранилище системных настроек, редактируемых из UI.
// Каждая запись — один логический config, value — произвольный JSON.
export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
});

export type AppSetting = typeof appSettings.$inferSelect;
export type NewAppSetting = typeof appSettings.$inferInsert;
