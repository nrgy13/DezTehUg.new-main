import Link from 'next/link';
import { ArrowRight, Users, Gauge } from 'lucide-react';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { formatRub } from '@/lib/finance/compute';
import type { MonthData, MonthKpis } from '@/lib/finance/monthly';
import { buildMetrics, fmtPct, monthTitle, monthShort, plural, ORDER_FORMS, type Metric } from './format';
import { DeltaBadge, ToneIcon } from './MetricCard';

/**
 * Блоки «Сводки месяца» для дашборда менеджера: компактный пульс текущего месяца
 * и клиенты по статусам. Цифры — из того же getMonthData, что и /manager/summary и Excel.
 */

function PulseItem({ m, extra }: { m: Metric; extra?: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-md border border-gray-100 bg-bg-card/40 px-3 py-2.5">
      <div className="flex items-start justify-between gap-1.5 mb-1">
        <span className="text-[10px] font-orbitron tracking-wider text-content-muted uppercase leading-tight">
          {m.label}
        </span>
        <ToneIcon tone={m.tone} className="w-3.5 h-3.5" />
      </div>
      <div
        className={`text-lg font-orbitron font-bold tabular-nums break-words ${
          m.value === 'н/д' ? 'text-content-muted' : 'text-content-primary'
        }`}
      >
        {m.value}
      </div>
      <div className="text-[11px] mt-0.5 flex flex-wrap items-baseline gap-x-1.5">
        {m.prevLabel ? null : <DeltaBadge delta={m.delta} good={m.deltaGood} />}
        <span className="text-content-muted">
          {m.prevLabel ?? 'было'} {m.prevValue}
        </span>
      </div>
      {extra && <div className="text-[10px] text-content-muted mt-1 leading-snug">{extra}</div>}
    </div>
  );
}

export function MonthPulse({
  cur,
  prev,
  inProgress,
}: {
  cur: MonthKpis;
  prev: MonthKpis;
  inProgress: boolean;
}) {
  const m = buildMetrics(cur, prev, { inProgress });
  return (
    <CyberpunkCard variant="default" hoverEffect={false} className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Gauge className="w-4 h-4 text-poison-green flex-shrink-0" />
          <h2 className="text-base font-orbitron font-semibold tracking-wider text-content-primary uppercase">
            {monthTitle(cur.month)}
          </h2>
          <span className="text-[11px] text-content-muted">Δ к {monthShort(prev.month)}</span>
        </div>
        <Link
          href="/manager/summary"
          className="group inline-flex items-center gap-1 text-xs font-orbitron uppercase tracking-wider text-neon-orange hover:text-poison-green"
        >
          Сводка месяца
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      <div className="grid grid-cols-1 min-[400px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        <PulseItem m={m.revenue} extra={m.revenue.incomplete} />
        <PulseItem
          m={m.masterPay}
          extra={
            cur.masterTopUpKop > 0
              ? `в т.ч. доплата до минималки ${formatRub(cur.masterTopUpKop)}`
              : cur.projectedTopUpKop > 0
                ? `+ доплата до минималки в конце месяца (прогноз) ${formatRub(cur.projectedTopUpKop)}`
                : undefined
          }
        />
        <PulseItem m={m.grossMargin} extra={`маржа ${fmtPct(cur.marginPct)}`} />
        <PulseItem
          m={m.orders}
          extra={
            cur.ordersUnpriced > 0 ? (
              <span className="text-amber-700">
                без цены {cur.ordersUnpriced} {plural(cur.ordersUnpriced, ORDER_FORMS)}
              </span>
            ) : cur.ordersOpen > 0 ? (
              `в плане ещё ${cur.ordersOpen}`
            ) : undefined
          }
        />
        <PulseItem m={m.rescheduleCount} extra={`одобрено ${cur.rescheduleApproved}`} />
      </div>
      {inProgress && (
        <p className="text-[10px] text-content-muted mt-2">
          Месяц идёт — суммы сравниваются с полным прошлым месяцем, светофор по ним выключен.
        </p>
      )}
    </CyberpunkCard>
  );
}

export function ClientsOverview({ data }: { data: MonthData }) {
  const c = data.clients;
  const s = c.byStatus;
  const items: { label: string; value: number; href: string; accent?: string }[] = [
    { label: 'Всего', value: c.total, href: '/manager/clients' },
    { label: 'Активные', value: s.active ?? 0, href: '/manager/clients?status=active', accent: 'text-emerald-700' },
    {
      label: 'Отказались',
      value: s.refused ?? 0,
      href: '/manager/clients?status=refused',
      accent: (s.refused ?? 0) > 0 ? 'text-amber-700' : undefined,
    },
    {
      label: 'Неактивные / заблок.',
      value: (s.inactive ?? 0) + (s.blocked ?? 0),
      href: '/manager/clients?status=inactive',
    },
    {
      label: `Новые за ${monthShort(data.month)}`,
      value: data.kpis.newClients,
      href: '/manager/clients',
      accent: data.kpis.newClients > 0 ? 'text-electric-blue' : undefined,
    },
  ];

  return (
    <CyberpunkCard variant="default" hoverEffect={false} className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-poison-green" />
          <h2 className="text-base font-orbitron font-semibold tracking-wider text-content-primary uppercase">
            Клиенты
          </h2>
        </div>
        <Link
          href="/manager/clients"
          className="group inline-flex items-center gap-1 text-xs text-content-muted hover:text-poison-green"
        >
          Все клиенты
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {items.map((it) => (
          <Link
            key={it.label}
            href={it.href}
            className="min-w-0 rounded-md border border-gray-100 bg-bg-card/40 px-3 py-2.5 transition-colors hover:border-poison-green/60"
          >
            <div className="text-[10px] font-orbitron tracking-wider text-content-muted uppercase leading-tight">
              {it.label}
            </div>
            <div className={`text-lg font-orbitron font-bold tabular-nums mt-1 ${it.accent ?? 'text-content-primary'}`}>
              {it.value}
            </div>
          </Link>
        ))}
      </div>

      {(c.refusedByReason.length > 0 || c.refusedInMonth.length > 0) && (
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {c.refusedByReason.length > 0 && (
            <div className="min-w-0">
              <div className="text-[10px] font-orbitron uppercase tracking-wider text-content-muted mb-1">
                Почему отказались
              </div>
              <ul className="space-y-0.5">
                {c.refusedByReason.map((r) => (
                  <li key={r.reason} className="flex justify-between gap-2">
                    <span className="text-content-secondary">{r.label}</span>
                    <span className="tabular-nums font-medium">{r.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {c.refusedInMonth.length > 0 && (
            <div className="min-w-0">
              <div className="text-[10px] font-orbitron uppercase tracking-wider text-content-muted mb-1">
                Отказались за {monthShort(data.month)}
              </div>
              <ul className="space-y-0.5">
                {c.refusedInMonth.map((r) => (
                  <li key={r.id} className="min-w-0 truncate">
                    <Link href={`/manager/clients/${r.id}`} className="text-content-primary hover:text-neon-orange">
                      {r.name}
                    </Link>
                    <span className="text-content-muted"> — {r.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </CyberpunkCard>
  );
}
