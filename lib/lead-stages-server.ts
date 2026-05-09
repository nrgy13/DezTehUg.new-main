import 'server-only';

import { db } from '@/lib/db';
import { leadStatusHistory } from '@/lib/db/schema/lead-status-history';
import type { LeadStatus } from '@/lib/db/schema/leads';
import { users } from '@/lib/db/schema/users';
import { eq, desc, sql, inArray } from 'drizzle-orm';
import { STALE_THRESHOLDS, daysSince } from './lead-stages';

// SERVER-ONLY: БД-запросы по lead_status_history.
// Импортировать только из server components / server actions / API routes.
// Из client components — НЕ импортировать (ошибка `Module not found: 'net'`).

export type HistoryEntryWithMeta = {
  id: string;
  fromStatus: LeadStatus | null;
  toStatus: LeadStatus;
  changedAt: Date;
  changedByName: string | null;
  notes: string | null;
};

/** Возвращает полную историю стадий лида в порядке возрастания (старые → новые). */
export async function getLeadHistory(leadId: string): Promise<HistoryEntryWithMeta[]> {
  const rows = await db
    .select({
      id: leadStatusHistory.id,
      fromStatus: leadStatusHistory.fromStatus,
      toStatus: leadStatusHistory.toStatus,
      changedAt: leadStatusHistory.changedAt,
      changedByName: users.fullName,
      notes: leadStatusHistory.notes,
    })
    .from(leadStatusHistory)
    .leftJoin(users, eq(users.id, leadStatusHistory.changedById))
    .where(eq(leadStatusHistory.leadId, leadId))
    .orderBy(leadStatusHistory.changedAt);
  return rows;
}

/** Сколько дней лид находится в текущей стадии. */
export async function getDaysInCurrentStage(leadId: string): Promise<number> {
  const rows = await db
    .select({ changedAt: leadStatusHistory.changedAt })
    .from(leadStatusHistory)
    .where(eq(leadStatusHistory.leadId, leadId))
    .orderBy(desc(leadStatusHistory.changedAt))
    .limit(1);
  if (rows.length === 0) return 0;
  return daysSince(rows[0].changedAt);
}

/** Батч: leadId → daysInCurrentStage. Один SQL без N+1.
 * Использует Drizzle query builder с inArray + DISTINCT ON через нативный
 * Postgres-приём (ORDER BY + DISTINCT ON), завёрнутый в подзапрос.
 * Раньше делал raw `ANY(${arr}::uuid[])`, но Drizzle разворачивает массив
 * в `($1, $2, $3)` (record), а не в array — Postgres не кастит record в uuid[].
 */
export async function getDaysInStageBatch(
  leadIds: string[],
): Promise<Record<string, number>> {
  if (leadIds.length === 0) return {};
  const rows = await db
    .selectDistinctOn([leadStatusHistory.leadId], {
      leadId: leadStatusHistory.leadId,
      changedAt: leadStatusHistory.changedAt,
    })
    .from(leadStatusHistory)
    .where(inArray(leadStatusHistory.leadId, leadIds))
    .orderBy(leadStatusHistory.leadId, desc(leadStatusHistory.changedAt));
  const out: Record<string, number> = {};
  for (const r of rows) {
    out[r.leadId] = daysSince(r.changedAt);
  }
  return out;
}

/** Сводка по колонке канбана: count + avg days + stale count. */
export async function getColumnSummary(
  status: LeadStatus,
): Promise<{ count: number; avgDays: number; staleCount: number }> {
  const t = STALE_THRESHOLDS[status];
  const staleDays = t == null ? 999999 : t.stale;
  const result = await db.execute<{
    count: number;
    avg_days: number;
    stale_count: number;
  }>(sql`
    WITH latest AS (
      SELECT DISTINCT ON (lead_id) lead_id, changed_at
      FROM lead_status_history
      ORDER BY lead_id, changed_at DESC
    )
    SELECT
      COUNT(*)::int AS count,
      COALESCE(AVG(EXTRACT(EPOCH FROM (NOW() - latest.changed_at)) / 86400), 0)::float AS avg_days,
      COUNT(*) FILTER (
        WHERE EXTRACT(EPOCH FROM (NOW() - latest.changed_at)) / 86400 >= ${staleDays}
      )::int AS stale_count
    FROM leads
    LEFT JOIN latest ON latest.lead_id = leads.id
    WHERE leads.status = ${status}::lead_status
  `);
  const row = (result as unknown as Array<{ count: number; avg_days: number; stale_count: number }>)[0];
  return {
    count: row?.count ?? 0,
    avgDays: Math.floor(row?.avg_days ?? 0),
    staleCount: row?.stale_count ?? 0,
  };
}

/** Количество «зависших» лидов по всей системе. */
export async function getStaleLeadsCount(managerId?: string): Promise<number> {
  const managerFilter = managerId ? sql`l.assigned_manager_id = ${managerId}::uuid AND` : sql``;
  const result = await db.execute<{ count: number }>(sql`
    WITH latest AS (
      SELECT DISTINCT ON (lead_id) lead_id, changed_at
      FROM lead_status_history
      ORDER BY lead_id, changed_at DESC
    )
    SELECT COUNT(*)::int AS count
    FROM leads l
    JOIN latest ON latest.lead_id = l.id
    WHERE
      l.status NOT IN ('won', 'lost')
      AND ${managerFilter}
      EXTRACT(EPOCH FROM (NOW() - latest.changed_at)) / 86400 >= CASE l.status
        WHEN 'new' THEN 1
        WHEN 'contacted' THEN 3
        WHEN 'qualified' THEN 3
        WHEN 'proposal_sent' THEN 7
        WHEN 'contract_signed' THEN 14
        WHEN 'works_completed' THEN 5
        ELSE 999999
      END
  `);
  const row = (result as unknown as Array<{ count: number }>)[0];
  return row?.count ?? 0;
}
