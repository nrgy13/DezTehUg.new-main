/**
 * Создание выездов (work_logs) с автозаполнением чеклиста.
 *
 * Используется:
 * - При назначении мастера на сделку (auto-seed по всем позициям прайса)
 * - При нажатии «Новый выезд» (создание следующего выезда для recurring работ)
 */

import 'server-only';
import { eq, and, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { deals, dealPriceItems, dealWorkLogs } from '@/lib/db/schema/deals';
import { clientObjects } from '@/lib/db/schema/objects';
import { serviceChecklists, dealChecklistItems } from '@/lib/db/schema/checklists';

export type CreatedVisit = {
  workLogId: string;
  priceItemId: string;
  itemsCount: number;
};

/**
 * Создаёт новый work_log (выезд) для позиции прайса и копирует шаблон чеклиста
 * по её service_id. Возвращает id созданного work_log и кол-во скопированных пунктов.
 *
 * Если у позиции нет service_id (customName) — чеклист пустой, мастер добавит сам.
 */
export async function createPlannedVisitForPriceItem(params: {
  dealId: string;
  masterId: string;
  priceItemId: string;
  /** Когда запланирован выезд. Если не указано — будет null. */
  plannedAt?: Date | null;
}): Promise<CreatedVisit> {
  const { dealId, masterId, priceItemId, plannedAt } = params;

  // Достанем service_id позиции — нужно для шаблона.
  const [priceItem] = await db
    .select({ id: dealPriceItems.id, serviceId: dealPriceItems.serviceId })
    .from(dealPriceItems)
    .where(eq(dealPriceItems.id, priceItemId))
    .limit(1);

  if (!priceItem) {
    throw new Error(`Price item ${priceItemId} not found`);
  }

  // 1) Создаём work_log со status='planned'.
  const [created] = await db
    .insert(dealWorkLogs)
    .values({
      dealId,
      masterId,
      priceItemId,
      status: 'planned',
      plannedAt: plannedAt ?? null,
      description: null,
      performedAt: null,
    })
    .returning({ id: dealWorkLogs.id });

  // 2) Если у позиции есть service_id — копируем шаблон.
  let itemsCount = 0;
  if (priceItem.serviceId) {
    const templates = await db
      .select()
      .from(serviceChecklists)
      .where(eq(serviceChecklists.serviceId, priceItem.serviceId))
      .orderBy(serviceChecklists.position);

    if (templates.length > 0) {
      const rows = templates.map((t) => ({
        workLogId: created.id,
        source: 'template' as const,
        sourceTemplateId: t.id,
        position: t.position,
        title: t.title,
        description: t.description,
        required: t.required,
      }));
      await db.insert(dealChecklistItems).values(rows);
      itemsCount = templates.length;
    }
  }

  return { workLogId: created.id, priceItemId, itemsCount };
}

/**
 * Идемпотентный seed: для каждой позиции прайса сделки создаёт planned-выезд,
 * если у неё ещё нет ни одного work_log'а с активным статусом (planned/in_progress).
 *
 * Вызывается из assignMaster и при создании сделки с уже назначенным мастером.
 */
export async function seedPlannedVisitsForDeal(
  dealId: string,
  masterId: string,
): Promise<CreatedVisit[]> {
  // 1) Все позиции прайса сделки (+ привязанный объект — для даты выезда).
  const items = await db
    .select({ id: dealPriceItems.id, objectId: dealPriceItems.objectId })
    .from(dealPriceItems)
    .where(eq(dealPriceItems.dealId, dealId));

  if (items.length === 0) return [];

  // 2) Какие позиции УЖЕ имеют активный work_log?
  const itemIds = items.map((i) => i.id);
  const existing = await db
    .select({ priceItemId: dealWorkLogs.priceItemId, status: dealWorkLogs.status })
    .from(dealWorkLogs)
    .where(
      and(
        eq(dealWorkLogs.dealId, dealId),
        inArray(dealWorkLogs.priceItemId, itemIds),
        inArray(dealWorkLogs.status, ['planned', 'in_progress']),
      ),
    );
  const haveActive = new Set(
    existing.map((e) => e.priceItemId).filter((x): x is string => !!x),
  );

  // 3) Дата старта сделки для plannedAt.
  const [deal] = await db
    .select({ startAt: deals.startAt, startDate: deals.startDate })
    .from(deals)
    .where(eq(deals.id, dealId))
    .limit(1);

  let dealPlannedAt: Date | null = null;
  if (deal?.startAt) {
    dealPlannedAt = deal.startAt;
  } else if (deal?.startDate) {
    dealPlannedAt = new Date(deal.startDate + 'T09:00:00');
  }

  // 3b) Плановые даты обработки объектов — приоритетный источник даты выезда.
  // Саня (Sprint 9): «на её основе формируются заявки мастерам».
  const objectIds = items.map((i) => i.objectId).filter((x): x is string => !!x);
  const objPlannedDate = new Map<string, string | null>();
  if (objectIds.length > 0) {
    const objs = await db
      .select({
        id: clientObjects.id,
        plannedTreatmentDate: clientObjects.plannedTreatmentDate,
      })
      .from(clientObjects)
      .where(inArray(clientObjects.id, objectIds));
    for (const o of objs) objPlannedDate.set(o.id, o.plannedTreatmentDate);
  }

  // 4) Создаём planned-выезд для каждой позиции без активного выезда.
  // Дата: плановая дата обработки объекта (если есть) → иначе дата старта сделки.
  const results: CreatedVisit[] = [];
  for (const it of items) {
    if (haveActive.has(it.id)) continue;
    const objDate = it.objectId ? objPlannedDate.get(it.objectId) : null;
    const plannedAt = objDate ? new Date(objDate + 'T09:00:00') : dealPlannedAt;
    const r = await createPlannedVisitForPriceItem({
      dealId,
      masterId,
      priceItemId: it.id,
      plannedAt,
    });
    results.push(r);
  }
  return results;
}
