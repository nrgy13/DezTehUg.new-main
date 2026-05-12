import Link from 'next/link';
import { requireRole } from '@/lib/auth/helpers';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import {
  Wallet,
  Users,
  Briefcase,
  TrendingUp,
  PieChart as PieIcon,
  Wrench,
  Clock,
  Frown,
  Repeat,
  CalendarRange,
  Download,
} from 'lucide-react';
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

export const metadata = { title: 'Отчёты — ДезТехЮг CRM' };
export const dynamic = 'force-dynamic';

const PERIOD_OPTIONS = [
  { value: '30', label: '30 дней' },
  { value: '90', label: '90 дней' },
  { value: '365', label: 'Год' },
  { value: 'all', label: 'Всё время' },
] as const;

function formatRub(n: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(n);
}

function formatMonth(ym: string): string {
  if (!ym) return '—';
  const [y, m] = ym.split('-');
  const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  return `${months[Number(m) - 1] ?? m} ${y.slice(-2)}`;
}

function parsePeriod(v: string | undefined): number | null {
  if (!v || v === 'all') return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 90;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  await requireRole('manager');
  const sp = await searchParams;
  const periodStr = sp.period ?? '90';
  const periodDays = parsePeriod(periodStr);

  const [
    revenue,
    dealsByMaster,
    conversion,
    managerActivity,
    serviceUsage,
    avgCheque,
    timeToClose,
    lossReasons,
    retention,
    masterLoad,
  ] = await Promise.all([
    getRevenueByMonth(periodDays),
    getDealsByMaster(periodDays),
    getConversionBySource(periodDays),
    getManagerActivity(periodDays),
    getServiceUsage(periodDays),
    getAvgCheque(periodDays),
    getTimeToClose(periodDays),
    getLossReasons(periodDays),
    getClientRetention(periodDays),
    getMasterLoad(periodDays),
  ]);

  const totalRevenue = revenue.reduce((s, r) => s + r.revenue, 0);
  const totalDeals = revenue.reduce((s, r) => s + r.deals, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-orbitron font-bold tracking-wide text-content-primary uppercase">
            Отчёты
          </h1>
          <p className="text-content-muted mt-1 text-sm">
            10 отчётов по доходу, активности, услугам и удержанию клиентов. Экспорт в CSV.
          </p>
        </div>
        <PeriodSwitcher current={periodStr} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Kpi label="Доход за период" value={formatRub(totalRevenue)} icon={Wallet} accent="green" />
        <Kpi label="Завершённых сделок" value={totalDeals} icon={Briefcase} />
        <Kpi
          label="Средний чек"
          value={
            totalDeals > 0
              ? formatRub(Math.round(totalRevenue / totalDeals))
              : '—'
          }
          icon={TrendingUp}
        />
      </div>

      <ReportSection
        title="1. Доход по месяцам"
        icon={Wallet}
        csvName="revenue-by-month"
        period={periodStr}
        emptyHint="Завершённых сделок за период нет"
        rows={revenue}
      >
        <Table
          headers={['Месяц', 'Сделок', 'Доход']}
          rows={revenue.map((r) => [formatMonth(r.month), r.deals, formatRub(r.revenue)])}
        />
      </ReportSection>

      <ReportSection
        title="2. Сделки по мастерам"
        icon={Wrench}
        csvName="deals-by-master"
        period={periodStr}
        emptyHint="Сделок за период нет"
        rows={dealsByMaster}
      >
        <Table
          headers={['Мастер', 'Всего', 'Завершено', 'В работе', 'Доход (завершённые)']}
          rows={dealsByMaster.map((r) => [
            r.masterName,
            r.total,
            r.completed,
            r.active,
            formatRub(r.revenue),
          ])}
        />
      </ReportSection>

      <ReportSection
        title="3. Конверсия по источникам"
        icon={PieIcon}
        csvName="conversion-by-source"
        period={periodStr}
        emptyHint="Лидов за период нет"
        rows={conversion}
      >
        <Table
          headers={['Источник', 'Всего', 'Won', 'Lost', 'Конверсия %']}
          rows={conversion.map((r) => [r.source, r.total, r.won, r.lost, `${r.conversion}%`])}
        />
      </ReportSection>

      <ReportSection
        title="4. Активность менеджеров"
        icon={Users}
        csvName="manager-activity"
        period={periodStr}
        emptyHint="Нет активных менеджеров"
        rows={managerActivity}
      >
        <Table
          headers={['Менеджер', 'Новых лидов', 'Won', 'Lost', 'Закрытых сделок', 'Доход']}
          rows={managerActivity.map((r) => [
            r.managerName,
            r.newLeads,
            r.wonLeads,
            r.lostLeads,
            r.closedDeals,
            formatRub(r.revenue),
          ])}
        />
      </ReportSection>

      <ReportSection
        title="5. Топ услуг"
        icon={PieIcon}
        csvName="service-usage"
        period={periodStr}
        emptyHint="Прайс-позиций за период нет"
        rows={serviceUsage}
      >
        <Table
          headers={['Услуга', 'Позиций', 'Площадь, м²', 'Доход']}
          rows={serviceUsage.map((r) => [
            r.serviceName,
            r.positions,
            r.totalAreaM2,
            formatRub(r.revenue),
          ])}
        />
      </ReportSection>

      <ReportSection
        title="6. Средний чек по месяцам"
        icon={TrendingUp}
        csvName="avg-cheque"
        period={periodStr}
        emptyHint="Данных нет"
        rows={avgCheque}
      >
        <Table
          headers={['Месяц', 'Сделок', 'Средний чек']}
          rows={avgCheque.map((r) => [formatMonth(r.period), r.deals, formatRub(r.avgAmount)])}
        />
      </ReportSection>

      <ReportSection
        title="7. Time-to-close (лид → закрытая сделка)"
        icon={Clock}
        csvName="time-to-close"
        period={periodStr}
        emptyHint="Нет конвертированных лидов в завершённые сделки"
        rows={timeToClose}
      >
        <Table
          headers={['Месяц', 'Сделок', 'Среднее, дн.']}
          rows={timeToClose.map((r) => [formatMonth(r.month), r.samples, r.avgDays])}
        />
      </ReportSection>

      <ReportSection
        title="8. Причины потери лидов"
        icon={Frown}
        csvName="loss-reasons"
        period={periodStr}
        emptyHint="Потерянных лидов нет"
        rows={lossReasons}
      >
        <Table
          headers={['Причина', 'Лидов', '% от потерь']}
          rows={lossReasons.map((r) => [r.reason, r.count, `${r.percent}%`])}
        />
      </ReportSection>

      <ReportSection
        title="9. Retention клиентов (распределение по числу сделок)"
        icon={Repeat}
        csvName="client-retention"
        period={periodStr}
        emptyHint="Клиентов со сделками нет"
        rows={retention}
      >
        <Table
          headers={['Сделок у клиента', 'Клиентов']}
          rows={retention.map((r) => [r.dealCount, r.clients])}
        />
      </ReportSection>

      <ReportSection
        title="10. Нагрузка мастеров (по выездам в месяц)"
        icon={CalendarRange}
        csvName="master-load"
        period={periodStr}
        emptyHint="Записей о выездах за период нет"
        rows={masterLoad}
      >
        <Table
          headers={['Мастер', 'Месяц', 'Выездов', 'Площадь, м²']}
          rows={masterLoad.map((r) => [
            r.masterName,
            formatMonth(r.month),
            r.workLogs,
            r.totalAreaM2,
          ])}
        />
      </ReportSection>
    </div>
  );
}

