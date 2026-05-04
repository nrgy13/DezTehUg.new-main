'use server';

import { revalidatePath } from 'next/cache';
import { eq, and, desc } from 'drizzle-orm';
import { headers } from 'next/headers';
import { z } from 'zod';
import { db } from '@/lib/db';
import { deals, dealAddendums } from '@/lib/db/schema/deals';
import { activityLog } from '@/lib/db/schema/activity';
import { auth } from '@/lib/auth';

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

async function getActor() {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.role !== 'manager' && session.user.role !== 'admin') return null;
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
    entityType: 'deal_addendum',
    entityId,
    changesJson: (changes as object) ?? null,
    ip: headersList.get('x-forwarded-for')?.split(',')[0].trim() ?? null,
    userAgent: headersList.get('user-agent') ?? null,
  });
}

const addendumFormSchema = z.object({
  date: z.string().min(1, 'Укажи дату'),
  description: z.string().max(5000).optional().or(z.literal('')),
});

export async function createAddendum(
  dealId: string,
  input: unknown,
): Promise<Result<{ id: string; number: number }>> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: 'Нет доступа' };

  const parsed = addendumFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0].message };
  }

  const dealRows = await db.select({ id: deals.id }).from(deals).where(eq(deals.id, dealId)).limit(1);
  if (dealRows.length === 0) return { ok: false, error: 'Сделка не найдена' };

  // Внутренний номер ДС — max+1 в рамках этой сделки (ДС№1, №2, №3...)
  // Это не путать с официальным номером документа (ДС-2026-NNN), который выдаст
  // nextDocumentNumber при генерации DOCX.
  const last = await db
    .select({ number: dealAddendums.number })
    .from(dealAddendums)
    .where(eq(dealAddendums.dealId, dealId))
    .orderBy(desc(dealAddendums.number))
    .limit(1);
  const nextNumber = (last[0]?.number ?? 0) + 1;

  const [created] = await db
    .insert(dealAddendums)
    .values({
      dealId,
      number: nextNumber,
      date: parsed.data.date,
      description: parsed.data.description?.trim() || null,
      status: 'draft',
      createdById: actor.id,
    })
    .returning({ id: dealAddendums.id });

  await logActivity(actor.id, 'addendum.create', created.id, {
    dealId,
    number: nextNumber,
  });

  revalidatePath(`/manager/deals/${dealId}`);
  return { ok: true, data: { id: created.id, number: nextNumber } };
}

export async function deleteAddendum(id: string): Promise<Result> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: 'Нет доступа' };

  const rows = await db
    .select({ id: dealAddendums.id, dealId: dealAddendums.dealId })
    .from(dealAddendums)
    .where(eq(dealAddendums.id, id))
    .limit(1);
  if (rows.length === 0) return { ok: false, error: 'ДС не найдено' };

  await db.delete(dealAddendums).where(eq(dealAddendums.id, id));

  await logActivity(actor.id, 'addendum.delete', id, { dealId: rows[0].dealId });
  revalidatePath(`/manager/deals/${rows[0].dealId}`);
  return { ok: true, data: undefined };
}
