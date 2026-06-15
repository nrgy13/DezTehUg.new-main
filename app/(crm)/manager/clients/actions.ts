'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq, and, ne, or, inArray, sql } from 'drizzle-orm';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { clients, type Client } from '@/lib/db/schema/clients';
import { clientObjects, clientObjectServices } from '@/lib/db/schema/objects';
import { activityLog } from '@/lib/db/schema/activity';
import { dealPriceItems, deals, dealWorkLogs } from '@/lib/db/schema/deals';
import { documents } from '@/lib/db/schema/documents';
import { executeDocumentDeletion } from '@/lib/documents/deletion';
import { auth } from '@/lib/auth';
import {
  clientFormSchema,
  clientObjectSchema,
  updateClientStatusSchema,
  type ObjectServiceInput,
} from './schemas';

type Result<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; field?: string; existingClientId?: string };

// db или транзакция — чтобы CRUD-хелперы работали и внутри db.transaction().
type DbExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

async function getActor() {
  const session = await auth();
  if (!session?.user?.id) return null;
  // Клиенты/объекты — мутации только для manager/admin. Server actions вызываются
  // в обход middleware (POST), поэтому роль проверяем ЯВНО (master не имеет прав CRUD).
  if (session.user.role !== 'manager' && session.user.role !== 'admin') return null;
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

/**
 * Удаление клиента manager или admin.
 *
 * Двухшаговое: если у клиента есть зависимости (договоры/документы) и не передан
 * force — возвращаем needsConfirm с детальным перечнем, чтобы кнопка показала
 * подробное подтверждение (Саня выбрал каскад вместо мягкого запрета, 2026-06-15).
 *
 * При force=true — КАСКАД: документы (файлы из storage + записи) удаляем явно
 * (FK set null их бы осиротил), затем договоры (каскад снимает price_items /
 * addendums / work_logs → checklist) и клиента (каскад: client_objects →
 * object_services; leads.client_id → SET NULL). Полный снимок данных пишем в
 * activity_log ДО удаления — на случай восстановления.
 */
export type DeleteClientResult =
  | { ok: true }
  | { ok: false; error: string }
  | {
      ok: false;
      needsConfirm: true;
      message: string;
      dealCount: number;
      objectCount: number;
      documentCount: number;
    };

export async function deleteClient(
  id: string,
  opts?: { force?: boolean },
): Promise<DeleteClientResult> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: 'Не авторизован' };

  const [existing] = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  if (!existing) return { ok: false, error: 'Клиент не найден' };

  // Зависимости клиента (для подтверждения + каскада).
  const dealRows = await db
    .select({ id: deals.id, contractNumber: deals.contractNumber })
    .from(deals)
    .where(eq(deals.clientId, id));
  const objectRows = await db
    .select({ id: clientObjects.id, name: clientObjects.name })
    .from(clientObjects)
    .where(eq(clientObjects.clientId, id));
  const dealIds = dealRows.map((d) => d.id);
  const docRows = await db
    .select({ id: documents.id })
    .from(documents)
    .where(
      dealIds.length > 0
        ? or(eq(documents.clientId, id), inArray(documents.dealId, dealIds))
        : eq(documents.clientId, id),
    );

  // Шаг 1: есть зависимости и не подтверждено → запрашиваем подтверждение.
  if (!opts?.force && (dealRows.length > 0 || docRows.length > 0)) {
    const parts: string[] = [];
    if (dealRows.length) parts.push(`${dealRows.length} договор(ов)`);
    if (objectRows.length) parts.push(`${objectRows.length} объект(ов)`);
    if (docRows.length) parts.push(`${docRows.length} документ(ов)`);
    return {
      ok: false,
      needsConfirm: true,
      dealCount: dealRows.length,
      objectCount: objectRows.length,
      documentCount: docRows.length,
      message:
        `У клиента «${existing.shortName}»: ${parts.join(', ')}. ` +
        `Каскадное удаление снесёт ВСЁ это БЕЗВОЗВРАТНО (договоры, прайс, заказ-наряды, история воронки и аналитика по ним). ` +
        `Полный снимок данных сохранится в журнале. Удалить клиента со всем содержимым?`,
    };
  }

  // Аудит ДО удаления: полный снимок (для восстановления из журнала).
  await logActivity(actor.id, 'client.delete_cascade', 'client', id, {
    client: existing,
    deals: dealRows,
    objects: objectRows,
    documentCount: docRows.length,
    forced: opts?.force ?? false,
  });

  // Документы: файлы из storage + записи (иначе осиротеют по FK set null).
  for (const doc of docRows) {
    const res = await executeDocumentDeletion(doc.id);
    if (!res.ok) {
      return { ok: false, error: `Не удалось удалить документ клиента: ${res.error}` };
    }
  }

  // Договоры + клиент — в транзакции (каскады Postgres делают остальное).
  await db.transaction(async (tx) => {
    if (dealIds.length > 0) {
      await tx.delete(deals).where(eq(deals.clientId, id));
    }
    await tx.delete(clients).where(eq(clients.id, id));
  });

  revalidatePath('/manager/clients');
  revalidatePath('/admin/clients');

  return { ok: true };
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

  const { services: serviceList, ...obj } = parsed.data;

  // Если объект привязывается к договору — он должен принадлежать этому же клиенту.
  if (obj.dealId) {
    const [d] = await db
      .select({ id: deals.id, clientId: deals.clientId })
      .from(deals)
      .where(eq(deals.id, obj.dealId))
      .limit(1);
    if (!d) return { ok: false, error: 'Договор не найден', field: 'dealId' };
    if (d.clientId !== clientId)
      return { ok: false, error: 'Договор принадлежит другому клиенту', field: 'dealId' };
  }

  // Объект + его услуги — одной транзакцией (иначе при сбое на услугах остаётся «голый» объект).
  const created = await db.transaction(async (tx) => {
    const [c] = await tx
      .insert(clientObjects)
      .values({
        clientId,
        ...obj,
        areaM2: obj.areaM2 == null ? null : String(obj.areaM2),
        dealId: obj.dealId ?? null,
        plannedTreatmentDate: obj.plannedTreatmentDate ?? null,
      })
      .returning({ id: clientObjects.id });
    await syncObjectServices(c.id, serviceList ?? [], tx);
    return c;
  });

  await logActivity(actor.id, 'object.create', 'client_object', created.id, {
    clientId,
    name: obj.name,
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

  // dealId сюда НЕ попадает: привязка к договору живёт отдельно
  // (attachObjectToDeal / createObjectForDeal), чтобы правка реквизитов
  // объекта не сбрасывала его связь с договором.
  const { services: serviceList, dealId: _ignoredDealId, ...obj } = parsed.data;

  // Правка реквизитов + услуги — одной транзакцией (иначе sync мог снести услуги и упасть на вставке).
  await db.transaction(async (tx) => {
    await tx
      .update(clientObjects)
      .set({
        ...obj,
        areaM2: obj.areaM2 == null ? null : String(obj.areaM2),
        plannedTreatmentDate: obj.plannedTreatmentDate ?? null,
        updatedAt: new Date(),
      })
      .where(eq(clientObjects.id, objectId));
    await syncObjectServices(objectId, serviceList ?? [], tx);
  });

  await logActivity(actor.id, 'object.update', 'client_object', objectId, computeDiff(existing, obj));

  revalidatePath(`/manager/clients/${existing.clientId}`);
  if (existing.dealId) revalidatePath(`/manager/deals/${existing.dealId}`);

  return { ok: true, data: undefined };
}

/**
 * Sprint 9: привязать/отвязать объект к договору (временная функция для Регины —
 * чтобы дополнить старые объекты договором-основанием). dealId=null → отвязать.
 * Договор обязан принадлежать тому же клиенту, что и объект.
 */
export async function attachObjectToDeal(
  objectId: string,
  dealId: string | null,
): Promise<Result> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: 'Не авторизован' };

  const [obj] = await db
    .select({ id: clientObjects.id, clientId: clientObjects.clientId, dealId: clientObjects.dealId })
    .from(clientObjects)
    .where(eq(clientObjects.id, objectId))
    .limit(1);
  if (!obj) return { ok: false, error: 'Объект не найден' };

  if (dealId) {
    const [d] = await db
      .select({ id: deals.id, clientId: deals.clientId })
      .from(deals)
      .where(eq(deals.id, dealId))
      .limit(1);
    if (!d) return { ok: false, error: 'Договор не найден' };
    if (d.clientId !== obj.clientId)
      return { ok: false, error: 'Договор принадлежит другому клиенту' };
  }

  await db
    .update(clientObjects)
    .set({ dealId, updatedAt: new Date() })
    .where(eq(clientObjects.id, objectId));

  await logActivity(actor.id, 'object.attach_deal', 'client_object', objectId, {
    from: obj.dealId,
    to: dealId,
  });

  revalidatePath(`/manager/clients/${obj.clientId}`);
  if (dealId) revalidatePath(`/manager/deals/${dealId}`);
  if (obj.dealId) revalidatePath(`/manager/deals/${obj.dealId}`);

  return { ok: true, data: undefined };
}

