'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { deals, dealPriceItems, dealWorkLogs } from '@/lib/db/schema/deals';
import { createPlannedVisitForPriceItem } from '@/lib/visits/create';

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

async function getManager() {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.role !== 'manager' && session.user.role !== 'admin') return null;
  return session.user;
}

/**
 * Создать новый planned-выезд по позиции прайса. Используется когда первичный
 * seed уже отработал, и нужен следующий выезд (например, для recurring работы
 * раз в месяц).
 *
 * Мастер берётся из deals.assigned_master_id. Если мастер не назначен — ошибка.
 */
export async function createNextVisitForPriceItem(
  priceItemId: string,
  plannedAtIso?: string,
): Promise<Result<{ workLogId: string }>> {
  const actor = await getManager();
  if (!actor) return { ok: false, error: 'Нет доступа' };

  const [pi] = await db
    .select({
      id: dealPriceItems.id,
      dealId: dealPriceItems.dealId,
    })
    .from(dealPriceItems)
    .where(eq(dealPriceItems.id, priceItemId))
    .limit(1);
  if (!pi) return { ok: false, error: 'Позиция прайса не найдена' };

  const [deal] = await db
    .select({ masterId: deals.assignedMasterId })
    .from(deals)
    .where(eq(deals.id, pi.dealId))
    .limit(1);
  if (!deal?.masterId) {
    return { ok: false, error: 'На сделке не назначен мастер. Назначь сначала.' };
  }

  const r = await createPlannedVisitForPriceItem({
    dealId: pi.dealId,
    masterId: deal.masterId,
    priceItemId: pi.id,
    plannedAt: plannedAtIso ? new Date(plannedAtIso) : null,
  });

  revalidatePath(`/manager/deals/${pi.dealId}`);
  revalidatePath(`/master`);
  return { ok: true, data: { workLogId: r.workLogId } };
}

/**
 * Drag-n-drop в календаре переносит дату planned-выезда.
 * Менять разрешено только planned (in_progress/completed — read-only по факту).
 */
export async function updateVisitPlannedAt(
  workLogId: string,
  input: { startAtIso: string | null; endAtIso: string | null },
): Promise<Result> {
  const actor = await getManager();
  if (!actor) return { ok: false, error: 'Нет доступа' };

  const [wl] = await db
    .select({
      id: dealWorkLogs.id,
      dealId: dealWorkLogs.dealId,
      status: dealWorkLogs.status,
    })
    .from(dealWorkLogs)
    .where(eq(dealWorkLogs.id, workLogId))
    .limit(1);
  if (!wl) return { ok: false, error: 'Выезд не найден' };
  if (wl.status !== 'planned') {
    return {
      ok: false,
      error:
        wl.status === 'in_progress'
          ? 'Выезд уже в работе — мастер начал, перенос недоступен'
          : 'Выезд уже завершён, перенос недоступен',
    };
  }

  await db
    .update(dealWorkLogs)
    .set({ plannedAt: input.startAtIso ? new Date(input.startAtIso) : null })
    .where(eq(dealWorkLogs.id, workLogId));

  revalidatePath(`/manager/deals/${wl.dealId}`);
  revalidatePath('/manager/calendar');
  revalidatePath('/master/calendar');
  revalidatePath('/master');
  return { ok: true, data: undefined };
}
