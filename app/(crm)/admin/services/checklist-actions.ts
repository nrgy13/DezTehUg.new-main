'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { and, eq, sql } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { serviceChecklists } from '@/lib/db/schema/checklists';

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

async function requireAdmin() {
  const session = await auth();
  // Sprint 9: manager (Регина) приравнен к admin для шаблонов чеклистов.
  if (
    !session?.user?.id ||
    (session.user.role !== 'admin' && session.user.role !== 'manager')
  )
    return null;
  return session.user;
}

const itemSchema = z.object({
  title: z.string().trim().min(2, 'Минимум 2 символа').max(200),
  description: z.string().trim().max(1000).optional().or(z.literal('')),
  required: z.boolean().default(true),
});

export async function listChecklistTemplates(serviceId: string) {
  const admin = await requireAdmin();
  if (!admin) return { ok: false as const, error: 'Нет доступа' };
  const rows = await db
    .select()
    .from(serviceChecklists)
    .where(eq(serviceChecklists.serviceId, serviceId))
    .orderBy(serviceChecklists.position);
  return { ok: true as const, data: rows };
}

export async function createChecklistTemplate(
  serviceId: string,
  input: unknown,
): Promise<Result<{ id: string }>> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: 'Нет доступа' };

  const parsed = itemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };

  // Следующая position — max+1 по этой услуге.
  const [{ next }] = await db
    .select({
      next: sql<number>`COALESCE(MAX(${serviceChecklists.position}), -1) + 1`,
    })
    .from(serviceChecklists)
    .where(eq(serviceChecklists.serviceId, serviceId));

  const [created] = await db
    .insert(serviceChecklists)
    .values({
      serviceId,
      position: Number(next ?? 0),
      title: parsed.data.title,
      description: parsed.data.description?.trim() || null,
      required: parsed.data.required,
    })
    .returning({ id: serviceChecklists.id });

  revalidatePath('/admin/services');
  return { ok: true, data: { id: created.id } };
}

export async function updateChecklistTemplate(
  id: string,
  input: unknown,
): Promise<Result> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: 'Нет доступа' };

  const parsed = itemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };

  await db
    .update(serviceChecklists)
    .set({
      title: parsed.data.title,
      description: parsed.data.description?.trim() || null,
      required: parsed.data.required,
      updatedAt: new Date(),
    })
    .where(eq(serviceChecklists.id, id));

  revalidatePath('/admin/services');
  return { ok: true, data: undefined };
}

export async function deleteChecklistTemplate(id: string): Promise<Result> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: 'Нет доступа' };
  await db.delete(serviceChecklists).where(eq(serviceChecklists.id, id));
  revalidatePath('/admin/services');
  return { ok: true, data: undefined };
}

export async function reorderChecklistTemplates(
  serviceId: string,
  orderedIds: string[],
): Promise<Result> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: 'Нет доступа' };

  // Транзакция: обновляем position по порядку id.
  await db.transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx
        .update(serviceChecklists)
        .set({ position: i, updatedAt: new Date() })
        .where(
          and(
            eq(serviceChecklists.id, orderedIds[i]),
            eq(serviceChecklists.serviceId, serviceId),
          ),
        );
    }
  });

  revalidatePath('/admin/services');
  return { ok: true, data: undefined };
}
