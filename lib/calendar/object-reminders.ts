import 'server-only';

import { db } from '@/lib/db';
import { and, eq, isNotNull, inArray } from 'drizzle-orm';
import { clientObjects, clientObjectServices } from '@/lib/db/schema/objects';
import { clients } from '@/lib/db/schema/clients';
import { deals, dealWorkLogs } from '@/lib/db/schema/deals';
import { services } from '@/lib/db/schema/services';

// SERVER-ONLY: виртуальные напоминания «по графику нужен заказ-наряд».
// Релиз B (цикл): из периодичности услуг объекта (client_object_services.frequency)
// строим серию дат вперёд (опорная = client_objects.planned_treatment_date).
// Флажок = (объект, дата). Гаснет, если по объекту уже есть выезд на этот день.
// БД циклом НЕ мутируется — это чистая проекция, всё обратимо (удалил наряд → флажок вернулся).

export type ReminderHealth = 'overdue' | 'today' | 'soon' | 'future';

export type ObjectReminder = {
  /** objectId|date — стабильный ключ для React. */
  key: string;
  objectId: string;
  objectName: string;
  address: string;
  clientId: string;
  clientShortName: string;
  /** Договор для предзаполнения формы (объекта или первый договор клиента). */
  dealId: string | null;
  contractNumber: string | null;
  /** Дата обработки по графику (YYYY-MM-DD). */
  date: string;
  /** Услуги, попадающие на эту дату по графику. */
  servicesLabel: string;
  health: ReminderHealth;
};

type Mode = { userId: string; isAdmin: boolean };

// Горизонт серии вперёд + окно показа просрочки назад.
const HORIZON_MONTHS = 3;
const OVERDUE_WINDOW_DAYS = 14;

// frequency → шаг в месяцах. 'Разово' — одна дата (без повтора). Остальное (По заявке/пусто) — без серии.
const FREQ_MONTHS: Record<string, number> = {
  Ежемесячно: 1,
  'Раз в 2 месяца': 2,
  Ежеквартально: 3,
  'Раз в полгода': 6,
  Ежегодно: 12,
};

// YYYY-MM-DD в Europe/Moscow (en-CA локаль даёт ISO-формат даты).
function mskISO(dt: Date): string {
  return dt.toLocaleDateString('en-CA', { timeZone: 'Europe/Moscow' });
}

function addMonthsISO(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + months, d)).toISOString().slice(0, 10);
}
function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Даты серии услуги в окне [windowStart, horizon]. */
function seriesDates(d0: string, freq: string, windowStart: string, horizon: string): string[] {
  if (freq === 'Разово') return d0 >= windowStart && d0 <= horizon ? [d0] : [];
  const months = FREQ_MONTHS[freq];
  if (!months) return []; // «По заявке» / неизвестное — без авто-серии
  const out: string[] = [];
  let cur = d0;
  let guard = 0;
  while (cur < windowStart && guard < 2000) {
    cur = addMonthsISO(cur, months);
    guard++;
  }
  while (cur <= horizon && guard < 2000) {
    out.push(cur);
    cur = addMonthsISO(cur, months);
    guard++;
  }
  return out;
}

function healthOf(date: string, todayISO: string, soonISO: string): ReminderHealth {
  if (date < todayISO) return 'overdue';
  if (date === todayISO) return 'today';
  if (date <= soonISO) return 'soon';
  return 'future';
}

/**
 * Серия напоминаний для менеджера (admin видит всё). Только объекты:
 * - с плановой датой обработки (опорная точка цикла),
 * - с услугами, у которых задана периодическая частота,
 * - у клиента есть хотя бы один договор (иначе наряд не оформить).
 */
