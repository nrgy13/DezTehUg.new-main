import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq, asc, desc, inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { ArrowLeft, Briefcase } from 'lucide-react';
import { requireRole } from '@/lib/auth/helpers';
import { db } from '@/lib/db';
import { deals, dealPriceItems, dealAddendums, dealWorkLogs, dealWorkLogServices } from '@/lib/db/schema/deals';
import { dealChecklistItems } from '@/lib/db/schema/checklists';
import { documents } from '@/lib/db/schema/documents';
import { clients } from '@/lib/db/schema/clients';
import { clientObjects, clientObjectServices } from '@/lib/db/schema/objects';
import { services } from '@/lib/db/schema/services';
import { users } from '@/lib/db/schema/users';
import { activityLog } from '@/lib/db/schema/activity';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { DealStatusBadge } from '@/components/crm/DealStatusBadge';
import { DealStatusControl } from './DealStatusControl';
import { DeleteDealButton } from './DeleteDealButton';
import { PriceItemsTable } from './PriceItemsTable';
import { DealRequisitesTab } from './DealRequisitesTab';
import { DealObjectsTab } from './DealObjectsTab';
import { DocumentsTab } from './DocumentsTab';
import { AddendumsTab } from './AddendumsTab';
import { VisitsTab, type ObjectVisitGroup, type VisitView } from './VisitsTab';
import { getWorkOrderFormData } from '@/app/(crm)/manager/calendar/work-order-actions';
import { PageTitle } from '@/components/crm/PageTitle';

export const metadata = { title: 'Сделка — ДезТехЮг CRM' };
export const dynamic = 'force-dynamic';

