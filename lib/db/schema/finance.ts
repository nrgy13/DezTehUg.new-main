import {
  pgTable,
  uuid,
  text,
  timestamp,
  date,
  decimal,
  pgEnum,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { dealWorkLogs } from './deals';

// Ставка мастера с историей (11.2026, запрос Сани): процент от стоимости наряда + гарантированная
// МЕСЯЧНАЯ минималка. Действует с effective_from (дата по МСК) до следующей записи этого мастера —
// поменяли процент в декабре, ноябрь считается по старому. Задаёт менеджер на «Мастера и ставки».
export const masterPayRates = pgTable(
  'master_pay_rates',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    percent: decimal('percent', { precision: 5, scale: 2 }).notNull(),
    minMonthly: decimal('min_monthly', { precision: 12, scale: 2 }).notNull().default('0'),
    effectiveFrom: date('effective_from').notNull(),
    note: text('note'),
    createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('master_pay_rates_user_idx').on(t.userId, t.effectiveFrom),
    userFromUq: unique('master_pay_rates_user_id_effective_from_key').on(t.userId, t.effectiveFrom),
  }),
);

// Запрос мастера на перенос наряда (11.2026): мастер сам дату не меняет — просит менеджера
// с обязательной причиной; менеджер одобряет (наряд переезжает) или отклоняет.
export const rescheduleRequestStatusEnum = pgEnum('reschedule_request_status', [
  'pending',
  'approved',
  'rejected',
  'cancelled',
]);

export const workOrderRescheduleRequests = pgTable(
  'work_order_reschedule_requests',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workLogId: uuid('work_log_id')
      .notNull()
      .references(() => dealWorkLogs.id, { onDelete: 'cascade' }),
    requestedById: uuid('requested_by_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    // Плановое время наряда на момент запроса (может быть пустым у наряда без даты).
    fromAt: timestamp('from_at', { withTimezone: true }),
    toAt: timestamp('to_at', { withTimezone: true }).notNull(),
    reason: text('reason').notNull(),
    status: rescheduleRequestStatusEnum('status').notNull().default('pending'),
    decidedById: uuid('decided_by_id').references(() => users.id, { onDelete: 'set null' }),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    decisionComment: text('decision_comment'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    workLogIdx: index('wo_resched_req_work_log_idx').on(t.workLogId),
    statusIdx: index('wo_resched_req_status_idx').on(t.status, t.createdAt),
  }),
);

export type MasterPayRate = typeof masterPayRates.$inferSelect;
export type RescheduleRequestStatus = (typeof rescheduleRequestStatusEnum.enumValues)[number];
export type WorkOrderRescheduleRequest = typeof workOrderRescheduleRequests.$inferSelect;
