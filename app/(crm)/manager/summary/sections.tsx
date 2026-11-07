import Link from 'next/link';
import { AlertTriangle, UserX } from 'lucide-react';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { formatRub, deltaPct } from '@/lib/finance/compute';
import type { MonthData, MonthKpis, MonthMasterRow, MonthReschedule } from '@/lib/finance/monthly';
import {
  TONE_CLASSES,
  fmtMskDate,
  fmtMskDateTime,
  fmtPct,
  monthLoc,
  monthShort,
  moneyOrNull,
  plural,
  ORDER_FORMS,
  type Verdict,
} from './format';
import { DeltaBadge } from './MetricCard';

// ─── Обёртка секции ───────────────────────────────────────────────

export function Section({
  id,
  title,
  icon: Icon,
  right,
  children,
}: {
  id?: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <CyberpunkCard id={id} variant="default" hoverEffect={false} className="p-0 overflow-hidden scroll-mt-20">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="w-4 h-4 text-poison-green flex-shrink-0" />
          <h2 className="text-sm font-orbitron font-semibold tracking-wider uppercase text-content-primary">
            {title}
          </h2>
        </div>
        {right}
      </div>
      <div className="p-3 sm:p-4">{children}</div>
    </CyberpunkCard>
  );
}

const thCls = 'px-3 py-2 text-[10px] uppercase font-orbitron tracking-wider text-content-muted';

// ─── Вердикт ──────────────────────────────────────────────────────

