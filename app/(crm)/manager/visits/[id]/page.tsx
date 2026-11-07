import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { CalendarClock, FileText, MapPin, User, Users, FlaskConical, StickyNote } from 'lucide-react';
import { requireRole } from '@/lib/auth/helpers';
import { db } from '@/lib/db';
import { deals, dealWorkLogs, dealWorkLogServices } from '@/lib/db/schema/deals';
import { clients } from '@/lib/db/schema/clients';
import { clientObjects } from '@/lib/db/schema/objects';
import { services } from '@/lib/db/schema/services';
import { users } from '@/lib/db/schema/users';
import { dealChecklistItems } from '@/lib/db/schema/checklists';
import { activityLog } from '@/lib/db/schema/activity';
import { workOrderRescheduleRequests } from '@/lib/db/schema/finance';
import { getPartnersByWorkLogIds } from '@/lib/visits/crew';
import { workOrderDate } from '@/lib/visits/order-date';
import { formatQuantity, unitLabel } from '@/lib/constants/units';
import { MSK_TZ } from '@/lib/datetime/msk';
import { formatRub, toKop } from '@/lib/finance/compute';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { PageTitle } from '@/components/crm/PageTitle';
import { Breadcrumbs, type Crumb } from '@/components/crm/Breadcrumbs';
import { VisitActButtons } from '@/components/crm/VisitActButtons';
import { WorkOrderPricingButton } from '@/components/crm/WorkOrderPricingButton';
import { WorkOrderCrewButton } from '@/components/crm/WorkOrderCrewButton';
import {
  WorkOrderCloseButton,
  WorkOrderEditButton,
} from '@/components/crm/WorkOrderManageButtons';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Заказ-наряд — ДезТехЮг CRM' };

const STATUS_LABEL: Record<string, string> = {
  planned: 'Запланирован',
  in_progress: 'В работе',
  completed: 'Выполнен',
};
const STATUS_CLASS: Record<string, string> = {
  planned: 'bg-sky-100 text-sky-800',
  in_progress: 'bg-amber-100 text-amber-800',
  completed: 'bg-emerald-100 text-emerald-800',
};
const ITEM_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'не отмечен', cls: 'text-content-muted' },
  done: { label: '✓ выполнено', cls: 'text-emerald-700' },
  na: { label: 'неприменимо', cls: 'text-amber-700' },
};
const RESCHED_STATUS: Record<string, string> = {
  pending: 'ждёт решения',
  approved: 'одобрен',
  rejected: 'отклонён',
  cancelled: 'снят',
};

