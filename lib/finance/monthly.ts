import 'server-only';

/**
 * Данные месяца для сводки (11.2026): ОДИН источник для дашборда, страницы «Сводка месяца» и
 * Excel-выгрузки — чтобы цифры везде совпадали до копейки.
 *
 * Месяц считаем по МСК. Наряд попадает в месяц:
 *  - по ДАТЕ НАРЯДА = плановой (07.11.2026, lib/visits/order-date.ts): «Начать»/«Завершить»
 *    у мастера её не двигают; без плана — по факту (performed/finalized/started);
 *  - запланированный/в работе — для графика мастеров; в деньги не идёт.
 * Деньги — только по выполненным нарядам (начисление по факту работы, не по договору).
 */

import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { CLIENT_REFUSAL_REASONS, type ClientRefusalReason } from '@/lib/db/schema/clients';
import {
  type Kopecks,
  type PayRate,
  type MasterShare,
  type MonthPay,
  toKop,
  workOrderCost,
  masterSharesForOrder,
  monthPay,
  isRecurringFrequency,
} from './compute';

function getRows<T>(result: unknown): T[] {
  return ((result as { rows?: unknown[] }).rows ?? result) as T[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Литерал массива uuid для `${x}::uuid[]`; в строке только проверенные uuid (не инъекция). */
function pgUuidArray(ids: string[]): string {
  return `{${ids.filter((id) => UUID_RE.test(id)).join(',')}}`;
}

/** 'YYYY-MM' → { start: 'YYYY-MM-01', next: 'YYYY-MM-01' следующего, end: последний день }. */
export function monthBounds(month: string): { start: string; next: string; end: string } {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) throw new Error(`Некорректный месяц: ${month}`);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) throw new Error(`Некорректный месяц: ${month}`);
  const pad = (n: number) => String(n).padStart(2, '0');
  const ny = mo === 12 ? y + 1 : y;
  const nmo = mo === 12 ? 1 : mo + 1;
  const lastDay = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return {
    start: `${y}-${pad(mo)}-01`,
    next: `${ny}-${pad(nmo)}-01`,
    end: `${y}-${pad(mo)}-${pad(lastDay)}`,
  };
}

export function shiftMonth(month: string, delta: number): string {
  const [y, mo] = month.split('-').map(Number);
  const idx = y * 12 + (mo - 1) + delta;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
}

/** Текущий месяц по МСК: 'YYYY-MM'. */
export function currentMskMonth(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  return `${y}-${m}`;
}

export function isValidMonth(v: string | undefined | null): v is string {
  return !!v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
}

// ─── Типы ────────────────────────────────────────────────────────

export type MonthOrderService = {
  name: string;
  objectName: string | null;
  quantity: string | null;
  unit: string;
  priceKop: Kopecks | null;
  priceSource: string | null;
};

export type MonthOrder = {
  id: string;
  status: 'planned' | 'in_progress' | 'completed';
  /** День наряда (МСК, YYYY-MM-DD). */
  day: string;
  /** Время (МСК, HH:MM): начало работы, иначе план; null — без времени. */
  time: string | null;
  plannedAt: string | null;
  startedAt: string | null;
  finalizedAt: string | null;
  dealId: string;
  contractNumber: string;
  clientId: string;
  clientName: string;
  objects: { id: string; name: string; address: string }[];
  services: MonthOrderService[];
  preparations: string | null;
  crew: { id: string; name: string }[];
  noMasterPay: boolean;
  recurring: boolean;
  /** Стоимость (только completed; null — без цены). */
  costKop: Kopecks | null;
  /** 'full' — у всех строк цена, 'partial' — у части, 'none' — нет. */
  priceStatus: 'full' | 'partial' | 'none';
  shares: (MasterShare & { name: string })[];
  /** Сколько одобренных переносов было у наряда (за всё время). */
  approvedReschedules: number;
};

export type MonthReschedule = {
  id: string;
  workLogId: string;
  createdAt: string;
  masterName: string;
  clientName: string;
  objectName: string | null;
  fromAt: string | null;
  toAt: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  decidedByName: string | null;
  decidedAt: string | null;
  decisionComment: string | null;
};

