import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq, asc } from 'drizzle-orm';
import {
  ChevronLeft,
  Pencil,
  MapPin,
  CalendarClock,
  FileText,
  User,
  Phone,
  StickyNote,
} from 'lucide-react';
import { requireRole } from '@/lib/auth/helpers';
import { db } from '@/lib/db';
import { clientObjects, clientObjectServices } from '@/lib/db/schema/objects';
import { clients } from '@/lib/db/schema/clients';
import { deals } from '@/lib/db/schema/deals';
import { services } from '@/lib/db/schema/services';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';
import { formatQuantity, unitLabel } from '@/lib/constants/units';
import { ObjectActions } from './ObjectActions';
import { PageTitle } from '@/components/crm/PageTitle';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [o] = await db
    .select({ name: clientObjects.name })
    .from(clientObjects)
    .where(eq(clientObjects.id, id))
    .limit(1);
  return { title: o ? `${o.name} — Объект — ДезТехЮг CRM` : 'Объект — ДезТехЮг CRM' };
}

function formatDate(d: string | null): string {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}.${m}.${y}`;
}

export default async function ObjectCardPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole('manager');
  const { id } = await params;

  const [object] = await db.select().from(clientObjects).where(eq(clientObjects.id, id)).limit(1);
  if (!object) notFound();

  const [client] = await db
    .select({ id: clients.id, shortName: clients.shortName })
    .from(clients)
    .where(eq(clients.id, object.clientId))
    .limit(1);

  const deal = object.dealId
    ? (
        await db
          .select({ id: deals.id, contractNumber: deals.contractNumber })
          .from(deals)
          .where(eq(deals.id, object.dealId))
          .limit(1)
      )[0] ?? null
    : null;

  const serviceRows = await db
    .select({
      customName: clientObjectServices.customName,
      method: clientObjectServices.method,
      serviceName: services.name,
      unit: clientObjectServices.unit,
      quantity: clientObjectServices.quantity,
    })
    .from(clientObjectServices)
    .leftJoin(services, eq(clientObjectServices.serviceId, services.id))
    .where(eq(clientObjectServices.objectId, id))
    .orderBy(asc(clientObjectServices.sortOrder));

  const objectServices = serviceRows.map((r) => ({
    label: r.customName ?? r.serviceName ?? 'Услуга',
    method: r.method,
    // Sprint 10: «500 м²» / «7,7 м³» / «5 ед.» — пусто, если кол-во не задано.
    qty: r.quantity != null ? `${formatQuantity(r.quantity)} ${unitLabel(r.unit)}` : '',
  }));

  const backHref = `/manager/clients/${object.clientId}?tab=objects`;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-sm text-content-muted hover:text-neon-orange transition-colors mb-2"
        >
          <ChevronLeft className="w-4 h-4" />К объектам клиента
        </Link>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="min-w-0">
            <PageTitle className="break-words">{object.name}</PageTitle>
            <div className="text-sm text-content-muted mt-1 flex flex-wrap items-center gap-x-2">
              {client && (
                <Link href={`/manager/clients/${client.id}`} className="hover:text-neon-orange">
                  {client.shortName}
                </Link>
              )}
              {object.objectType && <span>· {object.objectType}</span>}
            </div>
          </div>
          <CyberpunkButton href={`/manager/objects/${id}/edit`} variant="secondary">
            <Pencil className="w-4 h-4 mr-2" />
            Редактировать
          </CyberpunkButton>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Данные объекта */}
        <CyberpunkCard variant="default" hoverEffect={false} className="p-5 space-y-3">
          <h3 className="text-sm font-orbitron font-semibold tracking-wider text-content-primary uppercase mb-1">
            Данные объекта
          </h3>
          <InfoRow icon={MapPin} label="Адрес" value={object.address} />
          <InfoRow
            icon={MapPin}
            label="Площадь"
            value={object.areaM2 != null ? `${formatQuantity(object.areaM2)} м²` : '—'}
          />
          <InfoRow
            icon={CalendarClock}
            label="Плановая дата обработки"
            value={formatDate(object.plannedTreatmentDate)}
          />
          <InfoRow icon={User} label="Контактное лицо" value={object.contactPerson ?? '—'} />
          <InfoRow icon={Phone} label="Контактный телефон" value={object.contactPhone ?? '—'} />
          {object.notes && (
            <InfoRow icon={StickyNote} label="Заметки" value={object.notes} />
          )}
        </CyberpunkCard>

        {/* Договор + услуги */}
        <div className="space-y-6">
          <CyberpunkCard variant="default" hoverEffect={false} className="p-5">
            <h3 className="text-sm font-orbitron font-semibold tracking-wider text-content-primary uppercase mb-3">
              Договор-основание
            </h3>
            {deal ? (
              <div className="flex items-center gap-2 text-sm">
                <FileText className="w-4 h-4 text-neon-orange flex-shrink-0" />
                <Link
                  href={`/manager/deals/${deal.id}?tab=objects`}
                  className="font-mono text-neon-orange hover:underline"
                >
                  {deal.contractNumber}
                </Link>
              </div>
            ) : (
              <p className="text-sm text-content-muted">
                Объект не привязан к договору. Привяжите его в карточке клиента или договора —
                без договора нельзя сформировать акты.
              </p>
            )}
          </CyberpunkCard>

          <CyberpunkCard variant="default" hoverEffect={false} className="p-5">
            <h3 className="text-sm font-orbitron font-semibold tracking-wider text-content-primary uppercase mb-3">
              Услуги объекта
            </h3>
            {objectServices.length === 0 ? (
              <p className="text-sm text-content-muted">Услуги не заданы.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {objectServices.map((s, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center px-2 py-1 text-xs rounded bg-poison-green/10 text-poison-green border border-poison-green/20"
                  >
                    {s.label}
                    {s.method ? ` · ${s.method}` : ''}
                    {s.qty ? ` · ${s.qty}` : ''}
                  </span>
                ))}
              </div>
            )}
          </CyberpunkCard>
        </div>
      </div>

      {/* Действия: формирование актов + удаление */}
      <CyberpunkCard variant="default" hoverEffect={false} className="p-5">
        <h3 className="text-sm font-orbitron font-semibold tracking-wider text-content-primary uppercase mb-1">
          Документы по объекту
        </h3>
        <p className="text-xs text-content-muted mb-4">
          Акты формируются по позициям договора, относящимся к этому объекту. Готовый документ
          появится в карточке договора (таб «Документы»).
        </p>
        <ObjectActions
          objectId={object.id}
          objectName={object.name}
          dealId={object.dealId}
          clientId={object.clientId}
        />
      </CyberpunkCard>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className="w-4 h-4 text-content-muted mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <div className="text-xs font-orbitron tracking-wider text-content-muted uppercase">
          {label}
        </div>
        <div className="text-content-primary break-words whitespace-pre-wrap">{value}</div>
      </div>
    </div>
  );
}
