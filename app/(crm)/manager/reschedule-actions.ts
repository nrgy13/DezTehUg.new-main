'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { decideRescheduleRequest } from '@/lib/visits/reschedule-requests';

type Result = { ok: true } | { ok: false; error: string };

async function getManager() {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.role !== 'manager' && session.user.role !== 'admin') return null;
  return session.user;
}

const decideSchema = z.object({
  requestId: z.string().uuid(),
  decision: z.enum(['approve', 'reject']),
  comment: z.string().max(1000).nullable().optional(),
});

/** Менеджер одобряет (наряд переезжает, бригаде push) или отклоняет запрос мастера на перенос. */
export async function decideWorkOrderReschedule(input: unknown): Promise<Result> {
  const actor = await getManager();
  if (!actor) return { ok: false, error: 'Нет доступа' };
  const parsed = decideSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Некорректные данные' };
  const res = await decideRescheduleRequest(actor, parsed.data);
  if (!res.ok) return res;
  const { workLogId, dealId, objectId } = res.data;
  revalidatePath('/manager');
  revalidatePath('/manager/calendar');
  revalidatePath('/manager/summary');
  revalidatePath(`/manager/deals/${dealId}`);
  if (objectId) revalidatePath(`/manager/objects/${objectId}`);
  revalidatePath('/master');
  revalidatePath('/master/calendar');
  revalidatePath(`/master/visits/${workLogId}`);
  return { ok: true };
}
