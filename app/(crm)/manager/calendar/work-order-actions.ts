'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { eq, asc, and, desc, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { deals, dealWorkLogs, dealWorkLogServices, dealPriceItems } from '@/lib/db/schema/deals';
import { clients } from '@/lib/db/schema/clients';
import { clientObjects, clientObjectServices } from '@/lib/db/schema/objects';
import { services } from '@/lib/db/schema/services';
import { users } from '@/lib/db/schema/users';
import { serviceChecklists, dealChecklistItems } from '@/lib/db/schema/checklists';
import { activityLog } from '@/lib/db/schema/activity';
import {
  createWorkOrder,
  type WorkOrderServiceInput,
  type WorkOrderChecklistInput,
} from '@/lib/visits/create';
import { MSK_TZ } from '@/lib/datetime/msk';
import type { PriceItemUnit } from '@/lib/db/schema/deals';

type Result = { ok: true } | { ok: false; error: string };

async function getManager() {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.role !== 'manager' && session.user.role !== 'admin') return null;
  return session.user;
}

// ─── Данные для формы заказ-наряда ────────────────────────────
export type WorkOrderObjectService = {
  serviceId: string | null;
  label: string;
  method: string | null;
  unit: PriceItemUnit;
  quantity: string | null;
};
export type WorkOrderObject = {
  id: string;
  name: string;
  // Метка (object_type) + адрес — чтобы различать одноимённые объекты сетей
  // (напр. Гончаров «Хадыжи»: 31 магазин с одинаковым именем) в выпадашке наряда.
  objectType: string | null;
  address: string;
  areaM2: string | null;
  services: WorkOrderObjectService[];
};
export type WorkOrderDeal = { id: string; contractNumber: string };
export type WorkOrderClient = {
  id: string;
  shortName: string;
  deals: WorkOrderDeal[];
  objects: WorkOrderObject[];
};
export type WorkOrderFormData = {
  clients: WorkOrderClient[];
  masters: { id: string; fullName: string }[];
  catalog: { id: string; name: string; shortName: string | null; defaultMethod: string | null }[];
};

// Дефолты формы наряда по объекту: услуги/препараты/мастер из ПОСЛЕДНЕГО наряда
// этого объекта; если нарядов ещё не было — из услуг объекта (client_object_services).
export type WorkOrderDefaultService = {
  serviceId: string | null;
  customName: string | null;
  method: string | null;
  unit: PriceItemUnit;
  quantity: string | null;
};
/** Пункт стартового чеклиста для формы наряда (из прошлого наряда или из шаблонов услуг). */
export type WorkOrderChecklistDefault = {
  title: string;
  description: string | null;
  required: boolean;
  source: 'template' | 'manager';
  sourceTemplateId: string | null;
};
export type WorkOrderDefaults = {
  source: 'last_order' | 'object';
  services: WorkOrderDefaultService[];
  preparations: string | null;
  masterId: string | null;
  /** Стартовый чеклист: из прошлого наряда (source='manager') либо шаблоны услуг (source='template'). */
  checklist: WorkOrderChecklistDefault[];
};

/**
 * Снимок конкретного наряда для дублирования: всё, кроме даты (её ставят заново).
 * В отличие от getObjectWorkOrderDefaults (берёт ПОСЛЕДНИЙ наряд объекта) — это
 * данные ИМЕННО выбранного наряда. clientId/dealId/objectId — исходная цель, но в
 * форме их можно сменить (перенос копии на другой объект/договор/клиента).
 */
/** Услуга-снимок дубля + имя из каталога (для fallback, если услуга деактивирована). */
export type WorkOrderDuplicateService = WorkOrderDefaultService & {
  serviceName: string | null;
};
export type WorkOrderDuplicatePrefill = {
  clientId: string;
  dealId: string;
  objectId: string;
  masterId: string | null;
  preparations: string | null;
  services: WorkOrderDuplicateService[];
  checklist: WorkOrderChecklistDefault[];
};
export type WorkOrderDuplicateData =
  | { ok: true; formData: WorkOrderFormData; prefill: WorkOrderDuplicatePrefill }
  | { ok: false; error: string };

