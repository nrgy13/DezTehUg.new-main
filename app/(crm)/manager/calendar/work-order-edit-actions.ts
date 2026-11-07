'use server';

/**
 * Правка и закрытие заказ-наряда менеджером (запрос Регины 07.11.2026):
 *  - «Редактировать» — наряд в ЛЮБОМ статусе (запланирован / в работе / выполнен): дата и
 *    время, мастер и напарники, объекты и услуги (с ценами), препараты, «документальный»,
 *    чеклист. Отмеченные мастером пункты чеклиста (статус, заметка, фото) — неприкосновенны.
 *  - «Закрыть наряд» — запланированный или в работе Регина закрывает сама, без обязательных
 *    пунктов чеклиста (административное закрытие), комментарий по желанию.
 * Дату наряда двигает ТОЛЬКО менеджер (см. lib/visits/order-date.ts).
 * Каждое действие — в журнал (activity_log), бригаде — push.
 */

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { and, asc, eq, exists, inArray, ne, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  deals,
  dealWorkLogs,
  dealWorkLogServices,
  dealWorkLogMasters,
} from '@/lib/db/schema/deals';
import { clientObjects } from '@/lib/db/schema/objects';
import { services } from '@/lib/db/schema/services';
import { users } from '@/lib/db/schema/users';
import { dealChecklistItems } from '@/lib/db/schema/checklists';
import { activityLog } from '@/lib/db/schema/activity';
import { workOrderRescheduleRequests } from '@/lib/db/schema/finance';
import { normalizeLinePrice, type WorkOrderServiceInput } from '@/lib/visits/create';
import { woServiceSchema, MAX_WORK_ORDER_OBJECTS } from '@/lib/visits/work-order-schemas';
import {
  getCrewIds,
  getPartnersByWorkLogIds,
  isActiveMaster,
  resolvePartnerIds,
} from '@/lib/visits/crew';
import { MSK_TZ, utcToMskParts } from '@/lib/datetime/msk';
import {
  getWorkOrderFormData,
  type WorkOrderFormData,
  type WorkOrderDuplicatePrefill,
} from './work-order-actions';

type WorkLogStatus = 'planned' | 'in_progress' | 'completed';

async function getManager() {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.role !== 'manager' && session.user.role !== 'admin') return null;
  return session.user;
}

/** Пункт отмечен мастером (статус/заметка/фото) — его нельзя ни удалить, ни переписать. */
function isMarkedItem(i: { status: string; note: string | null; photos: unknown[] | null }): boolean {
  return i.status !== 'pending' || !!i.note?.trim() || (i.photos?.length ?? 0) > 0;
}

/** Количество для сравнения «было/стало»: '83.70' из БД и '83.7' из формы — одно и то же. */
function normQty(q: string | number | null | undefined): string | null {
  if (q === null || q === undefined || String(q).trim() === '') return null;
  const n = Number(String(q).replace(',', '.'));
  return Number.isFinite(n) ? String(n) : String(q);
}

