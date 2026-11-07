'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import {
  cancelRescheduleRequest,
  createRescheduleRequest,
} from '@/lib/visits/reschedule-requests';

type Result = { ok: true } | { ok: false; error: string };

async function getMaster() {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.role !== 'master' && session.user.role !== 'admin') return null;
  return session.user;
}

const requestSchema = z.object({
  workLogId: z.string().uuid(),
  toAtIso: z.string().min(10),
  reason: z.string(),
});

/**
 * Мастер просит перенести наряд (11.2026): сам дату не меняет — менеджеру уходит срочное
 * уведомление, решение — у менеджера. Причина обязательна (письменное пояснение для Регины).
 */
export async function requestWorkOrderReschedule(input: unknown): Promise<Result> {
  const actor = await getMaster();
  if (!actor) return { ok: false, error: 'Нет доступа' };
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Некорректные данные запроса' };
  const res = await createRescheduleRequest(actor, {
    workLogId: parsed.data.workLogId,
    toAt: new Date(parsed.data.toAtIso),
    reason: parsed.data.reason,
  });
  if (!res.ok) return res;
  revalidatePath(`/master/visits/${parsed.data.workLogId}`);
  revalidatePath('/master');
  revalidatePath('/manager');
  return { ok: true };
}

export async function cancelWorkOrderReschedule(requestId: string, workLogId: string): Promise<Result> {
  const actor = await getMaster();
  if (!actor) return { ok: false, error: 'Нет доступа' };
  if (!z.string().uuid().safeParse(requestId).success) return { ok: false, error: 'Запрос не найден' };
  const res = await cancelRescheduleRequest(actor, requestId);
  if (!res.ok) return res;
  if (z.string().uuid().safeParse(workLogId).success) revalidatePath(`/master/visits/${workLogId}`);
  revalidatePath('/manager');
  return { ok: true };
}
