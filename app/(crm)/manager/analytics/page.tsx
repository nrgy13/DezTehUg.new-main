import { requireRole } from '@/lib/auth/helpers';
import {
  getFunnelStats,
  getAvgTimeInStage,
  getLossReasons,
  getMonthlyConversions,
  getManagerList,
  type AnalyticsFilters,
} from '@/lib/analytics/funnel';
import { AnalyticsClient } from './AnalyticsClient';

export const metadata = { title: 'Аналитика воронки — ДезТехЮг CRM' };
export const dynamic = 'force-dynamic';

const SOURCE_OPTIONS = [
  { value: '', label: 'Все источники' },
  { value: 'website', label: 'Сайт' },
  { value: 'phone', label: 'Звонок' },
  { value: 'manager', label: 'Менеджер' },
  { value: 'recurring', label: 'Повторный' },
  { value: 'referral', label: 'Рекомендация' },
  { value: 'other', label: 'Другое' },
];

const PERIOD_OPTIONS = [
  { value: '30', label: '30 дней' },
  { value: '90', label: '90 дней' },
  { value: '365', label: 'Год' },
  { value: '0', label: 'Весь период' },
];

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: { period?: string; manager?: string; source?: string };
}) {
  const user = await requireRole('manager');

  // Менеджер видит только себя (если он не admin). Admin может фильтровать
  // по любому менеджеру через searchParams.manager.
  const periodRaw = searchParams.period ?? '90';
  const periodDays = periodRaw === '0' ? null : Number(periodRaw) || 90;
  const requestedManager = searchParams.manager || null;
  const managerId = user.role === 'admin' ? requestedManager : user.id;
  const source = searchParams.source || null;

  const filters: AnalyticsFilters = {
    periodDays,
    managerId,
    source,
  };

  const [funnelStats, avgTime, lossReasons, monthly, managerList] = await Promise.all([
    getFunnelStats(filters),
    getAvgTimeInStage(filters),
    getLossReasons(filters),
    getMonthlyConversions(filters),
    user.role === 'admin' ? getManagerList() : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-orbitron font-bold tracking-wide text-content-primary uppercase">
          Аналитика воронки
        </h1>
        <p className="text-content-muted mt-1 text-sm">
          Конверсии, время на стадиях, причины потери. Источник данных — история стадий лидов.
        </p>
      </div>

      <AnalyticsClient
        filters={{
          period: periodRaw,
          manager: requestedManager ?? '',
          source: source ?? '',
        }}
        isAdmin={user.role === 'admin'}
        periodOptions={PERIOD_OPTIONS}
        sourceOptions={SOURCE_OPTIONS}
        managerOptions={managerList}
        funnelStats={funnelStats}
        avgTime={avgTime}
        lossReasons={lossReasons}
        monthly={monthly}
      />
    </div>
  );
}
