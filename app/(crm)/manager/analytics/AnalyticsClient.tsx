'use client';

import { useRouter } from 'next/navigation';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from 'recharts';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import type {
  FunnelStat,
  AvgTimeRow,
  LossReasonRow,
  MonthlyRow,
} from '@/lib/analytics/funnel';

type Props = {
  filters: { period: string; manager: string; source: string };
  isAdmin: boolean;
  periodOptions: { value: string; label: string }[];
  sourceOptions: { value: string; label: string }[];
  managerOptions: { id: string; name: string }[];
  funnelStats: FunnelStat[];
  avgTime: AvgTimeRow[];
  lossReasons: LossReasonRow[];
  monthly: MonthlyRow[];
};

const PIE_COLORS = ['#dc2626', '#f59e0b', '#0891b2', '#7c3aed', '#059669', '#9ca3af', '#ef4444', '#3b82f6', '#6b7280'];

export function AnalyticsClient(props: Props) {
  const router = useRouter();
  const { filters, isAdmin, periodOptions, sourceOptions, managerOptions } = props;

  function updateFilter(key: 'period' | 'manager' | 'source', value: string) {
    const params = new URLSearchParams();
    const next = { ...filters, [key]: value };
    if (next.period && next.period !== '90') params.set('period', next.period);
    if (next.manager) params.set('manager', next.manager);
    if (next.source) params.set('source', next.source);
    const qs = params.toString();
    router.push(qs ? `/manager/analytics?${qs}` : '/manager/analytics');
  }

  const totalLost = props.lossReasons.reduce((s, r) => s + r.count, 0);

  return (
    <>
      {/* ─── Фильтры ──────────────────────────────────────────── */}
      <CyberpunkCard variant="default" hoverEffect={false} className="p-4">
        <div className="flex flex-wrap items-end gap-4">
          <FilterSelect
            label="Период"
            value={filters.period}
            options={periodOptions}
            onChange={(v) => updateFilter('period', v)}
          />
          {isAdmin && (
            <FilterSelect
              label="Менеджер"
              value={filters.manager}
              options={[
                { value: '', label: 'Все менеджеры' },
                ...managerOptions.map((m) => ({ value: m.id, label: m.name })),
              ]}
              onChange={(v) => updateFilter('manager', v)}
            />
          )}
          <FilterSelect
            label="Источник"
            value={filters.source}
            options={sourceOptions}
            onChange={(v) => updateFilter('source', v)}
          />
        </div>
      </CyberpunkCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ─── Воронка с конверсиями ─────────────────────────── */}
        <CyberpunkCard variant="default" hoverEffect={false} className="p-4">
          <h2 className="text-base font-orbitron font-semibold tracking-wider text-content-primary mb-3 uppercase">
            Воронка
          </h2>
          {props.funnelStats.every((s) => s.count === 0) ? (
            <EmptyState />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={props.funnelStats}
                  layout="vertical"
                  margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="label" type="category" width={140} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#0891b2" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-1 text-xs text-content-secondary">
                {props.funnelStats.map((s, i) => (
                  <div key={s.status} className="flex justify-between border-b border-gray-100 py-1">
                    <span>
                      {i + 1}. <strong>{s.label}</strong>: {s.count}
                    </span>
                    {s.conversionFromPrevious != null && (
                      <span
                        className={
                          s.conversionFromPrevious < 50
                            ? 'text-red-600'
                            : s.conversionFromPrevious < 80
                            ? 'text-amber-600'
                            : 'text-emerald-700'
                        }
                      >
                        {s.conversionFromPrevious}% от пред.
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </CyberpunkCard>

        {/* ─── Среднее время в стадии ────────────────────────── */}
        <CyberpunkCard variant="default" hoverEffect={false} className="p-4">
          <h2 className="text-base font-orbitron font-semibold tracking-wider text-content-primary mb-3 uppercase">
            Среднее время в стадии (дней)
          </h2>
          {props.avgTime.every((s) => s.samples === 0) ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={props.avgTime}
                layout="vertical"
                margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="label" type="category" width={140} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value: number, _name: string, item: { payload: AvgTimeRow }) => [
                    `${value} дн (${item.payload.samples} переходов)`,
                    'Среднее',
                  ]}
                />
                <Bar dataKey="avgDays" fill="#7c3aed" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CyberpunkCard>

        {/* ─── Причины потери ─────────────────────────────────── */}
        <CyberpunkCard variant="default" hoverEffect={false} className="p-4">
          <h2 className="text-base font-orbitron font-semibold tracking-wider text-content-primary mb-3 uppercase">
            Причины потери {totalLost > 0 && <span className="text-content-muted text-xs ml-2">(всего {totalLost})</span>}
          </h2>
          {props.lossReasons.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={props.lossReasons}
                  dataKey="count"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={(p: { label: string; percentage: number }) => `${p.percentage}%`}
                >
                  {props.lossReasons.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CyberpunkCard>

        {/* ─── Динамика по месяцам ────────────────────────────── */}
        <CyberpunkCard variant="default" hoverEffect={false} className="p-4">
          <h2 className="text-base font-orbitron font-semibold tracking-wider text-content-primary mb-3 uppercase">
            Динамика по месяцам
          </h2>
          {props.monthly.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={props.monthly} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="total" name="Всего лидов" stroke="#0891b2" strokeWidth={2} />
                <Line type="monotone" dataKey="won" name="Выигранные" stroke="#059669" strokeWidth={2} />
                <Line type="monotone" dataKey="lost" name="Потерянные" stroke="#dc2626" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CyberpunkCard>
      </div>
    </>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-orbitron tracking-wider text-content-muted uppercase">
        {label}
      </span>
      <select
        className="px-3 py-1.5 border border-gray-300 rounded text-sm bg-white text-content-primary focus:outline-none focus:border-poison-green"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function EmptyState() {
  return (
    <div className="flex items-center justify-center h-[280px] text-sm text-content-muted">
      Нет данных за выбранный период
    </div>
  );
}
