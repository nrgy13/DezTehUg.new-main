import 'server-only';

import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

// SERVER-ONLY: SQL-агрегаты для всех отчётов /manager/reports.
// Все функции принимают опц. период в днях (null = весь период).
// Возвращают serializable arrays — рендерим в таблицах + CSV-экспорт.

function periodFilter(periodDays: number | null, column: string): string {
  if (!periodDays) return 'TRUE';
  return `${column} >= NOW() - INTERVAL '${periodDays} days'`;
}

function getRows<T>(result: unknown): T[] {
  return ((result as { rows?: unknown[] }).rows ?? result) as T[];
}

// ─── 1. Доход по месяцам ────────────────────────────────────
export type RevenueRow = { month: string; deals: number; revenue: number };

export async function getRevenueByMonth(periodDays: number | null): Promise<RevenueRow[]> {
  const months = periodDays ? Math.max(3, Math.ceil(periodDays / 30)) : 12;
  const result = await db.execute<{ month: string; deals: number; revenue: string }>(sql`
    SELECT
      to_char(date_trunc('month', updated_at), 'YYYY-MM') AS month,
      COUNT(*)::int AS deals,
      COALESCE(SUM(total_amount), 0)::numeric AS revenue
    FROM deals
    WHERE status = 'completed'
      AND updated_at >= date_trunc('month', NOW() - (${months} || ' months')::interval)
    GROUP BY 1
    ORDER BY 1
  `);
  return getRows<{ month: string; deals: number; revenue: string }>(result).map((r) => ({
    month: r.month,
    deals: r.deals,
    revenue: Number(r.revenue),
  }));
}

// ─── 2. Сделки по мастерам ───────────────────────────────────
export type DealsByMasterRow = {
  masterId: string | null;
  masterName: string;
  total: number;
  completed: number;
  active: number;
  revenue: number;
};

export async function getDealsByMaster(periodDays: number | null): Promise<DealsByMasterRow[]> {
  const result = await db.execute<{
    master_id: string | null;
    master_name: string | null;
    total: number;
    completed: number;
    active: number;
    revenue: string;
  }>(sql.raw(`
    SELECT
      d.assigned_master_id AS master_id,
      u.full_name           AS master_name,
      COUNT(*)::int                                              AS total,
      COUNT(*) FILTER (WHERE d.status = 'completed')::int        AS completed,
      COUNT(*) FILTER (WHERE d.status IN ('signed','active'))::int AS active,
      COALESCE(SUM(d.total_amount) FILTER (WHERE d.status = 'completed'), 0)::numeric AS revenue
    FROM deals d
    LEFT JOIN users u ON u.id = d.assigned_master_id
    WHERE ${periodFilter(periodDays, 'd.created_at')}
    GROUP BY d.assigned_master_id, u.full_name
    ORDER BY revenue DESC NULLS LAST, total DESC
  `));
  return getRows<{
    master_id: string | null;
    master_name: string | null;
    total: number;
    completed: number;
    active: number;
    revenue: string;
  }>(result).map((r) => ({
    masterId: r.master_id,
    masterName: r.master_name ?? 'Без мастера',
    total: r.total,
    completed: r.completed,
    active: r.active,
    revenue: Number(r.revenue),
  }));
}

// ─── 3. Конверсия по источникам ──────────────────────────────
export type ConversionBySourceRow = {
  source: string;
  total: number;
  won: number;
  lost: number;
  conversion: number; // %
};

export async function getConversionBySource(
  periodDays: number | null,
): Promise<ConversionBySourceRow[]> {
  const result = await db.execute<{
    source: string | null;
    total: number;
    won: number;
    lost: number;
  }>(sql.raw(`
    SELECT
      COALESCE(source::text, 'не указан') AS source,
      COUNT(*)::int                                  AS total,
      COUNT(*) FILTER (WHERE status = 'won')::int   AS won,
      COUNT(*) FILTER (WHERE status = 'lost')::int  AS lost
    FROM leads
    WHERE ${periodFilter(periodDays, 'created_at')}
    GROUP BY 1
    ORDER BY total DESC
  `));
  return getRows<{
    source: string | null;
    total: number;
    won: number;
    lost: number;
  }>(result).map((r) => {
    const decided = r.won + r.lost;
    return {
      source: r.source ?? 'не указан',
      total: r.total,
      won: r.won,
      lost: r.lost,
      conversion: decided > 0 ? Math.round((r.won / decided) * 1000) / 10 : 0,
    };
  });
}

// ─── 4. Активность менеджеров ────────────────────────────────
export type ManagerActivityRow = {
  managerId: string | null;
  managerName: string;
  newLeads: number;
  wonLeads: number;
  lostLeads: number;
  closedDeals: number;
  revenue: number;
};

