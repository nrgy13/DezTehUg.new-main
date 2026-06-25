import 'server-only';

import { db } from '@/lib/db';
import { eq, and, gte, or, asc, desc, inArray, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { deals, dealPriceItems, dealWorkLogs, dealWorkLogServices } from '@/lib/db/schema/deals';
import { clients } from '@/lib/db/schema/clients';
import { clientObjects } from '@/lib/db/schema/objects';
import { services } from '@/lib/db/schema/services';
import { users } from '@/lib/db/schema/users';
import { dealChecklistItems } from '@/lib/db/schema/checklists';

// SERVER-ONLY: запросы для календарей.
// Sprint 6: календарь показывает ВЫЕЗДЫ (work_logs), не периоды сделок.
// Каждое событие = один work_log по позиции прайса. Длительность по умолчанию
// 2 часа от plannedAt (или startedAt/performedAt — в зависимости от статуса).
//
// Для /manager/calendar — выезды всех сделок, где он assignedManager (admin видит всё).
// Для /master/calendar — выезды этого мастера.

export type VisitStatus = 'planned' | 'in_progress' | 'completed';

export type DealEvent = {
  /** workLogId — событие = выезд, не сделка. */
  id: string;
  /** dealId — для href и tooltip ссылки. */
  dealId: string;
  contractNumber: string;
  /** Дата только (YYYY-MM-DD), синтезируется из plannedAt/performedAt для backward-compat MiniCalendar. */
  startDate: Date | null;
  endDate: Date | null;
  /** Точный timestamp начала выезда (planned/started/performed). */
  startAt: Date | null;
  /** start + 2 часа (default duration) или performedAt для completed. */
  endAt: Date | null;
  /** Всегда false — выезды позиционные, с конкретным временем. */
  isAllDay: boolean;
  /** workLog status. */
  status: VisitStatus;
  clientId: string | null;
  clientShortName: string | null;
  clientPhone: string | null;
  masterName: string | null;
  managerName: string | null;
  /** Заголовок: услуга + объект. */
  serviceTitle: string;
  objectName: string | null;
  periodLabel: string;
  health: 'past' | 'today' | 'soon' | 'future' | 'no-date';
};

const DEFAULT_VISIT_HOURS = 2;

function addHours(d: Date, h: number): Date {
  return new Date(d.getTime() + h * 60 * 60 * 1000);
}

function formatPeriod(start: Date | null, end: Date | null): string {
  if (!start && !end) return 'Без даты';
  const fmt = (d: Date) =>
    d.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  if (start && end) {
    if (Math.abs(end.getTime() - start.getTime()) < 60_000) return fmt(start);
    return `${fmt(start)} — ${fmt(end)}`;
  }
  return start ? `с ${fmt(start)}` : `до ${fmt(end!)}`;
}

function computeHealth(
  start: Date | null,
  end: Date | null,
): DealEvent['health'] {
  if (!start && !end) return 'no-date';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const ref = end ?? start!;
  const refDay = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const diffDays = Math.floor((refDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (start) {
    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    if (
      startDay.getTime() <= today.getTime() &&
      (end ? today.getTime() <= refDay.getTime() : startDay.getTime() === today.getTime())
    ) {
      return 'today';
    }
  }
  if (diffDays < 0) return 'past';
  if (diffDays === 0) return 'today';
  if (diffDays <= 7) return 'soon';
  return 'future';
}

type Mode =
  | { kind: 'master'; userId: string }
  | { kind: 'manager'; userId: string; isAdmin: boolean };

export async function getDealEvents(mode: Mode): Promise<DealEvent[]> {
  // Окно: 60 дней назад – 365 вперёд (по плановой дате выезда).
  const since = new Date();
  since.setDate(since.getDate() - 60);

  const masterAlias = alias(users, 'master_user');
  const managerAlias = alias(users, 'manager_user');
  // Объект заказ-наряда — напрямую по dealWorkLogs.objectId (а не через позицию прайса).
  const woObjects = alias(clientObjects, 'wo_object');

  const conditions: SQL[] = [];

  // Мастер видит только свои выезды. Менеджер/админ — ВСЕ выезды (Релиз B:
  // операционный календарь общий, менеджер по факту один, мастера общие).
  if (mode.kind === 'master') {
    conditions.push(eq(dealWorkLogs.masterId, mode.userId));
  }

  // Активный календарь — только запланированные и в работе.
  // Выполненные выезды уходят в отдельную «Историю» (getVisitHistory).
  conditions.push(inArray(dealWorkLogs.status, ['planned', 'in_progress']));

  // Берём только выезды с датой в окне (или вообще без даты — покажем в «no-date»)
  conditions.push(
    or(
      gte(dealWorkLogs.plannedAt, since),
      gte(dealWorkLogs.startedAt, since),
      gte(dealWorkLogs.performedAt, since),
      gte(dealWorkLogs.finalizedAt, since),
    )!,
  );

  const rows = await db
    .select({
      workLogId: dealWorkLogs.id,
      status: dealWorkLogs.status,
      plannedAt: dealWorkLogs.plannedAt,
      startedAt: dealWorkLogs.startedAt,
      performedAt: dealWorkLogs.performedAt,
      finalizedAt: dealWorkLogs.finalizedAt,
      dealId: deals.id,
      contractNumber: deals.contractNumber,
      assignedMasterId: deals.assignedMasterId,
      assignedManagerId: deals.assignedManagerId,
      clientId: clients.id,
      clientShortName: clients.shortName,
      clientPhone: clients.phone,
      serviceShortName: services.shortName,
      serviceName: services.name,
      customName: dealPriceItems.customName,
      objectName: clientObjects.name,
      workLogObjectId: dealWorkLogs.objectId,
      woObjectName: woObjects.name,
      masterFullName: masterAlias.fullName,
      managerFullName: managerAlias.fullName,
    })
    .from(dealWorkLogs)
    .leftJoin(deals, eq(deals.id, dealWorkLogs.dealId))
    .leftJoin(clients, eq(clients.id, deals.clientId))
    .leftJoin(dealPriceItems, eq(dealPriceItems.id, dealWorkLogs.priceItemId))
    .leftJoin(services, eq(services.id, dealPriceItems.serviceId))
    .leftJoin(clientObjects, eq(clientObjects.id, dealPriceItems.objectId))
    .leftJoin(woObjects, eq(woObjects.id, dealWorkLogs.objectId))
    .leftJoin(masterAlias, eq(masterAlias.id, deals.assignedMasterId))
    .leftJoin(managerAlias, eq(managerAlias.id, deals.assignedManagerId))
    .where(and(...conditions))
    .orderBy(asc(dealWorkLogs.plannedAt));

  // Объект-выезды (заказ-наряды): услуги берём из snapshot deal_work_log_services
  // (несколько услуг на выезд), а не из позиции прайса.
  const woIds = rows.filter((r) => r.workLogObjectId).map((r) => r.workLogId);
  const svcByWl = new Map<string, string[]>();
  if (woIds.length > 0) {
    const woSvc = await db
      .select({
        workLogId: dealWorkLogServices.workLogId,
        customName: dealWorkLogServices.customName,
        serviceName: services.name,
        serviceShortName: services.shortName,
      })
      .from(dealWorkLogServices)
      .leftJoin(services, eq(services.id, dealWorkLogServices.serviceId))
      .where(inArray(dealWorkLogServices.workLogId, woIds))
      .orderBy(asc(dealWorkLogServices.sortOrder));
    for (const s of woSvc) {
      const label = s.customName || s.serviceShortName || s.serviceName || 'Услуга';
      const arr = svcByWl.get(s.workLogId) ?? [];
      arr.push(label);
      svcByWl.set(s.workLogId, arr);
    }
  }

  return rows.map((r) => {
    // Выбираем start для отображения исходя из статуса:
    // - planned: plannedAt
    // - in_progress: startedAt (если есть) или plannedAt
    // - completed: performedAt/finalizedAt (если есть) или startedAt/plannedAt
    const status = r.status as VisitStatus;
    let start: Date | null = null;
    let end: Date | null = null;

    // NB: completed-выезды отфильтрованы из этого запроса (inArray planned/in_progress выше),
    // поэтому ветка completed недостижима — выполненные обрабатываются в getVisitHistory.
    // Оставлена для полноты switch по статусу.
    if (status === 'completed') {
      start = r.performedAt ?? r.startedAt ?? r.plannedAt;
      end = r.finalizedAt ?? (start ? addHours(start, DEFAULT_VISIT_HOURS) : null);
    } else if (status === 'in_progress') {
      start = r.startedAt ?? r.plannedAt;
      end = start ? addHours(start, DEFAULT_VISIT_HOURS) : null;
    } else {
      start = r.plannedAt;
      end = start ? addHours(start, DEFAULT_VISIT_HOURS) : null;
    }

    const woServiceTitle = svcByWl.get(r.workLogId)?.join(', ');
    const serviceTitle =
      woServiceTitle || r.customName || r.serviceShortName || r.serviceName || 'Без услуги';

    return {
      id: r.workLogId,
      dealId: r.dealId ?? '',
      contractNumber: r.contractNumber ?? '—',
      // startDate/endDate — для MiniCalendar (highlight days с событиями).
      startDate: start,
      endDate: end,
      startAt: start,
      endAt: end,
      isAllDay: false,
      status,
      clientId: r.clientId,
      clientShortName: r.clientShortName,
      clientPhone: r.clientPhone,
      masterName: r.masterFullName,
      managerName: r.managerFullName,
      serviceTitle,
      objectName: r.woObjectName ?? r.objectName,
      periodLabel: formatPeriod(start, end),
      health: computeHealth(start, end),
    };
  });
}

/** Сериализует DealEvent для передачи в client component (Date → ISO string). */
export function serializeForClient(events: DealEvent[]) {
  return events.map((e) => ({
    id: e.id,
    dealId: e.dealId,
    contractNumber: e.contractNumber,
    startDate: e.startDate ? toLocalDateISO(e.startDate) : null,
    endDate: e.endDate ? toLocalDateISO(e.endDate) : null,
    startAt: e.startAt ? e.startAt.toISOString() : null,
    endAt: e.endAt ? e.endAt.toISOString() : null,
    isAllDay: e.isAllDay,
    status: e.status as string,
    clientShortName: e.clientShortName,
    clientPhone: e.clientPhone,
    masterName: e.masterName,
    managerName: e.managerName,
    serviceTitle: e.serviceTitle,
    objectName: e.objectName,
    health: e.health,
  }));
}

function toLocalDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export type EventGroup = {
  key: string;
  label: string;
  events: DealEvent[];
};

/** Группирует события по неделе (понедельник как старт). */
export function groupByWeek(events: DealEvent[]): EventGroup[] {
  const map = new Map<string, DealEvent[]>();
  for (const e of events) {
    const ref = e.startDate ?? e.endDate;
    if (!ref) {
      const arr = map.get('no-date') ?? [];
      arr.push(e);
      map.set('no-date', arr);
      continue;
    }
    const day = ref.getDay() === 0 ? 7 : ref.getDay();
    const monday = new Date(ref);
    monday.setDate(ref.getDate() - (day - 1));
    monday.setHours(0, 0, 0, 0);
    const key = monday.toISOString().slice(0, 10);
    const arr = map.get(key) ?? [];
    arr.push(e);
    map.set(key, arr);
  }

  const out: EventGroup[] = [];
  const keys = Array.from(map.keys()).sort();
  for (const key of keys) {
    if (key === 'no-date') continue;
    const monday = new Date(key);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const fmt = (d: Date) => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    out.push({
      key,
      label: `${fmt(monday)} — ${fmt(sunday)}`,
      events: map.get(key)!,
    });
  }
  if (map.has('no-date')) {
    out.push({ key: 'no-date', label: 'Без даты', events: map.get('no-date')! });
  }
  return out;
}

// ─── История выполненных выездов ──────────────────────────────
export type VisitHistoryItem = {
  /** workLogId. */
  id: string;
  dealId: string;
  contractNumber: string;
  clientShortName: string | null;
  /** Мастер, выполнивший выезд (work_log.masterId, не назначенный по сделке). */
  masterName: string | null;
  objectName: string | null;
  /** Дата выполнения (performedAt ?? finalizedAt ?? startedAt ?? plannedAt). */
  completedAt: Date | null;
  services: string[];
  preparations: string | null;
  checklistDone: number;
  checklistTotal: number;
};

/**
 * История выполненных выездов (status = completed). БЕЗ ограничения по давности —
 * вся история, новые сверху (по дате выполнения). Для вкладки «История» в
 * календаре менеджера и кабинете мастера.
 */
export async function getVisitHistory(mode: Mode): Promise<VisitHistoryItem[]> {
  const masterAlias = alias(users, 'master_user');
  const woObjects = alias(clientObjects, 'wo_object');

  const conditions: SQL[] = [eq(dealWorkLogs.status, 'completed')];
  if (mode.kind === 'master') {
    conditions.push(eq(dealWorkLogs.masterId, mode.userId));
  }

  const rows = await db
    .select({
      workLogId: dealWorkLogs.id,
      preparations: dealWorkLogs.preparations,
      plannedAt: dealWorkLogs.plannedAt,
      startedAt: dealWorkLogs.startedAt,
      performedAt: dealWorkLogs.performedAt,
      finalizedAt: dealWorkLogs.finalizedAt,
      dealId: deals.id,
      contractNumber: deals.contractNumber,
      clientShortName: clients.shortName,
      serviceShortName: services.shortName,
      serviceName: services.name,
      customName: dealPriceItems.customName,
      objectName: clientObjects.name,
      workLogObjectId: dealWorkLogs.objectId,
      woObjectName: woObjects.name,
      masterFullName: masterAlias.fullName,
    })
    .from(dealWorkLogs)
    .leftJoin(deals, eq(deals.id, dealWorkLogs.dealId))
    .leftJoin(clients, eq(clients.id, deals.clientId))
    .leftJoin(dealPriceItems, eq(dealPriceItems.id, dealWorkLogs.priceItemId))
    .leftJoin(services, eq(services.id, dealPriceItems.serviceId))
    .leftJoin(clientObjects, eq(clientObjects.id, dealPriceItems.objectId))
    .leftJoin(woObjects, eq(woObjects.id, dealWorkLogs.objectId))
    .leftJoin(masterAlias, eq(masterAlias.id, dealWorkLogs.masterId))
    .where(and(...conditions))
    // Предохранитель от неограниченного роста истории. finalizedAt у completed всегда
    // проставлен (finalizeVisit). Точный порядок (по completedAt) — in-memory sort ниже.
    .orderBy(desc(dealWorkLogs.finalizedAt))
    .limit(500);

  const wlIds = rows.map((r) => r.workLogId);

  // Услуги заказ-нарядов берём из snapshot (несколько услуг на выезд).
  const svcByWl = new Map<string, string[]>();
  const woIds = rows.filter((r) => r.workLogObjectId).map((r) => r.workLogId);
  if (woIds.length > 0) {
    const woSvc = await db
      .select({
        workLogId: dealWorkLogServices.workLogId,
        customName: dealWorkLogServices.customName,
        serviceName: services.name,
        serviceShortName: services.shortName,
      })
      .from(dealWorkLogServices)
      .leftJoin(services, eq(services.id, dealWorkLogServices.serviceId))
      .where(inArray(dealWorkLogServices.workLogId, woIds))
      .orderBy(asc(dealWorkLogServices.sortOrder));
    for (const s of woSvc) {
      const label = s.customName || s.serviceShortName || s.serviceName || 'Услуга';
      const arr = svcByWl.get(s.workLogId) ?? [];
      arr.push(label);
      svcByWl.set(s.workLogId, arr);
    }
  }

  // Чеклист: done/total на каждый выезд (in-memory подсчёт).
  const doneByWl = new Map<string, number>();
  const totalByWl = new Map<string, number>();
  if (wlIds.length > 0) {
    const items = await db
      .select({ workLogId: dealChecklistItems.workLogId, status: dealChecklistItems.status })
      .from(dealChecklistItems)
      .where(inArray(dealChecklistItems.workLogId, wlIds));
    for (const it of items) {
      totalByWl.set(it.workLogId, (totalByWl.get(it.workLogId) ?? 0) + 1);
      if (it.status === 'done') {
        doneByWl.set(it.workLogId, (doneByWl.get(it.workLogId) ?? 0) + 1);
      }
    }
  }

  const out: VisitHistoryItem[] = rows.map((r) => {
    const completedAt = r.performedAt ?? r.finalizedAt ?? r.startedAt ?? r.plannedAt;
    const woServices = svcByWl.get(r.workLogId);
    const visitServices =
      woServices && woServices.length > 0
        ? woServices
        : [r.customName || r.serviceShortName || r.serviceName || 'Без услуги'];
    return {
      id: r.workLogId,
      dealId: r.dealId ?? '',
      contractNumber: r.contractNumber ?? '—',
      clientShortName: r.clientShortName,
      masterName: r.masterFullName,
      objectName: r.woObjectName ?? r.objectName,
      completedAt,
      services: visitServices,
      preparations: r.preparations,
      checklistDone: doneByWl.get(r.workLogId) ?? 0,
      checklistTotal: totalByWl.get(r.workLogId) ?? 0,
    };
  });

  // Новые сверху — по дате выполнения.
  out.sort((a, b) => {
    const ta = a.completedAt ? a.completedAt.getTime() : 0;
    const tb = b.completedAt ? b.completedAt.getTime() : 0;
    return tb - ta;
  });

  return out;
}

export type SerializedVisitHistoryItem = Omit<VisitHistoryItem, 'completedAt'> & {
  completedAt: string | null;
};

/** Сериализует историю для client component (Date → ISO). */
export function serializeVisitHistory(items: VisitHistoryItem[]): SerializedVisitHistoryItem[] {
  return items.map((i) => ({
    ...i,
    completedAt: i.completedAt ? i.completedAt.toISOString() : null,
  }));
}