export type MonthMasterRow = MonthPay & {
  name: string;
  isActive: boolean;
  ordersCompleted: number;
  ordersUnpriced: number;
  revenueKop: Kopecks;
  rescheduleRequests: number;
  hasRate: boolean;
};

export type MonthKpis = {
  month: string;
  revenueKop: Kopecks;
  recurringRevenueKop: Kopecks;
  oneTimeRevenueKop: Kopecks;
  ordersCompleted: number;
  ordersPriced: number;
  ordersUnpriced: number;
  ordersOpen: number;
  avgTicketKop: Kopecks | null;
  masterEarnedKop: Kopecks;
  /** Доплаты до минималки, ВКЛЮЧЁННЫЕ в выплаты (только у закончившегося месяца). */
  masterTopUpKop: Kopecks;
  /** Доплаты до минималки «если месяц закончится так» — у идущего месяца (в выплаты/маржу не входят). */
  projectedTopUpKop: Kopecks;
  masterPayKop: Kopecks;
  /** Месяц закончился (по МСК). Пока идёт — минималка гарантируется только в конце месяца. */
  monthComplete: boolean;
  /** Хоть у одного мастера есть ставка на конец месяца (иначе выплаты/маржа — н/д, а не 0). */
  anyRate: boolean;
  grossMarginKop: Kopecks;
  marginPct: number | null;
  documentaryCount: number;
  documentaryRevenueKop: Kopecks;
  marginExDocPct: number | null;
  activeMasters: number;
  revenuePerMasterKop: Kopecks | null;
  rescheduleRequests: number;
  rescheduleApproved: number;
  rescheduleRatePct: number | null;
  onTimeCount: number;
  onTimeBase: number;
  onTimePct: number | null;
  top5SharePct: number | null;
  clientsServed: number;
  newClients: number;
  refusedInMonth: number;
  churnPct: number | null;
  leads: number;
  leadsConverted: number;
  leadConversionPct: number | null;
};

export type MonthClientsBlock = {
  total: number;
  byStatus: Record<string, number>;
  refusedByReason: { reason: string; label: string; count: number }[];
  refusedInMonth: { id: string; name: string; reason: string; comment: string | null; at: string }[];
  newInMonth: { id: string; name: string; createdAt: string }[];
  topClients: { id: string; name: string; revenueKop: Kopecks; orders: number }[];
};

export type MonthData = {
  month: string;
  bounds: { start: string; next: string; end: string };
  orders: MonthOrder[];
  masters: MonthMasterRow[];
  reschedules: MonthReschedule[];
  clients: MonthClientsBlock;
  kpis: MonthKpis;
};

