'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { z } from 'zod';
import { db } from '@/lib/db';
import { deals, dealWorkLogs } from '@/lib/db/schema/deals';
import { activityLog } from '@/lib/db/schema/activity';
import { auth } from '@/lib/auth';

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

async function getMaster() {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.role !== 'master' && session.user.role !== 'admin') return null;
  return session.user;
}

async function logActivity(
  userId: string,
  action: string,
  entityId: string,
  changes?: unknown,
) {
  const headersList = await headers();
  await db.insert(activityLog).values({
    userId,
    action,
    entityType: 'deal',
    entityId,
    changesJson: (changes as object) ?? null,
    ip: headersList.get('x-forwarded-for')?.split(',')[0].trim() ?? null,
    userAgent: headersList.get('user-agent') ?? null,
  });
}

const workLogSchema = z.object({
  performedAt: z.string().min(1, 'Укажи дату'),
  description: z.string().min(2, 'Опиши что было сделано'),
  areaM2: z.coerce.number().int().min(0).max(1_000_000).optional().nullable(),
  notes: z.string().max(2000).optional().or(z.literal('')),
});

export async function addWorkLog(
  dealId: string,
  input: unknown,
): Promise<Result<{ id: string }>> {
  const actor = await getMaster();
  if (!actor) return { ok: false, error: 'Нет доступа' };

  // Проверяем что мастер назначен на эту сделку (admin может всегда)
  const dealRows = await db
    .select({ id: deals.id, masterId: deals.assignedMasterId })
    .from(deals)
    .where(eq(deals.id, dealId))
    .limit(1);
  if (dealRows.length === 0) return { ok: false, error: 'Сделка не найдена' };
  if (actor.role !== 'admin' && dealRows[0].masterId !== actor.id) {
    return { ok: false, error: 'Эта сделка назначена не на тебя' };
  }

  const parsed = workLogSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };

  const [created] = await db
    .insert(dealWorkLogs)
    .values({
      dealId,
      masterId: actor.id,
      performedAt: new Date(parsed.data.performedAt),
      description: parsed.data.description,
      areaM2: parsed.data.areaM2 ?? null,
      notes: parsed.data.notes?.trim() || null,
    })
    .returning({ id: dealWorkLogs.id });

  await logActivity(actor.id, 'work_log.add', dealId, {
    workLogId: created.id,
    description: parsed.data.description.slice(0, 100),
  });

  revalidatePath(`/master/deals/${dealId}`);
  revalidatePath(`/manager/deals/${dealId}`);
  return { ok: true, data: { id: created.id } };
}

export async function markDealCompleted(dealId: string): Promise<Result> {
  const actor = await getMaster();
  if (!actor) return { ok: false, error: 'Нет доступа' };

  const dealRows = await db
    .select({ id: deals.id, masterId: deals.assignedMasterId, status: deals.status })
    .from(deals)
    .where(eq(deals.id, dealId))
    .limit(1);
  if (dealRows.length === 0) return { ok: false, error: 'Сделка не найдена' };
  if (actor.role !== 'admin' && dealRows[0].masterId !== actor.id) {
    return { ok: false, error: 'Эта сделка назначена не на тебя' };
  }

  await db
    .update(deals)
    .set({ status: 'completed', updatedAt: new Date() })
    .where(eq(deals.id, dealId));

  await logActivity(actor.id, 'deal.mark_completed', dealId, {
    from: dealRows[0].status,
  });

  revalidatePath(`/master/deals/${dealId}`);
  revalidatePath(`/master`);
  revalidatePath(`/manager/deals/${dealId}`);
  return { ok: true, data: undefined };
}
