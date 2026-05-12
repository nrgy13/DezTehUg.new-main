import { sql } from 'drizzle-orm';
import { requireRole } from '@/lib/auth/helpers';
import { db } from '@/lib/db';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { Trash2, ShieldCheck } from 'lucide-react';
import { DeletionsClient } from './DeletionsClient';

export const metadata = { title: 'Запросы на удаление — ДезТехЮг CRM' };
export const dynamic = 'force-dynamic';

type RawRow = {
  id: string;
  number: string | null;
  type: string;
  date: string | null;
  status: string;
  deletion_status: 'pending' | 'rejected';
  // db.execute() возвращает timestamps как ISO-строки (а не как Date instances).
  deletion_requested_at: string;
  deletion_reason: string;
  deletion_admin_note: string | null;
  deletion_resolved_at: string | null;
  requester_name: string | null;
  resolver_name: string | null;
  deal_id: string | null;
  contract_number: string | null;
  client_short_name: string | null;
  client_id: string | null;
};

export default async function AdminDeletionsPage() {
  await requireRole('admin');

  // pending — главная очередь, rejected — для контекста (последние 30 дней)
  const result = await db.execute<RawRow>(sql`
    SELECT
      d.id,
      d.number,
      d.type::text AS type,
      d.date::text AS date,
      d.status::text AS status,
      d.deletion_status::text AS deletion_status,
      d.deletion_requested_at,
      d.deletion_reason,
      d.deletion_admin_note,
      d.deletion_resolved_at,
      requester.full_name AS requester_name,
      resolver.full_name  AS resolver_name,
      deals.id AS deal_id,
      deals.contract_number,
      cl.id AS client_id,
      cl.short_name AS client_short_name
    FROM documents d
    LEFT JOIN users requester ON requester.id = d.deletion_requested_by_id
    LEFT JOIN users resolver  ON resolver.id  = d.deletion_resolved_by_id
    LEFT JOIN deals   ON deals.id  = d.deal_id
    LEFT JOIN clients cl ON cl.id  = d.client_id
    WHERE d.deletion_status IN ('pending', 'rejected')
      AND (
        d.deletion_status = 'pending'
        OR d.deletion_resolved_at >= NOW() - INTERVAL '30 days'
      )
    ORDER BY
      CASE d.deletion_status WHEN 'pending' THEN 0 ELSE 1 END,
      d.deletion_requested_at DESC
  `);

  const rows = ((result as unknown as { rows?: RawRow[] }).rows ?? result) as RawRow[];

  const items = rows.map((r) => ({
    id: r.id,
    number: r.number,
    type: r.type,
    date: r.date,
    documentStatus: r.status,
    deletionStatus: r.deletion_status,
    requestedAt: new Date(r.deletion_requested_at).toISOString(),
    reason: r.deletion_reason,
    adminNote: r.deletion_admin_note,
    resolvedAt: r.deletion_resolved_at ? new Date(r.deletion_resolved_at).toISOString() : null,
    requesterName: r.requester_name,
    resolverName: r.resolver_name,
    dealId: r.deal_id,
    contractNumber: r.contract_number,
    clientId: r.client_id,
    clientShortName: r.client_short_name,
  }));

  const pending = items.filter((i) => i.deletionStatus === 'pending');
  const rejected = items.filter((i) => i.deletionStatus === 'rejected');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-orbitron font-bold tracking-wide text-content-primary uppercase">
          Запросы на удаление
        </h1>
        <p className="text-content-muted mt-1 text-sm">
          Менеджеры запрашивают удаление документов. Ты решаешь — удалять (файлы и запись
          уйдут безвозвратно) или отклонить с пояснением.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
        <StatChip label="Ждут решения" value={pending.length} icon={Trash2} accent="orange" />
        <StatChip label="Отклонено за 30 дней" value={rejected.length} icon={ShieldCheck} />
      </div>

      <DeletionsClient items={items} />
    </div>
  );
}

function StatChip({
  label,
  value,
  icon: Icon,
  accent = 'muted',
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  accent?: 'muted' | 'orange';
}) {
  return (
    <CyberpunkCard variant="default" hoverEffect={false} className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-orbitron tracking-wider text-content-muted uppercase">
          {label}
        </span>
        <Icon className={`w-4 h-4 ${accent === 'orange' ? 'text-neon-orange' : 'text-content-muted'}`} />
      </div>
      <div
        className={`text-2xl font-orbitron font-bold mt-1 ${
          accent === 'orange' && value > 0 ? 'text-neon-orange' : 'text-content-primary'
        }`}
      >
        {value}
      </div>
    </CyberpunkCard>
  );
}
