import 'server-only';

import { db } from '@/lib/db';
import { eq, and, gte, lte, isNotNull, desc, asc, or } from 'drizzle-orm';
import { deals, type DealStatus } from '@/lib/db/schema/deals';
import { clients } from '@/lib/db/schema/clients';
import { users } from '@/lib/db/schema/users';

// SERVER-ONLY: запросы для календарей выездов.
// Для /manager/calendar — все сделки c assignedManagerId === user.id (или все, если admin)
// Для /master/calendar — все сделки с assignedMasterId === user.id

export type DealEvent = {
  id: string;
  contractNumber: string;
  startDate: Date | null;
  endDate: Date | null;
  /** Точный timestamp начала (UTC). Если is_all_day=true — время = 00:00 МСК. */
  startAt: Date | null;
  /** Точный timestamp окончания (UTC). Если is_all_day=true — время = 23:59 МСК. */
  endAt: Date | null;
  isAllDay: boolean;
  status: DealStatus;
  clientId: string | null;
  clientShortName: string | null;
  clientPhone: string | null;
  masterName: string | null;
  managerName: string | null;
  /** «Период» в человекочитаемом виде, e.g. "10 — 15 мая" */
  periodLabel: string;
  /** Здоровье: past / today / soon (≤7 дней) / future */
  health: 'past' | 'today' | 'soon' | 'future' | 'no-date';
};

function formatPeriod(start: Date | null, end: Date | null): string {
  if (!start && !end) return 'Без даты';
  const fmt = (d: Date) => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  if (start && end) {
    if (start.getTime() === end.getTime()) return fmt(start);
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
  const masterAlias = users;

  // Берём окно: от 60 дней назад до 365 вперёд.
  const since = new Date();
  since.setDate(since.getDate() - 60);
  const until = new Date();
  until.setDate(until.getDate() + 365);

  const conditions = [] as Array<ReturnType<typeof eq>>;

  if (mode.kind === 'master') {
    conditions.push(eq(deals.assignedMasterId, mode.userId));
  } else if (mode.kind === 'manager' && !mode.isAdmin) {
    conditions.push(eq(deals.assignedManagerId, mode.userId));
  }

  // Берём только сделки с хотя бы одной датой в окне (или вообще без дат — покажем секцией)
  conditions.push(
    or(
      and(isNotNull(deals.startDate), gte(deals.startDate, since.toISOString().slice(0, 10))),
      and(isNotNull(deals.endDate), gte(deals.endDate, since.toISOString().slice(0, 10))),
    )!,
  );

  const rows = await db
    .select({
      id: deals.id,
      contractNumber: deals.contractNumber,
      startDate: deals.startDate,
      endDate: deals.endDate,
      startAt: deals.startAt,
      endAt: deals.endAt,
      isAllDay: deals.isAllDay,
      status: deals.status,
      clientId: clients.id,
      clientShortName: clients.shortName,
      clientPhone: clients.phone,
      assignedMasterId: deals.assignedMasterId,
      assignedManagerId: deals.assignedManagerId,
    })
    .from(deals)
    .leftJoin(clients, eq(clients.id, deals.clientId))
    .where(and(...conditions))
    .orderBy(asc(deals.startDate), asc(deals.contractDate));

  // Подтягиваем имена ответственных одним запросом
  const userIds = new Set<string>();
  for (const r of rows) {
    if (r.assignedMasterId) userIds.add(r.assignedMasterId);
    if (r.assignedManagerId) userIds.add(r.assignedManagerId);
  }
  const userMap = new Map<string, string>();
  if (userIds.size > 0) {
    const usersRows = await db
      .select({ id: masterAlias.id, name: masterAlias.fullName })
      .from(masterAlias);
    for (const u of usersRows) userMap.set(u.id, u.name);
  }

  return rows.map((r) => {
    const start = r.startDate ? new Date(r.startDate) : null;
    const end = r.endDate ? new Date(r.endDate) : null;
    return {
      id: r.id,
      contractNumber: r.contractNumber,
      startDate: start,
      endDate: end,
      startAt: r.startAt ?? null,
      endAt: r.endAt ?? null,
      isAllDay: r.isAllDay ?? true,
      status: r.status,
      clientId: r.clientId,
      clientShortName: r.clientShortName,
      clientPhone: r.clientPhone,
      masterName: r.assignedMasterId ? userMap.get(r.assignedMasterId) ?? null : null,
      managerName: r.assignedManagerId ? userMap.get(r.assignedManagerId) ?? null : null,
      periodLabel: formatPeriod(start, end),
      health: computeHealth(start, end),
    };
  });
}

/** Сериализует DealEvent для передачи в client component (Date → ISO string). */
export function serializeForClient(events: DealEvent[]) {
  return events.map((e) => ({
    id: e.id,
    contractNumber: e.contractNumber,
    startDate: e.startDate ? e.startDate.toISOString().slice(0, 10) : null,
    endDate: e.endDate ? e.endDate.toISOString().slice(0, 10) : null,
    /** ISO 8601 с UTC offset (или null). FullCalendar парсит в timeZone='Europe/Moscow'. */
    startAt: e.startAt ? e.startAt.toISOString() : null,
    endAt: e.endAt ? e.endAt.toISOString() : null,
    isAllDay: e.isAllDay,
    status: e.status as string,
    clientShortName: e.clientShortName,
    clientPhone: e.clientPhone,
    masterName: e.masterName,
    managerName: e.managerName,
    health: e.health,
  }));
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
    // понедельник этой недели
    const day = ref.getDay() === 0 ? 7 : ref.getDay(); // sun=7
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
