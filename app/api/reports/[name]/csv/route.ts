import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/helpers';
import {
  getRevenueByMonth,
  getDealsByMaster,
  getConversionBySource,
  getManagerActivity,
  getServiceUsage,
  getAvgCheque,
  getTimeToClose,
  getLossReasons,
  getClientRetention,
  getMasterLoad,
} from '@/lib/reports/queries';
import { toCSV, csvResponse } from '@/lib/reports/csv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parsePeriod(v: string | null): number | null {
  if (!v || v === 'all') return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 90;
}

function fmtMonth(ym: string): string {
  return ym;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string }> },
): Promise<Response> {
  await requireRole('manager');

  const { name } = await params;
  const url = new URL(request.url);
  const periodDays = parsePeriod(url.searchParams.get('period'));
  const periodSuffix = periodDays ? `${periodDays}d` : 'all';

  switch (name) {
    case 'revenue-by-month': {
      const data = await getRevenueByMonth(periodDays);
      return csvResponse({
        filename: `revenue-by-month_${periodSuffix}.csv`,
        content: toCSV(
          ['Месяц', 'Сделок', 'Доход (₽)'],
          data.map((r) => [fmtMonth(r.month), r.deals, r.revenue]),
        ),
      });
    }
    case 'deals-by-master': {
      const data = await getDealsByMaster(periodDays);
      return csvResponse({
        filename: `deals-by-master_${periodSuffix}.csv`,
        content: toCSV(
          ['Мастер', 'Всего', 'Завершено', 'В работе', 'Доход (₽)'],
          data.map((r) => [r.masterName, r.total, r.completed, r.active, r.revenue]),
        ),
      });
    }
    case 'conversion-by-source': {
      const data = await getConversionBySource(periodDays);
      return csvResponse({
        filename: `conversion-by-source_${periodSuffix}.csv`,
        content: toCSV(
          ['Источник', 'Всего', 'Won', 'Lost', 'Конверсия %'],
          data.map((r) => [r.source, r.total, r.won, r.lost, r.conversion]),
        ),
      });
    }
    case 'manager-activity': {
      const data = await getManagerActivity(periodDays);
      return csvResponse({
        filename: `manager-activity_${periodSuffix}.csv`,
        content: toCSV(
          ['Менеджер', 'Новых лидов', 'Won', 'Lost', 'Закрытых сделок', 'Доход (₽)'],
          data.map((r) => [
            r.managerName,
            r.newLeads,
            r.wonLeads,
            r.lostLeads,
            r.closedDeals,
            r.revenue,
          ]),
        ),
      });
    }
    case 'service-usage': {
      const data = await getServiceUsage(periodDays);
      return csvResponse({
        filename: `service-usage_${periodSuffix}.csv`,
        content: toCSV(
          ['Услуга', 'Позиций', 'Площадь, м²', 'Доход (₽)'],
          data.map((r) => [r.serviceName, r.positions, r.totalAreaM2, r.revenue]),
        ),
      });
    }
    case 'avg-cheque': {
      const data = await getAvgCheque(periodDays);
      return csvResponse({
        filename: `avg-cheque_${periodSuffix}.csv`,
        content: toCSV(
          ['Месяц', 'Сделок', 'Средний чек (₽)'],
          data.map((r) => [fmtMonth(r.period), r.deals, r.avgAmount]),
        ),
      });
    }
    case 'time-to-close': {
      const data = await getTimeToClose(periodDays);
      return csvResponse({
        filename: `time-to-close_${periodSuffix}.csv`,
        content: toCSV(
          ['Месяц', 'Сделок', 'Среднее, дн.'],
          data.map((r) => [fmtMonth(r.month), r.samples, r.avgDays]),
        ),
      });
    }
    case 'loss-reasons': {
      const data = await getLossReasons(periodDays);
      return csvResponse({
        filename: `loss-reasons_${periodSuffix}.csv`,
        content: toCSV(
          ['Причина', 'Лидов', '% от потерь'],
          data.map((r) => [r.reason, r.count, r.percent]),
        ),
      });
    }
    case 'client-retention': {
      const data = await getClientRetention(periodDays);
      return csvResponse({
        filename: `client-retention_${periodSuffix}.csv`,
        content: toCSV(
          ['Сделок у клиента', 'Клиентов'],
          data.map((r) => [r.dealCount, r.clients]),
        ),
      });
    }
    case 'master-load': {
      const data = await getMasterLoad(periodDays);
      return csvResponse({
        filename: `master-load_${periodSuffix}.csv`,
        content: toCSV(
          ['Мастер', 'Месяц', 'Выездов', 'Площадь, м²'],
          data.map((r) => [r.masterName, fmtMonth(r.month), r.workLogs, r.totalAreaM2]),
        ),
      });
    }
    default:
      return NextResponse.json({ ok: false, error: 'Unknown report' }, { status: 404 });
  }
}