export function VerdictCard({
  verdict,
  kpis,
  mastersNoRate,
  inProgress,
  prevMonth,
}: {
  verdict: Verdict;
  kpis: MonthKpis;
  mastersNoRate: MonthMasterRow[];
  inProgress: boolean;
  prevMonth: string;
}) {
  const t = TONE_CLASSES[verdict.tone];
  return (
    <CyberpunkCard variant="default" hoverEffect={false} className={`p-4 sm:p-5 border-l-4 ${t.bar}`}>
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span className="text-[11px] font-orbitron tracking-wider text-content-muted uppercase">Вердикт месяца</span>
        <span
          className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-orbitron uppercase tracking-tight ${t.soft} ${t.text}`}
        >
          {verdict.badge}
        </span>
      </div>
      <p className="text-sm sm:text-base text-content-primary leading-relaxed">{verdict.text}</p>

      {kpis.ordersUnpriced > 0 && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
          <div>
            <b>
              {kpis.ordersUnpriced} {plural(kpis.ordersUnpriced, ORDER_FORMS)} без цены
            </b>{' '}
            из {kpis.ordersCompleted} выполненных — их сумма не попала в выручку и маржу, а мастерам по % за них
            начислено 0. Укажите цену кнопкой «Цена» у наряда — в{' '}
            <a href="#calendar" className="underline font-medium hover:text-neon-orange">
              календаре работ
            </a>{' '}
            ниже такие наряды отмечены жёлтой полосой.
          </div>
        </div>
      )}

      {mastersNoRate.length > 0 && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <UserX className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            Не задана ставка: <b>{mastersNoRate.map((m) => m.name).join(', ')}</b> — за их наряды начислено 0.{' '}
            <Link href="/manager/masters" className="underline font-medium hover:text-neon-orange">
              Задать ставки →
            </Link>
          </div>
        </div>
      )}

      {inProgress && (
        <p className="text-[11px] text-content-muted mt-3">
          Месяц не закончен: суммы сравниваются с полным прошлым месяцем ({monthShort(prevMonth)}) — светофор по
          ним выключен (серый), Δ справочно. Доплата до минималки посчитана на сегодня.
        </p>
      )}
    </CyberpunkCard>
  );
}

// ─── Тренд: таблица ───────────────────────────────────────────────

export function TrendTable({ trend, selected }: { trend: MonthKpis[]; selected: string }) {
  const rows = trend.map((k, i) => {
    const prev = i > 0 ? trend[i - 1] : null;
    const rev = moneyOrNull(k, k.revenueKop);
    const revPrev = prev ? moneyOrNull(prev, prev.revenueKop) : null;
    const d = rev !== null && revPrev !== null ? deltaPct(rev, revPrev) : null;
    const delta = d === null ? null : d > 0 ? `+${d}%` : d < 0 ? `−${Math.abs(d)}%` : '0%';
    return { k, rev, delta, deltaGood: d === null || d === 0 ? null : d > 0 };
  });
  const anyIncomplete = trend.some((k) => k.ordersUnpriced > 0 && moneyOrNull(k, k.revenueKop) !== null);

  return (
    <div className="mt-4">
      <table className="hidden md:table w-full text-sm">
        <thead className="bg-bg-secondary/50 border-b border-gray-200">
          <tr>
            <th className={`${thCls} text-left`}>Месяц</th>
            <th className={`${thCls} text-right`}>Выручка</th>
            <th className={`${thCls} text-right`}>Δ выручки</th>
            <th className={`${thCls} text-right`}>Нарядов</th>
            <th className={`${thCls} text-right`}>Без цены</th>
            <th className={`${thCls} text-right`}>Ср. чек</th>
            <th className={`${thCls} text-right`}>Маржа</th>
            <th className={`${thCls} text-right`}>Выплаты</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map(({ k, rev, delta, deltaGood }) => (
            <tr key={k.month} className={k.month === selected ? 'bg-poison-green/5 font-medium' : 'hover:bg-gray-50/50'}>
              <td className="px-3 py-2 text-left">
                <Link href={`/manager/summary?month=${k.month}`} className="hover:text-neon-orange">
                  {monthShort(k.month)}
                </Link>
              </td>
              <td className={`px-3 py-2 text-right tabular-nums ${rev === null ? 'text-content-muted' : ''}`}>
                {formatRub(rev)}
                {rev !== null && k.ordersUnpriced > 0 && <span className="text-amber-600">*</span>}
              </td>
              <td className="px-3 py-2 text-right text-xs">
                <DeltaBadge delta={delta} good={deltaGood} />
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{k.ordersCompleted}</td>
              <td className={`px-3 py-2 text-right tabular-nums ${k.ordersUnpriced > 0 ? 'text-amber-700' : 'text-content-muted'}`}>
                {k.ordersUnpriced}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{formatRub(k.avgTicketKop)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtPct(k.marginPct)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatRub(k.masterPayKop)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="md:hidden divide-y divide-gray-100 rounded border border-gray-100">
        {rows.map(({ k, rev, delta, deltaGood }) => (
          <Link
            key={k.month}
            href={`/manager/summary?month=${k.month}`}
            className={`block px-3 py-2 ${k.month === selected ? 'bg-poison-green/5' : ''}`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium text-content-primary">{monthShort(k.month)}</span>
              <span className={`tabular-nums ${rev === null ? 'text-content-muted' : 'text-content-primary'}`}>
                {formatRub(rev)}
                {rev !== null && k.ordersUnpriced > 0 && <span className="text-amber-600">*</span>}
              </span>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-[11px] text-content-muted">
              <span>
                нарядов {k.ordersCompleted}
                {k.ordersUnpriced > 0 && <span className="text-amber-700"> · без цены {k.ordersUnpriced}</span>}
                {' · '}маржа {fmtPct(k.marginPct)}
              </span>
              <DeltaBadge delta={delta} good={deltaGood} />
            </div>
          </Link>
        ))}
      </div>
      {anyIncomplete && (
        <p className="text-[10px] text-content-muted mt-2">* выручка неполная — часть нарядов месяца без цены.</p>
      )}
    </div>
  );
}

// ─── Мастера ──────────────────────────────────────────────────────

function NoRateLink() {
  return (
    <Link href="/manager/masters" className="text-red-600 underline hover:text-neon-orange whitespace-nowrap">
      не задана
    </Link>
  );
}

/** Выручка по нарядам мастера: н/д, если все его наряды без цены. */
function masterRevenue(m: MonthMasterRow): string {
  return m.ordersCompleted > 0 && m.ordersUnpriced === m.ordersCompleted ? 'н/д' : formatRub(m.revenueKop);
}

export function MastersSection({ masters, inProgress }: { masters: MonthMasterRow[]; inProgress: boolean }) {
  if (masters.length === 0) {
    return <p className="text-sm text-content-muted text-center py-6 italic">Мастеров с нарядами или ставкой нет</p>;
  }
  const total = masters.reduce(
    (s, m) => ({
      orders: s.orders + m.ordersCompleted,
      earned: s.earned + m.earnedKop,
      pay: s.pay + m.payKop,
      topUp: s.topUp + m.topUpKop,
      resched: s.resched + m.rescheduleRequests,
    }),
    { orders: 0, earned: 0, pay: 0, topUp: 0, resched: 0 },
  );

  return (
    <>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-bg-secondary/50 border-b border-gray-200">
            <tr>
              <th className={`${thCls} text-left`}>Мастер</th>
              <th className={`${thCls} text-right`}>Ставка</th>
              <th className={`${thCls} text-right`}>Нарядов</th>
              <th className={`${thCls} text-right`}>Выручка по нарядам</th>
              <th className={`${thCls} text-right`}>Набрал по %</th>
              <th className={`${thCls} text-right`}>Минималка</th>
              <th className={`${thCls} text-right`}>К выплате</th>
              <th className={`${thCls} text-right`}>Доплата орг.</th>
              <th className={`${thCls} text-right`}>Переносов</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {masters.map((m) => (
              <tr key={m.userId} className="hover:bg-gray-50/50">
                <td className="px-3 py-2 text-left text-content-primary">
                  {m.name}
                  {!m.isActive && <span className="text-[10px] text-content-muted ml-1">(неактивен)</span>}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {m.hasRate ? `${m.percent ?? 0}%` : <NoRateLink />}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {m.ordersCompleted}
                  {m.ordersUnpriced > 0 && (
                    <span className="block text-[10px] text-amber-700">без цены {m.ordersUnpriced}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{masterRevenue(m)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatRub(m.earnedKop)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-content-secondary">
                  {m.minKop > 0 ? formatRub(m.minKop) : '—'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold text-content-primary">
                  {formatRub(m.payKop)}
                </td>
                <td className={`px-3 py-2 text-right tabular-nums ${m.topUpKop > 0 ? 'text-amber-700' : 'text-content-muted'}`}>
                  {m.topUpKop > 0 ? formatRub(m.topUpKop) : '—'}
                </td>
                <td className={`px-3 py-2 text-right tabular-nums ${m.rescheduleRequests > 0 ? 'text-amber-700' : 'text-content-muted'}`}>
                  {m.rescheduleRequests}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-gray-200 bg-bg-secondary/30 font-semibold">
            <tr>
              <td className="px-3 py-2 text-left">Итого</td>
              <td />
              <td className="px-3 py-2 text-right tabular-nums">{total.orders}</td>
              <td />
              <td className="px-3 py-2 text-right tabular-nums">{formatRub(total.earned)}</td>
              <td />
              <td className="px-3 py-2 text-right tabular-nums">{formatRub(total.pay)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{total.topUp > 0 ? formatRub(total.topUp) : '—'}</td>
              <td className="px-3 py-2 text-right tabular-nums">{total.resched}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="md:hidden divide-y divide-gray-100 rounded border border-gray-100">
        {masters.map((m) => (
          <div key={m.userId} className="px-3 py-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium text-content-primary">
                  {m.name}
                  {!m.isActive && <span className="text-[10px] text-content-muted ml-1">(неактивен)</span>}
                </div>
                <div className="text-[11px] text-content-muted">
                  ставка {m.hasRate ? `${m.percent ?? 0}%` : <NoRateLink />}
                  {m.minKop > 0 && ` · минималка ${formatRub(m.minKop)}`}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="font-orbitron font-bold tabular-nums text-content-primary">{formatRub(m.payKop)}</div>
                <div className="text-[10px] text-content-muted">к выплате</div>
              </div>
            </div>
            <div className="mt-1 text-[11px] text-content-secondary leading-snug">
              нарядов {m.ordersCompleted}
              {m.ordersUnpriced > 0 && <span className="text-amber-700"> (без цены {m.ordersUnpriced})</span>}
              {' · '}выручка {masterRevenue(m)} · набрал {formatRub(m.earnedKop)}
              {m.topUpKop > 0 && <span className="text-amber-700"> · доплата {formatRub(m.topUpKop)}</span>}
              {m.rescheduleRequests > 0 && <span className="text-amber-700"> · переносов {m.rescheduleRequests}</span>}
            </div>
          </div>
        ))}
        <div className="px-3 py-2 flex justify-between text-sm font-semibold bg-bg-secondary/30">
          <span>Итого к выплате</span>
          <span className="tabular-nums">{formatRub(total.pay)}</span>
        </div>
      </div>

      <p className="text-[10px] text-content-muted mt-2">
        К выплате = max(набрал по %, минималка). Выручка по нарядам у напарников считается каждому полностью.
        {inProgress && ' Месяц идёт — доплата до минималки уменьшится по мере работы.'}
      </p>
    </>
  );
}

// ─── Переносы ─────────────────────────────────────────────────────

const RESCHED_STATUS: Record<MonthReschedule['status'], { label: string; cls: string }> = {
  pending: { label: 'ждёт решения', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  approved: { label: 'одобрен', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected: { label: 'отклонён', cls: 'bg-red-50 text-red-700 border-red-200' },
  cancelled: { label: 'отозван', cls: 'bg-gray-50 text-content-muted border-gray-200' },
};

function ReschedStatus({ r }: { r: MonthReschedule }) {
  const s = RESCHED_STATUS[r.status];
  return (
    <span className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-orbitron uppercase tracking-tight ${s.cls}`}>
      {s.label}
    </span>
  );
}

