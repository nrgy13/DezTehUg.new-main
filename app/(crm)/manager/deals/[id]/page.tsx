import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq, asc, desc } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { ArrowLeft, Briefcase } from 'lucide-react';
import { requireRole } from '@/lib/auth/helpers';
import { db } from '@/lib/db';
import { deals, dealPriceItems, dealAddendums } from '@/lib/db/schema/deals';
import { documents } from '@/lib/db/schema/documents';
import { clients } from '@/lib/db/schema/clients';
import { clientObjects } from '@/lib/db/schema/objects';
import { services } from '@/lib/db/schema/services';
import { users } from '@/lib/db/schema/users';
import { activityLog } from '@/lib/db/schema/activity';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { DealStatusBadge } from '@/components/crm/DealStatusBadge';
import { DealStatusControl } from './DealStatusControl';
import { PriceItemsTable } from './PriceItemsTable';
import { DealRequisitesTab } from './DealRequisitesTab';
import { DocumentsTab } from './DocumentsTab';
import { AddendumsTab } from './AddendumsTab';

export const metadata = { title: 'Сделка — ДезТехЮг CRM' };
export const dynamic = 'force-dynamic';

const TABS = [
  { key: 'requisites', label: 'Реквизиты' },
  { key: 'prices', label: 'Прайс' },
  { key: 'documents', label: 'Документы' },
  { key: 'addendums', label: 'ДС' },
  { key: 'history', label: 'История' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

export default async function DealDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: TabKey }>;
}) {
  await requireRole('manager');
  const { id } = await params;
  const sp = await searchParams;
  const tab: TabKey = TABS.some((t) => t.key === sp.tab) ? (sp.tab as TabKey) : 'requisites';

  // Сделка
  const dealRows = await db.select().from(deals).where(eq(deals.id, id)).limit(1);
  if (dealRows.length === 0) notFound();
  const deal = dealRows[0];

  // Клиент
  const clientRows = await db
    .select()
    .from(clients)
    .where(eq(clients.id, deal.clientId))
    .limit(1);
  const client = clientRows[0]!;

  // Объекты клиента (для выбора в прайс-позициях)
  const objects = await db
    .select()
    .from(clientObjects)
    .where(eq(clientObjects.clientId, deal.clientId))
    .orderBy(asc(clientObjects.name));

  // Менеджер и мастер
  const [manager, master] = await Promise.all([
    deal.assignedManagerId
      ? db.select().from(users).where(eq(users.id, deal.assignedManagerId)).limit(1)
      : Promise.resolve([]),
    deal.assignedMasterId
      ? db.select().from(users).where(eq(users.id, deal.assignedMasterId)).limit(1)
      : Promise.resolve([]),
  ]);

  // Все мастера (для смены executor) и менеджеры
  const allMasters = await db
    .select({ id: users.id, fullName: users.fullName, role: users.role })
    .from(users)
    .where(eq(users.role, 'master'))
    .orderBy(asc(users.fullName));
  const allManagers = await db
    .select({ id: users.id, fullName: users.fullName, role: users.role })
    .from(users)
    .where(eq(users.role, 'manager'))
    .orderBy(asc(users.fullName));

  // Прайс-позиции
  const priceItems = await db
    .select({
      id: dealPriceItems.id,
      objectId: dealPriceItems.objectId,
      serviceId: dealPriceItems.serviceId,
      customName: dealPriceItems.customName,
      areaM2: dealPriceItems.areaM2,
      method: dealPriceItems.method,
      frequency: dealPriceItems.frequency,
      priceNoVat: dealPriceItems.priceNoVat,
      priceWithVat: dealPriceItems.priceWithVat,
      vatRate: dealPriceItems.vatRate,
      sortOrder: dealPriceItems.sortOrder,
    })
    .from(dealPriceItems)
    .where(eq(dealPriceItems.dealId, id))
    .orderBy(asc(dealPriceItems.sortOrder), asc(dealPriceItems.id));

  // Каталог услуг (для dropdown)
  const allServices = await db
    .select()
    .from(services)
    .where(eq(services.isActive, true))
    .orderBy(asc(services.sortOrder));

  // Total
  const totalNoVat = priceItems.reduce((sum, pi) => sum + Number(pi.priceNoVat), 0);
  const totalWithVat = priceItems.reduce((sum, pi) => sum + Number(pi.priceWithVat), 0);

  // ДС сделки
  const addendumList = await db
    .select({
      id: dealAddendums.id,
      number: dealAddendums.number,
      date: dealAddendums.date,
      description: dealAddendums.description,
      status: dealAddendums.status,
      createdAt: dealAddendums.createdAt,
    })
    .from(dealAddendums)
    .where(eq(dealAddendums.dealId, id))
    .orderBy(asc(dealAddendums.number));

  // Документы сделки + кто запросил/отклонил удаление (если есть)
  const requester = alias(users, 'requester');
  const resolver = alias(users, 'resolver');
  const docList = await db
    .select({
      id: documents.id,
      type: documents.type,
      number: documents.number,
      date: documents.date,
      status: documents.status,
      docxS3Key: documents.docxS3Key,
      pdfS3Key: documents.pdfS3Key,
      createdAt: documents.createdAt,
      deletionStatus: documents.deletionStatus,
      deletionReason: documents.deletionReason,
      deletionRequestedAt: documents.deletionRequestedAt,
      deletionRequestedById: documents.deletionRequestedById,
      deletionAdminNote: documents.deletionAdminNote,
      deletionResolvedAt: documents.deletionResolvedAt,
      requesterName: requester.fullName,
      resolverName: resolver.fullName,
    })
    .from(documents)
    .leftJoin(requester, eq(requester.id, documents.deletionRequestedById))
    .leftJoin(resolver, eq(resolver.id, documents.deletionResolvedById))
    .where(eq(documents.dealId, id))
    .orderBy(desc(documents.createdAt));

  // История по сделке
  const history = await db
    .select({
      id: activityLog.id,
      action: activityLog.action,
      changesJson: activityLog.changesJson,
      createdAt: activityLog.createdAt,
      userId: activityLog.userId,
    })
    .from(activityLog)
    .where(eq(activityLog.entityId, id))
    .orderBy(asc(activityLog.createdAt));

  return (
    <div className="space-y-6">
      <Link
        href="/manager/deals"
        className="inline-flex items-center gap-1 text-sm text-content-muted hover:text-neon-orange"
      >
        <ArrowLeft className="w-4 h-4" />К сделкам
      </Link>

      {/* Шапка */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <Briefcase className="w-7 h-7 text-neon-orange" />
          <div>
            <h1 className="text-2xl font-orbitron font-bold tracking-wide text-content-primary">
              {deal.contractNumber}
            </h1>
            <p className="text-content-muted text-sm">
              от {formatDate(deal.contractDate)} ·{' '}
              <Link
                href={`/manager/clients/${client.id}`}
                className="text-content-secondary hover:text-neon-orange"
              >
                {client.shortName}
              </Link>
            </p>
          </div>
          <DealStatusBadge status={deal.status} />
        </div>

        <DealStatusControl dealId={deal.id} status={deal.status} />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/manager/deals/${id}?tab=${t.key}`}
            className={`px-3 py-2 text-xs font-orbitron uppercase tracking-wider border-b-2 -mb-[1px] ${
              tab === t.key
                ? 'border-neon-orange text-neon-orange'
                : 'border-transparent text-content-muted hover:text-content-primary'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* Контент таба */}
      {tab === 'requisites' && (
        <DealRequisitesTab
          deal={deal}
          client={client}
          manager={manager[0] ?? null}
          master={master[0] ?? null}
          allManagers={allManagers}
          allMasters={allMasters}
        />
      )}

      {tab === 'prices' && (
        <CyberpunkCard variant="default" hoverEffect={false} className="p-0 overflow-hidden">
          <PriceItemsTable
            dealId={deal.id}
            items={priceItems}
            objects={objects}
            services={allServices}
            totalNoVat={totalNoVat}
            totalWithVat={totalWithVat}
          />
        </CyberpunkCard>
      )}

      {tab === 'documents' && (
        <DocumentsTab
          dealId={deal.id}
          clientEmail={client.email}
          documents={docList.map((d) => ({
            id: d.id,
            type: d.type,
            number: d.number,
            date: d.date,
            status: d.status,
            docxS3Key: d.docxS3Key,
            pdfS3Key: d.pdfS3Key,
            createdAt: d.createdAt.toISOString(),
            templateVersion: null,
            deletionStatus: d.deletionStatus,
            deletionReason: d.deletionReason,
            deletionRequestedAt: d.deletionRequestedAt?.toISOString() ?? null,
            deletionAdminNote: d.deletionAdminNote,
            deletionResolvedAt: d.deletionResolvedAt?.toISOString() ?? null,
            requesterName: d.requesterName,
            resolverName: d.resolverName,
          }))}
        />
      )}

      {tab === 'addendums' && (
        <AddendumsTab
          dealId={deal.id}
          addendums={addendumList.map((a) => ({
            id: a.id,
            number: a.number,
            date: a.date,
            description: a.description,
            status: a.status,
            createdAt: a.createdAt.toISOString(),
          }))}
        />
      )}

      {tab === 'history' && (
        <CyberpunkCard variant="default" hoverEffect={false} className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-bg-secondary border-b border-gray-200">
              <tr className="text-xs uppercase font-orbitron tracking-wider text-content-muted">
                <th className="text-left px-4 py-3 w-44">Когда</th>
                <th className="text-left px-4 py-3">Что</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {history.map((h) => (
                <tr key={h.id}>
                  <td className="px-4 py-3 text-content-muted text-xs">
                    {new Date(h.createdAt).toLocaleString('ru-RU')}
                  </td>
                  <td className="px-4 py-3 text-content-secondary text-xs">
                    <span className="font-mono">{h.action}</span>
                    {h.changesJson != null ? (
                      <pre className="mt-1 text-[10px] text-content-muted whitespace-pre-wrap">
                        {JSON.stringify(h.changesJson, null, 2)}
                      </pre>
                    ) : null}
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-8 text-center text-content-muted">
                    История пуста.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CyberpunkCard>
      )}
    </div>
  );
}

function formatDate(d: string | null): string {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}.${m}.${y}`;
}