/**
 * Sprint 9: создать объект сразу привязанным к договору (из карточки договора,
 * таб «Объекты»). Клиент берётся из договора, dealId инъектируется принудительно.
 */
export async function createObjectForDeal(
  dealId: string,
  rawInput: unknown,
): Promise<Result<{ id: string }>> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: 'Не авторизован' };

  const [deal] = await db
    .select({ id: deals.id, clientId: deals.clientId })
    .from(deals)
    .where(eq(deals.id, dealId))
    .limit(1);
  if (!deal) return { ok: false, error: 'Сделка не найдена' };

  const input = { ...(rawInput as Record<string, unknown>), dealId };
  const res = await addObject(deal.clientId, input);
  if (res.ok) revalidatePath(`/manager/deals/${dealId}`);
  return res;
}

/**
 * Заменяет полный набор услуг объекта (delete-all + reinsert). Пустые строки
 * (нет ни услуги из каталога, ни произвольного названия) отсеиваются.
 */
async function syncObjectServices(
  objectId: string,
  serviceList: ObjectServiceInput[],
  executor: DbExecutor = db,
): Promise<void> {
  await executor.delete(clientObjectServices).where(eq(clientObjectServices.objectId, objectId));

  const rows = serviceList
    .filter((s) => s.serviceId || s.customName)
    .map((s, i) => ({
      objectId,
      serviceId: s.serviceId ?? null,
      customName: s.customName ?? null,
      method: s.method ?? null,
      // Sprint 10: единица (дефолт m2) + количество (numeric → string в Drizzle).
      unit: s.unit ?? 'm2',
      quantity: s.quantity == null ? null : String(s.quantity),
      // Релиз B: периодичность обработки (для серии напоминаний).
      frequency: s.frequency ?? null,
      sortOrder: i,
    }));

  if (rows.length > 0) {
    await executor.insert(clientObjectServices).values(rows);
  }
}

