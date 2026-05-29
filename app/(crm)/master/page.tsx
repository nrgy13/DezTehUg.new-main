import Link from 'next/link';
import { eq, and, or, gte, desc, asc } from 'drizzle-orm';
import { Briefcase, Wrench, ListChecks, Clock, ArrowRight } from 'lucide-react';
import { requireRole } from '@/lib/auth/helpers';
import { db } from '@/lib/db';
import { deals, dealPriceItems, dealWorkLogs } from '@/lib/db/schema/deals';
import { clients } from '@/lib/db/schema/clients';
import { clientObjects } from '@/lib/db/schema/objects';
import { services } from '@/lib/db/schema/services';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { unitLabel, formatQuantity } from '@/lib/constants/units';
import type { PriceItemUnit } from '@/lib/db/schema/deals';

export const metadata = { title: 'Мастер — ДезТехЮг CRM' };
export const dynamic = 'force-dynamic';

type VisitRow = {
  id: string;
  status: 'planned' | 'in_progress' | 'completed';
  plannedAt: Date | null;
  startedAt: Date | null;
  finalizedAt: Date | null;
  performedAt: Date | null;
  contractNumber: string;
  clientShortName: string | null;
  service: string;
  objectName: string | null;
  areaM2: string | null;
  unit: PriceItemUnit | null;
  dealId: string;
};

export default async function MasterDashboard() {
  const user = await requireRole('master');

  // Все выезды этого мастера за последние 30 дней + все активные.
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      id: dealWorkLogs.id,
      status: dealWorkLogs.status,
      plannedAt: dealWorkLogs.plannedAt,
      startedAt: dealWorkLogs.startedAt,
      finalizedAt: dealWorkLogs.finalizedAt,
      performedAt: dealWorkLogs.performedAt,
      dealId: dealWorkLogs.dealId,
      priceItemId: dealWorkLogs.priceItemId,
      contractNumber: deals.contractNumber,
      clientShortName: clients.shortName,
      areaM2: dealPriceItems.areaM2,
      unit: dealPriceItems.unit,
      method: dealPriceItems.method,
      serviceId: dealPriceItems.serviceId,
      customName: dealPriceItems.customName,
      objectName: clientObjects.name,
    })
    .from(dealWorkLogs)
    .leftJoin(deals, eq(deals.id, dealWorkLogs.dealId))
    .leftJoin(clients, eq(clients.id, deals.clientId))
    .leftJoin(dealPriceItems, eq(dealPriceItems.id, dealWorkLogs.priceItemId))
    .leftJoin(clientObjects, eq(clientObjects.id, dealPriceItems.objectId))
    .where(
      and(
        eq(dealWorkLogs.masterId, user.id),
        or(
          // активные — независимо от давности
          eq(dealWorkLogs.status, 'planned'),
          eq(dealWorkLogs.status, 'in_progress'),
          // completed — только за 30 дней
          and(
            eq(dealWorkLogs.status, 'completed'),
            or(
              gte(dealWorkLogs.finalizedAt, since30d),
              gte(dealWorkLogs.performedAt, since30d),
            ),
          ),
        ),
      ),
    )
    .orderBy(asc(dealWorkLogs.plannedAt), desc(dealWorkLogs.startedAt));

  // Услуги для лейблов
  const allServices = await db.select().from(services);
  const svcMap = new Map(allServices.map((s) => [s.id, s.shortName ?? s.name]));

  const visits: VisitRow[] = rows.map((r) => ({
    id: r.id,
    status: r.status as 'planned' | 'in_progress' | 'completed',
    plannedAt: r.plannedAt,
    startedAt: r.startedAt,
    finalizedAt: r.finalizedAt,
    performedAt: r.performedAt,
    contractNumber: r.contractNumber ?? '—',
    clientShortName: r.clientShortName,
    service:
      r.customName || (r.serviceId ? svcMap.get(r.serviceId) ?? 'Без услуги' : 'Без услуги'),
    objectName: r.objectName,
    areaM2: r.areaM2,
    unit: r.unit,
    dealId: r.dealId,
  }));

  const inProgress = visits.filter((v) => v.status === 'in_progress');
  const planned = visits.filter((v) => v.status === 'planned');
  const completed = visits.filter((v) => v.status === 'completed');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-orbitron font-bold tracking-wide text-content-primary uppercase">
          Мои выезды
        </h1>
        <p className="text-content-muted mt-1 text-sm">
          Привет, {user.name}! Здесь — все твои запланированные и завершённые
          выезды по позициям договоров.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <StatCard label="В работе" value={inProgress.length} icon={Wrench} active />
        <StatCard label="Запланировано" value={planned.length} icon={Clock} />
        <StatCard label="За 30 дней" value={completed.length} icon={ListChecks} />
      </div>

      <VisitGroup
        title="В работе"
        visits={inProgress}
        emptyMsg="Нет выездов в процессе. Открой запланированный и нажми «Начать выезд»."
      />
      <VisitGroup
        title="Запланировано"
        visits={planned}
        emptyMsg="Нет запланированных выездов. Менеджер назначит — здесь появятся."
      />
      <VisitGroup
        title="Выполнено за 30 дней"
        visits={completed}
        emptyMsg="Завершённых выездов за месяц пока нет."
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  active = false,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  active?: boolean;
}) {
  return (
    <CyberpunkCard
      variant="default"
      className={`p-3 sm:p-5 ${active && value > 0 ? 'ring-2 ring-neon-orange/40' : ''}`}
    >
      <div className="flex items-center justify-between mb-1 sm:mb-2">
        <span className="text-[10px] sm:text-xs font-orbitron tracking-wider text-content-muted uppercase">
          {label}
        </span>
        <Icon className="w-4 h-4 text-content-muted" />
      </div>
      <div
        className={`text-xl sm:text-2xl font-orbitron font-bold ${active && value > 0 ? 'text-neon-orange' : 'text-content-primary'}`}
      >
        {value}
      </div>
    </CyberpunkCard>
  );
}

