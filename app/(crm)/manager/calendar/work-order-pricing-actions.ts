'use server';

/**
 * Деньги заказ-наряда (11.2026, запрос Сани): цена строк услуг, «документальный» наряд,
 * ручная сумма мастеру. Только менеджер/админ — мастер цен не видит нигде.
 *
 * Цену Регина ставит по КАЖДОМУ наряду: из прайса договора (подсказка) или свою (договорённость
 * с заказчиком). Править можно в любом статусе, включая выполненный (старым нарядам «указать цену»).
 */

import { revalidatePath } from 'next/cache';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  deals,
  dealPriceItems,
  dealWorkLogs,
  dealWorkLogServices,
  dealWorkLogPayOverrides,
} from '@/lib/db/schema/deals';
import { clients } from '@/lib/db/schema/clients';
import { clientObjects } from '@/lib/db/schema/objects';
import { services } from '@/lib/db/schema/services';
import { users } from '@/lib/db/schema/users';
import { masterPayRates } from '@/lib/db/schema/finance';
import { activityLog } from '@/lib/db/schema/activity';
import { getCrewIds } from '@/lib/visits/crew';
import { normalizeLinePrice } from '@/lib/visits/create';
import { workOrderDate } from '@/lib/visits/order-date';
import { rateAt, toKop, type PayRate } from '@/lib/finance/compute';

type Result = { ok: true } | { ok: false; error: string };

async function getManager() {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.role !== 'manager' && session.user.role !== 'admin') return null;
  return session.user;
}

const MSK_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Moscow',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

// ─── Подсказки из прайса договора ─────────────────────────────────

export type DealPriceHint = {
  objectId: string | null;
  serviceId: string | null;
  customName: string | null;
  label: string;
  priceWithVat: string;
  unit: string;
  areaM2: string;
  frequency: string | null;
};

/**
 * Позиции прайса договора — для подстановки цены в строку наряда.
 * Подстановка в форме — только при ОДНОЗНАЧНОМ совпадении (объект + услуга, одна цена):
 * в прайсах вперемешку цена «за выезд» и «за 1 м²», поэтому это подсказка, а не истина.
 */
export async function getDealPriceHints(dealId: string): Promise<DealPriceHint[]> {
  const actor = await getManager();
  if (!actor) return [];
  if (!z.string().uuid().safeParse(dealId).success) return [];
  const rows = await db
    .select({
      objectId: dealPriceItems.objectId,
      serviceId: dealPriceItems.serviceId,
      customName: dealPriceItems.customName,
      serviceName: services.name,
      priceWithVat: dealPriceItems.priceWithVat,
      unit: dealPriceItems.unit,
      areaM2: dealPriceItems.areaM2,
      frequency: dealPriceItems.frequency,
    })
    .from(dealPriceItems)
    .leftJoin(services, eq(dealPriceItems.serviceId, services.id))
    .where(eq(dealPriceItems.dealId, dealId))
    .orderBy(asc(dealPriceItems.sortOrder));
  return rows.map((r) => ({
    objectId: r.objectId,
    serviceId: r.serviceId,
    customName: r.customName,
    label: r.customName ?? r.serviceName ?? 'Услуга',
    priceWithVat: r.priceWithVat,
    unit: r.unit,
    areaM2: r.areaM2,
    frequency: r.frequency,
  }));
}

/**
 * Однозначная цена из прайса для (объект, услуга): одна различная цена → строка, иначе null.
 * Экспортируется для формы и стенда (одно правило везде).
 */
export async function pickContractPrice(
  hints: DealPriceHint[],
  objectId: string | null,
  serviceId: string | null,
): Promise<string | null> {
  if (!serviceId) return null;
  const prices = new Set(
    hints
      .filter((h) => h.serviceId === serviceId && (objectId ? h.objectId === objectId : true))
      .map((h) => normalizeLinePrice(h.priceWithVat))
      .filter((p): p is string => p !== null),
  );
  return prices.size === 1 ? Array.from(prices)[0] : null;
}

// ─── Чтение денег наряда (диалог «Цена») ──────────────────────────

export type WorkOrderPricingLine = {
  id: string;
  name: string;
  objectName: string | null;
  quantity: string | null;
  unit: string;
  price: string | null;
  priceSource: string | null;
  /** Однозначная цена из прайса договора (подсказка), если есть. */
  contractPrice: string | null;
};

export type WorkOrderPricingCrew = {
  userId: string;
  name: string;
  /** Ставка на дату наряда (null — не задана). */
  percent: number | null;
  /** Ручная сумма (строка ₽) или null — считать по ставке. */
  override: string | null;
};

export type WorkOrderPricing =
  | {
      ok: true;
      workLogId: string;
      status: string;
      day: string | null;
      clientName: string;
      contractNumber: string;
      noMasterPay: boolean;
      lines: WorkOrderPricingLine[];
      crew: WorkOrderPricingCrew[];
    }
  | { ok: false; error: string };

