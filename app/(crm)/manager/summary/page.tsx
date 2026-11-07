import Link from 'next/link';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  TrendingUp,
  CalendarDays,
  Wrench,
  CalendarClock,
  Users,
} from 'lucide-react';
import { requireRole } from '@/lib/auth/helpers';
import { PageTitle } from '@/components/crm/PageTitle';
import {
  getMonthlyReport,
  currentMskMonth,
  shiftMonth,
  isValidMonth,
} from '@/lib/finance/monthly';
import { kopToRub } from '@/lib/finance/compute';
import {
  buildMetrics,
  buildVerdict,
  METRIC_GROUPS,
  monthTitle,
  monthShort,
  revenueKnown,
} from './format';
import { MetricCard } from './MetricCard';
import { TrendCharts, type TrendPoint } from './TrendCharts';
import { MonthCalendar } from './MonthCalendar';
import {
  Section,
  VerdictCard,
  TrendTable,
  MastersSection,
  ReschedulesSection,
  ClientsSection,
  HowCalculated,
} from './sections';

export const metadata = { title: 'Сводка месяца — ДезТехЮг CRM' };
export const dynamic = 'force-dynamic';

/** Сегодня по МСК: 'YYYY-MM-DD'. */
function todayMsk(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * «Сводка месяца» (11.2026, запрос Сани): управленческая отчётность «как в SaaS» — вердикт месяца,
 * KPI со сравнением к прошлому месяцу и светофором, тренд за 6 месяцев, календарь выполненных
 * работ, зарплата мастеров, переносы, клиенты. Те же цифры уходят в Excel директору
 * (/api/reports/monthly-xlsx) — источник один: lib/finance/monthly.ts.
 */
export default async function SummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  await requireRole('manager');
  const sp = await searchParams;
  const nowMonth = currentMskMonth();
  const month = isValidMonth(sp.month) ? sp.month : nowMonth;
  const today = todayMsk();

  const { current, previous, trend } = await getMonthlyReport(month);
  const k = current.kpis;
  // Текущий (и будущий) месяц не закончен — накопительные суммы без светофора.
  const inProgress = month >= nowMonth;

  const metrics = buildMetrics(k, previous, { inProgress });
  const verdict = buildVerdict(k, previous, {
    inProgress,
    todayLabel: month === nowMonth ? `${today.slice(8, 10)}.${today.slice(5, 7)}` : undefined,
  });
  const mastersNoRate = current.masters.filter((m) => !m.hasRate && m.ordersCompleted > 0);

  const trendPoints: TrendPoint[] = trend.map((t) => ({
    month: t.month,
    label: monthShort(t.month),
    revenueRub: revenueKnown(t) ? kopToRub(t.revenueKop) : null,
    orders: t.ordersCompleted,
    incomplete: t.ordersUnpriced > 0,
  }));

  const prevM = shiftMonth(month, -1);
  const nextM = shiftMonth(month, 1);
  const canNext = nextM <= nowMonth;
  const pendingResched = current.reschedules.filter((r) => r.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* ─── Заголовок + переключатель месяца + Excel ─────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="min-w-0">
          <PageTitle>Сводка месяца</PageTitle>
          <p className="text-content-muted mt-1 text-sm">
            Итоги месяца с вердиктом, сравнением к прошлому месяцу и трендом за полгода.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-stretch rounded-lg border border-gray-200 bg-white overflow-hidden">
            <Link
              href={`/manager/summary?month=${prevM}`}
              className="px-2.5 py-2 text-content-secondary hover:bg-gray-50 hover:text-neon-orange"
              aria-label={`Предыдущий месяц: ${monthTitle(prevM)}`}
              title={monthTitle(prevM)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Link>
            <span className="px-3 py-2 text-xs font-orbitron uppercase tracking-wider text-content-primary min-w-[8.5rem] text-center border-x border-gray-200 flex items-center justify-center">
              {monthTitle(month)}
            </span>
            {canNext ? (
              <Link
                href={`/manager/summary?month=${nextM}`}
                className="px-2.5 py-2 text-content-secondary hover:bg-gray-50 hover:text-neon-orange"
                aria-label={`Следующий месяц: ${monthTitle(nextM)}`}
                title={monthTitle(nextM)}
              >
                <ChevronRight className="w-4 h-4" />
              </Link>
            ) : (
              <span className="px-2.5 py-2 text-content-muted/40" aria-hidden>
                <ChevronRight className="w-4 h-4" />
              </span>
            )}
          </div>
          {month !== nowMonth && (
            <Link
              href="/manager/summary"
              className="px-3 py-2 text-xs font-orbitron uppercase tracking-wider rounded-lg border border-gray-200 bg-white text-content-secondary hover:text-neon-orange"
            >
              Текущий
            </Link>
          )}
          <a
            href={`/api/reports/monthly-xlsx?month=${month}`}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-orbitron uppercase tracking-wider rounded-lg bg-neon-orange text-white hover:bg-neon-orange/90"
          >
            <Download className="w-3.5 h-3.5" />
            Выгрузить в Excel
          </a>
        </div>
      </div>

      {/* ─── a) Вердикт ───────────────────────────────────────────── */}
      <VerdictCard
        verdict={verdict}
        kpis={k}
        mastersNoRate={mastersNoRate}
        inProgress={inProgress}
        prevMonth={previous.month}
      />

      {/* ─── b) KPI ───────────────────────────────────────────────── */}
      {METRIC_GROUPS.map((g) => (
        <div key={g.title}>
          <h2 className="text-xs font-orbitron font-semibold tracking-wider text-content-muted uppercase mb-2">
            {g.title}
            <span className="normal-case font-sans font-normal tracking-normal ml-2">
              · сравнение с {monthShort(previous.month)}
            </span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {g.keys.map((key) => (
              <MetricCard key={key} m={metrics[key]} />
            ))}
          </div>
        </div>
      ))}

      {/* ─── c) Тренд ─────────────────────────────────────────────── */}
      <Section title="Тренд за 6 месяцев" icon={TrendingUp}>
        <TrendCharts points={trendPoints} selected={month} />
        <TrendTable trend={trend} selected={month} />
      </Section>

      {/* ─── d) Календарь работ ───────────────────────────────────── */}
      <Section
        id="calendar"
        title={`Календарь работ · ${monthTitle(month)}`}
        icon={CalendarDays}
        right={
          <span className="text-[11px] text-content-muted">
            выполнено {k.ordersCompleted}
            {k.ordersOpen > 0 && ` · план/в работе ${k.ordersOpen}`}
            {k.ordersUnpriced > 0 && <span className="text-amber-700"> · без цены {k.ordersUnpriced}</span>}
          </span>
        }
      >
        <MonthCalendar
          orders={current.orders}
          monthStart={current.bounds.start}
          monthEnd={current.bounds.end}
          today={today}
        />
      </Section>

      {/* ─── e) Мастера ───────────────────────────────────────────── */}
      <Section
        title="Мастера: зарплата за месяц"
        icon={Wrench}
        right={
          <Link href="/manager/masters" className="text-[11px] text-content-muted hover:text-neon-orange">
            Ставки мастеров →
          </Link>
        }
      >
        <MastersSection masters={current.masters} inProgress={inProgress} />
      </Section>

      {/* ─── f) Переносы ──────────────────────────────────────────── */}
      <Section
        title="Переносы месяца"
        icon={CalendarClock}
        right={
          current.reschedules.length > 0 ? (
            <span className="text-[11px] text-content-muted">
              запросов {current.reschedules.length} · одобрено {k.rescheduleApproved}
              {pendingResched > 0 && <span className="text-amber-700"> · ждут решения {pendingResched}</span>}
            </span>
          ) : undefined
        }
      >
        <ReschedulesSection items={current.reschedules} />
      </Section>

      {/* ─── g) Клиенты ───────────────────────────────────────────── */}
      <Section title="Клиенты" icon={Users}>
        <ClientsSection data={current} />
      </Section>

      {/* ─── h) Как считается ─────────────────────────────────────── */}
      <HowCalculated />
    </div>
  );
}