function VisitGroup({
  title,
  visits,
  emptyMsg,
}: {
  title: string;
  visits: VisitRow[];
  emptyMsg: string;
}) {
  return (
    <CyberpunkCard variant="default" hoverEffect={false} className="p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 bg-bg-secondary">
        <h2 className="text-xs font-orbitron font-semibold uppercase tracking-wider text-content-muted">
          {title} <span className="opacity-60">({visits.length})</span>
        </h2>
      </div>
      {visits.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-content-muted">{emptyMsg}</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {visits.map((v) => (
            <li key={v.id}>
              <Link
                href={`/master/visits/${v.id}`}
                className="block px-4 py-3 hover:bg-bg-secondary/50 active:bg-bg-secondary"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-medium text-content-primary">
                        {v.service}
                      </span>
                      {v.areaM2 && (
                        <span className="text-xs text-content-muted">
                          · {formatQuantity(v.areaM2)} {unitLabel(v.unit)}
                        </span>
                      )}
                    </div>
                    {v.objectName && (
                      <div className="text-xs text-content-secondary">
                        {v.objectName}
                      </div>
                    )}
                    <div className="text-xs text-content-muted mt-0.5 truncate">
                      {v.clientShortName ?? '—'} · {fmtDealNum(v.contractNumber)} ·{' '}
                      {fmtVisitDate(v)}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-content-muted flex-shrink-0 mt-1" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </CyberpunkCard>
  );
}

function fmtDealNum(n: string): string {
  return n.length > 22 ? n.slice(0, 20) + '…' : n;
}

function fmtVisitDate(v: VisitRow): string {
  const d =
    v.status === 'completed'
      ? v.performedAt ?? v.finalizedAt
      : v.startedAt ?? v.plannedAt;
  if (!d) return 'без даты';
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
