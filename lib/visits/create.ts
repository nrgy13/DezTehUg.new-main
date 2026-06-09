/**
 * Создание заказ-нарядов (work_logs) с чеклистом.
 *
 * Релиз A (2026-06-07): прайс-автомат (seedPlannedVisitsForDeal /
 * createPlannedVisitForPriceItem) удалён — выезды плодились по позициям прайса при
 * назначении мастера, давали дубли и «БЕЗ УСЛУГИ». Теперь единственный путь —
 * ручной заказ-наряд по ОБЪЕКТУ (createWorkOrder ниже).
 */

import 'server-only';
import { eq, and, inArray, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { dealWorkLogs, dealWorkLogServices } from '@/lib/db/schema/deals';
import { clientObjects } from '@/lib/db/schema/objects';
import { serviceChecklists, dealChecklistItems } from '@/lib/db/schema/checklists';
import type { PriceItemUnit } from '@/lib/db/schema/deals';

// ─── Релиз A: Заказ-наряды ────────────────────────────────────

export type WorkOrderServiceInput = {
  serviceId?: string | null;
  customName?: string | null;
  method?: string | null;
  unit?: PriceItemUnit;
  /** Дробное количество в unit. Строка/число/null. */
  quantity?: string | number | null;
};

/**
 * Пункт чеклиста, собранный менеджером в форме наряда.
 * source: 'template' — подтянут из шаблона услуги; 'manager' — добавлен/правлен Региной.
 */
export type WorkOrderChecklistInput = {
  title: string;
  description?: string | null;
  required: boolean;
  source: 'template' | 'manager';
  sourceTemplateId?: string | null;
};

/**
 * Создаёт заказ-наряд = один выезд (work_log) на ОБЪЕКТ в рамках договора, с
 * несколькими услугами (snapshot), препаратами и назначенным мастером.
 * Чеклист: если передан явный `checklist` (Регина собрала в форме) — вставляем его;
 * иначе (обратная совместимость) — автокопия из шаблонов по service_id услуг.
 *
 * Возвращает id выезда и кол-во пунктов чеклиста.
 */
export async function createWorkOrder(params: {
  dealId: string;
  objectId: string;
  masterId: string;
  plannedAt: Date | null;
  preparations?: string | null;
  services: WorkOrderServiceInput[];
  /** Явный чеклист от формы. undefined → автокопия из шаблонов услуг (старое поведение). */
  checklist?: WorkOrderChecklistInput[];
}): Promise<{ workLogId: string; itemsCount: number }> {
  const { dealId, objectId, masterId, plannedAt, preparations, services: svcList, checklist } = params;

  // Всё одной транзакцией: иначе при падении на услугах/чеклисте остаётся «битый»
  // work_log без услуг/чеклиста, а напоминание серии уже гасится по факту наличия выезда.
  return await db.transaction(async (tx) => {
    // 1) Сам выезд (planned).
    const [created] = await tx
      .insert(dealWorkLogs)
      .values({
        dealId,
        masterId,
        objectId,
        priceItemId: null,
        status: 'planned',
        plannedAt: plannedAt ?? null,
        preparations: preparations?.trim() ? preparations.trim() : null,
      })
      .returning({ id: dealWorkLogs.id });

    // 1b) Автопривязка объекта к договору, если ещё не привязан. Нужно для актов
    // АО/АВР (они формируются по позициям договора, относящимся к объекту).
    await tx
      .update(clientObjects)
      .set({ dealId })
      .where(and(eq(clientObjects.id, objectId), isNull(clientObjects.dealId)));

    // 2) Snapshot услуг наряда.
    const cleaned = svcList.filter((s) => s.serviceId || s.customName?.trim());
    if (cleaned.length > 0) {
      await tx.insert(dealWorkLogServices).values(
        cleaned.map((s, i) => ({
          workLogId: created.id,
          serviceId: s.serviceId ?? null,
          customName: s.customName?.trim() ? s.customName.trim() : null,
          method: s.method?.trim() ? s.method.trim() : null,
          unit: (s.unit ?? 'm2') as PriceItemUnit,
          quantity:
            s.quantity !== null && s.quantity !== undefined && String(s.quantity).trim() !== ''
              ? String(s.quantity)
              : null,
          sortOrder: i,
        })),
      );
    }

    // 3) Чеклист выезда.
    let itemsCount = 0;
    if (checklist !== undefined) {
      // Явный чеклист от формы (Регина собрала): вставляем как есть, по порядку.
      const items = checklist
        .map((c) => ({ ...c, title: c.title.trim() }))
        .filter((c) => c.title.length > 0);
      if (items.length > 0) {
        await tx.insert(dealChecklistItems).values(
          items.map((c, idx) => ({
            workLogId: created.id,
            source: c.source,
            sourceTemplateId: c.sourceTemplateId ?? null,
            position: idx,
            title: c.title,
            description: c.description?.trim() ? c.description.trim() : null,
            required: c.required,
          })),
        );
        itemsCount = items.length;
      }
    } else {
      // Обратная совместимость: автокопия из шаблонов по service_id услуг (объединяем все).
      const serviceIds = Array.from(
        new Set(cleaned.map((s) => s.serviceId).filter((x): x is string => !!x)),
      );
      if (serviceIds.length > 0) {
        const templates = await tx
          .select()
          .from(serviceChecklists)
          .where(inArray(serviceChecklists.serviceId, serviceIds))
          .orderBy(serviceChecklists.position);
        if (templates.length > 0) {
          await tx.insert(dealChecklistItems).values(
            templates.map((t, idx) => ({
              workLogId: created.id,
              source: 'template' as const,
              sourceTemplateId: t.id,
              position: idx,
              title: t.title,
              description: t.description,
              required: t.required,
            })),
          );
          itemsCount = templates.length;
        }
      }
    }

    return { workLogId: created.id, itemsCount };
  });
}
