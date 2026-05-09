import 'server-only';

import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import type { LeadStatus, LeadLostReason } from '@/lib/db/schema/leads';
import { STAGE_COLORS } from '@/lib/lead-stages';

// SERVER-ONLY: SQL-агрегаты для аналитики воронки.
// Используется в /manager/analytics. Все функции принимают filters
// и возвращают plain serializable structures.

export type AnalyticsFilters = {
  /** Период в днях: 30 / 90 / null (весь период) */
  periodDays: number | null;
  /** Только лиды этого менеджера */
  managerId: string | null;
  /** Только лиды из этого источника */
  source: string | null;
};

const ACTIVE_STAGES: LeadStatus[] = [
  'new',
  'contacted',
  'proposal_sent',
  'contract_signed',
  'works_completed',
  'won',
];

/** SQL-условие по периоду на колонку (по умолчанию leads.created_at). */
function periodSql(periodDays: number | null, column = 'l.created_at') {
  if (!periodDays) return sql.raw('TRUE');
  return sql.raw(`${column} >= NOW() - INTERVAL '${periodDays} days'`);
}

function managerSql(managerId: string | null, column = 'l.assigned_manager_id') {
  if (!managerId) return sql.raw('TRUE');
  return sql`${sql.raw(column)} = ${managerId}::uuid`;
}

function sourceSql(source: string | null, column = 'l.source') {
  if (!source) return sql.raw('TRUE');
  return sql`${sql.raw(column)} = ${source}::client_source`;
}

// ─── 1. Funnel: количество лидов прошедших через каждую стадию ──
export type FunnelStat = {
  status: LeadStatus;
  label: string;
  count: number;
  conversionFromPrevious: number | null; // % от предыдущей стадии
};

export async function getFunnelStats(filters: AnalyticsFilters): Promise<FunnelStat[]> {
  // Лид «прошёл» стадию если в его lead_status_history есть запись с to_status=стадия.
  // Берём distinct lead_id by to_status, фильтруем по period+manager+source через JOIN на leads.
  const result = await db.execute<{ status: LeadStatus; count: number }>(sql`
    SELECT
      h.to_status AS status,
      COUNT(DISTINCT h.lead_id)::int AS count
    FROM lead_status_history h
    JOIN leads l ON l.id = h.lead_id
    WHERE
      ${periodSql(filters.periodDays)}
      AND ${managerSql(filters.managerId)}
      AND ${sourceSql(filters.source)}
      AND h.to_status IN ('new','contacted','proposal_sent','contract_signed','works_completed','won')
    GROUP BY h.to_status
  `);
  const rows = ((result as unknown as { rows?: unknown[] }).rows ?? result) as Array<{
    status: LeadStatus;
    count: number;
  }>;
  const counts = new Map<LeadStatus, number>();
  for (const r of rows) counts.set(r.status, r.count);

  const stats: FunnelStat[] = [];
  let prev: number | null = null;
  for (const status of ACTIVE_STAGES) {
    const c = counts.get(status) ?? 0;
    const conversion = prev != null && prev > 0 ? Math.round((c / prev) * 1000) / 10 : null;
    stats.push({
      status,
      label: STAGE_COLORS[status]?.label ?? status,
      count: c,
      conversionFromPrevious: conversion,
    });
    prev = c;
  }
  return stats;
}

// ─── 2. Среднее время в каждой стадии ──────────────────────────
export type AvgTimeRow = {
  status: LeadStatus;
  label: string;
  avgDays: number;
  samples: number;
};

export async function getAvgTimeInStage(filters: AnalyticsFilters): Promise<AvgTimeRow[]> {
  // Используем LEAD() оконку: время в стадии = next_changed_at - this_changed_at.
  // Берём только завершённые passes (next IS NOT NULL).
  const result = await db.execute<{ status: LeadStatus; avg_days: number; samples: number }>(sql`
    SELECT
      t.to_status AS status,
      AVG(EXTRACT(EPOCH FROM (t.next_at - t.changed_at)) / 86400)::float AS avg_days,
      COUNT(*)::int AS samples
    FROM (
      SELECT
        h.lead_id,
        h.to_status,
        h.changed_at,
        LEAD(h.changed_at) OVER (PARTITION BY h.lead_id ORDER BY h.changed_at) AS next_at
      FROM lead_status_history h
      JOIN leads l ON l.id = h.lead_id
      WHERE
        ${periodSql(filters.periodDays)}
        AND ${managerSql(filters.managerId)}
        AND ${sourceSql(filters.source)}
    ) t
    WHERE t.next_at IS NOT NULL
      AND t.to_status IN ('new','contacted','proposal_sent','contract_signed','works_completed')
    GROUP BY t.to_status
    ORDER BY t.to_status
  `);
  const rows = ((result as unknown as { rows?: unknown[] }).rows ?? result) as Array<{
    status: LeadStatus;
    avg_days: number;
    samples: number;
  }>;
  const byStatus = new Map<LeadStatus, { avg: number; samples: number }>();
  for (const r of rows) {
    byStatus.set(r.status, { avg: r.avg_days, samples: r.samples });
  }

  const out: AvgTimeRow[] = [];
  for (const status of ['new', 'contacted', 'proposal_sent', 'contract_signed', 'works_completed'] as LeadStatus[]) {
    const v = byStatus.get(status);
    out.push({
      status,
      label: STAGE_COLORS[status]?.label ?? status,
      avgDays: v ? Math.round(v.avg * 10) / 10 : 0,
      samples: v?.samples ?? 0,
    });
  }
  return out;
}