export async function getManagerActivity(
  periodDays: number | null,
): Promise<ManagerActivityRow[]> {
  const periodLeads = periodFilter(periodDays, 'l.created_at');
  const periodDeals = periodFilter(periodDays, 'd.created_at');
  const result = await db.execute<{
    manager_id: string | null;
    manager_name: string | null;
    new_leads: number;
    won_leads: number;
    lost_leads: number;
    closed_deals: number;
    revenue: string;
  }>(sql.raw(`
    WITH lead_stats AS (
      SELECT
        l.assigned_manager_id AS manager_id,
        COUNT(*)::int                                  AS new_leads,
        COUNT(*) FILTER (WHERE l.status = 'won')::int  AS won_leads,
        COUNT(*) FILTER (WHERE l.status = 'lost')::int AS lost_leads
      FROM leads l
      WHERE ${periodLeads}
      GROUP BY l.assigned_manager_id
    ),
    deal_stats AS (
      SELECT
        d.assigned_manager_id AS manager_id,
        COUNT(*) FILTER (WHERE d.status = 'completed')::int AS closed_deals,
        COALESCE(SUM(d.total_amount) FILTER (WHERE d.status = 'completed'), 0)::numeric AS revenue
      FROM deals d
      WHERE ${periodDeals}
      GROUP BY d.assigned_manager_id
    )
    SELECT
      u.id          AS manager_id,
      u.full_name   AS manager_name,
      COALESCE(ls.new_leads, 0)    AS new_leads,
      COALESCE(ls.won_leads, 0)    AS won_leads,
      COALESCE(ls.lost_leads, 0)   AS lost_leads,
      COALESCE(ds.closed_deals, 0) AS closed_deals,
      COALESCE(ds.revenue, 0)      AS revenue
    FROM users u
    LEFT JOIN lead_stats ls ON ls.manager_id = u.id
    LEFT JOIN deal_stats ds ON ds.manager_id = u.id
    WHERE u.role IN ('manager','admin') AND u.is_active = true
    ORDER BY revenue DESC, new_leads DESC
  `));
  return getRows<{
    manager_id: string | null;
    manager_name: string | null;
    new_leads: number;
    won_leads: number;
    lost_leads: number;
    closed_deals: number;
    revenue: string;
  }>(result).map((r) => ({
    managerId: r.manager_id,
    managerName: r.manager_name ?? '—',
    newLeads: r.new_leads,
    wonLeads: r.won_leads,
    lostLeads: r.lost_leads,
    closedDeals: r.closed_deals,
    revenue: Number(r.revenue),
  }));
}

// ─── 5. Топ услуг (по количеству позиций в сделках) ──────────
export type ServiceUsageRow = {
  serviceName: string;
  positions: number;
  totalAreaM2: number;
  revenue: number;
};

export async function getServiceUsage(periodDays: number | null): Promise<ServiceUsageRow[]> {
  const result = await db.execute<{
    service_name: string;
    positions: number;
    total_area: number;
    revenue: string;
  }>(sql.raw(`
    SELECT
      COALESCE(s.short_name, s.name, pi.custom_name, 'Прочее') AS service_name,
      COUNT(*)::int                            AS positions,
      COALESCE(SUM(pi.area_m2), 0)::int        AS total_area,
      COALESCE(SUM(pi.price_with_vat), 0)::numeric AS revenue
    FROM deal_price_items pi
    LEFT JOIN services s ON s.id = pi.service_id
    JOIN deals d ON d.id = pi.deal_id
    WHERE ${periodFilter(periodDays, 'd.created_at')}
    GROUP BY 1
    ORDER BY revenue DESC, positions DESC
  `));
  return getRows<{
    service_name: string;
    positions: number;
    total_area: number;
    revenue: string;
  }>(result).map((r) => ({
    serviceName: r.service_name,
    positions: r.positions,
    totalAreaM2: r.total_area,
    revenue: Number(r.revenue),
  }));
}

// ─── 6. Средний чек ─────────────────────────────────────────
export type AvgChequeRow = { period: string; deals: number; avgAmount: number };

export async function getAvgCheque(periodDays: number | null): Promise<AvgChequeRow[]> {
  const months = periodDays ? Math.max(3, Math.ceil(periodDays / 30)) : 6;
  const result = await db.execute<{
    period: string;
    deals: number;
    avg_amount: string;
  }>(sql`
    SELECT
      to_char(date_trunc('month', updated_at), 'YYYY-MM') AS period,
      COUNT(*)::int                                       AS deals,
      COALESCE(AVG(total_amount), 0)::numeric             AS avg_amount
    FROM deals
    WHERE status = 'completed'
      AND total_amount IS NOT NULL
      AND updated_at >= date_trunc('month', NOW() - (${months} || ' months')::interval)
    GROUP BY 1
    ORDER BY 1
  `);
  return getRows<{ period: string; deals: number; avg_amount: string }>(result).map((r) => ({
    period: r.period,
    deals: r.deals,
    avgAmount: Number(r.avg_amount),
  }));
}