/**
 * Дерево клиент → { договоры, объекты } для формы заказ-наряда.
 * Объект и договор выбираются НЕЗАВИСИМО (объект = адрес клиента, договор =
 * основание). Показываем клиентов, у кого есть хотя бы один договор И один объект.
 * При создании наряда объект автоматически привязывается к договору (см.
 * createWorkOrder) — поэтому здесь не требуем заранее проставленный deal_id.
 *
 * clientId (опц.) — сузить дерево до одного клиента (карточка объекта / таб сделки).
 */
export async function getWorkOrderFormData(clientId?: string): Promise<WorkOrderFormData> {
  // Гард авторизации (дерево клиентов/договоров/объектов не должно утекать без прав).
  const actor = await getManager();
  if (!actor) return { clients: [], masters: [], catalog: [] };
  const [clientRows, dealRows, objectRows, objServiceRows, masterRows, catalogRows] =
    await Promise.all([
      clientId
        ? db
            .select({ id: clients.id, shortName: clients.shortName })
            .from(clients)
            .where(eq(clients.id, clientId))
        : db.select({ id: clients.id, shortName: clients.shortName }).from(clients),
      db
        .select({ id: deals.id, contractNumber: deals.contractNumber, clientId: deals.clientId })
        .from(deals)
        .orderBy(asc(deals.contractNumber)),
      db
        .select({
          id: clientObjects.id,
          name: clientObjects.name,
          objectType: clientObjects.objectType,
          address: clientObjects.address,
          areaM2: clientObjects.areaM2,
          clientId: clientObjects.clientId,
        })
        .from(clientObjects)
        .orderBy(asc(clientObjects.name)),
      db
        .select({
          objectId: clientObjectServices.objectId,
          serviceId: clientObjectServices.serviceId,
          customName: clientObjectServices.customName,
          serviceName: services.name,
          method: clientObjectServices.method,
          unit: clientObjectServices.unit,
          quantity: clientObjectServices.quantity,
          sortOrder: clientObjectServices.sortOrder,
        })
        .from(clientObjectServices)
        .leftJoin(services, eq(clientObjectServices.serviceId, services.id))
        .orderBy(asc(clientObjectServices.sortOrder)),
      db
        .select({ id: users.id, fullName: users.fullName })
        .from(users)
        .where(eq(users.role, 'master'))
        .orderBy(asc(users.fullName)),
      db
        .select({
          id: services.id,
          name: services.name,
          shortName: services.shortName,
          defaultMethod: services.defaultMethod,
        })
        .from(services)
        .where(eq(services.isActive, true))
        .orderBy(asc(services.sortOrder), asc(services.name)),
    ]);

  // services by objectId
  const svcByObject = new Map<string, WorkOrderObjectService[]>();
  for (const s of objServiceRows) {
    const arr = svcByObject.get(s.objectId) ?? [];
    arr.push({
      serviceId: s.serviceId,
      label: s.customName ?? s.serviceName ?? 'Услуга',
      method: s.method,
      unit: s.unit,
      quantity: s.quantity,
    });
    svcByObject.set(s.objectId, arr);
  }

  // objects by clientId (все объекты клиента)
  const objByClient = new Map<string, WorkOrderObject[]>();
  for (const o of objectRows) {
    const arr = objByClient.get(o.clientId) ?? [];
    arr.push({
      id: o.id,
      name: o.name,
      objectType: o.objectType,
      address: o.address,
      areaM2: o.areaM2,
      services: svcByObject.get(o.id) ?? [],
    });
    objByClient.set(o.clientId, arr);
  }

  // deals by clientId (все договоры клиента)
  const dealsByClient = new Map<string, WorkOrderDeal[]>();
  for (const d of dealRows) {
    const arr = dealsByClient.get(d.clientId) ?? [];
    arr.push({ id: d.id, contractNumber: d.contractNumber });
    dealsByClient.set(d.clientId, arr);
  }

  // Клиент попадает в форму, если есть И договор, И объект.
  const clientsTree: WorkOrderClient[] = clientRows
    .map((c) => ({
      id: c.id,
      shortName: c.shortName,
      deals: dealsByClient.get(c.id) ?? [],
      objects: objByClient.get(c.id) ?? [],
    }))
    .filter((c) => c.deals.length > 0 && c.objects.length > 0)
    .sort((a, b) => a.shortName.localeCompare(b.shortName, 'ru'));

  return { clients: clientsTree, masters: masterRows, catalog: catalogRows };
}

