'use server';

/**
 * Ставки мастеров (11.2026, запрос Сани): % от стоимости наряда + гарантированная месячная
 * минималка. Хранятся с историей — новая ставка действует с даты, прошлые месяцы не пересчитываются.
 */

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema/users';
import { masterPayRates } from '@/lib/db/schema/finance';
import { activityLog } from '@/lib/db/schema/activity';
import { normalizeLinePrice } from '@/lib/visits/create';

type Result = { ok: true } | { ok: false; error: string };

async function getManager() {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.role !== 'manager' && session.user.role !== 'admin') return null;
  return session.user;
}

const rateSchema = z.object({
  userId: z.string().uuid(),
  percent: z
    .union([z.string(), z.number()])
    .transform((v) => Number(String(v).replace(',', '.').trim()))
    .refine((v) => Number.isFinite(v) && v >= 0 && v <= 100, 'Процент — от 0 до 100'),
  minMonthly: z
    .union([z.string(), z.number()])
    .nullable()
    .optional()
    .refine(
      (v) => v === null || v === undefined || String(v).trim() === '' || normalizeLinePrice(v) !== null,
      'Минималка — неотрицательное число',
    ),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Укажи дату начала действия'),
  note: z.string().trim().max(500).nullable().optional(),
});

export async function setMasterRate(input: unknown): Promise<Result> {
  const actor = await getManager();
  if (!actor) return { ok: false, error: 'Нет доступа' };
  const parsed = rateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
  const { userId, percent, effectiveFrom } = parsed.data;
  if (Number.isNaN(new Date(`${effectiveFrom}T00:00:00Z`).getTime())) {
    return { ok: false, error: 'Некорректная дата' };
  }

  const [u] = await db
    .select({ id: users.id, role: users.role, fullName: users.fullName })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!u || u.role !== 'master') return { ok: false, error: 'Ставка задаётся только мастеру' };

  const minMonthly = normalizeLinePrice(parsed.data.minMonthly ?? null) ?? '0.00';
  const percentStr = (Math.round(percent * 100) / 100).toFixed(2);
  const note = parsed.data.note?.trim() || null;

  await db
    .insert(masterPayRates)
    .values({ userId, percent: percentStr, minMonthly, effectiveFrom, note, createdById: actor.id })
    .onConflictDoUpdate({
      target: [masterPayRates.userId, masterPayRates.effectiveFrom],
      set: { percent: percentStr, minMonthly, note, createdById: actor.id, createdAt: new Date() },
    });

  await db.insert(activityLog).values({
    userId: actor.id,
    action: 'master.rate_set',
    entityType: 'user',
    entityId: userId,
    changesJson: { master: u.fullName, percent: percentStr, minMonthly, effectiveFrom, note },
  });

  revalidatePath('/manager/masters');
  revalidatePath('/manager/summary');
  revalidatePath('/manager');
  return { ok: true };
}

export async function deleteMasterRate(rateId: string): Promise<Result> {
  const actor = await getManager();
  if (!actor) return { ok: false, error: 'Нет доступа' };
  if (!z.string().uuid().safeParse(rateId).success) return { ok: false, error: 'Ставка не найдена' };
  const deleted = await db
    .delete(masterPayRates)
    .where(and(eq(masterPayRates.id, rateId)))
    .returning({
      userId: masterPayRates.userId,
      percent: masterPayRates.percent,
      minMonthly: masterPayRates.minMonthly,
      effectiveFrom: masterPayRates.effectiveFrom,
    });
  if (deleted.length === 0) return { ok: false, error: 'Ставка не найдена' };
  await db.insert(activityLog).values({
    userId: actor.id,
    action: 'master.rate_delete',
    entityType: 'user',
    entityId: deleted[0].userId,
    changesJson: deleted[0],
  });
  revalidatePath('/manager/masters');
  revalidatePath('/manager/summary');
  revalidatePath('/manager');
  return { ok: true };
}
