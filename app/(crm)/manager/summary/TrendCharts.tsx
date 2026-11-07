'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';

export type TrendPoint = {
  month: string;
  label: string;
  /** Рубли; null — н/д (наряды были, цен нет). */
  revenueRub: number | null;
  orders: number;
  incomplete: boolean;
};

const REVENUE_COLOR = '#059669'; // emerald-600 — как «деньги» по всей CRM
const ORDERS_COLOR = '#0891b2'; // cyan-600 — как в аналитике воронки

function rubShort(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} млн`;
  if (Math.abs(v) >= 1_000) return `${Math.round(v / 1_000)} тыс`;
  return String(Math.round(v));
}

function rubFull(v: number): string {
  return `${v.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`;
}

/**
 * Тренд за 6 месяцев: ДВА маленьких графика рядом (выручка и число нарядов), а не один с двумя
 * осями — у них разный масштаб, двойная ось врёт о соотношении. Выбранный месяц — ярче.
 */
export function TrendCharts({ points, selected }: { points: TrendPoint[]; selected: string }) {
  const hasNa = points.some((p) => p.revenueRub === null);
  // Ни одного месяца с известной выручкой > 0 — ось «0…4 ₽» бессмысленна, показываем пояснение.
  const noRevenue = !points.some((p) => (p.revenueRub ?? 0) > 0);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <MiniBar
        title="Выручка, ₽"
        seriesName="Выручка"
        empty={
          noRevenue
            ? hasNa
              ? 'Выручка н/д: у выполненных нарядов этих месяцев не указаны цены'
              : 'Выручки за эти месяцы нет'
            : undefined
        }
        color={REVENUE_COLOR}
        data={points.map((p) => ({ label: p.label, month: p.month, value: p.revenueRub, incomplete: p.incomplete }))}
        selected={selected}
        tickFormatter={rubShort}
        valueFormatter={(v, incomplete) => (v === null ? 'н/д (нет цен)' : `${rubFull(v)}${incomplete ? ' — неполная' : ''}`)}
        footnote={hasNa && !noRevenue ? 'Нет столбца — н/д: у выполненных нарядов месяца не указаны цены.' : undefined}
      />
      <MiniBar
        title="Нарядов выполнено"
        seriesName="Нарядов"
        color={ORDERS_COLOR}
        data={points.map((p) => ({ label: p.label, month: p.month, value: p.orders, incomplete: false }))}
        selected={selected}
        tickFormatter={(v) => String(v)}
        valueFormatter={(v) => (v === null ? 'н/д' : String(v))}
      />
    </div>
  );
}

type Datum = { label: string; month: string; value: number | null; incomplete: boolean };

function MiniBar({
  title,
  seriesName,
  empty,
  color,
  data,
  selected,
  tickFormatter,
  valueFormatter,
  footnote,
}: {
  title: string;
  /** Имя ряда в тултипе (без единиц — они уже в значении). */
  seriesName: string;
  /** Текст вместо графика, когда показывать нечего. */
  empty?: string;
  color: string;
  data: Datum[];
  selected: string;
  tickFormatter: (v: number) => string;
  valueFormatter: (v: number | null, incomplete: boolean) => string;
  footnote?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-orbitron tracking-wider text-content-muted uppercase mb-2">{title}</div>
      {empty ? (
        <div className="h-[180px] flex items-center justify-center rounded border border-dashed border-gray-200 px-4 text-center text-xs text-content-muted">
          {empty}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef0f2" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
            <YAxis
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              tickLine={false}
              axisLine={false}
              width={44}
              tickFormatter={tickFormatter}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ fill: 'rgba(0,0,0,0.04)' }}
              formatter={(value, _name, item) => {
                const d = item?.payload as Datum | undefined;
                const v = typeof value === 'number' ? value : null;
                return [valueFormatter(v, d?.incomplete ?? false), seriesName];
              }}
              labelStyle={{ fontSize: 12 }}
              contentStyle={{ fontSize: 12, borderRadius: 6 }}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={36}>
              {data.map((d) => (
                <Cell key={d.month} fill={color} fillOpacity={d.month === selected ? 1 : 0.45} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
      {footnote && <p className="text-[10px] text-content-muted mt-1">{footnote}</p>}
    </div>
  );
}