function fmt(d: Date | null | undefined): string {
  if (!d) return '—';
  return d.toLocaleString('ru-RU', {
    timeZone: MSK_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmtIso(s: unknown): string {
  if (typeof s !== 'string' || !s) return 'без даты';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? 'без даты' : fmt(d);
}

/** Человекочитаемая строка журнала наряда. */
function journalLine(action: string, ch: Record<string, unknown>, names: Map<string, string>): string {
  const name = (id: unknown) => (typeof id === 'string' ? names.get(id) ?? 'мастер' : '—');
  switch (action) {
    case 'work_order.start':
      return 'Мастер нажал «Начать»';
    case 'work_order.finalize':
      return 'Мастер завершил выезд';
    case 'work_order.close_by_manager':
      return `Закрыт менеджером${ch.comment ? `: «${String(ch.comment)}»` : ''}`;
    case 'work_order.reschedule':
      return `Перенесён: ${fmtIso(ch.from)} → ${fmtIso(ch.to)}`;
    case 'work_order.reschedule_request':
      return `Мастер просит перенос на ${fmtIso(ch.to)}${ch.reason ? `: «${String(ch.reason)}»` : ''}`;
    case 'work_order.reschedule_rejected':
      return 'Запрос переноса отклонён';
    case 'work_order.crew_update':
      return 'Изменена бригада';
    case 'work_order.pricing':
      return 'Изменены цены / оплата мастеру';
    case 'work_order.edit': {
      const parts: string[] = [];
      const pa = ch.plannedAt as { from?: unknown; to?: unknown } | undefined;
      if (pa) parts.push(`дата ${fmtIso(pa.from)} → ${fmtIso(pa.to)}`);
      const m = ch.masterId as { from?: unknown; to?: unknown } | undefined;
      if (m) parts.push(`мастер ${name(m.from)} → ${name(m.to)}`);
      if (ch.partnerIds) parts.push('напарники');
      if (ch.objectId || ch.services) parts.push('объекты/услуги');
      if (ch.preparations) parts.push('препараты');
      if (ch.noMasterPay) parts.push('«документальный»');
      const c = ch.checklist as { added?: number; removed?: number; changed?: number } | undefined;
      if (c) {
        const bits = [
          c.added ? `+${c.added}` : '',
          c.removed ? `−${c.removed}` : '',
          c.changed ? `изм. ${c.changed}` : '',
        ].filter(Boolean);
        parts.push(`чеклист ${bits.join(' ')}`);
      }
      return `Отредактирован: ${parts.join(', ') || 'без изменений'}`;
    }
    default:
      return action;
  }
}

export default async function WorkOrderCardPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole('manager');
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const masterUser = alias(users, 'master_user');
  const [wl] = await db
    .select({
      id: dealWorkLogs.id,
      status: dealWorkLogs.status,
      plannedAt: dealWorkLogs.plannedAt,
      startedAt: dealWorkLogs.startedAt,
      finalizedAt: dealWorkLogs.finalizedAt,
      performedAt: dealWorkLogs.performedAt,
      createdAt: dealWorkLogs.createdAt,
      preparations: dealWorkLogs.preparations,
      noMasterPay: dealWorkLogs.noMasterPay,
      objectId: dealWorkLogs.objectId,
      masterId: dealWorkLogs.masterId,
      masterName: masterUser.fullName,
      dealId: deals.id,
      contractNumber: deals.contractNumber,
      clientId: clients.id,
      clientName: clients.shortName,
      objectName: clientObjects.name,
      objectAddress: clientObjects.address,
      contactPerson: clientObjects.contactPerson,
      contactPhone: clientObjects.contactPhone,
    })
    .from(dealWorkLogs)
    .innerJoin(deals, eq(deals.id, dealWorkLogs.dealId))
    .innerJoin(clients, eq(clients.id, deals.clientId))
    .leftJoin(clientObjects, eq(clientObjects.id, dealWorkLogs.objectId))
    .leftJoin(masterUser, eq(masterUser.id, dealWorkLogs.masterId))
    .where(eq(dealWorkLogs.id, id))
    .limit(1);
  if (!wl) notFound();

  const svcObject = alias(clientObjects, 'svc_object');
  const actor = alias(users, 'actor');
  const [partnersMap, svcRows, items, journal, requests] = await Promise.all([
    getPartnersByWorkLogIds([wl.id]),
    db
      .select({
        id: dealWorkLogServices.id,
        serviceName: services.name,
        customName: dealWorkLogServices.customName,
        method: dealWorkLogServices.method,
        unit: dealWorkLogServices.unit,
        quantity: dealWorkLogServices.quantity,
        price: dealWorkLogServices.price,
        priceSource: dealWorkLogServices.priceSource,
        objectId: dealWorkLogServices.objectId,
        objectName: svcObject.name,
        objectAddress: svcObject.address,
      })
      .from(dealWorkLogServices)
      .leftJoin(services, eq(services.id, dealWorkLogServices.serviceId))
      .leftJoin(svcObject, eq(svcObject.id, dealWorkLogServices.objectId))
      .where(eq(dealWorkLogServices.workLogId, wl.id))
      .orderBy(asc(dealWorkLogServices.sortOrder)),
    db
      .select({
        id: dealChecklistItems.id,
        title: dealChecklistItems.title,
        description: dealChecklistItems.description,
        required: dealChecklistItems.required,
        source: dealChecklistItems.source,
        status: dealChecklistItems.status,
        note: dealChecklistItems.note,
        photos: dealChecklistItems.photos,
        doneAt: dealChecklistItems.doneAt,
      })
      .from(dealChecklistItems)
      .where(eq(dealChecklistItems.workLogId, wl.id))
      .orderBy(asc(dealChecklistItems.position)),
    db
      .select({
        id: activityLog.id,
        action: activityLog.action,
        changes: activityLog.changesJson,
        createdAt: activityLog.createdAt,
        userName: actor.fullName,
      })
      .from(activityLog)
      .leftJoin(actor, eq(actor.id, activityLog.userId))
      .where(
        and(
          sql`${activityLog.changesJson}->>'workLogId' = ${wl.id}`,
          sql`${activityLog.action} LIKE 'work_order.%'`,
          sql`${activityLog.action} <> 'work_order.reschedule_request_notify'`,
        ),
      )
      .orderBy(desc(activityLog.createdAt))
      .limit(100),
    db
      .select({
        id: workOrderRescheduleRequests.id,
        fromAt: workOrderRescheduleRequests.fromAt,
        toAt: workOrderRescheduleRequests.toAt,
        reason: workOrderRescheduleRequests.reason,
        status: workOrderRescheduleRequests.status,
        decisionComment: workOrderRescheduleRequests.decisionComment,
        createdAt: workOrderRescheduleRequests.createdAt,
        requestedBy: actor.fullName,
      })
      .from(workOrderRescheduleRequests)
      .leftJoin(actor, eq(actor.id, workOrderRescheduleRequests.requestedById))
      .where(eq(workOrderRescheduleRequests.workLogId, wl.id))
      .orderBy(desc(workOrderRescheduleRequests.createdAt)),
  ]);

  const partners = partnersMap.get(wl.id) ?? [];
  const names = new Map<string, string>([
    [wl.masterId, wl.masterName ?? 'мастер'],
    ...partners.map((p) => [p.id, p.fullName ?? 'мастер'] as [string, string]),
  ]);
  const orderDate = workOrderDate(wl);
  const totalKop = svcRows.reduce((s, r) => s + (r.price ? toKop(r.price) ?? 0 : 0), 0);
  const unpriced = svcRows.filter((r) => !r.price).length;
  const status = wl.status as 'planned' | 'in_progress' | 'completed';
  const doneCount = items.filter((i) => i.status === 'done').length;

  const crumbs: Crumb[] = [
    { label: 'Клиенты', href: '/manager/clients' },
    { label: wl.clientName, href: `/manager/clients/${wl.clientId}` },
    { label: wl.contractNumber, href: `/manager/deals/${wl.dealId}?tab=visits` },
    ...(wl.objectId && wl.objectName
      ? [{ label: wl.objectName, href: `/manager/objects/${wl.objectId}` }]
      : []),
    { label: 'Наряд' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs items={crumbs} />
        <div className="flex items-start justify-between flex-wrap gap-3 mt-2">
          <div className="min-w-0">
            <PageTitle className="break-words">Заказ-наряд</PageTitle>
            <div className="text-sm text-content-muted mt-1 flex flex-wrap items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_CLASS[status] ?? ''}`}>
                {STATUS_LABEL[status] ?? status}
              </span>
              <span>{fmt(orderDate)}</span>
              {wl.noMasterPay && (
                <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700">
                  документальный
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <WorkOrderEditButton workLogId={wl.id} variant="button" />
            <WorkOrderCloseButton workLogId={wl.id} status={status} variant="button" />
            {status !== 'completed' && <WorkOrderCrewButton workLogId={wl.id} />}
            <WorkOrderPricingButton workLogId={wl.id} label />
            {wl.objectId && <VisitActButtons dealId={wl.dealId} workLogId={wl.id} />}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CyberpunkCard variant="default" hoverEffect={false} className="p-5 space-y-3 min-w-0">
          <h3 className="text-sm font-orbitron font-semibold tracking-wider uppercase">Наряд</h3>
          <Row icon={CalendarClock} label="Дата и время наряда" value={fmt(orderDate)} />
          <Row
            icon={CalendarClock}
            label="Факт"
            value={[
              `начат: ${fmt(wl.startedAt)}`,
              `закрыт: ${fmt(wl.finalizedAt)}`,
            ].join(' · ')}
          />
          <Row
            icon={User}
            label={partners.length > 0 ? 'Бригада' : 'Мастер'}
            value={[wl.masterName ?? '—', ...partners.map((p) => p.fullName ?? '—')].join(' + ')}
          />
          <Row
            icon={FileText}
            label="Клиент · договор"
            value={
              <span>
                <Link href={`/manager/clients/${wl.clientId}`} className="hover:text-neon-orange">
                  {wl.clientName}
                </Link>
                {' · '}
                <Link href={`/manager/deals/${wl.dealId}?tab=visits`} className="hover:text-neon-orange">
                  {wl.contractNumber}
                </Link>
              </span>
            }
          />
          {wl.objectId && (
            <Row
              icon={MapPin}
              label="Объект"
              value={
                <span>
                  <Link href={`/manager/objects/${wl.objectId}`} className="hover:text-neon-orange">
                    {wl.objectName}
                  </Link>
                  {wl.objectAddress ? ` · ${wl.objectAddress}` : ''}
                </span>
              }
            />
          )}
          {(wl.contactPerson || wl.contactPhone) && (
            <Row
              icon={Users}
              label="На месте"
              value={[wl.contactPerson, wl.contactPhone].filter(Boolean).join(', ')}
            />
          )}
          <Row icon={FlaskConical} label="Препараты" value={wl.preparations || '—'} />
          <p className="text-[11px] text-content-muted">
            Создан {fmt(wl.createdAt)}. Дату наряда «Начать»/«Завершить» мастера не меняют — только
            менеджер.
          </p>
        </CyberpunkCard>

        <CyberpunkCard variant="default" hoverEffect={false} className="p-5 min-w-0">
          <div className="flex items-baseline justify-between gap-2 flex-wrap mb-3">
            <h3 className="text-sm font-orbitron font-semibold tracking-wider uppercase">
              Услуги ({svcRows.length})
            </h3>
            <span className="text-sm">
              Итого: <b>{totalKop > 0 ? formatRub(totalKop) : '—'}</b>
              {unpriced > 0 && (
                <span className="text-xs text-amber-700 ml-1">без цены: {unpriced}</span>
              )}
            </span>
          </div>
          {svcRows.length === 0 ? (
            <p className="text-sm text-content-muted">Услуг нет.</p>
          ) : (
            <ul className="divide-y divide-gray-100 text-sm">
              {svcRows.map((s) => (
                <li key={s.id} className="py-2 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="break-words">{s.customName || s.serviceName || 'Услуга'}</div>
                    <div className="text-xs text-content-muted break-words">
                      {[
                        s.objectName ?? wl.objectName,
                        s.quantity ? `${formatQuantity(s.quantity)} ${unitLabel(s.unit)}` : '',
                        s.method ?? '',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div>{s.price ? formatRub(toKop(s.price) ?? 0) : '—'}</div>
                    {s.price && (
                      <div className="text-[11px] text-content-muted">
                        {s.priceSource === 'contract' ? 'из договора' : 'своя'}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CyberpunkCard>
      </div>

      <CyberpunkCard variant="default" hoverEffect={false} className="p-5 min-w-0">
        <h3 className="text-sm font-orbitron font-semibold tracking-wider uppercase mb-3">
          Чеклист ({doneCount}/{items.length})
        </h3>
        {items.length === 0 ? (
          <p className="text-sm text-content-muted">Пунктов нет.</p>
        ) : (
          <ul className="space-y-3">
            {items.map((it) => {
              const st = ITEM_STATUS[it.status] ?? ITEM_STATUS.pending;
              return (
                <li key={it.id} className="border-b border-gray-100 pb-3 last:border-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap text-sm">
                    <span className="min-w-0 break-words">
                      {it.title}
                      {it.required && <span className="text-red-500"> *</span>}
                      {it.source === 'master' && (
                        <span className="text-xs text-content-muted"> · добавил мастер</span>
                      )}
                    </span>
                    <span className={`text-xs shrink-0 ${st.cls}`}>
                      {st.label}
                      {it.doneAt ? ` · ${fmt(it.doneAt)}` : ''}
                    </span>
                  </div>
                  {it.description && (
                    <p className="text-xs text-content-muted mt-0.5 break-words">{it.description}</p>
                  )}
                  {it.note && (
                    <p className="text-xs mt-1 flex gap-1 break-words">
                      <StickyNote className="w-3.5 h-3.5 shrink-0 text-content-muted" />
                      {it.note}
                    </p>
                  )}
                  {(it.photos?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {it.photos.map((p) => (
                        <a
                          key={p.path}
                          href={`/api/storage/${encodeURI(p.path)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="block"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`/api/storage/${encodeURI(p.path)}`}
                            alt={it.title}
                            className="w-24 h-24 object-cover rounded border border-gray-200"
                            loading="lazy"
                          />
                        </a>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CyberpunkCard>

      {requests.length > 0 && (
        <CyberpunkCard variant="default" hoverEffect={false} className="p-5 min-w-0">
          <h3 className="text-sm font-orbitron font-semibold tracking-wider uppercase mb-3">
            Запросы мастера на перенос
          </h3>
          <ul className="space-y-2 text-sm">
            {requests.map((r) => (
              <li key={r.id} className="break-words">
                <b>{r.requestedBy ?? 'Мастер'}</b>: {fmt(r.fromAt)} → {fmt(r.toAt)} —{' '}
                «{r.reason}» <span className="text-content-muted">({RESCHED_STATUS[r.status] ?? r.status}
                {r.decisionComment ? `: ${r.decisionComment}` : ''})</span>
              </li>
            ))}
          </ul>
        </CyberpunkCard>
      )}

      <CyberpunkCard variant="default" hoverEffect={false} className="p-5 min-w-0">
        <h3 className="text-sm font-orbitron font-semibold tracking-wider uppercase mb-3">
          Журнал наряда
        </h3>
        {journal.length === 0 ? (
          <p className="text-sm text-content-muted">Записей нет.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {journal.map((j) => (
              <li key={j.id} className="break-words">
                <span className="text-content-muted">{fmt(j.createdAt)}</span>{' '}
                <b>{j.userName ?? '—'}</b>:{' '}
                {journalLine(j.action, (j.changes ?? {}) as Record<string, unknown>, names)}
              </li>
            ))}
          </ul>
        )}
      </CyberpunkCard>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 text-sm min-w-0">
      <Icon className="w-4 h-4 mt-0.5 text-neon-orange flex-shrink-0" />
      <div className="min-w-0">
        <div className="text-xs text-content-muted">{label}</div>
        <div className="break-words">{value}</div>
      </div>
    </div>
  );
}
