import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { eq, asc } from 'drizzle-orm';
import { ArrowLeft, MapPin, Phone } from 'lucide-react';
import { requireRole } from '@/lib/auth/helpers';
import { db } from '@/lib/db';
import { deals, dealPriceItems, dealWorkLogs } from '@/lib/db/schema/deals';
import { clients } from '@/lib/db/schema/clients';
import { clientObjects } from '@/lib/db/schema/objects';
import { services } from '@/lib/db/schema/services';
import { dealChecklistItems, type ChecklistPhoto } from '@/lib/db/schema/checklists';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { VisitChecklist, type VisitItem } from './VisitChecklist';
import { PageTitle } from '@/components/crm/PageTitle';

export const metadata = { title: 'Выезд — мастер — ДезТехЮг CRM' };
export const dynamic = 'force-dynamic';

export default async function MasterVisitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole('master');
  const { id } = await params;

  const [wl] = await db
    .select()
    .from(dealWorkLogs)
    .where(eq(dealWorkLogs.id, id))
    .limit(1);
  if (!wl) notFound();

  if (user.role !== 'admin' && wl.masterId !== user.id) {
    redirect('/master?error=not_yours');
  }

  // Контекст: сделка, клиент, позиция прайса, объект, услуга
  const [deal] = await db.select().from(deals).where(eq(deals.id, wl.dealId)).limit(1);
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, deal!.clientId))
    .limit(1);

  let priceItem: typeof dealPriceItems.$inferSelect | null = null;
  let object: typeof clientObjects.$inferSelect | null = null;
  let service: typeof services.$inferSelect | null = null;
  if (wl.priceItemId) {
    const [pi] = await db
      .select()
      .from(dealPriceItems)
      .where(eq(dealPriceItems.id, wl.priceItemId))
      .limit(1);
    priceItem = pi ?? null;
    if (pi?.objectId) {
      const [obj] = await db
        .select()
        .from(clientObjects)
        .where(eq(clientObjects.id, pi.objectId))
        .limit(1);
      object = obj ?? null;
    }
    if (pi?.serviceId) {
      const [sv] = await db
        .select()
        .from(services)
        .where(eq(services.id, pi.serviceId))
        .limit(1);
      service = sv ?? null;
    }
  }

  // Пункты чеклиста
  const itemRows = await db
    .select()
    .from(dealChecklistItems)
    .where(eq(dealChecklistItems.workLogId, id))
    .orderBy(asc(dealChecklistItems.position));

  const items: VisitItem[] = itemRows.map((it) => ({
    id: it.id,
    source: it.source as 'template' | 'manager' | 'master',
    position: it.position,
    title: it.title,
    description: it.description,
    required: it.required,
    status: it.status as 'pending' | 'done' | 'na',
    note: it.note,
    photos: (Array.isArray(it.photos) ? it.photos : []) as ChecklistPhoto[],
  }));

  const serviceLabel =
    priceItem?.customName ||
    (service ? service.shortName ?? service.name : 'Без услуги');

  const readOnly = wl.status === 'completed';

  return (
    <div className="space-y-5 pb-24">
      <Link
        href="/master"
        className="inline-flex items-center gap-1 text-sm text-content-muted hover:text-neon-orange"
      >
        <ArrowLeft className="w-4 h-4" /> К моим выездам
      </Link>

      {/* Заголовок */}
      <div>
        <PageTitle>
          {serviceLabel}
          {priceItem?.areaM2 && (
            <span className="text-content-muted font-normal text-base sm:text-lg">
              {' · '}
              {priceItem.areaM2} м²
            </span>
          )}
        </PageTitle>
        <p className="text-sm text-content-muted mt-1">
          {client?.shortName ?? '—'} · договор{' '}
          <Link
            href={`/master/deals/${deal!.id}`}
            className="text-content-secondary hover:text-neon-orange"
          >
            {deal!.contractNumber}
          </Link>
          {wl.plannedAt && (
            <>
              {' · '}
              {wl.plannedAt.toLocaleString('ru-RU', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </>
          )}
        </p>
      </div>

      {/* Объект и контакты */}
      {(object || client?.phone) && (
        <CyberpunkCard variant="default" hoverEffect={false} className="p-4">
          <div className="space-y-2 text-sm">
            {object && (
              <>
                <div className="font-medium text-content-primary">{object.name}</div>
                <a
                  href={`https://yandex.ru/maps/?text=${encodeURIComponent(object.address)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-content-secondary hover:text-neon-orange"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  {object.address}
                </a>
                {object.contactPerson && (
                  <div className="text-xs text-content-muted">
                    На месте: {object.contactPerson}
                    {object.contactPhone && (
                      <a
                        href={`tel:${object.contactPhone.replace(/\D/g, '')}`}
                        className="ml-2 text-neon-orange font-mono"
                      >
                        {object.contactPhone}
                      </a>
                    )}
                  </div>
                )}
                {object.plannedTreatmentDate && (
                  <div className="text-xs text-content-muted">
                    Плановая дата обработки:{' '}
                    {object.plannedTreatmentDate.split('-').reverse().join('.')}
                  </div>
                )}
              </>
            )}
            {client?.phone && !object?.contactPhone && (
              <a
                href={`tel:${client.phone.replace(/\D/g, '')}`}
                className="inline-flex items-center gap-1 text-neon-orange font-mono"
              >
                <Phone className="w-3.5 h-3.5" />
                {client.phone}
              </a>
            )}
            {priceItem?.method && (
              <div className="text-xs text-content-muted">
                Способ обработки: {priceItem.method}
              </div>
            )}
          </div>
        </CyberpunkCard>
      )}

      {/* Чеклист (клиентский компонент) */}
      <VisitChecklist
        workLogId={id}
        status={wl.status as 'planned' | 'in_progress' | 'completed'}
        startedAt={wl.startedAt?.toISOString() ?? null}
        finalizedAt={wl.finalizedAt?.toISOString() ?? null}
        items={items}
        readOnly={readOnly}
      />
    </div>
  );
}
