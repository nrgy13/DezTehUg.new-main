'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq, and, desc } from 'drizzle-orm';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import {
  deals,
  dealPriceItems,
  type DealStatus,
  type Deal,
} from '@/lib/db/schema/deals';
import { clients } from '@/lib/db/schema/clients';
import { users } from '@/lib/db/schema/users';
import { documents } from '@/lib/db/schema/documents';
import { activityLog } from '@/lib/db/schema/activity';
import { auth } from '@/lib/auth';
import { getStorage } from '@/lib/storage';
import {
  dealFormSchema,
  priceItemFormSchema,
  updateDealStatusSchema,
  updateDealDatesSchema,
} from './schemas';

type Result<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; field?: string };

async function getActor() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const role = session.user.role;
  // admin и manager — могут работать со сделками; master — только просмотр своих
  if (role !== 'admin' && role !== 'manager') return null;
  return session.user;
}

async function logActivity(
  userId: string,
  action: string,
  entityId: string,
  changes?: unknown,
) {
  const headersList = await headers();
  const ip = headersList.get('x-forwarded-for')?.split(',')[0].trim() ?? null;
  const userAgent = headersList.get('user-agent') ?? null;
  await db.insert(activityLog).values({
    userId,
    action,
    entityType: 'deal',
    entityId,
    changesJson: (changes as object) ?? null,
    ip,
    userAgent,
  });
}

function emptyToNull(v: string | null | undefined): string | null {
  if (v === undefined || v === null) return null;
  const trimmed = String(v).trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * Сгенерировать предварительный contract_number вида "ДТЮ-DD/MM/YY-ШТ"
 * где ШТ — порядковый номер для текущего дня. Это технический номер сделки
 * (не путать с official номером договора, который выдаёт Эпик A3 при генерации DOCX).
 *
 * Тут используется только для отображения в списках до момента, когда
 * пользователь сгенерирует первый официальный документ.
 */
async function generatePreliminaryDealNumber(date: Date): Promise<string> {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yy = String(date.getFullYear()).slice(-2);
  const prefix = `ДТЮ-${dd}/${mm}/${yy}-`;

  // Сколько уже сделок с этим префиксом — берём count + 1
  const existing = await db
    .select({ contractNumber: deals.contractNumber })
    .from(deals)
    .where(eq(deals.contractDate, date.toISOString().slice(0, 10)));

  const sameDayCount = existing.filter((d) =>
    d.contractNumber.startsWith(prefix),
  ).length;
  return `${prefix}${sameDayCount + 1}`;
}

// =============================================================
// CREATE
// =============================================================

export async function createDeal(input: unknown): Promise<Result<{ id: string }>> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: 'Нет доступа' };

  const parsed = dealFormSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    return { ok: false, error: first.message, field: first.path.join('.') };
  }
  const data = parsed.data;

  // Проверяем что клиент существует
  const client = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.id, data.clientId))
    .limit(1);
  if (client.length === 0) {
    return { ok: false, error: 'Клиент не найден', field: 'clientId' };
  }

  const contractDate = new Date(data.contractDate);
  if (isNaN(contractDate.getTime())) {
    return { ok: false, error: 'Неверный формат даты договора', field: 'contractDate' };
  }

  const contractNumber = await generatePreliminaryDealNumber(contractDate);

  const [created] = await db
    .insert(deals)
    .values({
      contractNumber,
      contractDate: data.contractDate,
      contractPlace: emptyToNull(data.contractPlace) ?? 'г. Новороссийск',
      clientId: data.clientId,
      leadId: data.leadId ?? null,
      startDate: emptyToNull(data.startDate) as string | null,
      endDate: emptyToNull(data.endDate) as string | null,
      status: 'draft',
      signatoryClient: emptyToNull(data.signatoryClient),
      signatoryExecutor: emptyToNull(data.signatoryExecutor) ?? 'ИП Белавина Ольга Владимировна',
      assignedManagerId: data.assignedManagerId ?? actor.id,
      assignedMasterId: data.assignedMasterId ?? null,
      notes: emptyToNull(data.notes),
      createdById: actor.id,
    })
    .returning({ id: deals.id });

  await logActivity(actor.id, 'deal.create', created.id, {
    contractNumber,
    clientId: data.clientId,
    fromLead: !!data.leadId,
  });

  revalidatePath('/manager/deals');
  revalidatePath(`/manager/clients/${data.clientId}`);

  return { ok: true, data: { id: created.id } };
}

/**
 * Удобный shortcut: создать минимальную draft-сделку от клиента.
 * Используется кнопкой «Создать сделку» в карточке клиента.
 */
export async function createDealFromClient(
  clientId: string,
): Promise<Result<{ id: string }>> {
  return createDeal({
    clientId,
    contractDate: new Date().toISOString().slice(0, 10),
  });
}

// =============================================================
// UPDATE
// =============================================================

