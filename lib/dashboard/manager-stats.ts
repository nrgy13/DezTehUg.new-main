import 'server-only';

import { db } from '@/lib/db';
import { sql, count, eq, and, gte, inArray } from 'drizzle-orm';
import { leads } from '@/lib/db/schema/leads';
import { clients } from '@/lib/db/schema/clients';
import { deals } from '@/lib/db/schema/deals';
import { documents } from '@/lib/db/schema/documents';
import { getStaleLeadsCount } from '@/lib/lead-stages-server';

export type ManagerDashboardStats = {
  newLeads: number;
  myActive: number;
  wonThisMonth: number;
  clientsCount: number;
  activeDeals: number;
  docsPreparing: number;
  staleLeads: number;
  upcomingVisits7d: number;
  revenue30d: number;
  conversion30d: number | null;
};

function getRows<T>(result: unknown): T[] {
  return ((result as { rows?: unknown[] }).rows ?? result) as T[];
}

export async function getManagerDashboardStats(userId: string): Promise<ManagerDashboardStats> {
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    [{ newLeads }],
    [{ myActive }],
    [{ clientsCount }],
    [{ activeDeals }],
    [{ docsPreparing }],
    [{ wonThisMonth }],
    staleLeads,
    upcomingVisitsResult,
    revenueResult,
    conversionResult,
  ] = await Promise.all([
    db.select({ newLeads: count() }).from(leads).where(eq(leads.status, 'new')),
    db
      .select({ myActive: count() })
      .from(leads)
      .where(
        and(
          eq(leads.assignedManagerId, userId),
          inArray(leads.status, [
            'contacted',
            'proposal_sent',
            'contract_signed',
            'works_completed',
          ]),
        ),
      ),
    db.select({ clientsCount: count() }).from(clients),
    db
      .select({ activeDeals: count() })
      .from(deals)
      .where(inArray(deals.status, ['draft', 'sent', 'signed', 'active'])),
    db
      .select({ docsPreparing: count() })
      .from(documents)
      .where(eq(documents.status, 'draft')),
    db
      .select({ wonThisMonth: count() })
      .from(leads)
      .where(and(eq(leads.status, 'won'), gte(leads.updatedAt, monthAgo))),
    getStaleLeadsCount(),
    db.execute<{ cnt: number }>(sql`
      SELECT COUNT(*)::int AS cnt
      FROM deals
      WHERE status IN ('sent','signed','active')
        AND COALESCE(
              date(start_at AT TIME ZONE 'Europe/Moscow'),
              start_date
            ) BETWEEN current_date AND current_date + INTERVAL '7 days'
    `),
    db.execute<{ revenue: string | null }>(sql`
      SELECT COALESCE(SUM(total_amount), 0)::numeric AS revenue
      FROM deals
      WHERE status = 'completed'
        AND updated_at >= NOW() - INTERVAL '30 days'
    `),
    db.execute<{ won: number; lost: number }>(sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'won')::int  AS won,
        COUNT(*) FILTER (WHERE status = 'lost')::int AS lost
      FROM leads
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `),
  ]);

  const upcomingRows = getRows<{ cnt: number }>(upcomingVisitsResult);
  const revenueRows = getRows<{ revenue: string | null }>(revenueResult);
  const conversionRows = getRows<{ won: number; lost: number }>(conversionResult);

  const upcomingVisits7d = upcomingRows[0]?.cnt ?? 0;
  const revenue30d = Number(revenueRows[0]?.revenue ?? 0);
  const won = conversionRows[0]?.won ?? 0;
  const lost = conversionRows[0]?.lost ?? 0;
  const conversion30d = won + lost > 0 ? Math.round((won / (won + lost)) * 1000) / 10 : null;

  return {
    newLeads,
    myActive,
    wonThisMonth,
    clientsCount,
    activeDeals,
    docsPreparing,
    staleLeads,
    upcomingVisits7d,
    revenue30d,
    conversion30d,
  };
}

export function formatRubShort(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1).replace('.0', '')} млн ₽`;
  if (amount >= 1_000) return `${Math.round(amount / 1_000)} тыс ₽`;
  return `${Math.round(amount)} ₽`;
}
