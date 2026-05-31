import Link from 'next/link';
import { LayoutGrid, Calendar as CalendarIcon, List as ListIcon } from 'lucide-react';
import { eq, desc, asc, and, ne } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { requireRole } from '@/lib/auth/helpers';
import { db } from '@/lib/db';
import { deals } from '@/lib/db/schema/deals';
import { clients } from '@/lib/db/schema/clients';
import { users } from '@/lib/db/schema/users';
import { DealBoardClient, type BoardDeal } from './DealBoardClient';
import { PageTitle } from '@/components/crm/PageTitle';

export const metadata = { title: 'Канбан сделок — ДезТехЮг CRM' };
export const dynamic = 'force-dynamic';

export default async function DealsBoardPage() {
  const user = await requireRole('manager');

  const managerUser = alias(users, 'manager_user');
  const masterUser = alias(users, 'master_user');

  const rows = await db
    .select({
      id: deals.id,
      contractNumber: deals.contractNumber,
      contractDate: deals.contractDate,
      startDate: deals.startDate,
      endDate: deals.endDate,
      status: deals.status,
      assignedManagerId: deals.assignedManagerId,
      clientId: clients.id,
      clientShortName: clients.shortName,
      managerName: managerUser.fullName,
      masterName: masterUser.fullName,
    })
    .from(deals)
    .leftJoin(clients, eq(clients.id, deals.clientId))
    .leftJoin(managerUser, eq(managerUser.id, deals.assignedManagerId))
    .leftJoin(masterUser, eq(masterUser.id, deals.assignedMasterId))
    .orderBy(desc(deals.contractDate));

  // Manager видит только свои сделки + не назначенные. Admin видит всё.
  const visibleDeals: BoardDeal[] =
    user.role === 'admin'
      ? rows
      : rows.filter((d) => !d.assignedManagerId || d.assignedManagerId === user.id);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <PageTitle>Канбан сделок</PageTitle>
          <p className="text-content-muted mt-1 text-sm">
            <span className="hidden lg:inline">Перетаскивай сделки между колонками для смены статуса.</span>
            <span className="lg:hidden">Меняй статус сделки кнопкой «Переместить» на карточке.</span>{' '}
            Изменения применяются мгновенно.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-1">
          <Link
            href="/manager/deals"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-content-secondary hover:bg-gray-50 rounded transition-colors"
          >
            <ListIcon className="w-3.5 h-3.5" />
            Список
          </Link>
          <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-neon-orange text-white rounded font-medium">
            <LayoutGrid className="w-3.5 h-3.5" />
            Канбан
          </span>
          <Link
            href="/manager/calendar"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-content-secondary hover:bg-gray-50 rounded transition-colors"
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            Календарь
          </Link>
        </div>
      </div>

      <DealBoardClient initialDeals={visibleDeals} />
    </div>
  );
}
