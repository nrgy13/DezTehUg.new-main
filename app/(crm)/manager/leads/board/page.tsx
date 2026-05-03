import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { RefreshCw } from 'lucide-react';
import { requireRole } from '@/lib/auth/helpers';
import { db } from '@/lib/db';
import { leads } from '@/lib/db/schema/leads';
import { users } from '@/lib/db/schema/users';
import { ViewToggle } from '../_components/ViewToggle';
import { NewLeadButton } from '../_components/NewLeadButton';
import { LeadBoard } from '../_components/LeadBoard';
import type { BoardLead } from '../_components/LeadCard';

export const metadata = { title: 'Воронка лидов — ДезТехЮг CRM' };
export const dynamic = 'force-dynamic';

export default async function LeadsBoardPage() {
  const user = await requireRole('manager');

  const rows = await db
    .select({
      id: leads.id,
      status: leads.status,
      contactName: leads.contactName,
      contactPhone: leads.contactPhone,
      contactEmail: leads.contactEmail,
      requestedAddress: leads.requestedAddress,
      channel: leads.channel,
      assignedManagerId: leads.assignedManagerId,
      managerName: users.fullName,
      createdAt: leads.createdAt,
    })
    .from(leads)
    .leftJoin(users, eq(leads.assignedManagerId, users.id))
    .orderBy(desc(leads.createdAt));

  const initialLeads: BoardLead[] = rows.map((r) => ({
    id: r.id,
    status: r.status,
    contactName: r.contactName,
    contactPhone: r.contactPhone,
    contactEmail: r.contactEmail,
    requestedAddress: r.requestedAddress,
    channel: r.channel,
    managerName: r.managerName,
    isMine: r.assignedManagerId === user.id,
    createdAt: r.createdAt,
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-orbitron font-bold tracking-wide text-content-primary uppercase">
            Воронка
          </h1>
          <p className="text-content-muted mt-1 text-sm">
            Всего: <span className="font-semibold text-content-primary">{initialLeads.length}</span>{' '}
            · Перетаскивай карточки между колонками — статус меняется сам.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <NewLeadButton />
          <ViewToggle current="board" />
          <Link
            href="/manager/leads/board"
            className="inline-flex items-center gap-1.5 text-sm text-content-muted hover:text-poison-green transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Обновить
          </Link>
        </div>
      </div>

      <LeadBoard initialLeads={initialLeads} />
    </div>
  );
}