function PeriodSwitcher({ current }: { current: string }) {
  return (
    <div className="inline-flex rounded-lg border border-gray-200 bg-white overflow-hidden text-xs">
      {PERIOD_OPTIONS.map((opt) => {
        const active = current === opt.value;
        return (
          <Link
            key={opt.value}
            href={`/manager/reports?period=${opt.value}`}
            className={`px-3 py-2 font-orbitron uppercase tracking-wider ${
              active
                ? 'bg-neon-orange text-white'
                : 'text-content-secondary hover:bg-gray-50 hover:text-content-primary'
            }`}
          >
            {opt.label}
          </Link>
        );
      })}
    </div>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  accent = 'muted',
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  accent?: 'muted' | 'green';
}) {
  return (
    <CyberpunkCard variant="default" hoverEffect={false} className="p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-orbitron tracking-wider text-content-muted uppercase">
          {label}
        </span>
        <Icon
          className={`w-4 h-4 ${accent === 'green' ? 'text-emerald-700' : 'text-content-muted'}`}
        />
      </div>
      <div
        className={`text-xl font-orbitron font-bold ${
          accent === 'green' ? 'text-emerald-700' : 'text-content-primary'
        }`}
      >
        {value}
      </div>
    </CyberpunkCard>
  );
}

function ReportSection({
  title,
  icon: Icon,
  csvName,
  period,
  rows,
  emptyHint,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  csvName: string;
  period: string;
  rows: unknown[];
  emptyHint: string;
  children: React.ReactNode;
}) {
  const csvHref = `/api/reports/${csvName}/csv?period=${period}`;
  return (
    <CyberpunkCard variant="default" hoverEffect={false} className="p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-poison-green" />
          <h2 className="text-sm font-orbitron font-semibold tracking-wider uppercase text-content-primary">
            {title}
          </h2>
        </div>
        {rows.length > 0 && (
          <a
            href={csvHref}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-content-muted hover:text-poison-green border border-border/40 rounded"
            title="Скачать CSV"
          >
            <Download className="w-3 h-3" />
            CSV
          </a>
        )}
      </div>
      <div className="p-3">
        {rows.length === 0 ? (
          <p className="text-sm text-content-muted text-center py-6 italic">{emptyHint}</p>
        ) : (
          children
        )}
      </div>
    </CyberpunkCard>
  );
}

function Table({
  headers,
  rows,
}: {
  headers: string[];
  rows: Array<Array<string | number>>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-bg-secondary/50 border-b border-gray-200">
          <tr className="text-[10px] uppercase font-orbitron tracking-wider text-content-muted">
            {headers.map((h, i) => (
              <th key={i} className={`px-3 py-2 ${i === 0 ? 'text-left' : 'text-right'}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, rIdx) => (
            <tr key={rIdx} className="hover:bg-gray-50/50">
              {row.map((cell, cIdx) => (
                <td
                  key={cIdx}
                  className={`px-3 py-2 ${
                    cIdx === 0
                      ? 'text-left text-content-primary'
                      : 'text-right text-content-secondary tabular-nums'
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