export async function getObjectReminders(mode: Mode): Promise<ObjectReminder[]> {
  const todayISO = mskISO(new Date());
  const windowStart = addDaysISO(todayISO, -OVERDUE_WINDOW_DAYS);
  const horizon = addMonthsISO(todayISO, HORIZON_MONTHS);
  const soonISO = addDaysISO(todayISO, 7);

  // 1) Объекты с плановой датой.
  const objectRows = await db
    .select({
      id: clientObjects.id,
      name: clientObjects.name,
      address: clientObjects.address,
      clientId: clientObjects.clientId,
      dealId: clientObjects.dealId,
      plannedTreatmentDate: clientObjects.plannedTreatmentDate,
    })
    .from(clientObjects)
    .where(isNotNull(clientObjects.plannedTreatmentDate));
  if (objectRows.length === 0) return [];

  const objectIds = objectRows.map((o) => o.id);
  const clientIds = Array.from(new Set(objectRows.map((o) => o.clientId)));

  // 2) Услуги этих объектов (для серии берём только с частотой).
  const [svcRows, dealRows, clientRows, workLogRows] = await Promise.all([
    db
      .select({
        objectId: clientObjectServices.objectId,
        customName: clientObjectServices.customName,
        serviceName: services.name,
        frequency: clientObjectServices.frequency,
      })
      .from(clientObjectServices)
      .leftJoin(services, eq(clientObjectServices.serviceId, services.id))
      .where(
        and(
          inArray(clientObjectServices.objectId, objectIds),
          isNotNull(clientObjectServices.frequency),
        ),
      ),
    db
      .select({
        id: deals.id,
        contractNumber: deals.contractNumber,
        clientId: deals.clientId,
        managerId: deals.assignedManagerId,
      })
      .from(deals)
      .where(inArray(deals.clientId, clientIds)),
    db
      .select({ id: clients.id, shortName: clients.shortName })
      .from(clients)
      .where(inArray(clients.id, clientIds)),
    db
      .select({
        objectId: dealWorkLogs.objectId,
        plannedAt: dealWorkLogs.plannedAt,
        startedAt: dealWorkLogs.startedAt,
        performedAt: dealWorkLogs.performedAt,
        finalizedAt: dealWorkLogs.finalizedAt,
      })
      .from(dealWorkLogs)
      .where(inArray(dealWorkLogs.objectId, objectIds)),
  ]);

  // Услуги по объекту (только периодические/разовые).
  const svcByObject = new Map<string, { label: string; frequency: string }[]>();
  for (const s of svcRows) {
    if (!s.frequency) continue;
    const label = s.customName ?? s.serviceName ?? 'Услуга';
    const arr = svcByObject.get(s.objectId) ?? [];
    arr.push({ label, frequency: s.frequency });
    svcByObject.set(s.objectId, arr);
  }

  // Договоры по клиенту (для прав + предзаполнения dealId).
  const dealsByClient = new Map<string, typeof dealRows>();
  for (const d of dealRows) {
    const arr = dealsByClient.get(d.clientId) ?? [];
    arr.push(d);
    dealsByClient.set(d.clientId, arr);
  }
  const clientName = new Map(clientRows.map((c) => [c.id, c.shortName]));
  const dealById = new Map(dealRows.map((d) => [d.id, d]));

  // Гашение: дни, на которые по объекту уже есть выезд (Europe/Moscow).
  const visitDays = new Set<string>();
  for (const w of workLogRows) {
    if (!w.objectId) continue;
    const dt = w.plannedAt ?? w.performedAt ?? w.startedAt ?? w.finalizedAt;
    if (!dt) continue;
    visitDays.add(`${w.objectId}|${mskISO(dt)}`);
  }

  const reminders: ObjectReminder[] = [];
  for (const obj of objectRows) {
    const d0 = obj.plannedTreatmentDate;
    if (!d0) continue;
    const svcs = svcByObject.get(obj.id);
    if (!svcs || svcs.length === 0) continue;

    const clientDeals = dealsByClient.get(obj.clientId) ?? [];
    if (clientDeals.length === 0) continue; // нет договора — наряд не оформить

    // Релиз B: менеджер/админ видят напоминания по всем клиентам с договором
    // (операционный календарь общий — фильтр по менеджеру убран).

    // dealId для предзаполнения: договор объекта → иначе «мой» договор → иначе первый.
    const ownDeal = obj.dealId ? dealById.get(obj.dealId) : null;
    const preferred =
      ownDeal ??
      clientDeals.find((d) => d.managerId === mode.userId) ??
      clientDeals[0];

    // Серия по каждой услуге → группировка по дате.
    const dateToLabels = new Map<string, string[]>();
    for (const svc of svcs) {
      for (const date of seriesDates(d0, svc.frequency, windowStart, horizon)) {
        if (visitDays.has(`${obj.id}|${date}`)) continue; // уже оформлен наряд на этот день
        const arr = dateToLabels.get(date) ?? [];
        arr.push(svc.label);
        dateToLabels.set(date, arr);
      }
    }

    for (const [date, labels] of Array.from(dateToLabels.entries())) {
      reminders.push({
        key: `${obj.id}|${date}`,
        objectId: obj.id,
        objectName: obj.name,
        address: obj.address,
        clientId: obj.clientId,
        clientShortName: clientName.get(obj.clientId) ?? '—',
        dealId: preferred?.id ?? null,
        contractNumber: preferred?.contractNumber ?? null,
        date,
        servicesLabel: Array.from(new Set(labels)).join(', '),
        health: healthOf(date, todayISO, soonISO),
      });
    }
  }

  reminders.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return reminders;
}

/** Число «горящих» напоминаний (просрочено/сегодня/скоро) — для виджета дашборда. */
export async function countDueReminders(mode: Mode): Promise<number> {
  const all = await getObjectReminders(mode);
  return all.filter((r) => r.health !== 'future').length;
}
