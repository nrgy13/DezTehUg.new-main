import Link from 'next/link';
import { eq, and, ne, asc, count } from 'drizzle-orm';
import { Briefcase, Wrench } from 'lucide-react';
import { requireRole } from '@/lib/auth/helpers';
import { db } from '@/lib/db';
import { deals } from '@/lib/db/schema/deals';
import { clients } from '@/lib/db/schema/clients';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { DealStatusBadge } from '@/components/crm/DealStatusBadge';

export const metadata = { title: 'Мастер — ДезТехЮг CRM' };
export const dynamic = 'force-dynamic';

export default async function MasterDashboard() {
  const user = await requireRole('master');

  // Все сделки, где я назначен мастером (кроме завершённых)
  const myDeals = await db
    .select({
      id: deals.id,
      contractNumber: deals.contractNumber,
      contractDate: deals.contractDate,
      startDate: deals.startDate,
      endDate: deals.endDate,
      status: deals.status,
      clientId: clients.id,
      clientShortName: clients.shortName,
      clientPhone: clients.phone,
    })
    .from(deals)
    .leftJoin(clients, eq(deals.clientId, clients.id))
    .where(and(eq(deals.assignedMasterId, user.id), ne(deals.status, 'terminated')))
    .orderBy(asc(deals.startDate), asc(deals.contractDate));

  // Группируем по статусу
  const active = myDeals.filter((d) => d.status === 'active' || d.status === 'signed');
  const draft = myDeals.filter((d) => d.status === 'draft' || d.status === 'sent');
  const completed = myDeals.filter((d) => d.status === 'completed');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-orbitron font-bold tracking-wide text-content-primary uppercase">
          Мои выезды
        </h1>
        <p className="text-content-muted mt-1 text-sm">
          Привет, {user.name}! Сделки, где ты назначен исполнителем.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="В работе" value={active.length} icon={Wrench} />
        <StatCard label="Готовится" value={draft.length} icon={Briefcase} />
        <StatCard label="Завершены" value={completed.length} icon={Briefcase} />
      </div>

      <DealList title="В работе" deals={active} emptyMsg="Нет сделок в работе." />
      <DealList title="Готовится" deals={draft} emptyMsg="Нет сделок в подготовке." />
      <DealList title="Завершённые" deals={completed} emptyMsg="Завершённых сделок пока нет." />
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <CyberpunkCard variant="default" className="p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-orbitron tracking-wider text-content-muted uppercase">
          {label}
        </span>
        <Icon className="w-4 h-4 text-content-muted" />
      </div>
      <div className="text-2xl font-orbitron font-bold text-content-primary">{value}</div>
    </CyberpunkCard>
  );
}

type DealLite = {
  id: string;
  contractNumber: string;
  contractDate: string;
  startDate: string | null;
  endDate: string | null;
  status: 'draft' | 'sent' | 'signed' | 'active' | 'completed' | 'terminated';
  clientId: string | null;
  clientShortName: string | null;
  clientPhone: string | null;
};

function DealList({
  title,
  deals,
  emptyMsg,
}: {
  title: string;
  deals: DealLite[];
  emptyMsg: string;
}) {
  return (
    <CyberpunkCard variant="default" hoverEffect={false} className="p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 bg-bg-secondary">
        <h2 className="text-xs font-orbitron font-semibold uppercase tracking-wider text-content-muted">
          {title} <span className="opacity-60">({deals.length})</span>
        </h2>
      </div>

      {deals.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-content-muted">{emptyMsg}</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-bg-secondary/50 border-b border-gray-200">
            <tr className="text-[10px] uppercase font-orbitron tracking-wider text-content-muted">
              <th className="text-left px-4 py-2 w-44">Номер</th>
              <th className="text-left px-4 py-2">Клиент</th>
              <th className="text-left px-4 py-2 w-40">Телефон</th>
              <th className="text-left px-4 py-2 w-28">Период</th>
              <th className="text-left px-4 py-2 w-32">Статус</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {deals.map((d) => (
              <tr key={d.id} className="hover:bg-bg-secondary/50">
                <td className="px-4 py-3">
                  <Link
                    href={`/master/deals/${d.id}`}
                    className="text-neon-orange hover:underline font-mono text-xs"
                  >
                    {d.contractNumber}
                  </Link>
                </td>
                <td className="px-4 py-3 text-content-primary">{d.clientShortName ?? '—'}</td>
                <td className="px-4 py-3 text-content-secondary font-mono text-xs">
                  {d.clientPhone ?? '—'}
                </td>
                <td className="px-4 py-3 text-content-secondary text-xs">
                  {fmtPeriod(d.startDate, d.endDate)}
                </td>
                <td className="px-4 py-3">
                  <DealStatusBadge status={d.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </CyberpunkCard>
  );
}

function fmtPeriod(start: string | null, end: string | null): string {
  const f = (d: string | null) => (d ? d.split('-').reverse().join('.') : '—');
  if (!start && !end) return '—';
  return `${f(start)} – ${f(end)}`;
}
