import { pgTable, uuid, timestamp, text, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { leads, leadStatusEnum } from './leads';
import { users } from './users';

// История смен статуса лида.
// Запись создаётся автоматически триггером БД при INSERT/UPDATE leads.status.
// См. drizzle/migrations/0004_lead_status_history.sql
export const leadStatusHistory = pgTable(
  'lead_status_history',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    leadId: uuid('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    fromStatus: leadStatusEnum('from_status'), // null для первой записи
    toStatus: leadStatusEnum('to_status').notNull(),
    changedById: uuid('changed_by_id').references(() => users.id, { onDelete: 'set null' }),
    changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
    notes: text('notes'),
  },
  (t) => ({
    leadIdx: index('idx_lsh_lead').on(t.leadId, t.changedAt),
    statusIdx: index('idx_lsh_status').on(t.toStatus, t.changedAt),
  }),
);

export type LeadStatusHistoryEntry = typeof leadStatusHistory.$inferSelect;
export type NewLeadStatusHistoryEntry = typeof leadStatusHistory.$inferInsert;