// ─── 7. Time-to-close (lead created → deal completed) ──────
export type TimeToCloseRow = { month: string; samples: number; avgDays: number };

export async function getTimeToClose(periodDays: number | null): Promise<TimeToCloseRow[]> {
  const months = periodDays ? Math.max(3, Math.ceil(periodDays / 30)) : 6;
  const result = await db.execute<{
    month: string;
    samples: number;
    avg_days: number;
  }>(sql`
    SELECT
      to_char(date_trunc('month', d.updated_at), 'YYYY-MM') AS month,
      COUNT(*)::int AS samples,
      AVG(EXTRACT(EPOCH FROM (d.updated_at - l.created_at)) / 86400)::float AS avg_days
    FROM deals d
    JOIN leads l ON l.id = d.lead_id
    WHERE d.status = 'completed'
      AND d.lead_id IS NOT NULL
      AND d.updated_at >= date_trunc('month', NOW() - (${months} || ' months')::interval)
    GROUP BY 1
    ORDER BY 1
  `);
  return getRows<{ month: string; samples: number; avg_days: number }>(result).map((r) => ({
    month: r.month,
    samples: r.samples,
    avgDays: Math.round(r.avg_days * 10) / 10,
  }));
}

// ─── 8. Причины потери (повтор аналитики, для отчётов) ──────
export type LossReasonRow = { reason: string; count: number; percent: number };

export async function getLossReasons(periodDays: number | null): Promise<LossReasonRow[]> {
  const result = await db.execute<{ reason: string | null; count: number }>(sql.raw(`
    SELECT
      COALESCE(lost_reason_code::text, 'unspecified') AS reason,
      COUNT(*)::int AS count
    FROM leads
    WHERE status = 'lost'
      AND ${periodFilter(periodDays, 'created_at')}
    GROUP BY 1
    ORDER BY count DESC
  `));
  const rows = getRows<{ reason: string | null; count: number }>(result);
  const total = rows.reduce((s, r) => s + r.count, 0);
  return rows.map((r) => ({
    reason: r.reason ?? 'unspecified',
    count: r.count,
    percent: total > 0 ? Math.round((r.count / total) * 1000) / 10 : 0,
  }));
}

// ─── 9. Retention клиентов (повторные сделки) ────────────────
export type RetentionRow = { dealCount: string; clients: number };

export async function getClientRetention(periodDays: number | null): Promise<RetentionRow[]> {
  const result = await db.execute<{ deal_count: string; clients: number }>(sql.raw(`
    WITH counts AS (
      SELECT client_id, COUNT(*)::int AS deal_count
      FROM deals
      WHERE ${periodFilter(periodDays, 'created_at')}
      GROUP BY client_id
    )
    SELECT
      CASE
        WHEN deal_count = 1 THEN '1 (новые)'
        WHEN deal_count = 2 THEN '2'
        WHEN deal_count = 3 THEN '3'
        WHEN deal_count BETWEEN 4 AND 5 THEN '4–5'
        WHEN deal_count BETWEEN 6 AND 10 THEN '6–10'
        ELSE '11+'
      END AS deal_count,
      COUNT(*)::int AS clients
    FROM counts
    GROUP BY 1
    ORDER BY MIN(deal_count)
  `));
  return getRows<{ deal_count: string; clients: number }>(result).map((r) => ({
    dealCount: r.deal_count,
    clients: r.clients,
  }));
}

// ─── 10. Нагрузка мастеров (выезды по месяцам) ─────────────
export type MasterLoadRow = {
  masterName: string;
  month: string;
  workLogs: number;
  totalAreaM2: number;
};

export async function getMasterLoad(periodDays: number | null): Promise<MasterLoadRow[]> {
  const result = await db.execute<{
    master_name: string;
    month: string;
    work_logs: number;
    total_area: number;
  }>(sql.raw(`
    SELECT
      COALESCE(u.full_name, '—') AS master_name,
      to_char(date_trunc('month', wl.performed_at), 'YYYY-MM') AS month,
      COUNT(*)::int                       AS work_logs,
      COALESCE(SUM(wl.area_m2), 0)::int   AS total_area
    FROM deal_work_logs wl
    LEFT JOIN users u ON u.id = wl.master_id
    WHERE ${periodFilter(periodDays, 'wl.performed_at')}
    GROUP BY 1, 2
    ORDER BY master_name, month DESC
  `));
  return getRows<{
    master_name: string;
    month: string;
    work_logs: number;
    total_area: number;
  }>(result).map((r) => ({
    masterName: r.master_name,
    month: r.month,
    workLogs: r.work_logs,
    totalAreaM2: r.total_area,
  }));
}