export type RemoveObjectResult =
  | { ok: true }
  | { ok: false; error: string }
  | { ok: false; needsConfirm: true; message: string; priceCount: number; visitCount: number };

export async function removeObject(
  objectId: string,
  opts?: { force?: boolean },
): Promise<RemoveObjectResult> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: 'Не авторизован' };

  const [existing] = await db.select().from(clientObjects).where(eq(clientObjects.id, objectId)).limit(1);
  if (!existing) return { ok: false, error: 'Объект не найден' };

  // Связи объекта: позиции прайса и выезды/наряды. На уровне БД оба FK = SET NULL,
  // поэтому удаление безопасно (ссылки обнулятся). Но предупреждаем менеджера —
  // акты АО/АВР по объекту после удаления уже не сформировать. force=true пропускает.
  if (!opts?.force) {
    const [[price], [visits]] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(dealPriceItems)
        .where(eq(dealPriceItems.objectId, objectId)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(dealWorkLogs)
        .where(eq(dealWorkLogs.objectId, objectId)),
    ]);
    const priceCount = price?.count ?? 0;
    const visitCount = visits?.count ?? 0;
    if (priceCount > 0 || visitCount > 0) {
      const parts: string[] = [];
      if (priceCount > 0) parts.push(`${priceCount} позиц. прайса`);
      if (visitCount > 0) parts.push(`${visitCount} выезд(ов)/наряд(ов)`);
      return {
        ok: false,
        needsConfirm: true,
        priceCount,
        visitCount,
        message: `Объект «${existing.name}» используется в ${parts.join(
          ' и ',
        )}. При удалении запланированные наряды будут удалены, остальные связи (прайс, завершённые выезды) обнулятся — акты АО/АВР по объекту больше не сформировать. Всё равно удалить?`,
      };
    }
  }

  // Planned-наряды этого объекта без него бессмысленны → удаляем в транзакции (каскад снимет
  // их услуги+чеклист). In_progress/completed оставляем как историю (object_id занулится FK SET NULL).
  await db.transaction(async (tx) => {
    await tx
      .delete(dealWorkLogs)
      .where(and(eq(dealWorkLogs.objectId, objectId), eq(dealWorkLogs.status, 'planned')));
    await tx.delete(clientObjects).where(eq(clientObjects.id, objectId));
  });
  await logActivity(actor.id, 'object.delete', 'client_object', objectId, {
    clientId: existing.clientId,
    forced: opts?.force ?? false,
  });

  revalidatePath(`/manager/clients/${existing.clientId}`);

  return { ok: true };
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