const TABS = [
  { key: 'requisites', label: 'Реквизиты' },
  { key: 'prices', label: 'Прайс' },
  { key: 'objects', label: 'Объекты' },
  { key: 'visits', label: 'Выезды' },
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
      unit: dealPriceItems.unit,
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

  // Sprint 9: объекты, привязанные к этому договору + не привязанные ни к одному
  // (для «Привязать существующий»). Берём из уже загруженного списка objects.
  const dealObjects = objects.filter((o) => o.dealId === id);
  const attachableObjects = objects
    .filter((o) => o.dealId === null)
    .map((o) => ({ id: o.id, name: o.name, address: o.address }));

  // Услуги объектов договора (несколько на объект) с именами из каталога.
  const dealObjectIds = dealObjects.map((o) => o.id);
  const objectServiceRows = dealObjectIds.length
    ? await db
        .select({
          id: clientObjectServices.id,
          objectId: clientObjectServices.objectId,
          serviceId: clientObjectServices.serviceId,
          customName: clientObjectServices.customName,
          method: clientObjectServices.method,
          frequency: clientObjectServices.frequency,
          sortOrder: clientObjectServices.sortOrder,
        })
        .from(clientObjectServices)
        .where(inArray(clientObjectServices.objectId, dealObjectIds))
        .orderBy(asc(clientObjectServices.sortOrder))
    : [];
  const svcNameMap = new Map(allServices.map((s) => [s.id, s.name]));
  const servicesByObject = new Map<
    string,
    { label: string; method: string | null; frequency: string | null }[]
  >();
  for (const row of objectServiceRows) {
    const label =
      row.customName ?? (row.serviceId ? svcNameMap.get(row.serviceId) ?? 'Услуга' : 'Услуга');
    const arr = servicesByObject.get(row.objectId) ?? [];
    arr.push({ label, method: row.method, frequency: row.frequency });
    servicesByObject.set(row.objectId, arr);
  }
  const dealObjectsView = dealObjects.map((o) => ({
    id: o.id,
    name: o.name,
    objectType: o.objectType,
    address: o.address,
    areaM2: o.areaM2,
    plannedTreatmentDate: o.plannedTreatmentDate,
    services: servicesByObject.get(o.id) ?? [],
  }));

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

  // Выезды (work_logs) и пункты их чеклистов. Грузим всегда — count маленький.
  const workLogRows = await db
    .select({
      id: dealWorkLogs.id,
      objectId: dealWorkLogs.objectId,
      preparations: dealWorkLogs.preparations,
      status: dealWorkLogs.status,
      plannedAt: dealWorkLogs.plannedAt,
      startedAt: dealWorkLogs.startedAt,
      finalizedAt: dealWorkLogs.finalizedAt,
      performedAt: dealWorkLogs.performedAt,
      masterName: users.fullName,
    })
    .from(dealWorkLogs)
    .leftJoin(users, eq(users.id, dealWorkLogs.masterId))
    .where(eq(dealWorkLogs.dealId, id))
    .orderBy(desc(dealWorkLogs.createdAt));

  const wlIds = workLogRows.map((w) => w.id);
  // Пункты чеклистов всех выездов сразу — фильтруем in-memory по workLogId.
  const allItems =
    wlIds.length > 0
      ? await db
          .select()
          .from(dealChecklistItems)
          .orderBy(asc(dealChecklistItems.position))
      : [];
  const wlIdSet = new Set(wlIds);
  const itemsByWorkLog = new Map<string, typeof allItems>();
  for (const it of allItems) {
    if (!wlIdSet.has(it.workLogId)) continue;
    const arr = itemsByWorkLog.get(it.workLogId) ?? [];
    arr.push(it);
    itemsByWorkLog.set(it.workLogId, arr);
  }

  // svcMap/objMap — также используются в табе «Документы» ниже.
  const svcMap = new Map(allServices.map((s) => [s.id, s.shortName ?? s.name]));
  const objMap = new Map(objects.map((o) => [o.id, o]));

  // Snapshot услуг заказ-нарядов (несколько услуг на выезд).
  const woSvcRows =
    wlIds.length > 0
      ? await db
          .select({
            workLogId: dealWorkLogServices.workLogId,
            customName: dealWorkLogServices.customName,
            serviceName: services.name,
          })
          .from(dealWorkLogServices)
          .leftJoin(services, eq(services.id, dealWorkLogServices.serviceId))
          .where(inArray(dealWorkLogServices.workLogId, wlIds))
          .orderBy(asc(dealWorkLogServices.sortOrder))
      : [];
  const svcByWl = new Map<string, string[]>();
  for (const s of woSvcRows) {
    const arr = svcByWl.get(s.workLogId) ?? [];
    arr.push(s.customName ?? s.serviceName ?? 'Услуга');
    svcByWl.set(s.workLogId, arr);
  }

  // Релиз B: группировка выездов (заказ-нарядов) по объекту.
  const visitsByObject = new Map<string, VisitView[]>();
  for (const w of workLogRows) {
    const view: VisitView = {
      id: w.id,
      status: w.status as VisitView['status'],
      plannedAt: w.plannedAt?.toISOString() ?? null,
      startedAt: w.startedAt?.toISOString() ?? null,
      finalizedAt: w.finalizedAt?.toISOString() ?? null,
      performedAt: w.performedAt?.toISOString() ?? null,
      masterName: w.masterName,
      services: svcByWl.get(w.id) ?? [],
      preparations: w.preparations,
      items: (itemsByWorkLog.get(w.id) ?? []).map((it) => ({
        id: it.id,
        source: it.source as 'template' | 'manager' | 'master',
        position: it.position,
        title: it.title,
        description: it.description,
        required: it.required,
        status: it.status as 'pending' | 'done' | 'na',
        note: it.note,
        photosCount: Array.isArray(it.photos) ? it.photos.length : 0,
      })),
    };
    const key = w.objectId ?? 'none';
    const arr = visitsByObject.get(key) ?? [];
    arr.push(view);
    visitsByObject.set(key, arr);
  }
  const objectVisitGroups: ObjectVisitGroup[] = Array.from(visitsByObject.entries()).map(
    ([key, visits]) => {
      const obj = key === 'none' ? null : objMap.get(key);
      return {
        objectId: key === 'none' ? null : key,
        objectName: obj?.name ?? null,
        address: obj?.address ?? null,
        visits,
      };
    },
  );

  // Данные формы заказ-наряда (для кнопки «+ Заказ-наряд» в табе выездов).
  const visitsFormData = await getWorkOrderFormData(deal.clientId);

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
            <PageTitle>{deal.contractNumber}</PageTitle>
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

        <div className="flex items-center gap-2 flex-wrap">
          <DealStatusControl dealId={deal.id} status={deal.status} />
          <DeleteDealButton dealId={deal.id} contractNumber={deal.contractNumber} />
        </div>
      </div>

      {/* Tabs — на мобиле горизонтальный скролл (6 табов не влезают по ширине) */}
      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/manager/deals/${id}?tab=${t.key}`}
            className={`px-3 py-2 text-xs font-orbitron uppercase tracking-wider border-b-2 -mb-[1px] whitespace-nowrap ${
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

      {tab === 'objects' && (
        <DealObjectsTab
          dealId={deal.id}
          objects={dealObjectsView}
          attachable={attachableObjects}
        />
      )}

      {tab === 'visits' && (
        <VisitsTab
          dealId={deal.id}
          clientId={deal.clientId}
          formData={visitsFormData}
          groups={objectVisitGroups}
        />
      )}

      {tab === 'documents' && (
        <DocumentsTab
          dealId={deal.id}
          clientEmail={client.email}
          priceItems={priceItems.map((pi) => ({
            id: pi.id,
            objectName: pi.objectId ? objMap.get(pi.objectId)?.name ?? null : null,
            serviceName: pi.customName || (pi.serviceId ? svcMap.get(pi.serviceId) ?? '—' : '—'),
            areaM2: pi.areaM2,
            unit: pi.unit,
            priceWithVat: Number(pi.priceWithVat),
          }))}
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
          {/* Desktop: таблица */}
          <table className="hidden md:table w-full text-sm">
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
            </tbody>
          </table>

          {/* Mobile: карточки */}
          <div className="md:hidden divide-y divide-gray-100">
            {history.map((h) => (
              <div key={h.id} className="p-3">
                <div className="text-[11px] text-content-muted mb-0.5">
                  {new Date(h.createdAt).toLocaleString('ru-RU')}
                </div>
                <div className="font-mono text-xs text-content-secondary">{h.action}</div>
                {h.changesJson != null ? (
                  <pre className="mt-1 text-[10px] text-content-muted whitespace-pre-wrap break-all">
                    {JSON.stringify(h.changesJson, null, 2)}
                  </pre>
                ) : null}
              </div>
            ))}
          </div>

          {history.length === 0 && (
            <div className="px-4 py-8 text-center text-content-muted">История пуста.</div>
          )}
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
