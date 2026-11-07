'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, MapPin, Users, FlaskConical, Wallet, Repeat, FileText, CalendarClock } from 'lucide-react';
import type { MonthOrder } from '@/lib/finance/monthly';
import { formatRub } from '@/lib/finance/compute';
import { unitLabel, formatQuantity } from '@/lib/constants/units';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { WorkOrderPricingButton } from '@/components/crm/WorkOrderPricingButton';
import { WEEKDAYS_SHORT, dayTitle, weekdayMon0, plural } from './format';

type Share = MonthOrder['shares'][number];

const STATUS_LABEL: Record<MonthOrder['status'], string> = {
  completed: 'выполнен',
  in_progress: 'в работе',
  planned: 'план',
};

const BASIS_LABEL: Record<Share['basis'], (s: Share) => string> = {
  percent: (s) => `${s.percent ?? '?'}% от стоимости`,
  override: () => 'ручная сумма',
  no_master_pay: () => 'документальный — мастеру не платится',
  no_price: (s) => `нет цены${s.percent !== null ? ` (ставка ${s.percent}%)` : ''} — 0 до указания цены`,
  no_rate: () => 'ставка не задана',
};

function contractLabel(n: string): string {
  const t = n.trim();
  return /^№/.test(t) ? t : `№ ${t}`;
}

function objectsLabel(o: MonthOrder): string {
  if (o.objects.length === 0) return 'объект не указан';
  if (o.objects.length === 1) return o.objects[0].name;
  return `${o.objects[0].name} +${o.objects.length - 1}`;
}

/** Сумма цен услуг (для незавершённого наряда — справочно, в выручку не идёт). */
function plannedSum(o: MonthOrder): number | null {
  let sum = 0;
  let any = false;
  for (const s of o.services) {
    if (s.priceKop === null) continue;
    sum += s.priceKop;
    any = true;
  }
  return any ? sum : null;
}

/**
 * Месячный календарь работ: сетка Пн–Вс на планшете/десктопе, список по дням на телефоне.
 * Клик по наряду — диалог со всеми деталями и кнопкой «Цена». Выбранный наряд ищем по id в
 * свежих props, чтобы после правки цены (router.refresh) диалог показал новые цифры.
 */
