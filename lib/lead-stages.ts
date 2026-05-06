import { db } from '@/lib/db';
import { leadStatusHistory, type LeadStatusHistoryEntry } from '@/lib/db/schema/lead-status-history';
import { leads, type LeadStatus } from '@/lib/db/schema/leads';
import { users } from '@/lib/db/schema/users';
import { eq, desc, and, isNull, sql } from 'drizzle-orm';

// ─── Цвета по стадиям воронки ────────────────────────────────
export const STAGE_COLORS: Record<
  LeadStatus,
  { bg: string; text: string; border: string; dot: string; label: string }
> = {
  new: {
    label: 'Новые',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-300',
    dot: 'bg-blue-500',
  },
  contacted: {
    label: 'Связались',
    bg: 'bg-cyan-50',
    text: 'text-cyan-700',
    border: 'border-cyan-300',
    dot: 'bg-cyan-500',
  },
  qualified: {
    label: 'Квалифицированы (legacy)',
    bg: 'bg-gray-50',
    text: 'text-gray-700',
    border: 'border-gray-300',
    dot: 'bg-gray-400',
  },
  proposal_sent: {
    label: 'КП отправлено',
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-300',
    dot: 'bg-orange-500',
  },
  contract_signed: {
    label: 'Договор подписан',
    bg: 'bg-violet-50',
    text: 'text-violet-700',
    border: 'border-violet-300',
    dot: 'bg-violet-500',
  },
  works_completed: {
    label: 'Реализована',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-300',
    dot: 'bg-emerald-500',
  },
  won: {
    label: 'Оплата',
    bg: 'bg-green-100',
    text: 'text-green-800',
    border: 'border-green-500',
    dot: 'bg-green-700',
  },
  lost: {
    label: 'Не состоялась',
    bg: 'bg-gray-50',
    text: 'text-gray-600',
    border: 'border-gray-300',
    dot: 'bg-gray-400',
  },
};

// ─── Пороги «зависания» ──────────────────────────────────────
// warn = жёлтый, stale = красный.
// null = финальная стадия (won/lost), индикатор не показываем.
export type StageThreshold = { warn: number; stale: number };
export const STALE_THRESHOLDS: Record<LeadStatus, StageThreshold | null> = {
  new: { warn: 0, stale: 1 },
  contacted: { warn: 2, stale: 3 },
  qualified: { warn: 2, stale: 3 }, // legacy
  proposal_sent: { warn: 5, stale: 7 },
  contract_signed: { warn: 10, stale: 14 },
  works_completed: { warn: 3, stale: 5 },
  won: null,
  lost: null,
};

export type StageHealth = 'fresh' | 'warn' | 'stale' | 'final';

export function stageHealthLevel(status: LeadStatus, days: number): StageHealth {
  const t = STALE_THRESHOLDS[status];
  if (t == null) return 'final';
  if (days >= t.stale) return 'stale';
  if (days >= t.warn) return 'warn';
  return 'fresh';
}

// Цветовые классы для бейджа в зависимости от здоровья.
// Сначала смотрим health (если stale → красный поверх стадии),
// если fresh — берём цвета из STAGE_COLORS.
export function badgeClassesForLead(
  status: LeadStatus,
  days: number,
): { bg: string; text: string; dot: string; ringPulse?: string } {
  const health = stageHealthLevel(status, days);
  if (health === 'stale') {
    return { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500', ringPulse: 'ring-2 ring-red-400/50 animate-pulse' };
  }
  if (health === 'warn') {
    return { bg: 'bg-yellow-100', text: 'text-yellow-800', dot: 'bg-yellow-500' };
  }
  if (health === 'final') {
    const c = STAGE_COLORS[status];
    return { bg: c.bg, text: c.text, dot: c.dot };
  }
  // fresh — стадийный цвет
  const c = STAGE_COLORS[status];
  return { bg: c.bg, text: c.text, dot: c.dot };
}

// ─── Подсчёт дней ────────────────────────────────────────────
export function daysSince(date: Date | string): number {
  const d = typeof date === 'string' ? new Date(date) : date;
  const ms = Date.now() - d.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

export function formatDays(days: number): string {
  if (days === 0) return 'сегодня';
  if (days === 1) return '1д';
  return `${days}д`;
}

// ─── Запросы к БД ────────────────────────────────────────────

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

/** Сколько дней лид находится в текущей стадии. Берёт последнюю запись из истории. */
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

/**
 * Батчевый запрос: вернёт map leadId → daysInCurrentStage.
 * Использует один SQL-запрос с DISTINCT ON, не N+1.
 */
export async function getDaysInStageBatch(
  leadIds: string[],
): Promise<Record<string, number>> {
  if (leadIds.length === 0) return {};
  const rows = await db.execute<{ lead_id: string; changed_at: Date }>(sql`
    SELECT DISTINCT ON (lead_id) lead_id, changed_at
    FROM lead_status_history
    WHERE lead_id = ANY(${leadIds}::uuid[])
    ORDER BY lead_id, changed_at DESC
  `);
  const out: Record<string, number> = {};
  for (const r of rows as unknown as Array<{ lead_id: string; changed_at: Date }>) {
    out[r.lead_id] = daysSince(r.changed_at);
  }
  return out;
}

/** Сводка по колонке канбана: count лидов и avg дней в стадии. */
export async function getColumnSummary(
  status: LeadStatus,
): Promise<{ count: number; avgDays: number; staleCount: number }> {
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
        WHERE EXTRACT(EPOCH FROM (NOW() - latest.changed_at)) / 86400 >=
        ${getStaleDaysSql(status)}
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

// Вспомогательная функция: возвращает SQL-литерал stale-порога для статуса.
function getStaleDaysSql(status: LeadStatus): ReturnType<typeof sql> {
  const t = STALE_THRESHOLDS[status];
  // Для финальных стадий ставим заведомо большое число — никто не попадёт
  return sql`${t == null ? 999999 : t.stale}`;
}

/**
 * Количество «зависших» лидов по всей системе (для KPI на дашборде).
 * Опциональный фильтр по менеджеру.
 */
export async function getStaleLeadsCount(managerId?: string): Promise<number> {
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
      AND ${managerId ? sql`l.assigned_manager_id = ${managerId}::uuid AND` : sql``}
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