export async function updateDeal(
  id: string,
  input: unknown,
): Promise<Result<{ id: string }>> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: 'Нет доступа' };

  const parsed = dealFormSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    return { ok: false, error: first.message, field: first.path.join('.') };
  }
  const data = parsed.data;

  const existing = await db.select().from(deals).where(eq(deals.id, id)).limit(1);
  if (existing.length === 0) return { ok: false, error: 'Сделка не найдена' };

  await db
    .update(deals)
    .set({
      contractDate: data.contractDate,
      contractPlace: emptyToNull(data.contractPlace) ?? 'г. Новороссийск',
      clientId: data.clientId,
      leadId: data.leadId ?? null,
      startDate: emptyToNull(data.startDate) as string | null,
      endDate: emptyToNull(data.endDate) as string | null,
      signatoryClient: emptyToNull(data.signatoryClient),
      signatoryExecutor: emptyToNull(data.signatoryExecutor) ?? 'ИП Белавина Ольга Владимировна',
      assignedManagerId: data.assignedManagerId ?? null,
      assignedMasterId: data.assignedMasterId ?? null,
      notes: emptyToNull(data.notes),
      updatedAt: new Date(),
    })
    .where(eq(deals.id, id));

  await logActivity(actor.id, 'deal.update', id, data);

  revalidatePath('/manager/deals');
  revalidatePath(`/manager/deals/${id}`);
  revalidatePath(`/manager/clients/${data.clientId}`);

  return { ok: true, data: { id } };
}

export async function updateDealStatus(
  id: string,
  input: unknown,
): Promise<Result<{ status: DealStatus }>> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: 'Нет доступа' };

  const parsed = updateDealStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0].message };
  }

  const existing = await db
    .select({ id: deals.id, clientId: deals.clientId, status: deals.status })
    .from(deals)
    .where(eq(deals.id, id))
    .limit(1);
  if (existing.length === 0) return { ok: false, error: 'Сделка не найдена' };

  await db
    .update(deals)
    .set({ status: parsed.data.status, updatedAt: new Date() })
    .where(eq(deals.id, id));

  await logActivity(actor.id, 'deal.status_change', id, {
    from: existing[0].status,
    to: parsed.data.status,
  });

  revalidatePath('/manager/deals');
  revalidatePath(`/manager/deals/${id}`);
  revalidatePath(`/manager/clients/${existing[0].clientId}`);

  return { ok: true, data: { status: parsed.data.status } };
}

/**
 * Drag-n-drop переноса дат сделки в календаре.
 * Доступно только manager / admin.
 */
export async function updateDealDates(
  id: string,
  input: unknown,
): Promise<Result<{ startDate: string; endDate: string | null }>> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: 'Нет доступа' };

  const parsed = updateDealDatesSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0].message };
  }
  const { startDate, endDate } = parsed.data;

  const existing = await db
    .select({
      id: deals.id,
      clientId: deals.clientId,
      startDate: deals.startDate,
      endDate: deals.endDate,
    })
    .from(deals)
    .where(eq(deals.id, id))
    .limit(1);
  if (existing.length === 0) return { ok: false, error: 'Сделка не найдена' };

  await db
    .update(deals)
    .set({
      startDate,
      endDate: endDate ?? null,
      updatedAt: new Date(),
    })
    .where(eq(deals.id, id));

  await logActivity(actor.id, 'deal.dates_drag', id, {
    from: { startDate: existing[0].startDate, endDate: existing[0].endDate },
    to: { startDate, endDate: endDate ?? null },
  });

  revalidatePath('/manager/calendar');
  revalidatePath('/manager/deals');
  revalidatePath(`/manager/deals/${id}`);

  return { ok: true, data: { startDate, endDate: endDate ?? null } };
}

export async function assignMaster(
  id: string,
  masterId: string | null,
): Promise<Result> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: 'Нет доступа' };

  if (masterId) {
    const m = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, masterId))
      .limit(1);
    if (m.length === 0) return { ok: false, error: 'Мастер не найден' };
    if (m[0].role !== 'master' && m[0].role !== 'admin') {
      return { ok: false, error: 'Указанный пользователь не является мастером' };
    }
  }

  await db
    .update(deals)
    .set({ assignedMasterId: masterId, updatedAt: new Date() })
    .where(eq(deals.id, id));

  await logActivity(actor.id, 'deal.assign_master', id, { masterId });

  revalidatePath(`/manager/deals/${id}`);
  return { ok: true, data: undefined };
}

// =============================================================
// PRICE ITEMS
// =============================================================

