'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq, and, ne, sql } from 'drizzle-orm';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { clients, type Client } from '@/lib/db/schema/clients';
import { clientObjects } from '@/lib/db/schema/objects';
import { activityLog } from '@/lib/db/schema/activity';
import { dealPriceItems } from '@/lib/db/schema/deals';
import { auth } from '@/lib/auth';
import { clientFormSchema, clientObjectSchema, updateClientStatusSchema } from './schemas';

type Result<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; field?: string; existingClientId?: string };

async function getActor() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user;
}

async function logActivity(
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  changes?: unknown
) {
  const headersList = await headers();
  const ip = headersList.get('x-forwarded-for')?.split(',')[0].trim() ?? null;
  const userAgent = headersList.get('user-agent') ?? null;
  await db.insert(activityLog).values({
    userId,
    action,
    entityType,
    entityId,
    changesJson: (changes as object) ?? null,
    ip,
    userAgent,
  });
}

// =============================================================
// CLIENT CRUD
// =============================================================

export async function createClient(rawInput: unknown): Promise<Result<{ id: string }>> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: 'Не авторизован' };

  const parsed = clientFormSchema.safeParse(rawInput);
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    return { ok: false, error: first.message, field: first.path.join('.') };
  }
  const data = parsed.data;

  // Проверка дубля по ИНН (если введён)
  if (data.inn) {
    const [existing] = await db
      .select({ id: clients.id, shortName: clients.shortName })
      .from(clients)
      .where(eq(clients.inn, data.inn))
      .limit(1);
    if (existing) {
      return {
        ok: false,
        error: `Клиент с этим ИНН уже существует: ${existing.shortName}`,
        field: 'inn',
        existingClientId: existing.id,
      };
    }
  }

  const insertValues = {
    ...data,
    createdById: actor.id,
    assignedManagerId: data.assignedManagerId ?? actor.id,
  };

  const [created] = await db.insert(clients).values(insertValues).returning({ id: clients.id });

  await logActivity(actor.id, 'client.create', 'client', created.id, { type: data.type, shortName: data.shortName });

  revalidatePath('/manager/clients');
  revalidatePath('/admin/clients');

  return { ok: true, data: { id: created.id } };
}

export async function updateClient(id: string, rawInput: unknown): Promise<Result> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: 'Не авторизован' };

  const parsed = clientFormSchema.safeParse(rawInput);
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    return { ok: false, error: first.message, field: first.path.join('.') };
  }
  const data = parsed.data;

  // Проверка дубля ИНН — но не на самом обновляемом клиенте
  if (data.inn) {
    const [duplicate] = await db
      .select({ id: clients.id, shortName: clients.shortName })
      .from(clients)
      .where(and(eq(clients.inn, data.inn), ne(clients.id, id)))
      .limit(1);
    if (duplicate) {
      return {
        ok: false,
        error: `ИНН уже используется клиентом: ${duplicate.shortName}`,
        field: 'inn',
        existingClientId: duplicate.id,
      };
    }
  }

  const [existing] = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  if (!existing) return { ok: false, error: 'Клиент не найден' };

  await db
    .update(clients)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(clients.id, id));

  await logActivity(actor.id, 'client.update', 'client', id, computeDiff(existing, data));

  revalidatePath('/manager/clients');
  revalidatePath(`/manager/clients/${id}`);

  return { ok: true, data: undefined };
}

export async function updateClientStatus(rawInput: unknown): Promise<Result> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: 'Не авторизован' };

  const parsed = updateClientStatusSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
  const { id, status } = parsed.data;

  const [existing] = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  if (!existing) return { ok: false, error: 'Клиент не найден' };

  await db
    .update(clients)
    .set({ status, updatedAt: new Date() })
    .where(eq(clients.id, id));

  await logActivity(actor.id, 'client.status_change', 'client', id, {
    from: existing.status,
    to: status,
  });

  revalidatePath('/manager/clients');
  revalidatePath(`/manager/clients/${id}`);

  return { ok: true, data: undefined };
}

// =============================================================
// CLIENT OBJECTS CRUD
// =============================================================

export async function addObject(clientId: string, rawInput: unknown): Promise<Result<{ id: string }>> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: 'Не авторизован' };

  const parsed = clientObjectSchema.safeParse(rawInput);
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    return { ok: false, error: first.message, field: first.path.join('.') };
  }

  const [client] = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, clientId)).limit(1);
  if (!client) return { ok: false, error: 'Клиент не найден' };

  const [created] = await db
    .insert(clientObjects)
    .values({ clientId, ...parsed.data })
    .returning({ id: clientObjects.id });

  await logActivity(actor.id, 'object.create', 'client_object', created.id, {
    clientId,
    name: parsed.data.name,
  });

  revalidatePath(`/manager/clients/${clientId}`);

  return { ok: true, data: { id: created.id } };
}

export async function updateObject(objectId: string, rawInput: unknown): Promise<Result> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: 'Не авторизован' };

  const parsed = clientObjectSchema.safeParse(rawInput);
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    return { ok: false, error: first.message, field: first.path.join('.') };
  }

  const [existing] = await db.select().from(clientObjects).where(eq(clientObjects.id, objectId)).limit(1);
  if (!existing) return { ok: false, error: 'Объект не найден' };

  await db
    .update(clientObjects)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(clientObjects.id, objectId));

  await logActivity(actor.id, 'object.update', 'client_object', objectId, computeDiff(existing, parsed.data));

  revalidatePath(`/manager/clients/${existing.clientId}`);

  return { ok: true, data: undefined };
}

export async function removeObject(objectId: string): Promise<Result> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: 'Не авторизован' };

  const [existing] = await db.select().from(clientObjects).where(eq(clientObjects.id, objectId)).limit(1);
  if (!existing) return { ok: false, error: 'Объект не найден' };

  // Защита: если есть deal_price_items с этим объектом — не удалять
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(dealPriceItems)
    .where(eq(dealPriceItems.objectId, objectId));

  if (count > 0) {
    return {
      ok: false,
      error: `Объект используется в ${count} позиции(ях) договоров — удаление невозможно. Перенесите/закройте договоры или измените статус объекта.`,
    };
  }

  await db.delete(clientObjects).where(eq(clientObjects.id, objectId));
  await logActivity(actor.id, 'object.delete', 'client_object', objectId, { clientId: existing.clientId });

  revalidatePath(`/manager/clients/${existing.clientId}`);

  return { ok: true, data: undefined };
}

// =============================================================
// Helpers
// =============================================================

/**
 * Минимальный diff: только изменённые поля, "before/after".
 */
function computeDiff(before: Record<string, unknown>, after: Record<string, unknown>) {
  const diff: Record<string, { before: unknown; after: unknown }> = {};
  for (const [key, value] of Object.entries(after)) {
    if (before[key] !== value) {
      diff[key] = { before: before[key], after: value };
    }
  }
  return diff;
}

// =============================================================
// Server form actions (для использования с <form action={...}>)
// =============================================================

export async function createClientFormAction(formData: FormData): Promise<void> {
  const data = Object.fromEntries(formData.entries());
  const result = await createClient(data);
  if (result.ok) redirect(`/manager/clients/${result.data.id}`);
  // Если ошибка — на этом этапе не пробрасываем, форма обрабатывает результат напрямую через клиентский вызов
  throw new Error(result.error);
}