export function ReschedulesSection({ items }: { items: MonthReschedule[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-content-muted text-center py-6 italic">Запросов на перенос в этом месяце не было</p>;
  }
  return (
    <>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-bg-secondary/50 border-b border-gray-200">
            <tr>
              <th className={`${thCls} text-left`}>Когда</th>
              <th className={`${thCls} text-left`}>Мастер</th>
              <th className={`${thCls} text-left`}>Клиент · объект</th>
              <th className={`${thCls} text-left`}>Было → просил</th>
              <th className={`${thCls} text-left`}>Причина</th>
              <th className={`${thCls} text-left`}>Решение</th>
              <th className={`${thCls} text-left`}>Комментарий</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 align-top">
            {items.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50/50">
                <td className="px-3 py-2 tabular-nums whitespace-nowrap text-content-secondary">{fmtMskDateTime(r.createdAt)}</td>
                <td className="px-3 py-2 text-content-primary">{r.masterName}</td>
                <td className="px-3 py-2">
                  {r.clientName}
                  {r.objectName && <span className="text-content-muted"> · {r.objectName}</span>}
                </td>
                <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                  {fmtMskDateTime(r.fromAt)} → <b>{fmtMskDateTime(r.toAt)}</b>
                </td>
                <td className="px-3 py-2 text-content-secondary max-w-[16rem] break-words">{r.reason}</td>
                <td className="px-3 py-2">
                  <ReschedStatus r={r} />
                  {r.decidedByName && r.status !== 'cancelled' && (
                    <div className="text-[10px] text-content-muted mt-0.5">
                      {r.decidedByName}, {fmtMskDateTime(r.decidedAt)}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-content-secondary max-w-[14rem] break-words">{r.decisionComment ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden divide-y divide-gray-100 rounded border border-gray-100">
        {items.map((r) => (
          <div key={r.id} className="px-3 py-2.5 space-y-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium text-content-primary">{r.masterName}</div>
                <div className="text-xs text-content-muted break-words">
                  {r.clientName}
                  {r.objectName && ` · ${r.objectName}`}
                </div>
              </div>
              <ReschedStatus r={r} />
            </div>
            <div className="text-xs tabular-nums text-content-secondary">
              {fmtMskDateTime(r.fromAt)} → <b>{fmtMskDateTime(r.toAt)}</b>
              <span className="text-content-muted"> · запрос {fmtMskDateTime(r.createdAt)}</span>
            </div>
            <div className="text-xs text-content-secondary break-words">Причина: {r.reason}</div>
            {r.decisionComment && (
              <div className="text-xs text-content-muted break-words">Ответ: {r.decisionComment}</div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

// ─── Клиенты ──────────────────────────────────────────────────────

/** Подписи статусов клиента (как в ClientStatusBadge), в порядке показа. */
export const CLIENT_STATUS_ORDER: { key: string; label: string; cls: string }[] = [
  { key: 'active', label: 'Активные', cls: 'bg-poison-green' },
  { key: 'refused', label: 'Отказались', cls: 'bg-amber-400' },
  { key: 'inactive', label: 'Неактивные', cls: 'bg-gray-300' },
  { key: 'blocked', label: 'Заблокированы', cls: 'bg-red-400' },
  { key: 'lead', label: 'Лиды', cls: 'bg-electric-blue' },
];

function SubTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-orbitron uppercase tracking-wider text-content-muted mb-1.5">{children}</div>
  );
}

export function ClientsSection({ data }: { data: MonthData }) {
  const c = data.clients;
  const k = data.kpis;
  const revenueKnownNow = moneyOrNull(k, k.revenueKop) !== null;
  const top = c.topClients.slice(0, 10);
  // Наряды без цены по клиентам: у клиента, где ВСЕ наряды без цены, выручка — н/д, а не 0 ₽.
  const unpricedByClient = new Map<string, number>();
  for (const o of data.orders) {
    if (o.status === 'completed' && o.costKop === null) {
      unpricedByClient.set(o.clientId, (unpricedByClient.get(o.clientId) ?? 0) + 1);
    }
  }
  const otherStatuses = Object.keys(c.byStatus).filter((s) => !CLIENT_STATUS_ORDER.some((o) => o.key === s));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <div className="min-w-0">
          <SubTitle>По статусам · всего {c.total}</SubTitle>
          <ul className="space-y-1 text-sm">
            {CLIENT_STATUS_ORDER.map((s) => (
              <li key={s.key} className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-content-secondary">
                  <span className={`w-2 h-2 rounded-full ${s.cls}`} />
                  {s.label}
                </span>
                <span className="tabular-nums text-content-primary font-medium">{c.byStatus[s.key] ?? 0}</span>
              </li>
            ))}
            {otherStatuses.map((s) => (
              <li key={s} className="flex items-center justify-between gap-2">
                <span className="text-content-secondary">{s}</span>
                <span className="tabular-nums">{c.byStatus[s]}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="min-w-0">
          <SubTitle>Отказы по причинам (всего)</SubTitle>
          {c.refusedByReason.length === 0 ? (
            <p className="text-sm text-content-muted italic">Отказавшихся клиентов нет</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {c.refusedByReason.map((r) => (
                <li key={r.reason} className="flex items-center justify-between gap-2">
                  <span className="text-content-secondary">{r.label}</span>
                  <span className="tabular-nums font-medium">{r.count}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3">
            <SubTitle>Отказались в {monthLoc(data.month)}</SubTitle>
            {c.refusedInMonth.length === 0 ? (
              <p className="text-sm text-content-muted italic">Никто</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {c.refusedInMonth.map((r) => (
                  <li key={r.id} className="min-w-0">
                    <Link href={`/manager/clients/${r.id}`} className="text-content-primary hover:text-neon-orange">
                      {r.name}
                    </Link>
                    <span className="block text-[11px] text-content-muted break-words">
                      {fmtMskDate(r.at)} · {r.reason}
                      {r.comment ? ` — ${r.comment}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="min-w-0">
          <SubTitle>
            Новые в {monthLoc(data.month)} · {c.newInMonth.length}
          </SubTitle>
          {c.newInMonth.length === 0 ? (
            <p className="text-sm text-content-muted italic">Новых клиентов нет</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {c.newInMonth.map((n) => (
                <li key={n.id} className="flex items-baseline justify-between gap-2 min-w-0">
                  <Link href={`/manager/clients/${n.id}`} className="truncate text-content-primary hover:text-neon-orange">
                    {n.name}
                  </Link>
                  <span className="text-[11px] text-content-muted tabular-nums flex-shrink-0">{fmtMskDate(n.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div>
        <SubTitle>
          Топ клиентов по выручке{c.topClients.length > top.length ? ` (10 из ${c.topClients.length})` : ''}
        </SubTitle>
        {top.length === 0 ? (
          <p className="text-sm text-content-muted italic">Выполненных нарядов в месяце нет</p>
        ) : (
          <>
            <ul className="divide-y divide-gray-100 rounded border border-gray-100 text-sm">
              {top.map((t, i) => {
                const unpriced = unpricedByClient.get(t.id) ?? 0;
                const known = revenueKnownNow && unpriced < t.orders;
                const share = known && k.revenueKop > 0 ? Math.round((t.revenueKop / k.revenueKop) * 1000) / 10 : null;
                return (
                  <li key={t.id} className="flex items-center gap-3 px-3 py-2">
                    <span className="w-5 text-right text-[11px] text-content-muted tabular-nums flex-shrink-0">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <Link href={`/manager/clients/${t.id}`} className="block truncate text-content-primary hover:text-neon-orange">
                        {t.name}
                      </Link>
                      <span className="text-[11px] text-content-muted">
                        {t.orders} {plural(t.orders, ORDER_FORMS)}
                        {unpriced > 0 && <span className="text-amber-700"> · без цены {unpriced}</span>}
                      </span>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className={`tabular-nums ${known ? 'text-content-primary' : 'text-content-muted'}`}>
                        {known ? formatRub(t.revenueKop) : 'н/д'}
                        {known && unpriced > 0 && <span className="text-amber-600">*</span>}
                      </div>
                      <div className="text-[11px] text-content-muted tabular-nums">{fmtPct(share)}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
            {!revenueKnownNow ? (
              <p className="text-[10px] text-content-muted mt-1.5">
                Цен у нарядов нет — порядок по числу нарядов, выручка и доли н/д.
              </p>
            ) : (
              top.some((t) => (unpricedByClient.get(t.id) ?? 0) > 0) && (
                <p className="text-[10px] text-content-muted mt-1.5">
                  * часть нарядов клиента без цены — сумма неполная; н/д — без цены все наряды клиента.
                </p>
              )
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Как считается ────────────────────────────────────────────────

export function HowCalculated() {
  return (
    <div className="text-[11px] text-content-muted leading-relaxed space-y-1 px-1">
      <div className="font-orbitron uppercase tracking-wider text-[10px]">Как считается</div>
      <p>
        Деньги — только по <b>выполненным</b> нарядам, по дате выполнения (МСК). Стоимость наряда = сумма цен его
        услуг; наряд без единой цены — «без цены» (н/д), а не 0 ₽. Мастеру — его % от стоимости наряда (в бригаде —
        каждому от полной), за месяц — не меньше минималки; «документальный» наряд мастеру не оплачивается.
      </p>
      <p>
        Регулярная выручка — договоры с периодичностью в прайсе; «по заявке» и без периодичности — разовая.
        «В назначенный день» — наряд начат в тот же день (МСК), на который был запланирован. Отток = отказались в
        месяце / (активные + отказались в месяце). Δ для сумм и штук — в % к прошлому месяцу, для процентов — в
        процентных пунктах (п.п.).
      </p>
    </div>
  );
}
