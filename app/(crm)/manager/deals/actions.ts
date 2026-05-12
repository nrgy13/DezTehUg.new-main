'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import {
  deals,
  dealPriceItems,
  type DealStatus,
} from '@/lib/db/schema/deals';
import { clients } from '@/lib/db/schema/clients';
import { users } from '@/lib/db/schema/users';
import { documents } from '@/lib/db/schema/documents';
import { activityLog } from '@/lib/db/schema/activity';
import { auth } from '@/lib/auth';
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
 * Вычисляет startAt/endAt timestamptz и флаг isAllDay из date+time inputs формы.
 * Время трактуется как МСК (Europe/Moscow → UTC offset +03:00).
 * Если оба startTime и endTime пусты → isAllDay=true, startAt=date 00:00 МСК, endAt=date 23:59 МСК.
 */
function deriveDealTimes(
  startDate: string | null,
  endDate: string | null,
  startTime: string | null,
  endTime: string | null,
): { startAt: Date | null; endAt: Date | null; isAllDay: boolean } {
  if (!startDate && !endDate) {
    return { startAt: null, endAt: null, isAllDay: true };
  }
  const hasTime = Boolean(startTime || endTime);
  const isAllDay = !hasTime;
  const sd = startDate ?? endDate!;
  const ed = endDate ?? startDate!;
  const sTime = startTime || (isAllDay ? '00:00' : '09:00');
  const eTime = endTime || (isAllDay ? '23:59' : '18:00');
  const startAt = new Date(`${sd}T${sTime}:00+03:00`);
  const endAt = new Date(`${ed}T${eTime}:00+03:00`);
  return { startAt, endAt, isAllDay };
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

  const startDate = emptyToNull(data.startDate);
  const endDate = emptyToNull(data.endDate);
  const times = deriveDealTimes(
    startDate,
    endDate,
    emptyToNull(data.startTime),
    emptyToNull(data.endTime),
  );

  const [created] = await db
    .insert(deals)
    .values({
      contractNumber,
      contractDate: data.contractDate,
      contractPlace: emptyToNull(data.contractPlace) ?? 'г. Новороссийск',
      clientId: data.clientId,
      leadId: data.leadId ?? null,
      startDate,
      endDate,
      startAt: times.startAt,
      endAt: times.endAt,
      isAllDay: times.isAllDay,
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

  const startDate = emptyToNull(data.startDate);
  const endDate = emptyToNull(data.endDate);
  const times = deriveDealTimes(
    startDate,
    endDate,
    emptyToNull(data.startTime),
    emptyToNull(data.endTime),
  );

  await db
    .update(deals)
    .set({
      contractDate: data.contractDate,
      contractPlace: emptyToNull(data.contractPlace) ?? 'г. Новороссийск',
      clientId: data.clientId,
      leadId: data.leadId ?? null,
      startDate,
      endDate,
      startAt: times.startAt,
      endAt: times.endAt,
      isAllDay: times.isAllDay,
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
 * Drag-n-drop переноса дат/времени сделки в календаре.
 * Доступно только manager / admin.
 *
 * Принимает ISO 8601 timestamps (UTC offset). Если isAllDay=true — также
 * синхронизирует date-колонки start_date/end_date для обратной совместимости.
 */
export async function updateDealDates(
  id: string,
  input: unknown,
): Promise<Result<{ startAt: string; endAt: string | null; isAllDay: boolean }>> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: 'Нет доступа' };

  const parsed = updateDealDatesSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0].message };
  }
  const { startAt, endAt, isAllDay } = parsed.data;
  const startAtDate = new Date(startAt);
  const endAtDate = endAt ? new Date(endAt) : null;

  // Дата в TZ='Europe/Moscow' для совместимых полей start_date/end_date.
  const moscowDate = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Moscow',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  const startDateMSK = moscowDate(startAtDate);
  const endDateMSK = endAtDate ? moscowDate(endAtDate) : null;

  const existing = await db
    .select({
      id: deals.id,
      clientId: deals.clientId,
      startAt: deals.startAt,
      endAt: deals.endAt,
      isAllDay: deals.isAllDay,
    })
    .from(deals)
    .where(eq(deals.id, id))
    .limit(1);
  if (existing.length === 0) return { ok: false, error: 'Сделка не найдена' };

  await db
    .update(deals)
    .set({
      startAt: startAtDate,
      endAt: endAtDate,
      isAllDay,
      startDate: startDateMSK,
      endDate: endDateMSK,
      updatedAt: new Date(),
    })
    .where(eq(deals.id, id));

  await logActivity(actor.id, 'deal.dates_drag', id, {
    from: {
      startAt: existing[0].startAt,
      endAt: existing[0].endAt,
      isAllDay: existing[0].isAllDay,
    },
    to: { startAt, endAt: endAt ?? null, isAllDay },
  });

  revalidatePath('/manager/calendar');
  revalidatePath('/master/calendar');
  revalidatePath('/manager/deals');
  revalidatePath(`/manager/deals/${id}`);

  return { ok: true, data: { startAt, endAt: endAt ?? null, isAllDay } };
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
// DOCUMENTS — request/cancel deletion (Sprint 5 эпик B)
// =============================================================

/**
 * Запросить удаление документа. Реальное удаление выполнит admin
 * из /admin/deletions через approveDocumentDeletion. Manager не может
 * удалить документ напрямую — только запросить.
 */
export async function requestDocumentDeletion(
  id: string,
  reason: string,
): Promise<Result> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: 'Нет доступа' };

  const trimmedReason = reason.trim();
  if (trimmedReason.length < 5) {
    return { ok: false, error: 'Опиши причину удаления (минимум 5 символов)' };
  }
  if (trimmedReason.length > 1000) {
    return { ok: false, error: 'Причина слишком длинная (максимум 1000 символов)' };
  }

  const rows = await db
    .select({
      id: documents.id,
      number: documents.number,
      type: documents.type,
      dealId: documents.dealId,
      clientId: documents.clientId,
      deletionStatus: documents.deletionStatus,
    })
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1);
  if (rows.length === 0) return { ok: false, error: 'Документ не найден' };
  const doc = rows[0];

  if (doc.deletionStatus === 'pending') {
    return { ok: false, error: 'Запрос на удаление уже отправлен и ждёт решения админа' };
  }

  await db
    .update(documents)
    .set({
      deletionStatus: 'pending',
      deletionRequestedAt: new Date(),
      deletionRequestedById: actor.id,
      deletionReason: trimmedReason,
      // Очищаем след предыдущего отклонения, если он был
      deletionResolvedAt: null,
      deletionResolvedById: null,
      deletionAdminNote: null,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, id));

  await logActivity(actor.id, 'document.deletion_request', doc.dealId ?? doc.clientId ?? id, {
    documentId: id,
    number: doc.number,
    type: doc.type,
    reason: trimmedReason,
  });

  if (doc.dealId) revalidatePath(`/manager/deals/${doc.dealId}`);
  if (doc.clientId) revalidatePath(`/manager/clients/${doc.clientId}`);
  revalidatePath('/admin/deletions');
  revalidatePath('/admin');

  return { ok: true, data: undefined };
}