// ─── 3. Причины потери ─────────────────────────────────────────
export type LossReasonRow = {
  code: LeadLostReason | 'unspecified';
  label: string;
  count: number;
  percentage: number;
};

const LOSS_REASON_LABELS: Record<LeadLostReason | 'unspecified', string> = {
  price_too_high: 'Высокая цена',
  chose_competitor: 'Выбрали конкурента',
  no_response: 'Не дозвонились',
  not_relevant: 'Потребность отпала',
  postponed: 'Отложили решение',
  diy_solved: 'Решили сами',
  wrong_region: 'Не наш регион',
  spam: 'Спам / ошибка',
  other: 'Другое',
  unspecified: 'Не указано',
};

export async function getLossReasons(filters: AnalyticsFilters): Promise<LossReasonRow[]> {
  const result = await db.execute<{ code: string | null; count: number }>(sql`
    SELECT
      l.lost_reason_code AS code,
      COUNT(*)::int AS count
    FROM leads l
    WHERE
      l.status = 'lost'
      AND ${periodSql(filters.periodDays)}
      AND ${managerSql(filters.managerId)}
      AND ${sourceSql(filters.source)}
    GROUP BY l.lost_reason_code
    ORDER BY count DESC
  `);
  const rows = ((result as unknown as { rows?: unknown[] }).rows ?? result) as Array<{
    code: string | null;
    count: number;
  }>;
  const total = rows.reduce((s, r) => s + r.count, 0);
  if (total === 0) return [];
  return rows.map((r) => {
    const code = (r.code ?? 'unspecified') as LeadLostReason | 'unspecified';
    return {
      code,
      label: LOSS_REASON_LABELS[code] ?? code,
      count: r.count,
      percentage: Math.round((r.count / total) * 1000) / 10,
    };
  });
}

// ─── 4. Динамика по месяцам ────────────────────────────────────
export type MonthlyRow = {
  month: string; // 'YYYY-MM'
  total: number;
  won: number;
  lost: number;
};

export async function getMonthlyConversions(filters: AnalyticsFilters): Promise<MonthlyRow[]> {
  // Период overrideim — для динамики берём минимум 6 месяцев или указанный
  const months = filters.periodDays ? Math.max(3, Math.ceil(filters.periodDays / 30)) : 12;
  const result = await db.execute<{
    month: string;
    total: number;
    won: number;
    lost: number;
  }>(sql`
    SELECT
      to_char(date_trunc('month', l.created_at), 'YYYY-MM') AS month,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE l.status = 'won')::int AS won,
      COUNT(*) FILTER (WHERE l.status = 'lost')::int AS lost
    FROM leads l
    WHERE
      l.created_at >= date_trunc('month', NOW() - (${months} || ' months')::interval)
      AND ${managerSql(filters.managerId)}
      AND ${sourceSql(filters.source)}
    GROUP BY 1
    ORDER BY 1
  `);
  const rows = ((result as unknown as { rows?: unknown[] }).rows ?? result) as Array<{
    month: string;
    total: number;
    won: number;
    lost: number;
  }>;
  return rows;
}

// ─── 5. Получить список менеджеров (для селектора фильтра) ─────
export async function getManagerList(): Promise<{ id: string; name: string }[]> {
  const result = await db.execute<{ id: string; name: string }>(sql`
    SELECT id, full_name AS name
    FROM users
    WHERE role IN ('manager','admin') AND is_active = true
    ORDER BY full_name
  `);
  return ((result as unknown as { rows?: unknown[] }).rows ?? result) as Array<{
    id: string;
    name: string;
  }>;
}
