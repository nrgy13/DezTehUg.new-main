import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq, desc, asc, inArray } from 'drizzle-orm';
import { Pencil, Plus, ChevronLeft, FileText, History as HistoryIcon, ScrollText, Boxes } from 'lucide-react';
import { requireRole } from '@/lib/auth/helpers';
import { db } from '@/lib/db';
import { clients } from '@/lib/db/schema/clients';
import { clientObjects, clientObjectServices } from '@/lib/db/schema/objects';
import { services } from '@/lib/db/schema/services';
import { activityLog } from '@/lib/db/schema/activity';
import { users } from '@/lib/db/schema/users';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';
import { ClientTypeBadge } from '@/components/crm/ClientStatusBadge';
import { DealStatusBadge } from '@/components/crm/DealStatusBadge';
import { ClientStatusControl } from '../ClientStatusControl';
import { CreateDealButton } from './CreateDealButton';
import { DeleteClientButton } from './DeleteClientButton';
import { ClientObjectsList } from './ClientObjectsList';
import { deals } from '@/lib/db/schema/deals';

export const dynamic = 'force-dynamic';

type Tab = 'requisites' | 'objects' | 'deals' | 'history';

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'requisites', label: 'Реквизиты', icon: ScrollText },
  { id: 'objects', label: 'Объекты', icon: Boxes },
  { id: 'deals', label: 'Договоры', icon: FileText },
  { id: 'history', label: 'История', icon: HistoryIcon },
];

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [c] = await db.select({ shortName: clients.shortName }).from(clients).where(eq(clients.id, id)).limit(1);
  return { title: c ? `${c.shortName} — Клиент — ДезТехЮг CRM` : 'Клиент — ДезТехЮг CRM' };
}

export default async function ClientCardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: Tab }>;
}) {
  await requireRole('manager');
  const { id } = await params;
  const { tab = 'requisites' } = await searchParams;

  const [client] = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  if (!client) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/manager/clients"
          className="inline-flex items-center gap-1 text-sm text-content-muted hover:text-neon-orange transition-colors mb-2"
        >
          <ChevronLeft className="w-4 h-4" />
          К списку клиентов
        </Link>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-orbitron font-bold tracking-wide text-content-primary uppercase">
              {client.shortName}
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <ClientTypeBadge type={client.type} />
              <ClientStatusControl clientId={client.id} initial={client.status} />
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <CreateDealButton clientId={id} />
            <CyberpunkButton href={`/manager/clients/${id}/edit`} variant="secondary" size="default">
              <Pencil className="w-4 h-4 mr-2" />
              Редактировать
            </CyberpunkButton>
            <DeleteClientButton clientId={id} clientName={client.shortName} />
          </div>
        </div>
      </div>

      {/* Tabs nav */}
      <div className="flex gap-1 border-b border-gray-200 -mb-px">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = t.id === tab;
          return (
            <Link
              key={t.id}
              href={`/manager/clients/${id}?tab=${t.id}`}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-orbitron uppercase tracking-wider transition-colors border-b-2 ${
                isActive
                  ? 'border-neon-orange text-neon-orange'
                  : 'border-transparent text-content-muted hover:text-content-primary hover:border-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </Link>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === 'requisites' && <RequisitesTab client={client} />}
      {tab === 'objects' && <ObjectsTab clientId={id} />}
      {tab === 'deals' && <DealsTab clientId={id} />}
      {tab === 'history' && <HistoryTab clientId={id} />}
    </div>
  );
}

// ============================================================
// Requisites tab
// ============================================================

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid grid-cols-12 gap-4 py-2 border-b border-gray-100 last:border-b-0 text-sm">
      <div className="col-span-12 sm:col-span-4 text-xs font-orbitron tracking-wider text-content-muted uppercase">
        {label}
      </div>
      <div className="col-span-12 sm:col-span-8 text-content-primary break-words">
        {value && value.length > 0 ? value : <span className="text-content-muted">—</span>}
      </div>
    </div>
  );
}