/**
 * Отменить свой запрос на удаление. Доступно тому кто запросил, либо admin.
 * Работает только пока запрос pending — после approve/reject уже поздно.
 */
export async function cancelDeletionRequest(id: string): Promise<Result> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: 'Нет доступа' };

  const rows = await db
    .select({
      id: documents.id,
      number: documents.number,
      dealId: documents.dealId,
      clientId: documents.clientId,
      deletionStatus: documents.deletionStatus,
      deletionRequestedById: documents.deletionRequestedById,
    })
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1);
  if (rows.length === 0) return { ok: false, error: 'Документ не найден' };
  const doc = rows[0];

  if (doc.deletionStatus !== 'pending') {
    return { ok: false, error: 'Нет активного запроса на удаление' };
  }

  const isOwn = doc.deletionRequestedById === actor.id;
  const isAdmin = actor.role === 'admin';
  if (!isOwn && !isAdmin) {
    return { ok: false, error: 'Отменить запрос может только автор или админ' };
  }

  await db
    .update(documents)
    .set({
      deletionStatus: 'none',
      deletionRequestedAt: null,
      deletionRequestedById: null,
      deletionReason: null,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, id));

  await logActivity(actor.id, 'document.deletion_cancel', doc.dealId ?? doc.clientId ?? id, {
    documentId: id,
    number: doc.number,
  });

  if (doc.dealId) revalidatePath(`/manager/deals/${doc.dealId}`);
  if (doc.clientId) revalidatePath(`/manager/clients/${doc.clientId}`);
  revalidatePath('/admin/deletions');
  revalidatePath('/admin');

  return { ok: true, data: undefined };
}
