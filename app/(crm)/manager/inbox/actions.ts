'use server';

import { revalidatePath } from 'next/cache';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { activityLog } from '@/lib/db/schema/activity';
import { auth } from '@/lib/auth';

type Result = { ok: true } | { ok: false; error: string };

async function getActor() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const role = session.user.role;
  if (role !== 'manager' && role !== 'admin') return null;
  return session.user;
}

/**
 * Отметить inbox-запись как обработанную. После этого она исчезает из /manager/inbox
 * и больше не считается в бейдже sidebar.
 */
export async function acknowledgeNotification(id: string): Promise<Result> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: 'Нет доступа' };

  await db
    .update(activityLog)
    .set({
      acknowledgedAt: new Date(),
      acknowledgedById: actor.id,
    })
    .where(and(eq(activityLog.id, id), isNull(activityLog.acknowledgedAt)));

  revalidatePath('/manager/inbox');
  revalidatePath('/manager');
  return { ok: true };
}

/**
 * Отметить ВСЕ активные inbox-записи менеджера как обработанные одним кликом.
 * Полезно после быстрого review всего списка.
 */
export async function acknowledgeAll(): Promise<Result> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: 'Нет доступа' };

  // Найдём id'ы активных записей по сделкам где actor назначен менеджером.
  // Делаем raw SQL так как нужен LEFT JOIN с deals для фильтра.
  await db.execute(sql`
    UPDATE activity_log
    SET
      acknowledged_at = NOW(),
      acknowledged_by_id = ${actor.id}::uuid
    WHERE id IN (
      SELECT a.id FROM activity_log a
      LEFT JOIN deals ON deals.id = a.entity_id AND a.entity_type = 'deal'
      WHERE a.action = 'deal.master_date_request'
        AND a.acknowledged_at IS NULL
        AND (deals.assigned_manager_id = ${actor.id}::uuid OR deals.assigned_manager_id IS NULL)
    )
  `);

  revalidatePath('/manager/inbox');
  revalidatePath('/manager');
  return { ok: true };
}