/** День по МСК из ISO-времени: 'YYYY-MM-DD'. */
function mskDay(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

function pct(num: number, den: number): number | null {
  if (!den) return null;
  return Math.round((num / den) * 1000) / 10;
}

// ─── Сборка месяца ────────────────────────────────────────────────

export async function getMonthData(month: string): Promise<MonthData> {
  const bounds = monthBounds(month);
  const { start, next, end } = bounds;

  // 1) Наряды месяца (все статусы) с датой по МСК.
  const orderRows = getRows<{
    id: string;
    status: 'planned' | 'in_progress' | 'completed';
    day: string;
    time: string | null;
    planned_at: string | null;
    started_at: string | null;
    finalized_at: string | null;
    deal_id: string;
    contract_number: string;
    client_id: string;
    client_name: string;
    object_id: string | null;
    master_id: string;
    preparations: string | null;
    no_master_pay: boolean;
  }>(
    await db.execute(sql`
      WITH wl AS (
        SELECT w.*,
          COALESCE(w.planned_at, w.performed_at, w.finalized_at, w.started_at) AS eff_at
        FROM deal_work_logs w
      )
      SELECT wl.id, wl.status,
        to_char(wl.eff_at AT TIME ZONE 'Europe/Moscow', 'YYYY-MM-DD') AS day,
        to_char(wl.eff_at AT TIME ZONE 'Europe/Moscow', 'HH24:MI') AS time,
        wl.planned_at, wl.started_at, wl.finalized_at,
        wl.deal_id, d.contract_number, d.client_id, c.short_name AS client_name,
        wl.object_id, wl.master_id, wl.preparations, wl.no_master_pay
      FROM wl
      JOIN deals d ON d.id = wl.deal_id
      JOIN clients c ON c.id = d.client_id
      WHERE wl.eff_at IS NOT NULL
        AND (wl.eff_at AT TIME ZONE 'Europe/Moscow') >= ${start}::timestamp
        AND (wl.eff_at AT TIME ZONE 'Europe/Moscow') < ${next}::timestamp
      ORDER BY wl.eff_at
    `),
  );
  const ids = orderRows.map((r) => r.id);
  // Массив параметром: drizzle разворачивает JS-массив в ($1,$2…), поэтому шлём литерал '{…}'::uuid[].
  const idList = pgUuidArray(ids);
  const dealIds = Array.from(new Set(orderRows.map((r) => r.deal_id)));
  const dealList = pgUuidArray(dealIds);

  const [svcRes, crewRes, ovRes, ratesRes, usersRes, freqRes, objRes, reschedAllRes, reschedMonthRes] =
    await Promise.all([
      db.execute(sql`
        SELECT s.work_log_id, COALESCE(s.custom_name, sv.name, 'Услуга') AS name,
          COALESCE(s.object_id, w.object_id) AS object_id, o.name AS object_name,
          s.quantity::text AS quantity, s.unit::text AS unit, s.price::text AS price, s.price_source
        FROM deal_work_log_services s
        JOIN deal_work_logs w ON w.id = s.work_log_id
        LEFT JOIN services sv ON sv.id = s.service_id
        LEFT JOIN client_objects o ON o.id = COALESCE(s.object_id, w.object_id)
        WHERE s.work_log_id = ANY(${idList}::uuid[])
        ORDER BY s.work_log_id, s.sort_order
      `),
      db.execute(sql`
        SELECT work_log_id, user_id FROM deal_work_log_masters
        WHERE work_log_id = ANY(${idList}::uuid[])
        ORDER BY created_at
      `),
      db.execute(sql`
        SELECT work_log_id, user_id, amount::text AS amount FROM deal_work_log_pay_overrides
        WHERE work_log_id = ANY(${idList}::uuid[])
      `),
      db.execute(sql`
        SELECT user_id, percent::text AS percent, min_monthly::text AS min_monthly,
          to_char(effective_from, 'YYYY-MM-DD') AS effective_from
        FROM master_pay_rates
      `),
      db.execute(sql`SELECT id, full_name, role::text AS role, is_active FROM users`),
      db.execute(sql`
        SELECT deal_id, frequency FROM deal_price_items WHERE deal_id = ANY(${dealList}::uuid[])
      `),
      // Объекты наряда: основной первым, дальше объекты услуг в порядке строк (детерминированно).
      db.execute(sql`
        SELECT work_log_id, id, name, address FROM (
          SELECT DISTINCT ON (x.work_log_id, o.id) x.work_log_id, o.id, o.name, o.address, x.ord
          FROM (
            SELECT w.id AS work_log_id, w.object_id, -1 AS ord FROM deal_work_logs w
            WHERE w.id = ANY(${idList}::uuid[])
            UNION ALL
            SELECT s.work_log_id, s.object_id, s.sort_order AS ord FROM deal_work_log_services s
            WHERE s.work_log_id = ANY(${idList}::uuid[]) AND s.object_id IS NOT NULL
          ) x
          JOIN client_objects o ON o.id = x.object_id
          ORDER BY x.work_log_id, o.id, x.ord
        ) t
        ORDER BY work_log_id, ord, name
      `),
      db.execute(sql`
        SELECT work_log_id, COUNT(*)::int AS cnt FROM work_order_reschedule_requests
        WHERE status = 'approved' AND work_log_id = ANY(${idList}::uuid[])
        GROUP BY work_log_id
      `),
      db.execute(sql`
        SELECT r.id, r.work_log_id, r.created_at, r.from_at, r.to_at, r.reason, r.status::text AS status,
          r.decided_at, r.decision_comment, r.requested_by_id,
          um.full_name AS master_name, ud.full_name AS decided_by_name,
          c.short_name AS client_name, o.name AS object_name
        FROM work_order_reschedule_requests r
        JOIN deal_work_logs w ON w.id = r.work_log_id
        JOIN deals d ON d.id = w.deal_id
        JOIN clients c ON c.id = d.client_id
        LEFT JOIN client_objects o ON o.id = w.object_id
        JOIN users um ON um.id = r.requested_by_id
        LEFT JOIN users ud ON ud.id = r.decided_by_id
        WHERE (r.created_at AT TIME ZONE 'Europe/Moscow') >= ${start}::timestamp
          AND (r.created_at AT TIME ZONE 'Europe/Moscow') < ${next}::timestamp
        ORDER BY r.created_at
      `),
    ]);

  const users = new Map(
    getRows<{ id: string; full_name: string; role: string; is_active: boolean }>(usersRes).map((u) => [
      u.id,
      u,
    ]),
  );
  const nameOf = (id: string) => users.get(id)?.full_name ?? '—';

  const rates: PayRate[] = getRows<{
    user_id: string;
    percent: string;
    min_monthly: string;
    effective_from: string;
  }>(ratesRes).map((r) => ({
    userId: r.user_id,
    percent: Number(r.percent),
    minMonthlyKop: toKop(r.min_monthly) ?? 0,
    effectiveFrom: r.effective_from,
  }));

  const svcBy = new Map<string, MonthOrderService[]>();
  for (const s of getRows<{
    work_log_id: string;
    name: string;
    object_name: string | null;
    quantity: string | null;
    unit: string;
    price: string | null;
    price_source: string | null;
  }>(svcRes)) {
    const arr = svcBy.get(s.work_log_id) ?? [];
    arr.push({
      name: s.name,
      objectName: s.object_name,
      quantity: s.quantity,
      unit: s.unit,
      priceKop: toKop(s.price),
      priceSource: s.price_source,
    });
    svcBy.set(s.work_log_id, arr);
  }
  const partnersBy = new Map<string, string[]>();
  for (const p of getRows<{ work_log_id: string; user_id: string }>(crewRes)) {
    const arr = partnersBy.get(p.work_log_id) ?? [];
    arr.push(p.user_id);
    partnersBy.set(p.work_log_id, arr);
  }
  const overridesBy = new Map<string, Map<string, Kopecks>>();
  for (const o of getRows<{ work_log_id: string; user_id: string; amount: string }>(ovRes)) {
    const m = overridesBy.get(o.work_log_id) ?? new Map<string, Kopecks>();
    m.set(o.user_id, toKop(o.amount) ?? 0);
    overridesBy.set(o.work_log_id, m);
  }
  const recurringDeals = new Set<string>();
  for (const f of getRows<{ deal_id: string; frequency: string | null }>(freqRes)) {
    if (isRecurringFrequency(f.frequency)) recurringDeals.add(f.deal_id);
  }
  const objectsBy = new Map<string, { id: string; name: string; address: string }[]>();
  for (const o of getRows<{ work_log_id: string; id: string; name: string; address: string }>(objRes)) {
    const arr = objectsBy.get(o.work_log_id) ?? [];
    arr.push({ id: o.id, name: o.name, address: o.address });
    objectsBy.set(o.work_log_id, arr);
  }
  const approvedBy = new Map(
    getRows<{ work_log_id: string; cnt: number }>(reschedAllRes).map((r) => [r.work_log_id, r.cnt]),
  );

  // 2) Наряды + деньги.
  const orders: MonthOrder[] = orderRows.map((r) => {
    const services = svcBy.get(r.id) ?? [];
    const crewIds = [r.master_id, ...(partnersBy.get(r.id) ?? []).filter((x) => x !== r.master_id)];
    const priced = services.filter((s) => s.priceKop !== null).length;
    const completed = r.status === 'completed';
    const costKop = completed ? workOrderCost(services) : null;
    const shares = completed
      ? masterSharesForOrder({
          crew: crewIds,
          costKop,
          noMasterPay: r.no_master_pay,
          overrides: overridesBy.get(r.id) ?? new Map(),
          rates,
          day: r.day,
        }).map((s) => ({ ...s, name: nameOf(s.userId) }))
      : [];
    return {
      id: r.id,
      status: r.status,
      day: r.day,
      time: r.time,
      plannedAt: r.planned_at ? new Date(r.planned_at).toISOString() : null,
      startedAt: r.started_at ? new Date(r.started_at).toISOString() : null,
      finalizedAt: r.finalized_at ? new Date(r.finalized_at).toISOString() : null,
      dealId: r.deal_id,
      contractNumber: r.contract_number,
      clientId: r.client_id,
      clientName: r.client_name,
      objects: objectsBy.get(r.id) ?? [],
      services,
      preparations: r.preparations,
      crew: crewIds.map((id) => ({ id, name: nameOf(id) })),
      noMasterPay: r.no_master_pay,
      recurring: recurringDeals.has(r.deal_id),
      costKop,
      priceStatus:
        services.length > 0 && priced === services.length ? 'full' : priced > 0 ? 'partial' : 'none',
      shares,
      approvedReschedules: approvedBy.get(r.id) ?? 0,
    };
  });

  const done = orders.filter((o) => o.status === 'completed');

  // 3) Переносы месяца.
  const reschedules: MonthReschedule[] = getRows<{
    id: string;
    work_log_id: string;
    created_at: string;
    from_at: string | null;
    to_at: string;
    reason: string;
    status: MonthReschedule['status'];
    decided_at: string | null;
    decision_comment: string | null;
    requested_by_id: string;
    master_name: string;
    decided_by_name: string | null;
    client_name: string;
    object_name: string | null;
  }>(reschedMonthRes).map((r) => ({
    id: r.id,
    workLogId: r.work_log_id,
    createdAt: new Date(r.created_at).toISOString(),
    masterName: r.master_name,
    clientName: r.client_name,
    objectName: r.object_name,
    fromAt: r.from_at ? new Date(r.from_at).toISOString() : null,
    toAt: new Date(r.to_at).toISOString(),
    reason: r.reason,
    status: r.status,
    decidedByName: r.decided_by_name,
    decidedAt: r.decided_at ? new Date(r.decided_at).toISOString() : null,
    decisionComment: r.decision_comment,
  }));
  const reschedByMaster = new Map<string, number>();
  for (const r of getRows<{ requested_by_id: string }>(reschedMonthRes)) {
    reschedByMaster.set(r.requested_by_id, (reschedByMaster.get(r.requested_by_id) ?? 0) + 1);
  }

  // 4) Зарплата мастеров: все мастера с нарядами в месяце + активные мастера со ставкой
  //    (минималка платится и при нуле нарядов — «если нет работы»).
  const earned = new Map<string, Kopecks>();
  const doneCount = new Map<string, number>();
  const unpricedCount = new Map<string, number>();
  const revenueBy = new Map<string, Kopecks>();
  for (const o of done) {
    for (const s of o.shares) {
      earned.set(s.userId, (earned.get(s.userId) ?? 0) + s.amountKop);
      doneCount.set(s.userId, (doneCount.get(s.userId) ?? 0) + 1);
      if (o.costKop === null) unpricedCount.set(s.userId, (unpricedCount.get(s.userId) ?? 0) + 1);
      revenueBy.set(s.userId, (revenueBy.get(s.userId) ?? 0) + (o.costKop ?? 0));
    }
  }
  // Минималка гарантируется за МЕСЯЦ: пока месяц идёт, доплата — только прогноз (иначе 1-го числа
  // вся минималка сразу уходит в выплаты и маржа показывается с минусом).
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const monthComplete = today > end;

  const masterIds = new Set<string>(earned.keys());
  for (const [id, u] of Array.from(users.entries())) {
    if (u.role === 'master' && u.is_active) masterIds.add(id);
  }
  const masters: MonthMasterRow[] = Array.from(masterIds)
    .map((id) => {
      const u = users.get(id);
      const mp = monthPay(id, earned.get(id) ?? 0, rates, end);
      return {
        ...mp,
        // Месяц идёт: к выплате пока только набранное; topUpKop = прогноз доплаты (справочно).
        payKop: monthComplete ? mp.payKop : mp.earnedKop,
        name: u?.full_name ?? '—',
        isActive: !!u?.is_active,
        ordersCompleted: doneCount.get(id) ?? 0,
        ordersUnpriced: unpricedCount.get(id) ?? 0,
        revenueKop: revenueBy.get(id) ?? 0,
        rescheduleRequests: reschedByMaster.get(id) ?? 0,
        hasRate: rates.some((r) => r.userId === id && r.effectiveFrom <= end),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));

  // 5) Клиенты.
  const [clientStatusRes, refusedRes, newClientsRes, leadsRes] = await Promise.all([
    db.execute(sql`SELECT status::text AS status, refusal_reason, COUNT(*)::int AS cnt FROM clients GROUP BY 1, 2`),
    db.execute(sql`
      SELECT id, short_name, refusal_reason, refusal_comment, refused_at FROM clients
      WHERE status = 'refused' AND refused_at IS NOT NULL
        AND (refused_at AT TIME ZONE 'Europe/Moscow') >= ${start}::timestamp
        AND (refused_at AT TIME ZONE 'Europe/Moscow') < ${next}::timestamp
      ORDER BY refused_at
    `),
    db.execute(sql`
      SELECT id, short_name, created_at FROM clients
      WHERE (created_at AT TIME ZONE 'Europe/Moscow') >= ${start}::timestamp
        AND (created_at AT TIME ZONE 'Europe/Moscow') < ${next}::timestamp
      ORDER BY created_at
    `),
    db.execute(sql`
      SELECT COUNT(*)::int AS leads, COUNT(*) FILTER (WHERE client_id IS NOT NULL)::int AS converted
      FROM leads
      WHERE (created_at AT TIME ZONE 'Europe/Moscow') >= ${start}::timestamp
        AND (created_at AT TIME ZONE 'Europe/Moscow') < ${next}::timestamp
    `),
  ]);
  const byStatus: Record<string, number> = {};
  const reasonCount = new Map<string, number>();
  let totalClients = 0;
  for (const r of getRows<{ status: string; refusal_reason: string | null; cnt: number }>(clientStatusRes)) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + r.cnt;
    totalClients += r.cnt;
    if (r.status === 'refused') {
      const key = r.refusal_reason ?? 'other';
      reasonCount.set(key, (reasonCount.get(key) ?? 0) + r.cnt);
    }
  }
  const reasonLabel = (k: string) =>
    k in CLIENT_REFUSAL_REASONS ? CLIENT_REFUSAL_REASONS[k as ClientRefusalReason] : 'Другое';
  const refusedInMonth = getRows<{
    id: string;
    short_name: string;
    refusal_reason: string | null;
    refusal_comment: string | null;
    refused_at: string;
  }>(refusedRes).map((r) => ({
    id: r.id,
    name: r.short_name,
    reason: reasonLabel(r.refusal_reason ?? 'other'),
    comment: r.refusal_comment,
    at: new Date(r.refused_at).toISOString(),
  }));
  const newInMonth = getRows<{ id: string; short_name: string; created_at: string }>(newClientsRes).map(
    (r) => ({ id: r.id, name: r.short_name, createdAt: new Date(r.created_at).toISOString() }),
  );
  const clientRevenue = new Map<string, { name: string; revenueKop: Kopecks; orders: number }>();
  for (const o of done) {
    const cur = clientRevenue.get(o.clientId) ?? { name: o.clientName, revenueKop: 0, orders: 0 };
    cur.revenueKop += o.costKop ?? 0;
    cur.orders += 1;
    clientRevenue.set(o.clientId, cur);
  }
  const topClients = Array.from(clientRevenue.entries())
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.revenueKop - a.revenueKop || b.orders - a.orders);

  const leadsRow = getRows<{ leads: number; converted: number }>(leadsRes)[0] ?? { leads: 0, converted: 0 };

  // 6) KPI.
  const revenueKop = done.reduce((s, o) => s + (o.costKop ?? 0), 0);
  const recurringRevenueKop = done.filter((o) => o.recurring).reduce((s, o) => s + (o.costKop ?? 0), 0);
  const ordersPriced = done.filter((o) => o.costKop !== null).length;
  const docOrders = done.filter((o) => o.noMasterPay);
  const documentaryRevenueKop = docOrders.reduce((s, o) => s + (o.costKop ?? 0), 0);
  const masterEarnedKop = masters.reduce((s, m) => s + m.earnedKop, 0);
  const allTopUpKop = masters.reduce((s, m) => s + m.topUpKop, 0);
  const masterTopUpKop = monthComplete ? allTopUpKop : 0;
  const masterPayKop = masterEarnedKop + masterTopUpKop;
  const grossMarginKop = revenueKop - masterPayKop;
  const activeMasters = masters.filter((m) => m.ordersCompleted > 0).length;
  let onTimeBase = 0;
  let onTimeCount = 0;
  // «В назначенный день»: начат в тот же день по МСК, что и запланирован. Точность по часам НЕ
  // меряем — время начала = когда мастер нажал «Начать» (на проде медиана +5,9 ч к плану, ±60 мин
  // давало 5 из 54 и показывало «опоздания», которых не было).
  for (const o of done) {
    if (!o.plannedAt || !o.startedAt) continue;
    onTimeBase += 1;
    if (mskDay(o.startedAt) === mskDay(o.plannedAt)) onTimeCount += 1;
  }
  const top5 = topClients.slice(0, 5).reduce((s, c) => s + c.revenueKop, 0);
  const activeNow = byStatus.active ?? 0;
  const exDocRevenue = revenueKop - documentaryRevenueKop;

  const kpis: MonthKpis = {
    month,
    revenueKop,
    recurringRevenueKop,
    oneTimeRevenueKop: revenueKop - recurringRevenueKop,
    ordersCompleted: done.length,
    ordersPriced,
    ordersUnpriced: done.length - ordersPriced,
    ordersOpen: orders.length - done.length,
    avgTicketKop: ordersPriced > 0 ? Math.round(revenueKop / ordersPriced) : null,
    masterEarnedKop,
    masterTopUpKop,
    projectedTopUpKop: monthComplete ? 0 : allTopUpKop,
    masterPayKop,
    monthComplete,
    anyRate: rates.some((r) => r.effectiveFrom <= end),
    grossMarginKop,
    marginPct: revenueKop > 0 ? pct(grossMarginKop, revenueKop) : null,
    documentaryCount: docOrders.length,
    documentaryRevenueKop,
    marginExDocPct: exDocRevenue > 0 ? pct(exDocRevenue - masterPayKop, exDocRevenue) : null,
    activeMasters,
    revenuePerMasterKop: activeMasters > 0 ? Math.round(revenueKop / activeMasters) : null,
    rescheduleRequests: reschedules.length,
    rescheduleApproved: reschedules.filter((r) => r.status === 'approved').length,
    rescheduleRatePct: orders.length > 0 ? pct(reschedules.length, orders.length) : null,
    onTimeCount,
    onTimeBase,
    onTimePct: pct(onTimeCount, onTimeBase),
    top5SharePct: revenueKop > 0 ? pct(top5, revenueKop) : null,
    clientsServed: clientRevenue.size,
    newClients: newInMonth.length,
    refusedInMonth: refusedInMonth.length,
    churnPct: pct(refusedInMonth.length, activeNow + refusedInMonth.length),
    leads: leadsRow.leads,
    leadsConverted: leadsRow.converted,
    leadConversionPct: pct(leadsRow.converted, leadsRow.leads),
  };

  return {
    month,
    bounds,
    orders,
    masters,
    reschedules,
    clients: {
      total: totalClients,
      byStatus,
      refusedByReason: Array.from(reasonCount.entries())
        .map(([reason, count]) => ({ reason, label: reasonLabel(reason), count }))
        .sort((a, b) => b.count - a.count),
      refusedInMonth,
      newInMonth,
      topClients,
    },
    kpis,
  };
}

/** Отчёт месяца: данные месяца + KPI прошлого месяца (якорь сравнения) + тренд за 6 месяцев. */
export type MonthlyReport = {
  current: MonthData;
  previous: MonthKpis;
  trend: MonthKpis[];
};

export async function getMonthlyReport(month: string, trendMonths = 6): Promise<MonthlyReport> {
  const current = await getMonthData(month);
  const trend: MonthKpis[] = [];
  for (let i = trendMonths - 1; i >= 1; i--) {
    trend.push((await getMonthData(shiftMonth(month, -i))).kpis);
  }
  trend.push(current.kpis);
  const previous = trend.length >= 2 ? trend[trend.length - 2] : (await getMonthData(shiftMonth(month, -1))).kpis;
  return { current, previous, trend };
}