export async function getWorkOrderPricing(workLogId: string): Promise<WorkOrderPricing> {
  const actor = await getManager();
  if (!actor) return { ok: false, error: 'Нет доступа' };
  if (!z.string().uuid().safeParse(workLogId).success) return { ok: false, error: 'Наряд не найден' };

  const [wl] = await db
    .select({
      id: dealWorkLogs.id,
      status: dealWorkLogs.status,
      dealId: dealWorkLogs.dealId,
      objectId: dealWorkLogs.objectId,
      masterId: dealWorkLogs.masterId,
      noMasterPay: dealWorkLogs.noMasterPay,
      plannedAt: dealWorkLogs.plannedAt,
      performedAt: dealWorkLogs.performedAt,
      finalizedAt: dealWorkLogs.finalizedAt,
      contractNumber: deals.contractNumber,
      clientName: clients.shortName,
    })
    .from(dealWorkLogs)
    .innerJoin(deals, eq(deals.id, dealWorkLogs.dealId))
    .innerJoin(clients, eq(clients.id, deals.clientId))
    .where(eq(dealWorkLogs.id, workLogId))
    .limit(1);
  if (!wl) return { ok: false, error: 'Наряд не найден' };

  // Дата наряда (плановая; без плана — факт) — то же правило, что в сводке месяца.
  const at = workOrderDate(wl);
  const day = at ? MSK_DAY.format(at) : null;

  const [lineRows, crewIds, overrides, hints] = await Promise.all([
    db
      .select({
        id: dealWorkLogServices.id,
        serviceId: dealWorkLogServices.serviceId,
        customName: dealWorkLogServices.customName,
        serviceName: services.name,
        objectId: dealWorkLogServices.objectId,
        objectName: clientObjects.name,
        quantity: dealWorkLogServices.quantity,
        unit: dealWorkLogServices.unit,
        price: dealWorkLogServices.price,
        priceSource: dealWorkLogServices.priceSource,
      })
      .from(dealWorkLogServices)
      .leftJoin(services, eq(services.id, dealWorkLogServices.serviceId))
      .leftJoin(clientObjects, eq(clientObjects.id, dealWorkLogServices.objectId))
      .where(eq(dealWorkLogServices.workLogId, workLogId))
      .orderBy(asc(dealWorkLogServices.sortOrder)),
    getCrewIds(workLogId, wl.masterId),
    db
      .select({ userId: dealWorkLogPayOverrides.userId, amount: dealWorkLogPayOverrides.amount })
      .from(dealWorkLogPayOverrides)
      .where(eq(dealWorkLogPayOverrides.workLogId, workLogId)),
    getDealPriceHints(wl.dealId),
  ]);

  const crewUsers = crewIds.length
    ? await db
        .select({ id: users.id, fullName: users.fullName })
        .from(users)
        .where(inArray(users.id, crewIds))
    : [];
  const rateRows = crewIds.length
    ? await db
        .select({
          userId: masterPayRates.userId,
          percent: masterPayRates.percent,
          minMonthly: masterPayRates.minMonthly,
          effectiveFrom: masterPayRates.effectiveFrom,
        })
        .from(masterPayRates)
        .where(inArray(masterPayRates.userId, crewIds))
    : [];
  const rates: PayRate[] = rateRows.map((r) => ({
    userId: r.userId,
    percent: Number(r.percent),
    minMonthlyKop: toKop(r.minMonthly) ?? 0,
    effectiveFrom: r.effectiveFrom,
  }));
  const nameById = new Map(crewUsers.map((u) => [u.id, u.fullName]));
  const ovById = new Map(overrides.map((o) => [o.userId, o.amount]));

  const lines: WorkOrderPricingLine[] = [];
  for (const l of lineRows) {
    lines.push({
      id: l.id,
      name: l.customName ?? l.serviceName ?? 'Услуга',
      objectName: l.objectName,
      quantity: l.quantity,
      unit: l.unit,
      price: l.price,
      priceSource: l.priceSource,
      contractPrice: await pickContractPrice(hints, l.objectId ?? wl.objectId, l.serviceId),
    });
  }

  return {
    ok: true,
    workLogId,
    status: wl.status,
    day,
    clientName: wl.clientName,
    contractNumber: wl.contractNumber,
    noMasterPay: wl.noMasterPay,
    lines,
    crew: crewIds.map((id) => ({
      userId: id,
      name: nameById.get(id) ?? '—',
      percent: day ? (rateAt(rates, id, day)?.percent ?? null) : null,
      override: ovById.get(id) ?? null,
    })),
  };
}

// ─── Сохранение денег наряда ──────────────────────────────────────

const priceField = z
  .union([z.string(), z.number()])
  .nullable()
  .refine(
    (p) => p === null || String(p).trim() === '' || normalizeLinePrice(p) !== null,
    'цена — неотрицательное число',
  )
  .refine(
    (p) => p === null || String(p).trim() === '' || Number(normalizeLinePrice(p)) < 100_000_000,
    'слишком большая сумма',
  );