// ─── Создание заказ-наряда ────────────────────────────────────
const checklistInputSchema = z.array(
  z.object({
    title: z.string().trim().min(2, 'минимум 2 символа в пункте').max(200),
    description: z.string().trim().max(1000).nullable().optional(),
    required: z.boolean(),
    source: z.enum(['template', 'manager']),
    sourceTemplateId: z.string().uuid().nullable().optional(),
  }),
);

// Валидация услуг наряда (раньше количество шло сырьём → -5/'abc' падали уже на уровне PG).
const woServiceSchema = z.array(
  z.object({
    serviceId: z.string().uuid().nullable().optional(),
    customName: z.string().trim().max(255).nullable().optional(),
    method: z.string().trim().max(128).nullable().optional(),
    unit: z.enum(['m2', 'pcs', 'm3']).optional(),
    quantity: z
      .union([z.string(), z.number()])
      .nullable()
      .optional()
      .refine(
        (q) => q == null || q === '' || (Number.isFinite(Number(q)) && Number(q) >= 0),
        'количество — неотрицательное число',
      ),
  }),
);

export async function createWorkOrderAction(input: {
  dealId: string;
  objectId: string;
  masterId: string;
  plannedAtIso: string | null;
  preparations: string | null;
  services: WorkOrderServiceInput[];
  /**
   * Чеклист для мастера из формы: массив (м.б. пустой = осознанно без пунктов).
   * Форма ВСЕГДА шлёт массив. undefined бывает только при прямом вызове createWorkOrder
   * мимо формы → там срабатывает автокопия из шаблонов услуг (обратная совместимость).
   */
  checklist?: WorkOrderChecklistInput[];
}): Promise<Result> {
  const actor = await getManager();
  if (!actor) return { ok: false, error: 'Нет доступа' };

  const { dealId, objectId, masterId, plannedAtIso, preparations } = input;
  if (!dealId) return { ok: false, error: 'Не выбран договор' };
  if (!objectId) return { ok: false, error: 'Не выбран объект' };
  if (!masterId) return { ok: false, error: 'Не выбран мастер' };

  const svc = (input.services ?? []).filter((s) => s.serviceId || s.customName?.trim());
  if (svc.length === 0) return { ok: false, error: 'Добавь хотя бы одну услугу' };
  const svcParsed = woServiceSchema.safeParse(svc);
  if (!svcParsed.success) {
    return { ok: false, error: `Услуги: ${svcParsed.error.errors[0].message}` };
  }

  // Чеклист (если форма прислала массив — даже пустой): фильтруем пустые, валидируем.
  let checklist: WorkOrderChecklistInput[] | undefined;
  if (input.checklist !== undefined) {
    const cleaned = input.checklist.filter((c) => c?.title?.trim());
    const parsed = checklistInputSchema.safeParse(cleaned);
    if (!parsed.success) {
      return { ok: false, error: `Чеклист: ${parsed.error.errors[0].message}` };
    }
    checklist = parsed.data;
  }

  // Объект и договор должны принадлежать одному клиенту.
  const [obj] = await db
    .select({ clientId: clientObjects.clientId })
    .from(clientObjects)
    .where(eq(clientObjects.id, objectId))
    .limit(1);
  const [deal] = await db
    .select({ clientId: deals.clientId })
    .from(deals)
    .where(eq(deals.id, dealId))
    .limit(1);
  if (!obj || !deal) return { ok: false, error: 'Объект или договор не найден' };
  if (obj.clientId !== deal.clientId) {
    return { ok: false, error: 'Объект и договор принадлежат разным клиентам' };
  }

  // Защита от дубля: не плодим второй активный наряд на тот же объект и день
  // (двойной клик «Оформить» из панели напоминаний, два открытых таба и т.п.).
  if (plannedAtIso) {
    const day = plannedAtIso.slice(0, 10);
    const [dup] = await db
      .select({ id: dealWorkLogs.id })
      .from(dealWorkLogs)
      .where(
        and(
          eq(dealWorkLogs.objectId, objectId),
          inArray(dealWorkLogs.status, ['planned', 'in_progress']),
          sql`${dealWorkLogs.plannedAt}::date = ${day}::date`,
        ),
      )
      .limit(1);
    if (dup) {
      return { ok: false, error: 'На этот объект уже есть активный наряд на выбранную дату' };
    }
  }

  let workLogId: string;
  try {
    const created = await createWorkOrder({
      dealId,
      objectId,
      masterId,
      plannedAt: plannedAtIso ? new Date(plannedAtIso) : null,
      preparations,
      services: svc,
      checklist,
    });
    workLogId = created.workLogId;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Не удалось создать заказ-наряд' };
  }

  // Push мастеру: назначен новый заказ-наряд (раньше уведомлял только старый
  // assignMaster, а выезды теперь создаются нарядом → мастер не узнавал о выезде).
  // Best-effort, ленивый импорт — push не должен ронять создание наряда.
  try {
    const { sendPushToUser } = await import('@/lib/push/server');
    const [info] = await db
      .select({ contractNumber: deals.contractNumber, objectName: clientObjects.name })
      .from(deals)
      .leftJoin(clientObjects, eq(clientObjects.id, objectId))
      .where(eq(deals.id, dealId))
      .limit(1);
    const datePart = plannedAtIso
      ? ` · ${new Date(plannedAtIso).toLocaleDateString('ru-RU', {
          timeZone: MSK_TZ,
          day: '2-digit',
          month: '2-digit',
        })}`
      : '';
    await sendPushToUser(masterId, {
      title: 'Новый заказ-наряд',
      body: `${info?.objectName ?? info?.contractNumber ?? 'Выезд'}${datePart}`,
      url: `/master/visits/${workLogId}`,
      tag: `wo-assigned-${workLogId}`,
    });
  } catch (err) {
    console.warn('[createWorkOrderAction] push failed:', err);
  }

  revalidatePath('/manager/calendar');
  revalidatePath('/master/calendar');
  revalidatePath('/master');
  return { ok: true };
}