function RequisitesTab({ client }: { client: typeof clients.$inferSelect }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <CyberpunkCard variant="default" hoverEffect={false} className="p-5">
        <h3 className="text-sm font-orbitron font-semibold tracking-wider text-content-primary uppercase mb-3">
          Контакты
        </h3>
        <Row label="Полное наименование" value={client.fullName} />
        <Row label="Телефон" value={client.phone} />
        <Row label="Email" value={client.email} />
      </CyberpunkCard>

      {client.type === 'legal' && (
        <CyberpunkCard variant="default" hoverEffect={false} className="p-5">
          <h3 className="text-sm font-orbitron font-semibold tracking-wider text-content-primary uppercase mb-3">
            Реквизиты
          </h3>
          <Row label="ИНН" value={client.inn} />
          <Row label="КПП" value={client.kpp} />
          <Row label="ОГРН/ОГРНИП" value={client.ogrn} />
          <Row label="Юр. адрес" value={client.legalAddress} />
          <Row label="Почт. адрес" value={client.postalAddress} />
        </CyberpunkCard>
      )}

      {client.type === 'individual' && (
        <CyberpunkCard variant="default" hoverEffect={false} className="p-5">
          <h3 className="text-sm font-orbitron font-semibold tracking-wider text-content-primary uppercase mb-3">
            Физлицо
          </h3>
          <Row label="ИНН" value={client.inn} />
          <Row label="Адрес" value={client.legalAddress} />
        </CyberpunkCard>
      )}

      {client.type === 'legal' && (
        <CyberpunkCard variant="default" hoverEffect={false} className="p-5">
          <h3 className="text-sm font-orbitron font-semibold tracking-wider text-content-primary uppercase mb-3">
            Подписант
          </h3>
          <Row label="ФИО" value={client.directorName} />
          <Row label="Должность" value={client.directorRole} />
          <Row label="Действует на основании" value={client.actingBasis} />
        </CyberpunkCard>
      )}

      {client.type === 'legal' && (
        <CyberpunkCard variant="default" hoverEffect={false} className="p-5">
          <h3 className="text-sm font-orbitron font-semibold tracking-wider text-content-primary uppercase mb-3">
            Банк
          </h3>
          <Row label="Наименование банка" value={client.bankName} />
          <Row label="БИК" value={client.bankBik} />
          <Row label="Корсчёт" value={client.bankCorrAccount} />
          <Row label="Расчётный счёт" value={client.bankAccount} />
        </CyberpunkCard>
      )}

      <CyberpunkCard variant="default" hoverEffect={false} className="p-5 lg:col-span-2">
        <h3 className="text-sm font-orbitron font-semibold tracking-wider text-content-primary uppercase mb-3">
          Заметки менеджера
        </h3>
        <p className="text-sm text-content-primary whitespace-pre-wrap">
          {client.notes && client.notes.length > 0 ? client.notes : <span className="text-content-muted">—</span>}
        </p>
      </CyberpunkCard>
    </div>
  );
}

// ============================================================
// Objects tab
// ============================================================

async function ObjectsTab({ clientId }: { clientId: string }) {
  const objects = await db
    .select()
    .from(clientObjects)
    .where(eq(clientObjects.clientId, clientId))
    .orderBy(desc(clientObjects.createdAt));

  const clientDeals = await db
    .select({ id: deals.id, contractNumber: deals.contractNumber })
    .from(deals)
    .where(eq(deals.clientId, clientId))
    .orderBy(desc(deals.contractDate), desc(deals.createdAt));

  const contractByDeal = new Map(clientDeals.map((d) => [d.id, d.contractNumber]));

  const objectIds = objects.map((o) => o.id);
  const serviceRows = objectIds.length
    ? await db
        .select({
          objectId: clientObjectServices.objectId,
          serviceId: clientObjectServices.serviceId,
          customName: clientObjectServices.customName,
          method: clientObjectServices.method,
          serviceName: services.name,
        })
        .from(clientObjectServices)
        .leftJoin(services, eq(clientObjectServices.serviceId, services.id))
        .where(inArray(clientObjectServices.objectId, objectIds))
        .orderBy(asc(clientObjectServices.sortOrder))
    : [];

  const servicesByObject = new Map<string, { label: string; method: string | null }[]>();
  for (const r of serviceRows) {
    const list = servicesByObject.get(r.objectId) ?? [];
    list.push({ label: r.customName ?? r.serviceName ?? 'Услуга', method: r.method });
    servicesByObject.set(r.objectId, list);
  }

  const objectViews = objects.map((o) => ({
    id: o.id,
    name: o.name,
    objectType: o.objectType,
    address: o.address,
    areaM2: o.areaM2,
    plannedTreatmentDate: o.plannedTreatmentDate,
    dealId: o.dealId,
    contractNumber: o.dealId ? contractByDeal.get(o.dealId) ?? null : null,
    services: servicesByObject.get(o.id) ?? [],
  }));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <CyberpunkButton href={`/manager/clients/${clientId}/objects/new`} variant="primary" size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Добавить объект
        </CyberpunkButton>
      </div>
      {objectViews.length === 0 ? (
        <CyberpunkCard variant="default" hoverEffect={false} className="p-10 text-center">
          <p className="text-sm text-content-muted">У клиента пока нет объектов обслуживания.</p>
        </CyberpunkCard>
      ) : (
        <ClientObjectsList objects={objectViews} deals={clientDeals} />
      )}
    </div>
  );
}

