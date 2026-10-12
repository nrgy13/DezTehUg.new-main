'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { dealWorkLogs } from '@/lib/db/schema/deals';
import { clientObjects } from '@/lib/db/schema/objects';
import { activityLog } from '@/lib/db/schema/activity';
import { MSK_TZ } from '@/lib/datetime/msk';
import { getCrewIds } from '@/lib/visits/crew';

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

async function getManager() {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.role !== 'manager' && session.user.role !== 'admin') return null;
  return session.user;
}

/**
 * Перенос planned-выезда на другую дату/время: drag-n-drop в календаре и кнопка
 * «Перенести» на карточке наряда (там же меняется время — в месячном виде календаря
 * перетаскивание двигает только день). Менять разрешено только planned
 * (in_progress/completed — read-only по факту).
 * Бригаде — push «Выезд перенесён» (раньше мастер о переносе не узнавал), в журнал —
 * work_order.reschedule (с какого на какое время).
 */
export async function updateVisitPlannedAt(
  workLogId: string,
  input: { startAtIso: string | null; endAtIso: string | null },
): Promise<Result> {
  const actor = await getManager();
  if (!actor) return { ok: false, error: 'Нет доступа' };

  const nextAt = input.startAtIso ? new Date(input.startAtIso) : null;
  if (nextAt && Number.isNaN(nextAt.getTime())) {
    return { ok: false, error: 'Некорректная дата или время' };
  }

  const [wl] = await db
    .select({
      id: dealWorkLogs.id,
      dealId: dealWorkLogs.dealId,
      objectId: dealWorkLogs.objectId,
      masterId: dealWorkLogs.masterId,
      status: dealWorkLogs.status,
      plannedAt: dealWorkLogs.plannedAt,
      objectName: clientObjects.name,
    })
    .from(dealWorkLogs)
    .leftJoin(clientObjects, eq(clientObjects.id, dealWorkLogs.objectId))
    .where(eq(dealWorkLogs.id, workLogId))
    .limit(1);
  if (!wl) return { ok: false, error: 'Выезд не найден' };
  const notPlanned = (status: string) =>
    status === 'in_progress'
      ? 'Выезд уже в работе — мастер начал, перенос недоступен'
      : 'Выезд уже завершён, перенос недоступен';
  if (wl.status !== 'planned') return { ok: false, error: notPlanned(wl.status) };

  // То же время — ничего не меняем и никого не дёргаем push'ем.
  if ((wl.plannedAt?.getTime() ?? null) === (nextAt?.getTime() ?? null)) {
    return { ok: true, data: undefined };
  }

  // Атомарно: мастер мог нажать «Начать» между чтением и записью — тогда не переносим.
  const updated = await db
    .update(dealWorkLogs)
    .set({ plannedAt: nextAt })
    .where(and(eq(dealWorkLogs.id, workLogId), eq(dealWorkLogs.status, 'planned')))
    .returning({ id: dealWorkLogs.id });
  if (updated.length === 0) return { ok: false, error: notPlanned('in_progress') };

  try {
    await db.insert(activityLog).values({
      userId: actor.id,
      action: 'work_order.reschedule',
      entityType: 'deal',
      entityId: wl.dealId,
      changesJson: {
        workLogId: wl.id,
        from: wl.plannedAt?.toISOString() ?? null,
        to: nextAt?.toISOString() ?? null,
      },
    });
  } catch (err) {
    console.warn('[updateVisitPlannedAt] activity log failed:', err);
  }

  // Push бригаде (best-effort): иначе мастер приедет в старый день.
  try {
    const crewIds = await getCrewIds(wl.id, wl.masterId);
    const when = nextAt
      ? nextAt.toLocaleString('ru-RU', {
          timeZone: MSK_TZ,
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'без даты';
    const { sendPushToUsers } = await import('@/lib/push/server');
    await sendPushToUsers(crewIds, {
      title: 'Выезд перенесён',
      body: `${wl.objectName ?? 'Выезд'} → ${when}`,
      url: `/master/visits/${wl.id}`,
      tag: `wo-moved-${wl.id}`,
    });
  } catch (err) {
    console.warn('[updateVisitPlannedAt] push failed:', err);
  }

  revalidatePath(`/manager/deals/${wl.dealId}`);
  if (wl.objectId) revalidatePath(`/manager/objects/${wl.objectId}`);
  revalidatePath('/manager/calendar');
  revalidatePath('/master/calendar');
  revalidatePath('/master');
  revalidatePath(`/master/visits/${wl.id}`);
  return { ok: true, data: undefined };
}
