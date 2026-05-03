import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq, desc } from 'drizzle-orm';
import { Pencil, Plus, ChevronLeft, FileText, History as HistoryIcon, ScrollText, Boxes } from 'lucide-react';
import { requireRole } from '@/lib/auth/helpers';
import { db } from '@/lib/db';
import { clients } from '@/lib/db/schema/clients';
import { clientObjects } from '@/lib/db/schema/objects';
import { activityLog } from '@/lib/db/schema/activity';
import { users } from '@/lib/db/schema/users';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';
import { ClientTypeBadge } from '@/components/crm/ClientStatusBadge';
import { ClientStatusControl } from '../ClientStatusControl';
import { GenerateDocumentMenu } from './GenerateDocumentMenu';
import { DeleteObjectButton } from '../DeleteObjectButton';

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
            <h1 className="text-3xl font-orbitron font-bold tracking-wide text-content-primary uppercase">
              {client.shortName}
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <ClientTypeBadge type={client.type} />
              <ClientStatusControl clientId={client.id} initial={client.status} />
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <GenerateDocumentMenu clientId={id} />
            <CyberpunkButton href={`/manager/clients/${id}/edit`} variant="secondary" size="default">
              <Pencil className="w-4 h-4 mr-2" />
              Редактировать
            </CyberpunkButton>
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
      {tab === 'deals' && <DealsPlaceholder />}
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

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <CyberpunkButton href={`/manager/clients/${clientId}/objects/new`} variant="primary" size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Добавить объект
        </CyberpunkButton>
      </div>
      {objects.length === 0 ? (
        <CyberpunkCard variant="default" hoverEffect={false} className="p-10 text-center">
          <p className="text-sm text-content-muted">У клиента пока нет объектов обслуживания.</p>
        </CyberpunkCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {objects.map((o) => (
            <CyberpunkCard key={o.id} variant="default" className="p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="font-semibold text-content-primary">{o.name}</div>
                <DeleteObjectButton objectId={o.id} objectName={o.name} />
              </div>
              <div className="text-sm text-content-secondary mb-1">{o.address}</div>
              {o.objectType && (
                <div className="text-xs text-content-muted mb-2">Тип: {o.objectType}</div>
              )}
              {o.areaM2 && (
                <div className="text-xs text-content-muted">Площадь: {o.areaM2} м²</div>
              )}
              {(o.contactPerson || o.contactPhone) && (
                <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-content-secondary">
                  {o.contactPerson && <div>{o.contactPerson}</div>}
                  {o.contactPhone && <div className="font-mono">{o.contactPhone}</div>}
                </div>
              )}
            </CyberpunkCard>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Deals tab — placeholder (этап 4 в Спринте 3+)
// ============================================================

function DealsPlaceholder() {
  return (
    <CyberpunkCard variant="default" hoverEffect={false} className="p-10 text-center">
      <p className="text-sm text-content-muted">
        Договоры с этим клиентом появятся после внедрения модуля сделок (Спринт 3+).
      </p>
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