// ============================================================
// Deals tab — список сделок клиента
// ============================================================

async function DealsTab({ clientId }: { clientId: string }) {
  const list = await db
    .select({
      id: deals.id,
      contractNumber: deals.contractNumber,
      contractDate: deals.contractDate,
      status: deals.status,
      totalAmount: deals.totalAmount,
    })
    .from(deals)
    .where(eq(deals.clientId, clientId))
    .orderBy(desc(deals.contractDate), desc(deals.createdAt));

  if (list.length === 0) {
    return (
      <CyberpunkCard variant="default" hoverEffect={false} className="p-10 text-center">
        <p className="text-sm text-content-muted mb-4">
          У этого клиента ещё нет сделок.
        </p>
        <CreateDealButton clientId={clientId} />
      </CyberpunkCard>
    );
  }

  return (
    <CyberpunkCard variant="default" hoverEffect={false} className="p-0 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-bg-secondary border-b border-gray-200">
          <tr className="text-xs uppercase font-orbitron tracking-wider text-content-muted">
            <th className="text-left px-4 py-3 w-44">Номер</th>
            <th className="text-left px-4 py-3 w-32">Дата</th>
            <th className="text-left px-4 py-3 w-32">Статус</th>
            <th className="text-right px-4 py-3 w-32">Сумма</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {list.map((d) => (
            <tr key={d.id} className="hover:bg-bg-secondary/50">
              <td className="px-4 py-3">
                <Link
                  href={`/manager/deals/${d.id}`}
                  className="text-neon-orange hover:underline font-mono text-xs"
                >
                  {d.contractNumber}
                </Link>
              </td>
              <td className="px-4 py-3 text-content-secondary">
                {d.contractDate
                  ? d.contractDate.split('-').reverse().join('.')
                  : '—'}
              </td>
              <td className="px-4 py-3">
                <DealStatusBadge status={d.status} />
              </td>
              <td className="px-4 py-3 text-right text-content-secondary">
                {d.totalAmount
                  ? `${new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2 }).format(Number(d.totalAmount))} ₽`
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </CyberpunkCard>
  );
}

// ============================================================
// History tab — записи activity_log по этому клиенту
// ============================================================

const ACTION_LABEL: Record<string, string> = {
  'client.create': 'Создан клиент',
  'client.update': 'Обновлены реквизиты',
  'client.status_change': 'Изменён статус',
  'object.create': 'Добавлен объект',
  'object.update': 'Обновлён объект',
  'object.delete': 'Удалён объект',
};

async function HistoryTab({ clientId }: { clientId: string }) {
  const records = await db
    .select({
      id: activityLog.id,
      action: activityLog.action,
      entityType: activityLog.entityType,
      changes: activityLog.changesJson,
      createdAt: activityLog.createdAt,
      userName: users.fullName,
    })
    .from(activityLog)
    .leftJoin(users, eq(activityLog.userId, users.id))
    .where(eq(activityLog.entityId, clientId))
    .orderBy(desc(activityLog.createdAt))
    .limit(50);

  if (records.length === 0) {
    return (
      <CyberpunkCard variant="default" hoverEffect={false} className="p-10 text-center">
        <p className="text-sm text-content-muted">История событий по клиенту пуста.</p>
      </CyberpunkCard>
    );
  }

  const formatter = new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <CyberpunkCard variant="default" hoverEffect={false} className="p-5">
      <ul className="space-y-3">
        {records.map((r) => (
          <li key={r.id} className="flex items-start gap-3 pb-3 border-b border-gray-100 last:border-b-0 last:pb-0">
            <div className="w-2 h-2 rounded-full bg-poison-green mt-1.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm text-content-primary">
                {ACTION_LABEL[r.action] ?? r.action}
              </div>
              <div className="text-xs text-content-muted mt-0.5">
                {formatter.format(r.createdAt)} • {r.userName ?? 'система'}
              </div>
              {Boolean(r.changes && typeof r.changes === 'object' && Object.keys(r.changes as object).length > 0) && (
                <pre className="text-xs text-content-secondary mt-2 bg-bg-tertiary p-2 rounded overflow-x-auto">
                  {JSON.stringify(r.changes as Record<string, unknown>, null, 2)}
                </pre>
              )}
            </div>
          </li>
        ))}
      </ul>
    </CyberpunkCard>
  );
}