const savePricingSchema = z.object({
  workLogId: z.string().uuid(),
  noMasterPay: z.boolean(),
  lines: z
    .array(
      z.object({
        id: z.string().uuid(),
        price: priceField,
        priceSource: z.enum(['contract', 'manual']).nullable().optional(),
      }),
    )
    .max(200),
  overrides: z
    .array(z.object({ userId: z.string().uuid(), amount: priceField }))
    .max(20),
});

export async function saveWorkOrderPricing(input: unknown): Promise<Result> {
  const actor = await getManager();
  if (!actor) return { ok: false, error: 'Нет доступа' };
  const parsed = savePricingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
  const { workLogId, noMasterPay } = parsed.data;

  const [wl] = await db
    .select({
      id: dealWorkLogs.id,
      dealId: dealWorkLogs.dealId,
      masterId: dealWorkLogs.masterId,
      noMasterPay: dealWorkLogs.noMasterPay,
    })
    .from(dealWorkLogs)
    .where(eq(dealWorkLogs.id, workLogId))
    .limit(1);
  if (!wl) return { ok: false, error: 'Наряд не найден' };

  const crewIds = new Set(await getCrewIds(workLogId, wl.masterId));
  if (parsed.data.overrides.some((o) => !crewIds.has(o.userId))) {
    return { ok: false, error: 'Ручная сумма — только для мастеров этого наряда' };
  }

  const changes: Record<string, unknown> = {};
  try {
    await db.transaction(async (tx) => {
      const existing = await tx
        .select({
          id: dealWorkLogServices.id,
          price: dealWorkLogServices.price,
          priceSource: dealWorkLogServices.priceSource,
        })
        .from(dealWorkLogServices)
        .where(eq(dealWorkLogServices.workLogId, workLogId));
      const byId = new Map(existing.map((e) => [e.id, e]));
      if (parsed.data.lines.some((l) => !byId.has(l.id))) {
        throw new Error('Строка услуги не относится к этому наряду');
      }

      const lineChanges: { id: string; from: string | null; to: string | null; source: string | null }[] = [];
      for (const l of parsed.data.lines) {
        const prev = byId.get(l.id)!;
        const price = normalizeLinePrice(l.price);
        const source = price === null ? null : (l.priceSource ?? 'manual');
        if (price === prev.price && source === prev.priceSource) continue;
        await tx
          .update(dealWorkLogServices)
          .set({ price, priceSource: source })
          .where(and(eq(dealWorkLogServices.id, l.id), eq(dealWorkLogServices.workLogId, workLogId)));
        lineChanges.push({ id: l.id, from: prev.price, to: price, source });
      }
      if (lineChanges.length) changes.lines = lineChanges;

      if (noMasterPay !== wl.noMasterPay) {
        await tx.update(dealWorkLogs).set({ noMasterPay }).where(eq(dealWorkLogs.id, workLogId));
        changes.noMasterPay = { from: wl.noMasterPay, to: noMasterPay };
      }

      const prevOv = await tx
        .select({ userId: dealWorkLogPayOverrides.userId, amount: dealWorkLogPayOverrides.amount })
        .from(dealWorkLogPayOverrides)
        .where(eq(dealWorkLogPayOverrides.workLogId, workLogId));
      const prevOvBy = new Map(prevOv.map((o) => [o.userId, o.amount]));
      const ovChanges: { userId: string; from: string | null; to: string | null }[] = [];
      for (const o of parsed.data.overrides) {
        const amount = normalizeLinePrice(o.amount);
        const prev = prevOvBy.get(o.userId) ?? null;
        if (amount === prev) continue;
        if (amount === null) {
          await tx
            .delete(dealWorkLogPayOverrides)
            .where(
              and(
                eq(dealWorkLogPayOverrides.workLogId, workLogId),
                eq(dealWorkLogPayOverrides.userId, o.userId),
              ),
            );
        } else {
          await tx
            .insert(dealWorkLogPayOverrides)
            .values({ workLogId, userId: o.userId, amount, setById: actor.id })
            .onConflictDoUpdate({
              target: [dealWorkLogPayOverrides.workLogId, dealWorkLogPayOverrides.userId],
              set: { amount, setById: actor.id, setAt: new Date() },
            });
        }
        ovChanges.push({ userId: o.userId, from: prev, to: amount });
      }
      if (ovChanges.length) changes.overrides = ovChanges;

      if (Object.keys(changes).length > 0) {
        await tx.insert(activityLog).values({
          userId: actor.id,
          entityType: 'deal',
          entityId: wl.dealId,
          action: 'work_order.pricing',
          changesJson: { workLogId, ...changes },
        });
      }
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Не удалось сохранить' };
  }

  revalidatePath('/manager');
  revalidatePath('/manager/summary');
  revalidatePath('/manager/calendar');
  revalidatePath(`/manager/deals/${wl.dealId}`);
  return { ok: true };
}
