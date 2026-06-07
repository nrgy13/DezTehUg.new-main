'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { dealWorkLogs } from '@/lib/db/schema/deals';

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

async function getManager() {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.role !== 'manager' && session.user.role !== 'admin') return null;
  return session.user;
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