// ─── Удаление заказ-наряда (только запланированного) ──────────
/**
 * Удаляет заказ-наряд (work_log). Разрешено только для status='planned' —
 * in_progress/completed мастер уже трогал (есть фото/чеклист/история).
 * Snapshot услуг и пункты чеклиста снимутся каскадом (ON DELETE CASCADE).
 * После удаления напоминание серии на эту дату снова появится (всё обратимо).
 */
export async function deleteWorkOrder(workLogId: string): Promise<Result> {
  const actor = await getManager();
  if (!actor) return { ok: false, error: 'Нет доступа' };

  const [wl] = await db
    .select({
      id: dealWorkLogs.id,
      status: dealWorkLogs.status,
      dealId: dealWorkLogs.dealId,
      objectId: dealWorkLogs.objectId,
      masterId: dealWorkLogs.masterId,
    })
    .from(dealWorkLogs)
    .where(eq(dealWorkLogs.id, workLogId))
    .limit(1);
  if (!wl) return { ok: false, error: 'Выезд не найден' };
  if (wl.status !== 'planned') {
    return {
      ok: false,
      error:
        wl.status === 'in_progress'
          ? 'Выезд уже в работе — мастер начал, удаление недоступно'
          : 'Выезд уже завершён, удаление недоступно',
    };
  }

  await db.delete(dealWorkLogs).where(eq(dealWorkLogs.id, workLogId));

  // Аудит: удаление наряда было «молчаливым» — фиксируем кто/что удалил.
  try {
    const h = await headers();
    await db.insert(activityLog).values({
      userId: actor.id,
      action: 'work_order.delete',
      entityType: 'deal',
      entityId: wl.dealId,
      changesJson: { workLogId, objectId: wl.objectId, masterId: wl.masterId },
      ip: h.get('x-forwarded-for')?.split(',')[0].trim() ?? null,
      userAgent: h.get('user-agent') ?? null,
    });
  } catch (err) {
    console.warn('[deleteWorkOrder] activity log failed:', err);
  }

  // Push мастеру: выезд отменён (best-effort) — иначе у мастера в списке висит
  // запланированный выезд, которого уже нет.
  try {
    if (wl.masterId) {
      const { sendPushToUser } = await import('@/lib/push/server');
      await sendPushToUser(wl.masterId, {
        title: 'Выезд отменён',
        body: 'Заказ-наряд удалён менеджером',
        url: '/master',
        tag: `wo-deleted-${workLogId}`,
      });
    }
  } catch (err) {
    console.warn('[deleteWorkOrder] push failed:', err);
  }

  revalidatePath('/manager/calendar');
  revalidatePath('/master/calendar');
  revalidatePath('/master');
  if (wl.dealId) revalidatePath(`/manager/deals/${wl.dealId}`);
  if (wl.objectId) revalidatePath(`/manager/objects/${wl.objectId}`);
  return { ok: true };
}

