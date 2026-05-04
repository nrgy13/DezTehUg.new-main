import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { eq, asc } from 'drizzle-orm';
import { ArrowLeft, MapPin, Phone, Briefcase } from 'lucide-react';
import { requireRole } from '@/lib/auth/helpers';
import { db } from '@/lib/db';
import { deals, dealPriceItems, dealWorkLogs } from '@/lib/db/schema/deals';
import { clients } from '@/lib/db/schema/clients';
import { clientObjects } from '@/lib/db/schema/objects';
import { services } from '@/lib/db/schema/services';
import { users } from '@/lib/db/schema/users';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { DealStatusBadge } from '@/components/crm/DealStatusBadge';
import { WorkLogForm } from './WorkLogForm';

export const metadata = { title: 'Сделка — мастер — ДезТехЮг CRM' };
export const dynamic = 'force-dynamic';

export default async function MasterDealPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole('master');
  const { id } = await params;

  const dealRows = await db.select().from(deals).where(eq(deals.id, id)).limit(1);
  if (dealRows.length === 0) notFound();
  const deal = dealRows[0];

  // Permission: master видит только свои сделки. admin видит всё.
  if (user.role !== 'admin' && deal.assignedMasterId !== user.id) {
    redirect('/master?error=not_yours');
  }

  const [client] = await db.select().from(clients).where(eq(clients.id, deal.clientId)).limit(1);
  const objects = await db
    .select()
    .from(clientObjects)
    .where(eq(clientObjects.clientId, deal.clientId))
    .orderBy(asc(clientObjects.name));

  const priceItemsRaw = await db
    .select({
      id: dealPriceItems.id,
      objectId: dealPriceItems.objectId,
      serviceId: dealPriceItems.serviceId,
      customName: dealPriceItems.customName,
      areaM2: dealPriceItems.areaM2,
      method: dealPriceItems.method,
      frequency: dealPriceItems.frequency,
    })
    .from(dealPriceItems)
    .where(eq(dealPriceItems.dealId, id))
    .orderBy(asc(dealPriceItems.sortOrder), asc(dealPriceItems.id));

  // ВНИМАНИЕ: master не видит цены, поэтому цены НЕ выбираем.
  const allServices = await db.select().from(services);
  const svcMap = new Map(allServices.map((s) => [s.id, s.shortName ?? s.name]));
  const objMap = new Map(objects.map((o) => [o.id, o]));

  const priceItems = priceItemsRaw.map((p) => {
    const obj = p.objectId ? objMap.get(p.objectId) : null;
    return {
      id: p.id,
      service: p.customName || (p.serviceId ? svcMap.get(p.serviceId) ?? '' : ''),
      objectName: obj?.name ?? '',
      objectAddress: obj?.address ?? '',
      areaM2: p.areaM2,
      method: p.method ?? '',
      frequency: p.frequency ?? '',
    };
  });

  const workLogs = await db
    .select({
      id: dealWorkLogs.id,
      performedAt: dealWorkLogs.performedAt,
      description: dealWorkLogs.description,
      areaM2: dealWorkLogs.areaM2,
      notes: dealWorkLogs.notes,
      masterName: users.fullName,
    })
    .from(dealWorkLogs)
    .leftJoin(users, eq(dealWorkLogs.masterId, users.id))
    .where(eq(dealWorkLogs.dealId, id))
    .orderBy(asc(dealWorkLogs.performedAt));

  return (
    <div className="space-y-6">
      <Link
        href="/master"
        className="inline-flex items-center gap-1 text-sm text-content-muted hover:text-neon-orange"
      >
        <ArrowLeft className="w-4 h-4" />К моим выездам
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <Briefcase className="w-7 h-7 text-neon-orange" />
          <div>
            <h1 className="text-2xl font-orbitron font-bold tracking-wide text-content-primary">
              {deal.contractNumber}
            </h1>
            <p className="text-content-muted text-sm">
              {client?.shortName ?? '—'} · от {fmt(deal.contractDate)}
            </p>
          </div>
          <DealStatusBadge status={deal.status} />
        </div>
      </div>

      {/* Контакты клиента */}
      <CyberpunkCard variant="default" hoverEffect={false} className="p-5">
        <h2 className="text-base font-orbitron font-semibold uppercase tracking-wider text-content-primary mb-3">
          Клиент
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <div className="text-xs uppercase font-orbitron tracking-wider text-content-muted">
              Название
            </div>
            <div className="text-content-primary mt-1">{client?.shortName ?? '—'}</div>
          </div>
          <div>
            <div className="text-xs uppercase font-orbitron tracking-wider text-content-muted">
              Телефон
            </div>
            <div className="mt-1">
              {client?.phone ? (
                <a
                  href={`tel:${client.phone.replace(/\D/g, '')}`}
                  className="inline-flex items-center gap-1 text-neon-orange hover:underline font-mono"
                >
                  <Phone className="w-3 h-3" />
                  {client.phone}
                </a>
              ) : (
                '—'
              )}
            </div>
          </div>
        </div>
      </CyberpunkCard>

      {/* Объекты обслуживания */}
      {objects.length > 0 && (
        <CyberpunkCard variant="default" hoverEffect={false} className="p-5">
          <h2 className="text-base font-orbitron font-semibold uppercase tracking-wider text-content-primary mb-3">
            Объекты
          </h2>
          <div className="space-y-3">
            {objects.map((o) => (
              <div key={o.id} className="border-l-2 border-poison-green pl-3">
                <div className="font-medium text-content-primary">{o.name}</div>
                <a
                  href={`https://yandex.ru/maps/?text=${encodeURIComponent(o.address)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-content-secondary hover:text-neon-orange"
                >
                  <MapPin className="w-3 h-3" />
                  {o.address}
                </a>
                {o.areaM2 && (
                  <div className="text-xs text-content-muted mt-0.5">
                    Площадь: {o.areaM2} м²
                  </div>
                )}
                {o.contactPerson && (
                  <div className="text-xs text-content-muted mt-0.5">
                    На месте: {o.contactPerson}
                    {o.contactPhone && (
                      <a
                        href={`tel:${o.contactPhone.replace(/\D/g, '')}`}
                        className="ml-2 text-neon-orange hover:underline font-mono"
                      >
                        {o.contactPhone}
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CyberpunkCard>
      )}

      {/* Что делать */}
      <CyberpunkCard variant="default" hoverEffect={false} className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-bg-secondary">
          <h2 className="text-xs font-orbitron font-semibold uppercase tracking-wider text-content-muted">
            План работ
          </h2>
        </div>
        {priceItems.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-content-muted">
            План работ не задан.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-bg-secondary/50 border-b border-gray-200">
              <tr className="text-[10px] uppercase font-orbitron tracking-wider text-content-muted">
                <th className="text-left px-4 py-2">Объект</th>
                <th className="text-left px-4 py-2">Услуга</th>
                <th className="text-right px-4 py-2 w-16">м²</th>
                <th className="text-left px-4 py-2 w-32">Способ</th>
                <th className="text-left px-4 py-2 w-32">Периодичность</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {priceItems.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2 text-content-secondary text-xs">{p.objectName || '—'}</td>
                  <td className="px-4 py-2 text-content-primary">{p.service}</td>
                  <td className="px-4 py-2 text-right text-content-secondary">{p.areaM2}</td>
                  <td className="px-4 py-2 text-content-secondary text-xs">{p.method || '—'}</td>
                  <td className="px-4 py-2 text-content-secondary text-xs">{p.frequency || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CyberpunkCard>

      {/* Журнал работ */}
      <CyberpunkCard variant="default" hoverEffect={false} className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-bg-secondary">
          <h2 className="text-xs font-orbitron font-semibold uppercase tracking-wider text-content-muted">
            Журнал работ ({workLogs.length})
          </h2>
        </div>
        {workLogs.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-content-muted">
            Записей о выполненных работах пока нет.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {workLogs.map((w) => (
              <li key={w.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="text-xs text-content-muted">
                      {new Date(w.performedAt).toLocaleString('ru-RU', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}{' '}
                      · {w.masterName ?? 'неизвестно'}
                    </div>
                    <div className="text-sm text-content-primary mt-1">{w.description}</div>
                    {w.notes && (
                      <div className="text-xs text-content-secondary mt-1 italic">{w.notes}</div>
                    )}
                  </div>
                  {w.areaM2 && (
                    <div className="text-xs font-orbitron text-content-muted">{w.areaM2} м²</div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CyberpunkCard>

      <WorkLogForm dealId={deal.id} status={deal.status} />
    </div>
  );
}

function fmt(d: string | null): string {
  if (!d) return '—';
  return d.split('-').reverse().join('.');
}