function fmtMsk(d: Date | null): string {
  if (!d) return 'без даты';
  return d.toLocaleString('ru-RU', {
    timeZone: MSK_TZ,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function writeJournal(
  actorId: string,
  action: string,
  dealId: string,
  changes: Record<string, unknown>,
): Promise<void> {
  try {
    const h = await headers();
    await db.insert(activityLog).values({
      userId: actorId,
      action,
      entityType: 'deal',
      entityId: dealId,
      changesJson: changes,
      ip: h.get('x-forwarded-for')?.split(',')[0].trim() ?? null,
      userAgent: h.get('user-agent') ?? null,
    });
  } catch (err) {
    console.warn(`[${action}] activity log failed:`, err);
  }
}

function revalidateWorkOrder(workLogId: string, dealId: string | null, objectIds: string[]) {
  revalidatePath('/manager');
  revalidatePath('/manager/calendar');
  revalidatePath('/manager/summary');
  revalidatePath(`/manager/visits/${workLogId}`);
  revalidatePath('/master/calendar');
  revalidatePath('/master');
  revalidatePath(`/master/visits/${workLogId}`);
  if (dealId) revalidatePath(`/manager/deals/${dealId}`);
  for (const id of objectIds) revalidatePath(`/manager/objects/${id}`);
}

// ─── Данные для формы «Редактировать наряд» ───────────────────

/** Пункт чеклиста наряда в форме правки: с id из БД и отметками мастера. */
export type WorkOrderEditChecklistItem = {
  id: string;
  title: string;
  description: string | null;
  required: boolean;
  source: 'template' | 'manager' | 'master';
  sourceTemplateId: string | null;
  status: 'pending' | 'done' | 'na';
  photosCount: number;
  /** Отмечен мастером (статус/заметка/фото) — только просмотр, удалить нельзя. */
  marked: boolean;
};

export type WorkOrderEditPrefill = Omit<WorkOrderDuplicatePrefill, 'checklist'> & {
  workLogId: string;
  status: WorkLogStatus;
  /** Дата и время наряда для datetime-local по МСК ("YYYY-MM-DDTHH:mm"), '' — без даты. */
  plannedAtLocal: string;
  checklist: WorkOrderEditChecklistItem[];
};

export type WorkOrderEditData =
  | { ok: true; formData: WorkOrderFormData; prefill: WorkOrderEditPrefill }
  | { ok: false; error: string };

export async function getWorkOrderEditData(workLogId: string): Promise<WorkOrderEditData> {
  const actor = await getManager();
  if (!actor) return { ok: false, error: 'Нет доступа' };
  if (!z.string().uuid().safeParse(workLogId).success) {
    return { ok: false, error: 'Наряд не найден' };
  }

  const [wl] = await db
    .select({
      id: dealWorkLogs.id,
      dealId: dealWorkLogs.dealId,
      objectId: dealWorkLogs.objectId,
      masterId: dealWorkLogs.masterId,
      masterName: users.fullName,
      status: dealWorkLogs.status,
      plannedAt: dealWorkLogs.plannedAt,
      preparations: dealWorkLogs.preparations,
      noMasterPay: dealWorkLogs.noMasterPay,
      clientId: deals.clientId,
    })
    .from(dealWorkLogs)
    .innerJoin(deals, eq(dealWorkLogs.dealId, deals.id))
    .leftJoin(users, eq(users.id, dealWorkLogs.masterId))
    .where(eq(dealWorkLogs.id, workLogId))
    .limit(1);
  if (!wl) return { ok: false, error: 'Наряд не найден' };
  if (!wl.objectId) {
    return { ok: false, error: 'У наряда нет объекта — его можно только закрыть' };
  }

  const [formData, svc, chk, partners] = await Promise.all([
    // Клиент наряда фиксирован (договор и клиент в правке не меняются) — дерево только по нему.
    getWorkOrderFormData(wl.clientId),
    db
      .select({
        serviceId: dealWorkLogServices.serviceId,
        customName: dealWorkLogServices.customName,
        serviceName: services.name,
        method: dealWorkLogServices.method,
        unit: dealWorkLogServices.unit,
        quantity: dealWorkLogServices.quantity,
        objectId: dealWorkLogServices.objectId,
        price: dealWorkLogServices.price,
        priceSource: dealWorkLogServices.priceSource,
      })
      .from(dealWorkLogServices)
      .leftJoin(services, eq(dealWorkLogServices.serviceId, services.id))
      .where(eq(dealWorkLogServices.workLogId, wl.id))
      .orderBy(asc(dealWorkLogServices.sortOrder)),
    db
      .select({
        id: dealChecklistItems.id,
        title: dealChecklistItems.title,
        description: dealChecklistItems.description,
        required: dealChecklistItems.required,
        source: dealChecklistItems.source,
        sourceTemplateId: dealChecklistItems.sourceTemplateId,
        status: dealChecklistItems.status,
        note: dealChecklistItems.note,
        photos: dealChecklistItems.photos,
      })
      .from(dealChecklistItems)
      .where(eq(dealChecklistItems.workLogId, wl.id))
      .orderBy(asc(dealChecklistItems.position)),
    getPartnersByWorkLogIds([wl.id]),
  ]);

  if (!formData.clients.some((c) => c.id === wl.clientId)) {
    return { ok: false, error: 'У клиента наряда нет договора или объектов — правка недоступна' };
  }

  // Мастер/напарники могли с тех пор уйти из активных — в правке их всё равно показываем,
  // иначе выбор молча опустел бы, а выполненный наряд «потерял» исполнителя.
  const partnerList = partners.get(wl.id) ?? [];
  const masters = [...formData.masters];
  const known = new Set(masters.map((m) => m.id));
  if (!known.has(wl.masterId)) {
    masters.push({ id: wl.masterId, fullName: `${wl.masterName ?? 'Мастер'} (неактивен)` });
    known.add(wl.masterId);
  }
  for (const p of partnerList) {
    if (!known.has(p.id)) {
      masters.push({ id: p.id, fullName: `${p.fullName ?? 'Мастер'} (неактивен)` });
      known.add(p.id);
    }
  }

  // Услуга наряда могла уйти из активного каталога — добавляем её в выпадашку, иначе форма
  // превратила бы строку в «свою услугу» и при сохранении молча отвязала её от каталога.
  const catalog = [...formData.catalog];
  const inCatalog = new Set(catalog.map((c) => c.id));
  const missing = Array.from(
    new Set(svc.map((s) => s.serviceId).filter((id): id is string => !!id && !inCatalog.has(id))),
  );
  if (missing.length > 0) {
    const extra = await db
      .select({
        id: services.id,
        name: services.name,
        shortName: services.shortName,
        defaultMethod: services.defaultMethod,
      })
      .from(services)
      .where(inArray(services.id, missing));
    for (const s of extra) catalog.push({ ...s, name: `${s.name} (неактивна)` });
  }

  const primaryObjectId = wl.objectId;
  const objectIds = Array.from(
    new Set([primaryObjectId, ...svc.map((s) => s.objectId ?? primaryObjectId)]),
  );
  const local = wl.plannedAt ? utcToMskParts(wl.plannedAt) : null;

  return {
    ok: true,
    formData: { ...formData, masters, catalog },
    prefill: {
      workLogId: wl.id,
      status: wl.status as WorkLogStatus,
      plannedAtLocal: local ? `${local.date}T${local.time}` : '',
      clientId: wl.clientId,
      dealId: wl.dealId,
      objectId: primaryObjectId,
      objectIds,
      masterId: wl.masterId,
      partnerIds: partnerList.map((p) => p.id),
      preparations: wl.preparations,
      noMasterPay: wl.noMasterPay,
      services: svc.map((s) => ({
        serviceId: s.serviceId,
        customName: s.customName,
        serviceName: s.serviceName,
        method: s.method,
        unit: s.unit,
        quantity: s.quantity,
        price: s.price,
        priceSource: s.priceSource,
        objectId: s.objectId ?? primaryObjectId,
      })),
      checklist: chk.map((c) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        required: c.required,
        source: c.source,
        sourceTemplateId: c.sourceTemplateId,
        status: c.status,
        photosCount: c.photos?.length ?? 0,
        marked: isMarkedItem(c),
      })),
    },
  };
}

// ─── Сохранение правки ────────────────────────────────────────

const editChecklistSchema = z
  .array(
    z.object({
      /** id пункта из БД; нет — новый пункт. */
      id: z.string().uuid().nullable().optional(),
      title: z.string().trim().min(2, 'минимум 2 символа в пункте').max(200),
      description: z.string().trim().max(1000).nullable().optional(),
      required: z.boolean(),
      source: z.enum(['template', 'manager']).optional(),
      sourceTemplateId: z.string().uuid().nullable().optional(),
    }),
  )
  .max(100, 'слишком много пунктов');

type EditResult = { ok: true } | { ok: false; error: string; needsConfirm?: boolean };

/** Ошибка «по существу» внутри транзакции — откатываем и показываем текст пользователю. */
class EditError extends Error {}

export async function updateWorkOrderAction(input: {
  workLogId: string;
  /** Объекты наряда в порядке блоков формы: основной первым. */
  objectIds: string[];
  masterId: string;
  partnerIds?: string[];
  plannedAtIso: string | null;
  preparations: string | null;
  services: WorkOrderServiceInput[];
  checklist: {
    id?: string | null;
    title: string;
    description?: string | null;
    required: boolean;
    source?: 'template' | 'manager';
    sourceTemplateId?: string | null;
  }[];
  noMasterPay?: boolean;
  /**
   * id пунктов чеклиста, которые были в форме при открытии. Удаляем ТОЛЬКО из них: пункт,
   * добавленный мастером, пока форма была открыта, Регина не видела — он сохраняется.
   * Не передан — считаем «видела все» (прямой вызов).
   */
  knownChecklistIds?: string[];
  /** Подтверждён второй наряд на объект в тот же день (переспрос формы). */
  allowSameDay?: boolean;
}): Promise<EditResult> {
  const actor = await getManager();
  if (!actor) return { ok: false, error: 'Нет доступа' };
  if (!z.string().uuid().safeParse(input.workLogId).success) {
    return { ok: false, error: 'Наряд не найден' };
  }

  const [wl] = await db
    .select({
      id: dealWorkLogs.id,
      dealId: dealWorkLogs.dealId,
      clientId: deals.clientId,
      status: dealWorkLogs.status,
      masterId: dealWorkLogs.masterId,
      objectId: dealWorkLogs.objectId,
      plannedAt: dealWorkLogs.plannedAt,
      preparations: dealWorkLogs.preparations,
      noMasterPay: dealWorkLogs.noMasterPay,
    })
    .from(dealWorkLogs)
    .innerJoin(deals, eq(dealWorkLogs.dealId, deals.id))
    .where(eq(dealWorkLogs.id, input.workLogId))
    .limit(1);
  if (!wl) return { ok: false, error: 'Наряд не найден' };

  // ── Объекты
  const objectIds = Array.from(new Set((input.objectIds ?? []).filter((x): x is string => !!x)));
  if (objectIds.length === 0) return { ok: false, error: 'Не выбран объект' };
  if (objectIds.length > MAX_WORK_ORDER_OBJECTS) {
    return {
      ok: false,
      error: `Слишком много объектов в одном наряде (максимум ${MAX_WORK_ORDER_OBJECTS})`,
    };
  }
  if (!objectIds.every((id) => z.string().uuid().safeParse(id).success)) {
    return { ok: false, error: 'Объект не найден' };
  }
  const primaryObjectId = objectIds[0];

  // ── Мастер и напарники. Уже стоящих в наряде (даже если ушли из активных) оставляем;
  // нового основного/напарника берём только из активных мастеров.
  const masterId = input.masterId;
  if (!masterId) return { ok: false, error: 'Не выбран мастер' };
  if (masterId !== wl.masterId && !(await isActiveMaster(masterId))) {
    return { ok: false, error: 'Мастер не найден или не активен' };
  }
  const currentPartnerIds = (await getPartnersByWorkLogIds([wl.id])).get(wl.id)?.map((p) => p.id) ?? [];
  const wanted = Array.from(new Set(input.partnerIds ?? [])).filter((id) => id !== masterId);
  const kept = wanted.filter((id) => currentPartnerIds.includes(id) || id === wl.masterId);
  const fresh = await resolvePartnerIds(
    masterId,
    wanted.filter((id) => !kept.includes(id)),
  );
  if (!fresh.ok) return { ok: false, error: fresh.error };
  const partnerIds = [...kept, ...fresh.ids];

  // ── Дата: у наряда с датой её нельзя «стереть» (наряд без даты выпадает из календаря).
  let plannedAt: Date | null = null;
  if (input.plannedAtIso) {
    plannedAt = new Date(input.plannedAtIso);
    if (Number.isNaN(plannedAt.getTime())) return { ok: false, error: 'Некорректная дата или время' };
  } else if (wl.plannedAt) {
    return { ok: false, error: 'Укажи дату и время наряда' };
  }

  // ── Услуги
  const svc = (input.services ?? []).filter((s) => s.serviceId || s.customName?.trim());
  if (svc.length === 0) return { ok: false, error: 'Добавь хотя бы одну услугу' };
  const svcParsed = woServiceSchema.safeParse(svc);
  if (!svcParsed.success) {
    return { ok: false, error: `Услуги: ${svcParsed.error.errors[0].message}` };
  }
  if (svc.some((s) => s.objectId && !objectIds.includes(s.objectId))) {
    return { ok: false, error: 'Услуга привязана к объекту, которого нет в наряде' };
  }

  // ── Чеклист
  const chkParsed = editChecklistSchema.safeParse(
    (input.checklist ?? []).filter((c) => c?.title?.trim()),
  );
  if (!chkParsed.success) {
    return { ok: false, error: `Чеклист: ${chkParsed.error.errors[0].message}` };
  }
  const checklist = chkParsed.data;

  // ── Объекты существуют и принадлежат клиенту договора наряда
  const objRows = await db
    .select({ id: clientObjects.id, clientId: clientObjects.clientId, name: clientObjects.name })
    .from(clientObjects)
    .where(inArray(clientObjects.id, objectIds));
  if (objRows.length !== objectIds.length) return { ok: false, error: 'Объект не найден' };
  if (objRows.some((o) => o.clientId !== wl.clientId)) {
    return { ok: false, error: 'Объект принадлежит другому клиенту' };
  }
  const objName = new Map(objRows.map((o) => [o.id, o.name]));
  const servedObjects = new Set(svc.map((s) => s.objectId ?? primaryObjectId));
  const unserved = objectIds.find((id) => !servedObjects.has(id));
  if (unserved) {
    return {
      ok: false,
      error: `У объекта «${objName.get(unserved) ?? '?'}» нет ни одной услуги — добавь услугу или убери объект из наряда`,
    };
  }

  // ── Второй наряд на объект в тот же день (МСК) — переспрос, как при создании.
  // Проверяем только если сменился день или состав объектов (иначе правка препаратов
  // переспрашивала бы о соседнем наряде, который стоял там и раньше).
  const newDay = plannedAt ? utcToMskParts(plannedAt)?.date ?? null : null;
  const oldDay = wl.plannedAt ? utcToMskParts(wl.plannedAt)?.date ?? null : null;
  const oldObjectIds = (
    await db
      .select({ objectId: dealWorkLogServices.objectId })
      .from(dealWorkLogServices)
      .where(eq(dealWorkLogServices.workLogId, wl.id))
  )
    .map((r) => r.objectId ?? wl.objectId)
    .concat(wl.objectId ? [wl.objectId] : []);
  const objectsGrew = objectIds.some((id) => !oldObjectIds.includes(id));
  if (newDay && !input.allowSameDay && (newDay !== oldDay || objectsGrew)) {
    const [dup] = await db
      .select({ id: dealWorkLogs.id })
      .from(dealWorkLogs)
      .where(
        and(
          ne(dealWorkLogs.id, wl.id),
          inArray(dealWorkLogs.status, ['planned', 'in_progress']),
          sql`(${dealWorkLogs.plannedAt} AT TIME ZONE 'Europe/Moscow')::date = ${newDay}::date`,
          or(
            inArray(dealWorkLogs.objectId, objectIds),
            exists(
              db
                .select({ one: sql`1` })
                .from(dealWorkLogServices)
                .where(
                  and(
                    eq(dealWorkLogServices.workLogId, dealWorkLogs.id),
                    inArray(dealWorkLogServices.objectId, objectIds),
                  ),
                ),
            ),
          ),
        ),
      )
      .limit(1);
    if (dup) {
      return {
        ok: false,
        needsConfirm: true,
        error: 'На этот объект в выбранный день уже стоит другой активный наряд.',
      };
    }
  }

  const preparations = input.preparations?.trim() ? input.preparations.trim() : null;
  const noMasterPay = input.noMasterPay === true;

  let summary: {
    before: Record<string, unknown>;
    after: Record<string, unknown>;
    checklist: { added: number; removed: number; changed: number };
    crewBefore: string[];
    crewAfter: string[];
    oldObjectIds: string[];
  };
  try {
    summary = await db.transaction(async (tx) => {
      // Блокировка строки наряда: параллельная «Завершить»/«Начать» мастера дождётся нас.
      const [locked] = await tx
        .select({
          status: dealWorkLogs.status,
          masterId: dealWorkLogs.masterId,
          plannedAt: dealWorkLogs.plannedAt,
          objectId: dealWorkLogs.objectId,
        })
        .from(dealWorkLogs)
        .where(eq(dealWorkLogs.id, wl.id))
        .for('update');
      if (!locked) throw new EditError('Наряд не найден');

      const beforeSvc = (
        await tx
          .select({
            serviceId: dealWorkLogServices.serviceId,
            customName: dealWorkLogServices.customName,
            objectId: dealWorkLogServices.objectId,
            quantity: dealWorkLogServices.quantity,
            unit: dealWorkLogServices.unit,
            price: dealWorkLogServices.price,
          })
          .from(dealWorkLogServices)
          .where(eq(dealWorkLogServices.workLogId, wl.id))
          .orderBy(asc(dealWorkLogServices.sortOrder))
      ).map((s) => ({
        ...s,
        // Legacy-строки без объекта относятся к основному объекту наряда.
        objectId: s.objectId ?? locked.objectId,
        quantity: normQty(s.quantity),
        price: normalizeLinePrice(s.price),
      }));
      const crewBefore = [locked.masterId, ...currentPartnerIds];

      // 1) Сам наряд.
      await tx
        .update(dealWorkLogs)
        .set({ masterId, objectId: primaryObjectId, plannedAt, preparations, noMasterPay })
        .where(eq(dealWorkLogs.id, wl.id));

      // 2) Напарники: снимаем лишних, добавляем новых.
      await tx.delete(dealWorkLogMasters).where(eq(dealWorkLogMasters.workLogId, wl.id));
      if (partnerIds.length > 0) {
        await tx
          .insert(dealWorkLogMasters)
          .values(partnerIds.map((userId) => ({ workLogId: wl.id, userId })))
          .onConflictDoNothing();
      }

      // 3) Объекты без договора — привязываем к договору наряда (нужно актам), как при создании.
      await tx
        .update(clientObjects)
        .set({ dealId: wl.dealId })
        .where(and(inArray(clientObjects.id, objectIds), sql`${clientObjects.dealId} IS NULL`));

      // 4) Услуги наряда: снимок пересобираем целиком (на строки ссылок нет — только на наряд).
      await tx.delete(dealWorkLogServices).where(eq(dealWorkLogServices.workLogId, wl.id));
      const objectIdSet = new Set(objectIds);
      await tx.insert(dealWorkLogServices).values(
        svc.map((s, i) => ({
          workLogId: wl.id,
          serviceId: s.serviceId ?? null,
          objectId: s.objectId && objectIdSet.has(s.objectId) ? s.objectId : primaryObjectId,
          customName: s.customName?.trim() ? s.customName.trim() : null,
          method: s.method?.trim() ? s.method.trim() : null,
          unit: s.unit ?? 'm2',
          quantity:
            s.quantity !== null && s.quantity !== undefined && String(s.quantity).trim() !== ''
              ? String(s.quantity)
              : null,
          price: normalizeLinePrice(s.price),
          priceSource: normalizeLinePrice(s.price) === null ? null : (s.priceSource ?? 'manual'),
          sortOrder: i,
        })),
      );

      // 5) Чеклист: пункты, отмеченные мастером, неприкосновенны (только порядок).
      // FOR UPDATE: пока решаем, что удалить, мастер не успеет отметить/сфотографировать пункт
      // (его UPDATE дождётся нас, а уже отмеченный мы увидим свежим и не тронем).
      const existing = await tx
        .select({
          id: dealChecklistItems.id,
          title: dealChecklistItems.title,
          description: dealChecklistItems.description,
          required: dealChecklistItems.required,
          position: dealChecklistItems.position,
          status: dealChecklistItems.status,
          note: dealChecklistItems.note,
          photos: dealChecklistItems.photos,
        })
        .from(dealChecklistItems)
        .where(eq(dealChecklistItems.workLogId, wl.id))
        .for('update');
      const byId = new Map(existing.map((e) => [e.id, e]));
      const incomingIds = new Set(checklist.map((c) => c.id).filter((x): x is string => !!x));
      for (const id of Array.from(incomingIds)) {
        if (!byId.has(id)) throw new EditError('Пункт чеклиста не найден — обнови страницу');
      }
      // Удаляем только то, что Регина видела в форме и убрала. Пункты, появившиеся после
      // открытия формы (мастер добавил на выезде), сохраняются и встают в конец списка.
      const known = input.knownChecklistIds ? new Set(input.knownChecklistIds) : null;
      const removed = existing.filter((e) => !incomingIds.has(e.id) && (!known || known.has(e.id)));
      const unseen = existing
        .filter((e) => !incomingIds.has(e.id) && known && !known.has(e.id))
        .sort((a, b) => a.position - b.position);
      const markedRemoved = removed.find((e) => isMarkedItem(e));
      if (markedRemoved) {
        throw new EditError(
          `Пункт «${markedRemoved.title}» уже отмечен мастером — удалить его нельзя`,
        );
      }
      if (removed.length > 0) {
        await tx.delete(dealChecklistItems).where(
          inArray(
            dealChecklistItems.id,
            removed.map((r) => r.id),
          ),
        );
      }
      let added = 0;
      let changed = 0;
      for (let idx = 0; idx < checklist.length; idx++) {
        const c = checklist[idx];
        const cur = c.id ? byId.get(c.id) : undefined;
        if (cur) {
          if (isMarkedItem(cur)) {
            await tx
              .update(dealChecklistItems)
              .set({ position: idx })
              .where(eq(dealChecklistItems.id, cur.id));
          } else {
            await tx
              .update(dealChecklistItems)
              .set({
                position: idx,
                title: c.title,
                description: c.description?.trim() ? c.description.trim() : null,
                required: c.required,
                updatedAt: new Date(),
              })
              .where(eq(dealChecklistItems.id, cur.id));
            const desc = c.description?.trim() ? c.description.trim() : null;
            if (cur.title !== c.title || (cur.description ?? null) !== desc || cur.required !== c.required) {
              changed++;
            }
          }
        } else {
          await tx.insert(dealChecklistItems).values({
            workLogId: wl.id,
            source: c.source ?? 'manager',
            sourceTemplateId: c.sourceTemplateId ?? null,
            position: idx,
            title: c.title,
            description: c.description?.trim() ? c.description.trim() : null,
            required: c.required,
          });
          added++;
        }
      }
      for (let k = 0; k < unseen.length; k++) {
        await tx
          .update(dealChecklistItems)
          .set({ position: checklist.length + k })
          .where(eq(dealChecklistItems.id, unseen[k].id));
      }

      // 6) Дату наряда сменила Регина — висящий запрос мастера на перенос больше не актуален.
      const dateChanged = (locked.plannedAt?.getTime() ?? null) !== (plannedAt?.getTime() ?? null);
      if (dateChanged) {
        await tx
          .update(workOrderRescheduleRequests)
          .set({ status: 'cancelled', decidedAt: new Date(), decidedById: actor.id })
          .where(
            and(
              eq(workOrderRescheduleRequests.workLogId, wl.id),
              eq(workOrderRescheduleRequests.status, 'pending'),
            ),
          );
      }

      return {
        before: {
          status: locked.status,
          plannedAt: locked.plannedAt?.toISOString() ?? null,
          masterId: locked.masterId,
          partnerIds: currentPartnerIds,
          objectId: locked.objectId,
          preparations: wl.preparations,
          noMasterPay: wl.noMasterPay,
          services: beforeSvc,
        },
        after: {
          plannedAt: plannedAt?.toISOString() ?? null,
          masterId,
          partnerIds,
          objectId: primaryObjectId,
          preparations,
          noMasterPay,
          services: svc.map((s) => ({
            serviceId: s.serviceId ?? null,
            customName: s.customName?.trim() || null,
            objectId: s.objectId && objectIdSet.has(s.objectId) ? s.objectId : primaryObjectId,
            quantity: normQty(s.quantity),
            unit: s.unit ?? 'm2',
            price: normalizeLinePrice(s.price),
          })),
        },
        checklist: { added, removed: removed.length, changed },
        crewBefore,
        crewAfter: [masterId, ...partnerIds],
        oldObjectIds: Array.from(new Set(oldObjectIds.filter((x): x is string => !!x))),
      };
    });
  } catch (err) {
    if (err instanceof EditError) return { ok: false, error: err.message };
    console.error('[updateWorkOrderAction] failed:', err);
    return { ok: false, error: 'Не удалось сохранить наряд' };
  }

  // Журнал: было → стало (только то, что реально поменялось).
  const changes: Record<string, unknown> = { workLogId: wl.id, status: summary.before.status };
  for (const k of ['plannedAt', 'masterId', 'objectId', 'preparations', 'noMasterPay'] as const) {
    if (JSON.stringify(summary.before[k]) !== JSON.stringify(summary.after[k])) {
      changes[k] = { from: summary.before[k], to: summary.after[k] };
    }
  }
  const sortIds = (a: unknown) => [...((a as string[]) ?? [])].sort();
  if (JSON.stringify(sortIds(summary.before.partnerIds)) !== JSON.stringify(sortIds(summary.after.partnerIds))) {
    changes.partnerIds = { from: summary.before.partnerIds, to: summary.after.partnerIds };
  }
  if (JSON.stringify(summary.before.services) !== JSON.stringify(summary.after.services)) {
    changes.services = { from: summary.before.services, to: summary.after.services };
  }
  const chk = summary.checklist;
  if (chk.added || chk.removed || chk.changed) changes.checklist = chk;
  const changedKeys = Object.keys(changes).filter((k) => k !== 'workLogId' && k !== 'status');
  if (changedKeys.length === 0) {
    return { ok: true };
  }
  await writeJournal(actor.id, 'work_order.edit', wl.dealId, changes);

  // Push бригаде (best-effort): кого сняли, кого добавили, остальным — что наряд изменён.
  try {
    const { sendPushToUsers } = await import('@/lib/push/server');
    const what = `${objName.get(primaryObjectId) ?? 'Выезд'} · ${fmtMsk(plannedAt)}`;
    const before = new Set(summary.crewBefore);
    const after = new Set(summary.crewAfter);
    const removedCrew = Array.from(before).filter((id) => !after.has(id));
    const addedCrew = Array.from(after).filter((id) => !before.has(id));
    const stayed = Array.from(after).filter((id) => before.has(id));
    if (removedCrew.length > 0) {
      await sendPushToUsers(removedCrew, {
        title: 'Тебя сняли с наряда',
        body: what,
        url: '/master',
        tag: `wo-edit-${wl.id}`,
      });
    }
    if (addedCrew.length > 0) {
      await sendPushToUsers(addedCrew, {
        title: 'Новый заказ-наряд',
        body: what,
        url: `/master/visits/${wl.id}`,
        tag: `wo-edit-${wl.id}`,
      });
    }
    if (stayed.length > 0) {
      await sendPushToUsers(stayed, {
        title: changes.plannedAt ? 'Наряд перенесён' : 'Наряд изменён менеджером',
        body: what,
        url: `/master/visits/${wl.id}`,
        tag: `wo-edit-${wl.id}`,
      });
    }
  } catch (err) {
    console.warn('[updateWorkOrderAction] push failed:', err);
  }

  revalidateWorkOrder(wl.id, wl.dealId, Array.from(new Set([...summary.oldObjectIds, ...objectIds])));
  return { ok: true };
}

// ─── Закрыть наряд (менеджер) ─────────────────────────────────

/**
 * Регина закрывает наряд сама — запланированный или в работе. Обязательные пункты чеклиста
 * НЕ требуются (административное закрытие: работа сделана, мастер не дожал «Завершить»,
 * или наряд закрывается документально). Дата наряда не меняется; performed_at — плановая,
 * если мастер факт не зафиксировал. Висящие запросы мастера на перенос снимаются.
 */
export async function closeWorkOrderByManager(input: {
  workLogId: string;
  comment?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await getManager();
  if (!actor) return { ok: false, error: 'Нет доступа' };
  if (!z.string().uuid().safeParse(input.workLogId).success) {
    return { ok: false, error: 'Наряд не найден' };
  }
  const comment = (input.comment ?? '').trim().slice(0, 1000) || null;

  let closed: {
    fromStatus: WorkLogStatus;
    dealId: string;
    masterId: string;
    objectId: string | null;
    plannedAt: Date | null;
  } | null;
  try {
    closed = await db.transaction(async (tx) => {
      const [wl] = await tx
        .select({
          status: dealWorkLogs.status,
          dealId: dealWorkLogs.dealId,
          masterId: dealWorkLogs.masterId,
          objectId: dealWorkLogs.objectId,
          plannedAt: dealWorkLogs.plannedAt,
        })
        .from(dealWorkLogs)
        .where(eq(dealWorkLogs.id, input.workLogId))
        .for('update');
      if (!wl) throw new EditError('Наряд не найден');
      if (wl.status === 'completed') throw new EditError('Наряд уже выполнен');
      await tx
        .update(dealWorkLogs)
        .set({
          status: 'completed',
          finalizedAt: new Date(),
          performedAt: sql`COALESCE(${dealWorkLogs.performedAt}, ${dealWorkLogs.plannedAt}, NOW())`,
        })
        .where(eq(dealWorkLogs.id, input.workLogId));
      await tx
        .update(workOrderRescheduleRequests)
        .set({ status: 'cancelled', decidedAt: new Date(), decidedById: actor.id })
        .where(
          and(
            eq(workOrderRescheduleRequests.workLogId, input.workLogId),
            eq(workOrderRescheduleRequests.status, 'pending'),
          ),
        );
      return { ...wl, fromStatus: wl.status as WorkLogStatus };
    });
  } catch (err) {
    if (err instanceof EditError) return { ok: false, error: err.message };
    console.error('[closeWorkOrderByManager] failed:', err);
    return { ok: false, error: 'Не удалось закрыть наряд' };
  }
  if (!closed) return { ok: false, error: 'Наряд не найден' };

  await writeJournal(actor.id, 'work_order.close_by_manager', closed.dealId, {
    workLogId: input.workLogId,
    fromStatus: closed.fromStatus,
    comment,
  });

  // Push бригаде: наряд ушёл из активных (и цифра на иконке уменьшится).
  try {
    const crew = await getCrewIds(input.workLogId, closed.masterId);
    if (crew.length > 0) {
      const [obj] = closed.objectId
        ? await db
            .select({ name: clientObjects.name })
            .from(clientObjects)
            .where(eq(clientObjects.id, closed.objectId))
            .limit(1)
        : [];
      const { sendPushToUsers } = await import('@/lib/push/server');
      await sendPushToUsers(crew, {
        title: 'Наряд закрыт менеджером',
        body: `${obj?.name ?? 'Выезд'} · ${fmtMsk(closed.plannedAt)}${comment ? ` — ${comment.slice(0, 80)}` : ''}`,
        url: `/master/visits/${input.workLogId}`,
        tag: `wo-closed-${input.workLogId}`,
      });
    }
  } catch (err) {
    console.warn('[closeWorkOrderByManager] push failed:', err);
  }

  revalidateWorkOrder(input.workLogId, closed.dealId, closed.objectId ? [closed.objectId] : []);
  return { ok: true };
}