// ─── Дефолты наряда по объекту (предзаполнение формы) ─────────
/**
 * Возвращает предзаполнение формы наряда для объекта:
 * - если по объекту уже был наряд — услуги (snapshot), препараты и мастера из
 *   ПОСЛЕДНЕГО наряда (Саня: «форма предзаполнена данными с прошлого наряда»);
 * - иначе — услуги объекта из client_object_services (как при ручном вводе).
 */
export async function getObjectWorkOrderDefaults(objectId: string): Promise<WorkOrderDefaults> {
  const actor = await getManager();
  if (!actor)
    return { source: 'object', services: [], preparations: null, masterId: null, checklist: [] };

  // 1) Последний наряд объекта.
  const [last] = await db
    .select({
      id: dealWorkLogs.id,
      preparations: dealWorkLogs.preparations,
      masterId: dealWorkLogs.masterId,
    })
    .from(dealWorkLogs)
    .where(eq(dealWorkLogs.objectId, objectId))
    .orderBy(desc(dealWorkLogs.createdAt))
    .limit(1);

  if (last) {
    const [svc, chk] = await Promise.all([
      db
        .select({
          serviceId: dealWorkLogServices.serviceId,
          customName: dealWorkLogServices.customName,
          method: dealWorkLogServices.method,
          unit: dealWorkLogServices.unit,
          quantity: dealWorkLogServices.quantity,
        })
        .from(dealWorkLogServices)
        .where(eq(dealWorkLogServices.workLogId, last.id))
        .orderBy(asc(dealWorkLogServices.sortOrder)),
      db
        .select({
          title: dealChecklistItems.title,
          description: dealChecklistItems.description,
          required: dealChecklistItems.required,
        })
        .from(dealChecklistItems)
        // Только пункты менеджера/шаблона — НЕ мастерские добавления конкретного выезда.
        .where(
          and(
            eq(dealChecklistItems.workLogId, last.id),
            inArray(dealChecklistItems.source, ['template', 'manager']),
          ),
        )
        .orderBy(asc(dealChecklistItems.position)),
    ]);
    return {
      source: 'last_order',
      services: svc.map((s) => ({
        serviceId: s.serviceId,
        customName: s.customName,
        method: s.method,
        unit: s.unit,
        quantity: s.quantity,
      })),
      preparations: last.preparations,
      masterId: last.masterId,
      // Чеклист прошлого наряда → Регина дальше владеет им (source='manager').
      checklist: chk.map((c) => ({
        title: c.title,
        description: c.description,
        required: c.required,
        source: 'manager' as const,
        sourceTemplateId: null,
      })),
    };
  }

  // 2) Fallback: услуги объекта + площадь для кол-ва по умолчанию.
  const [objRow, objSvc] = await Promise.all([
    db
      .select({ areaM2: clientObjects.areaM2 })
      .from(clientObjects)
      .where(eq(clientObjects.id, objectId))
      .limit(1),
    db
      .select({
        serviceId: clientObjectServices.serviceId,
        customName: clientObjectServices.customName,
        serviceName: services.name,
        method: clientObjectServices.method,
        unit: clientObjectServices.unit,
        quantity: clientObjectServices.quantity,
      })
      .from(clientObjectServices)
      .leftJoin(services, eq(clientObjectServices.serviceId, services.id))
      .where(eq(clientObjectServices.objectId, objectId))
      .orderBy(asc(clientObjectServices.sortOrder)),
  ]);
  const areaM2 = objRow[0]?.areaM2 ?? null;

  // 2b) Если у объекта НЕТ своих услуг (client_object_services разрежены на проде) —
  // тянем из позиций прайса по этому объекту. Иначе форма наряда открывалась пустой
  // («не подтянулись услуги», баг п.9). Дедупим — импортные дубли строк прайса
  // не должны размножать услуги в форме.
  let svcRows = objSvc;
  if (svcRows.length === 0) {
    const priceRows = await db
      .select({
        serviceId: dealPriceItems.serviceId,
        customName: dealPriceItems.customName,
        serviceName: services.name,
        method: dealPriceItems.method,
        unit: dealPriceItems.unit,
        quantity: dealPriceItems.areaM2,
      })
      .from(dealPriceItems)
      .leftJoin(services, eq(dealPriceItems.serviceId, services.id))
      .where(eq(dealPriceItems.objectId, objectId))
      .orderBy(asc(dealPriceItems.sortOrder));
    const seen = new Set<string>();
    svcRows = priceRows.filter((r) => {
      const key = `${r.serviceId ?? ''}|${(r.customName ?? '').trim().toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // Стартовый чеклист — шаблоны услуг объекта (нарядов ещё не было).
  const objServiceIds = Array.from(
    new Set(svcRows.map((s) => s.serviceId).filter((x): x is string => !!x)),
  );
  const templates = objServiceIds.length
    ? await db
        .select({
          id: serviceChecklists.id,
          title: serviceChecklists.title,
          description: serviceChecklists.description,
          required: serviceChecklists.required,
        })
        .from(serviceChecklists)
        .where(inArray(serviceChecklists.serviceId, objServiceIds))
        .orderBy(asc(serviceChecklists.position))
    : [];
  return {
    source: 'object',
    services: svcRows.map((s) => ({
      serviceId: s.serviceId,
      // произвольная услуга → имя в customName; из каталога → null (рендерится по serviceId)
      customName: s.serviceId ? null : s.customName ?? s.serviceName ?? null,
      method: s.method,
      unit: s.unit,
      quantity: s.quantity ?? areaM2,
    })),
    preparations: null,
    masterId: null,
    checklist: templates.map((t) => ({
      title: t.title,
      description: t.description,
      required: t.required,
      source: 'template' as const,
      sourceTemplateId: t.id,
    })),
  };
}

// ─── Чеклист: источники для кнопок формы ──────────────────────
/** Пункты шаблонов чеклистов по выбранным услугам (кнопка «Из шаблонов услуг»). */
export async function getServiceChecklistTemplates(
  serviceIds: string[],
): Promise<WorkOrderChecklistDefault[]> {
  const actor = await getManager();
  if (!actor) return [];
  const ids = Array.from(new Set(serviceIds.filter((x): x is string => !!x)));
  if (ids.length === 0) return [];
  const rows = await db
    .select({
      id: serviceChecklists.id,
      title: serviceChecklists.title,
      description: serviceChecklists.description,
      required: serviceChecklists.required,
    })
    .from(serviceChecklists)
    .where(inArray(serviceChecklists.serviceId, ids))
    .orderBy(asc(serviceChecklists.position));
  return rows.map((t) => ({
    title: t.title,
    description: t.description,
    required: t.required,
    source: 'template' as const,
    sourceTemplateId: t.id,
  }));
}

/** Пункты чеклиста последнего наряда объекта (кнопка «Из прошлого наряда»). */
export async function getLastOrderChecklist(
  objectId: string,
): Promise<WorkOrderChecklistDefault[]> {
  const actor = await getManager();
  if (!actor) return [];
  const [last] = await db
    .select({ id: dealWorkLogs.id })
    .from(dealWorkLogs)
    .where(eq(dealWorkLogs.objectId, objectId))
    .orderBy(desc(dealWorkLogs.createdAt))
    .limit(1);
  if (!last) return [];
  const rows = await db
    .select({
      title: dealChecklistItems.title,
      description: dealChecklistItems.description,
      required: dealChecklistItems.required,
    })
    .from(dealChecklistItems)
    // Только пункты менеджера/шаблона — НЕ мастерские добавления конкретного выезда.
    .where(
      and(
        eq(dealChecklistItems.workLogId, last.id),
        inArray(dealChecklistItems.source, ['template', 'manager']),
      ),
    )
    .orderBy(asc(dealChecklistItems.position));
  return rows.map((c) => ({
    title: c.title,
    description: c.description,
    required: c.required,
    source: 'manager' as const,
    sourceTemplateId: null,
  }));
}

// ─── Дублирование наряда ──────────────────────────────────────
/**
 * Данные для формы «Дублировать наряд»: снимок выбранного наряда (услуги, препараты,
 * мастер, чеклист менеджера/шаблона) + ПОЛНОЕ дерево клиентов, чтобы копию можно было
 * перенести на другой объект/договор/клиента. Дату форма ставит заново (защита от
 * дубля на тот же день). Чеклист-пункты мастера конкретного выезда НЕ копируются.
 */
export async function getWorkOrderDuplicateData(
  workLogId: string,
): Promise<WorkOrderDuplicateData> {
  const actor = await getManager();
  if (!actor) return { ok: false, error: 'Нет доступа' };

  const [wl] = await db
    .select({
      id: dealWorkLogs.id,
      dealId: dealWorkLogs.dealId,
      objectId: dealWorkLogs.objectId,
      masterId: dealWorkLogs.masterId,
      preparations: dealWorkLogs.preparations,
      clientId: deals.clientId,
    })
    .from(dealWorkLogs)
    .innerJoin(deals, eq(dealWorkLogs.dealId, deals.id))
    .where(eq(dealWorkLogs.id, workLogId))
    .limit(1);
  if (!wl) return { ok: false, error: 'Наряд не найден' };
  if (!wl.objectId) {
    return { ok: false, error: 'У наряда нет объекта — копировать нечего' };
  }

  const [formData, svc, chk] = await Promise.all([
    // Полное дерево (без clientId) — чтобы цель копии можно было сменить.
    getWorkOrderFormData(),
    db
      .select({
        serviceId: dealWorkLogServices.serviceId,
        customName: dealWorkLogServices.customName,
        serviceName: services.name,
        method: dealWorkLogServices.method,
        unit: dealWorkLogServices.unit,
        quantity: dealWorkLogServices.quantity,
      })
      .from(dealWorkLogServices)
      .leftJoin(services, eq(dealWorkLogServices.serviceId, services.id))
      .where(eq(dealWorkLogServices.workLogId, wl.id))
      .orderBy(asc(dealWorkLogServices.sortOrder)),
    db
      .select({
        title: dealChecklistItems.title,
        description: dealChecklistItems.description,
        required: dealChecklistItems.required,
      })
      .from(dealChecklistItems)
      // Только пункты менеджера/шаблона — НЕ мастерские добавления конкретного выезда.
      .where(
        and(
          eq(dealChecklistItems.workLogId, wl.id),
          inArray(dealChecklistItems.source, ['template', 'manager']),
        ),
      )
      .orderBy(asc(dealChecklistItems.position)),
  ]);

  return {
    ok: true,
    formData,
    prefill: {
      clientId: wl.clientId,
      dealId: wl.dealId,
      objectId: wl.objectId,
      masterId: wl.masterId,
      preparations: wl.preparations,
      services: svc.map((s) => ({
        serviceId: s.serviceId,
        customName: s.customName,
        serviceName: s.serviceName,
        method: s.method,
        unit: s.unit,
        quantity: s.quantity,
      })),
      // Скопированные пункты переходят во владение менеджеру (как в getLastOrderChecklist).
      checklist: chk.map((c) => ({
        title: c.title,
        description: c.description,
        required: c.required,
        source: 'manager' as const,
        sourceTemplateId: null,
      })),
    },
  };
}
