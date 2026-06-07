'use server';

import { revalidatePath } from 'next/cache';
import { eq, asc, and, desc } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { deals, dealWorkLogs, dealWorkLogServices } from '@/lib/db/schema/deals';
import { clients } from '@/lib/db/schema/clients';
import { clientObjects, clientObjectServices } from '@/lib/db/schema/objects';
import { services } from '@/lib/db/schema/services';
import { users } from '@/lib/db/schema/users';
import { createWorkOrder, type WorkOrderServiceInput } from '@/lib/visits/create';
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
export type WorkOrderDefaults = {
  source: 'last_order' | 'object';
  services: WorkOrderDefaultService[];
  preparations: string | null;
  masterId: string | null;
};

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
    arr.push({ id: o.id, name: o.name, areaM2: o.areaM2, services: svcByObject.get(o.id) ?? [] });
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
export async function createWorkOrderAction(input: {
  dealId: string;
  objectId: string;
  masterId: string;
  plannedAtIso: string | null;
  preparations: string | null;
  services: WorkOrderServiceInput[];
}): Promise<Result> {
  const actor = await getManager();
  if (!actor) return { ok: false, error: 'Нет доступа' };

  const { dealId, objectId, masterId, plannedAtIso, preparations } = input;
  if (!dealId) return { ok: false, error: 'Не выбран договор' };
  if (!objectId) return { ok: false, error: 'Не выбран объект' };
  if (!masterId) return { ok: false, error: 'Не выбран мастер' };

  const svc = (input.services ?? []).filter((s) => s.serviceId || s.customName?.trim());
  if (svc.length === 0) return { ok: false, error: 'Добавь хотя бы одну услугу' };

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

  try {
    await createWorkOrder({
      dealId,
      objectId,
      masterId,
      plannedAt: plannedAtIso ? new Date(plannedAtIso) : null,
      preparations,
      services: svc,
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Не удалось создать заказ-наряд' };
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
  if (!actor) return { source: 'object', services: [], preparations: null, masterId: null };

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
    const svc = await db
      .select({
        serviceId: dealWorkLogServices.serviceId,
        customName: dealWorkLogServices.customName,
        method: dealWorkLogServices.method,
        unit: dealWorkLogServices.unit,
        quantity: dealWorkLogServices.quantity,
      })
      .from(dealWorkLogServices)
      .where(eq(dealWorkLogServices.workLogId, last.id))
      .orderBy(asc(dealWorkLogServices.sortOrder));
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
  return {
    source: 'object',
    services: objSvc.map((s) => ({
      serviceId: s.serviceId,
      // произвольная услуга → имя в customName; из каталога → null (рендерится по serviceId)
      customName: s.serviceId ? null : s.customName ?? s.serviceName ?? null,
      method: s.method,
      unit: s.unit,
      quantity: s.quantity ?? areaM2,
    })),
    preparations: null,
    masterId: null,
  };
}