export function MonthCalendar({
  orders,
  monthStart,
  monthEnd,
  today,
}: {
  orders: MonthOrder[];
  /** 'YYYY-MM-01' */
  monthStart: string;
  /** 'YYYY-MM-DD' последнего дня */
  monthEnd: string;
  /** Сегодня по МСК 'YYYY-MM-DD' — подсветка клетки. */
  today: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? (orders.find((o) => o.id === selectedId) ?? null) : null;

  const byDay = useMemo(() => {
    const m = new Map<string, MonthOrder[]>();
    for (const o of orders) {
      const arr = m.get(o.day) ?? [];
      arr.push(o);
      m.set(o.day, arr);
    }
    Array.from(m.values()).forEach((arr) => arr.sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99')));
    return m;
  }, [orders]);

  const prefix = monthStart.slice(0, 8); // 'YYYY-MM-'
  const daysInMonth = Number(monthEnd.slice(8, 10));
  const lead = weekdayMon0(monthStart);
  const cells: (string | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${prefix}${String(d).padStart(2, '0')}`);
  while (cells.length % 7 !== 0) cells.push(null);

  const daysWithOrders = Array.from(byDay.keys()).sort();

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-content-muted mb-3">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm border border-gray-300 bg-white" /> выполнен
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm border border-gray-300 border-l-4 border-l-amber-400 bg-white" /> без цены
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm border border-dashed border-gray-400 bg-white opacity-60" /> план / в работе
        </span>
      </div>

      {orders.length === 0 && (
        <p className="text-sm text-content-muted text-center py-6 italic">Нарядов в этом месяце нет</p>
      )}

      {/* Планшет/десктоп: сетка Пн–Вс */}
      {orders.length > 0 && (
        <div className="hidden md:block rounded-md border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-7 bg-bg-secondary/50 border-b border-gray-200">
            {WEEKDAYS_SHORT.map((w, i) => (
              <div
                key={w}
                className={`px-2 py-1.5 text-[10px] font-orbitron uppercase tracking-wider ${
                  i >= 5 ? 'text-neon-orange' : 'text-content-muted'
                }`}
              >
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              const list = day ? (byDay.get(day) ?? []) : [];
              const weekend = i % 7 >= 5;
              return (
                <div
                  key={day ?? `blank-${i}`}
                  className={`min-w-0 min-h-[5.5rem] border-b border-r border-gray-100 p-1 ${
                    !day ? 'bg-gray-50/70' : weekend ? 'bg-gray-50/40' : 'bg-white'
                  } ${day === today ? 'ring-2 ring-inset ring-poison-green/50' : ''}`}
                >
                  {day && (
                    <>
                      <div className="flex items-center justify-between px-0.5 mb-0.5">
                        <span className={`text-[11px] tabular-nums ${list.length ? 'font-semibold text-content-primary' : 'text-content-muted'}`}>
                          {Number(day.slice(8))}
                        </span>
                        {list.length > 1 && <span className="text-[9px] text-content-muted">{list.length}</span>}
                      </div>
                      <div className="space-y-1">
                        {list.map((o) => (
                          <OrderChip key={o.id} o={o} onOpen={() => setSelectedId(o.id)} />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Телефон: список по дням (только дни с нарядами) */}
      {orders.length > 0 && (
        <div className="md:hidden space-y-3">
          {daysWithOrders.map((day) => (
            <div key={day}>
              <div
                className={`text-[11px] font-orbitron uppercase tracking-wider mb-1 ${
                  day === today ? 'text-poison-green' : 'text-content-muted'
                }`}
              >
                {dayTitle(day)}
              </div>
              <div className="space-y-1.5">
                {(byDay.get(day) ?? []).map((o) => (
                  <OrderRow key={o.id} o={o} onOpen={() => setSelectedId(o.id)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <Dialog open onOpenChange={(open) => !open && setSelectedId(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <OrderDetails o={selected} />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function chipClasses(o: MonthOrder): string {
  const done = o.status === 'completed';
  const unpriced = done && o.costKop === null;
  return [
    'w-full text-left rounded border transition-colors hover:border-poison-green hover:bg-poison-green/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-poison-green/50',
    done ? 'border-gray-200 bg-white' : 'border-dashed border-gray-300 bg-white opacity-60',
    unpriced ? 'border-l-4 border-l-amber-400' : '',
  ].join(' ');
}

function OrderChip({ o, onOpen }: { o: MonthOrder; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className={`${chipClasses(o)} px-1 py-0.5 text-[10px] leading-tight`}>
      <div className="flex items-center gap-1 min-w-0">
        <span className="tabular-nums text-content-muted flex-shrink-0">{o.time ?? '—'}</span>
        <span className="truncate font-medium text-content-primary">{o.clientName}</span>
      </div>
      <div className="truncate text-content-muted">
        {o.status !== 'completed' && <span className="text-neon-orange">план · </span>}
        {objectsLabel(o)}
      </div>
    </button>
  );
}

function OrderRow({ o, onOpen }: { o: MonthOrder; onOpen: () => void }) {
  const done = o.status === 'completed';
  return (
    <button type="button" onClick={onOpen} className={`${chipClasses(o)} px-3 py-2 text-sm`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium text-content-primary truncate">{o.clientName}</div>
          <div className="text-xs text-content-muted truncate">{objectsLabel(o)}</div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-xs tabular-nums text-content-secondary">{o.time ?? '—'}</div>
          <div className={`text-[11px] tabular-nums ${done && o.costKop === null ? 'text-amber-700' : 'text-content-muted'}`}>
            {done ? (o.costKop === null ? 'без цены' : formatRub(o.costKop)) : 'план'}
          </div>
        </div>
      </div>
    </button>
  );
}

function Pill({ children, tone = 'gray' }: { children: React.ReactNode; tone?: 'gray' | 'green' | 'amber' | 'orange' | 'blue' }) {
  const cls = {
    gray: 'bg-gray-50 text-content-secondary border-gray-200',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-800 border-amber-200',
    orange: 'bg-neon-orange/10 text-neon-orange border-neon-orange/30',
    blue: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  }[tone];
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-orbitron uppercase tracking-tight ${cls}`}>
      {children}
    </span>
  );
}

function Block({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-[10px] font-orbitron uppercase tracking-wider text-content-muted mb-1">
        <Icon className="w-3.5 h-3.5" />
        {title}
      </div>
      {children}
    </div>
  );
}

function OrderDetails({ o }: { o: MonthOrder }) {
  const done = o.status === 'completed';
  const multiObject = o.objects.length > 1;
  const planned = done ? null : plannedSum(o);

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-orbitron uppercase tracking-wide pr-6 break-words">{o.clientName}</DialogTitle>
        <DialogDescription>
          {dayTitle(o.day)}
          {o.time ? `, ${o.time} МСК` : ''}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-wrap gap-1.5">
        <Pill tone={done ? 'green' : 'orange'}>{STATUS_LABEL[o.status]}</Pill>
        {done && o.priceStatus === 'none' && <Pill tone="amber">без цены</Pill>}
        {done && o.priceStatus === 'partial' && <Pill tone="amber">цена не у всех услуг</Pill>}
        {o.noMasterPay && (
          <Pill tone="blue">
            <FileText className="w-3 h-3" />
            документальный
          </Pill>
        )}
        <Pill>
          <Repeat className="w-3 h-3" />
          {o.recurring ? 'регулярный договор' : 'разовый'}
        </Pill>
        {o.approvedReschedules > 0 && (
          <Pill tone="amber">
            <CalendarClock className="w-3 h-3" />
            перенос одобрен {o.approvedReschedules} {plural(o.approvedReschedules, ['раз', 'раза', 'раз'])}
          </Pill>
        )}
      </div>

      <div className="space-y-4 text-sm">
        <Block icon={FileText} title="Договор">
          <Link
            href={`/manager/deals/${o.dealId}`}
            className="inline-flex items-center gap-1 text-content-primary hover:text-neon-orange font-medium"
          >
            {contractLabel(o.contractNumber)}
            <ExternalLink className="w-3 h-3" />
          </Link>
        </Block>

        <Block icon={MapPin} title={multiObject ? `Объекты (${o.objects.length})` : 'Объект'}>
          {o.objects.length === 0 ? (
            <span className="text-content-muted">не указан</span>
          ) : (
            <ul className="space-y-1">
              {o.objects.map((ob) => (
                <li key={ob.id} className="min-w-0">
                  <span className="text-content-primary">{ob.name}</span>
                  {ob.address && <span className="block text-xs text-content-muted break-words">{ob.address}</span>}
                </li>
              ))}
            </ul>
          )}
        </Block>

        <Block icon={Wallet} title="Услуги">
          {o.services.length === 0 ? (
            <span className="text-content-muted">услуги не указаны</span>
          ) : (
            <ul className="divide-y divide-gray-100 rounded border border-gray-100">
              {o.services.map((s, i) => {
                const qty = formatQuantity(s.quantity);
                return (
                  <li key={i} className="flex items-start justify-between gap-3 px-2 py-1.5">
                    <div className="min-w-0">
                      <div className="text-content-primary break-words">{s.name}</div>
                      <div className="text-[11px] text-content-muted">
                        {qty ? `${qty} ${unitLabel(s.unit)}` : 'кол-во не указано'}
                        {multiObject && s.objectName ? ` · ${s.objectName}` : ''}
                        {s.priceKop !== null && s.priceSource === 'manual' ? ' · своя цена' : ''}
                        {s.priceKop !== null && s.priceSource === 'contract' ? ' · по договору' : ''}
                      </div>
                    </div>
                    <div
                      className={`text-right tabular-nums whitespace-nowrap ${
                        s.priceKop === null ? 'text-amber-700 text-xs' : 'text-content-primary'
                      }`}
                    >
                      {s.priceKop === null ? 'без цены' : formatRub(s.priceKop)}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Block>

        {o.preparations && (
          <Block icon={FlaskConical} title="Препараты">
            <p className="text-content-secondary whitespace-pre-line break-words">{o.preparations}</p>
          </Block>
        )}

        <Block icon={Users} title={o.crew.length > 1 ? 'Бригада' : 'Мастер'}>
          <span className="text-content-primary">{o.crew.map((c) => c.name).join(', ') || '—'}</span>
        </Block>

        <div className="rounded-md border border-gray-200 bg-bg-secondary/40 p-3 space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[11px] font-orbitron uppercase tracking-wider text-content-muted">
              Стоимость наряда
            </span>
            <span
              className={`font-orbitron font-bold tabular-nums ${
                done && o.costKop === null ? 'text-amber-700' : 'text-content-primary'
              }`}
            >
              {done ? formatRub(o.costKop) : planned !== null ? `${formatRub(planned)} (план)` : 'н/д'}
            </span>
          </div>
          {!done && (
            <p className="text-[11px] text-content-muted">
              Наряд ещё не выполнен — в выручку и зарплату мастеров не входит.
            </p>
          )}
          {done && o.shares.length > 0 && (
            <div>
              <div className="text-[10px] font-orbitron uppercase tracking-wider text-content-muted mb-1">
                Начисления мастерам
              </div>
              <ul className="space-y-1">
                {o.shares.map((s) => (
                  <li key={s.userId} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-content-primary">{s.name}</div>
                      <div
                        className={`text-[11px] ${
                          s.basis === 'no_rate' || s.basis === 'no_price' ? 'text-amber-700' : 'text-content-muted'
                        }`}
                      >
                        {BASIS_LABEL[s.basis](s)}
                        {s.basis === 'no_rate' && (
                          <>
                            {' · '}
                            <Link href="/manager/masters" className="underline hover:text-neon-orange">
                              задать
                            </Link>
                          </>
                        )}
                      </div>
                    </div>
                    <span className="tabular-nums whitespace-nowrap text-content-primary">{formatRub(s.amountKop)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {done && o.costKop === null && (
          <span className="text-xs text-amber-700 mr-auto">Укажите цену — наряд попадёт в выручку и зарплату.</span>
        )}
        <WorkOrderPricingButton workLogId={o.id} label />
      </div>
    </>
  );
}