export async function addPriceItem(
  dealId: string,
  input: unknown,
): Promise<Result<{ id: string }>> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: 'Нет доступа' };

  const parsed = priceItemFormSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    return { ok: false, error: first.message, field: first.path.join('.') };
  }
  const data = parsed.data;

  const dealExists = await db
    .select({ id: deals.id })
    .from(deals)
    .where(eq(deals.id, dealId))
    .limit(1);
  if (dealExists.length === 0) return { ok: false, error: 'Сделка не найдена' };

  const priceWithVat = round2(data.priceNoVat * (1 + data.vatRate / 100));

  const [created] = await db
    .insert(dealPriceItems)
    .values({
      dealId,
      objectId: data.objectId ?? null,
      serviceId: data.serviceId ?? null,
      customName: emptyToNull(data.customName ?? null),
      areaM2: data.areaM2,
      method: emptyToNull(data.method ?? null),
      frequency: emptyToNull(data.frequency ?? null),
      priceNoVat: String(data.priceNoVat),
      priceWithVat: String(priceWithVat),
      vatRate: String(data.vatRate),
      sortOrder: data.sortOrder,
    })
    .returning({ id: dealPriceItems.id });

  await logActivity(actor.id, 'deal.price_item.add', dealId, {
    priceItemId: created.id,
    name: data.customName || data.serviceId,
  });

  revalidatePath(`/manager/deals/${dealId}`);
  return { ok: true, data: { id: created.id } };
}

export async function updatePriceItem(
  id: string,
  input: unknown,
): Promise<Result> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: 'Нет доступа' };

  const parsed = priceItemFormSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    return { ok: false, error: first.message, field: first.path.join('.') };
  }
  const data = parsed.data;

  const existing = await db
    .select({ id: dealPriceItems.id, dealId: dealPriceItems.dealId })
    .from(dealPriceItems)
    .where(eq(dealPriceItems.id, id))
    .limit(1);
  if (existing.length === 0) return { ok: false, error: 'Позиция не найдена' };

  const priceWithVat = round2(data.priceNoVat * (1 + data.vatRate / 100));

  await db
    .update(dealPriceItems)
    .set({
      objectId: data.objectId ?? null,
      serviceId: data.serviceId ?? null,
      customName: emptyToNull(data.customName ?? null),
      areaM2: data.areaM2,
      method: emptyToNull(data.method ?? null),
      frequency: emptyToNull(data.frequency ?? null),
      priceNoVat: String(data.priceNoVat),
      priceWithVat: String(priceWithVat),
      vatRate: String(data.vatRate),
      sortOrder: data.sortOrder,
      updatedAt: new Date(),
    })
    .where(eq(dealPriceItems.id, id));

  await logActivity(actor.id, 'deal.price_item.update', existing[0].dealId, {
    priceItemId: id,
  });

  revalidatePath(`/manager/deals/${existing[0].dealId}`);
  return { ok: true, data: undefined };
}

export async function deletePriceItem(id: string): Promise<Result> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: 'Нет доступа' };

  const existing = await db
    .select({ id: dealPriceItems.id, dealId: dealPriceItems.dealId })
    .from(dealPriceItems)
    .where(eq(dealPriceItems.id, id))
    .limit(1);
  if (existing.length === 0) return { ok: false, error: 'Позиция не найдена' };

  await db.delete(dealPriceItems).where(eq(dealPriceItems.id, id));

  await logActivity(actor.id, 'deal.price_item.delete', existing[0].dealId, {
    priceItemId: id,
  });

  revalidatePath(`/manager/deals/${existing[0].dealId}`);
  return { ok: true, data: undefined };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// =============================================================
// DOCUMENTS
// =============================================================

/**
 * Удалить документ полностью: файлы из storage (DOCX + PDF + signed_scan если есть)
 * + запись из БД. Действие необратимо.
 *
 * Доступно manager и admin. Если файла в storage нет — не падает (idempotent delete).
 */
export async function deleteDocument(id: string): Promise<Result> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: 'Нет доступа' };

  const rows = await db
    .select({
      id: documents.id,
      number: documents.number,
      type: documents.type,
      dealId: documents.dealId,
      clientId: documents.clientId,
      docxS3Key: documents.docxS3Key,
      pdfS3Key: documents.pdfS3Key,
      signedScanS3Key: documents.signedScanS3Key,
    })
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1);
  if (rows.length === 0) return { ok: false, error: 'Документ не найден' };
  const doc = rows[0];

  // Удаляем файлы из storage. Если упадёт — логируем, но БД запись всё равно сносим
  // (не оставляем "висячий" документ ради файла).
  const storage = await getStorage();
  for (const key of [doc.docxS3Key, doc.pdfS3Key, doc.signedScanS3Key]) {
    if (!key) continue;
    try {
      await storage.delete(key);
    } catch (err) {
      console.warn(`[deleteDocument] storage.delete(${key}) failed:`, err);
    }
  }

  await db.delete(documents).where(eq(documents.id, id));

  await logActivity(actor.id, 'document.delete', doc.dealId ?? doc.clientId ?? id, {
    documentId: id,
    number: doc.number,
    type: doc.type,
  });

  if (doc.dealId) revalidatePath(`/manager/deals/${doc.dealId}`);
  if (doc.clientId) revalidatePath(`/manager/clients/${doc.clientId}`);

  return { ok: true, data: undefined };
}
