import { eq, asc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { clients, type Client } from '@/lib/db/schema/clients';
import { clientObjects, clientObjectServices } from '@/lib/db/schema/objects';
import { deals, dealPriceItems, dealAddendums, dealWorkLogs, type Deal } from '@/lib/db/schema/deals';
import { services } from '@/lib/db/schema/services';
import { users } from '@/lib/db/schema/users';
import { CONTRACT_PROVIDER } from '@/lib/contract-provider';
import { unitLabel, formatQuantity } from '@/lib/constants/units';
import type { DocumentType } from '@/lib/db/schema/documents';

/**
 * Контекст для построения данных шаблона. Все поля опциональные —
 * нужный набор зависит от типа документа.
 */
export type BuildContext = {
  type: DocumentType;
  dealId?: string;
  addendumId?: string;
  clientId?: string; // если документ не привязан к сделке (например, общий КП)
  documentNumber: string; // официальный номер от nextDocumentNumber
  documentDate: string; // YYYY-MM-DD
  /** Произвольные оверрайды от UI: contract.endDate, report.objectStatus и т.д. */
  overrides?: Record<string, unknown>;
  /** Sprint 8: если задано — генерим только эти позиции прайса. Иначе все. */
  priceItemIds?: string[];
  /** Sprint 9: если задано — акт по конкретному объекту (АО/АВР). Сужает прайс и
   *  список объектов до этого объекта. */
  objectId?: string;
};

/**
 * Собирает data-объект для docxtemplater, специфичный для типа документа.
 * Все ссылки (deal → client → objects → priceItems) подгружаются из БД здесь.
 */
export async function buildDocumentData(ctx: BuildContext): Promise<{
  data: Record<string, unknown>;
  client: Client | null;
  deal: Deal | null;
}> {
  let deal: Deal | null = null;
  let client: Client | null = null;

  if (ctx.dealId) {
    const dealRows = await db.select().from(deals).where(eq(deals.id, ctx.dealId)).limit(1);
    if (dealRows.length === 0) throw new Error(`Сделка ${ctx.dealId} не найдена`);
    deal = dealRows[0];
    const cRows = await db.select().from(clients).where(eq(clients.id, deal.clientId)).limit(1);
    client = cRows[0] ?? null;
  } else if (ctx.clientId) {
    const cRows = await db.select().from(clients).where(eq(clients.id, ctx.clientId)).limit(1);
    client = cRows[0] ?? null;
  }

  // Объекты клиента
  const objects = client
    ? await db
        .select()
        .from(clientObjects)
        .where(eq(clientObjects.clientId, client.id))
        .orderBy(asc(clientObjects.name))
    : [];

  // Прайс-позиции сделки.
  // Sprint 8: фильтрация по priceItemIds — если задано, грузим только эти позиции.
  const priceItemsAll = deal
    ? await db
        .select({
          id: dealPriceItems.id,
          objectId: dealPriceItems.objectId,
          serviceId: dealPriceItems.serviceId,
          customName: dealPriceItems.customName,
          areaM2: dealPriceItems.areaM2,
          unit: dealPriceItems.unit,
          method: dealPriceItems.method,
          frequency: dealPriceItems.frequency,
          priceNoVat: dealPriceItems.priceNoVat,
          priceWithVat: dealPriceItems.priceWithVat,
          vatRate: dealPriceItems.vatRate,
          sortOrder: dealPriceItems.sortOrder,
        })
        .from(dealPriceItems)
        .where(eq(dealPriceItems.dealId, deal.id))
        .orderBy(asc(dealPriceItems.sortOrder), asc(dealPriceItems.id))
    : [];

  // Sprint 9: акт по объекту — сначала сужаем прайс до позиций этого объекта.
  const priceItemsByObject = ctx.objectId
    ? priceItemsAll.filter((p) => p.objectId === ctx.objectId)
    : priceItemsAll;

  const priceItemsRaw =
    ctx.priceItemIds && ctx.priceItemIds.length > 0
      ? priceItemsByObject.filter((p) => ctx.priceItemIds!.includes(p.id))
      : priceItemsByObject;

  // Имена услуг (для priceItems из каталога)
  const serviceIds = priceItemsRaw.map((p) => p.serviceId).filter((x): x is string => !!x);
  const svcMap = new Map<string, string>();
  if (serviceIds.length > 0) {
    const svcs = await db.select().from(services);
    for (const s of svcs) svcMap.set(s.id, s.shortName ?? s.name);
  }

  const objMap = new Map(objects.map((o) => [o.id, o]));

  // Sprint 9: для акта по объекту список объектов в шаблоне сужаем до него одного.
  const templateObjects = ctx.objectId ? objects.filter((o) => o.id === ctx.objectId) : objects;

  const priceItems = priceItemsRaw.map((p, idx) => {
    const obj = p.objectId ? objMap.get(p.objectId) : null;
    return {
      index: idx + 1,
      serviceName: p.customName || (p.serviceId ? svcMap.get(p.serviceId) ?? '' : ''),
      objectName: obj?.name ?? '',
      objectAddress: obj?.address ?? '',
      area: formatQuantity(p.areaM2),
      areaUnit: p.unit,
      areaUnitLabel: unitLabel(p.unit),
      method: p.method ?? '',
      frequency: p.frequency ?? '',
      priceNet: formatMoney(p.priceNoVat),
      priceGross: formatMoney(p.priceWithVat),
      // Сумма НДС на строку (для прайс-таблиц ДС с колонкой «НДС 5%»).
      vatLine: formatMoney(Number(p.priceWithVat) - Number(p.priceNoVat)),
      vatRate: Number(p.vatRate),
      quantity: 1,
      unit: 'усл.',
      amount: formatMoney(p.priceWithVat),
    };
  });

  // Прайс, сгруппированный по объекту — для ДС (несколько прайс-таблиц,
  // у каждой свой объект+адрес заголовком). Внешний цикл {#priceItemsByObject},
  // внутри — {#items}. Порядок объектов сохраняется (Map по first-seen).
  const pioMap = new Map<
    string,
    { objectName: string; objectAddress: string; items: typeof priceItems }
  >();
  for (const pi of priceItems) {
    const key = `${pi.objectName}|||${pi.objectAddress}`;
    let g = pioMap.get(key);
    if (!g) {
      g = { objectName: pi.objectName, objectAddress: pi.objectAddress, items: [] };
      pioMap.set(key, g);
    }
    g.items.push(pi);
  }
  const priceGroupsByObject = Array.from(pioMap.values());

  const totalNet = priceItemsRaw.reduce((sum, p) => sum + Number(p.priceNoVat), 0);
  const totalGross = priceItemsRaw.reduce((sum, p) => sum + Number(p.priceWithVat), 0);

  // ДС (если генерируем addendum или акт работ)
  let addendum: { id: string; number: number; date: string | null } | null = null;
  if (ctx.addendumId) {
    const aRows = await db
      .select({ id: dealAddendums.id, number: dealAddendums.number, date: dealAddendums.date })
      .from(dealAddendums)
      .where(eq(dealAddendums.id, ctx.addendumId))
      .limit(1);
    addendum = aRows[0] ?? null;
  }

  // Журнал работ (для акта работ)
  const workLogs = deal
    ? await db
        .select({
          id: dealWorkLogs.id,
          performedAt: dealWorkLogs.performedAt,
          description: dealWorkLogs.description,
          areaM2: dealWorkLogs.areaM2,
          notes: dealWorkLogs.notes,
          masterName: users.fullName,
        })
        .from(dealWorkLogs)
        .leftJoin(users, eq(dealWorkLogs.masterId, users.id))
        .where(eq(dealWorkLogs.dealId, deal.id))
        .orderBy(asc(dealWorkLogs.performedAt))
    : [];

  // Sprint 10: услуги объекта — источник таблицы для АО/АВР по объекту
  // (№ | Объект | Адрес | Площадь+Единица | Услуга). Цен нет — акт технический.
  const isObjectAct =
    !!ctx.objectId && (ctx.type === 'act_inspection' || ctx.type === 'act_work');
  const targetObject = ctx.objectId ? objMap.get(ctx.objectId) ?? null : null;

  let objectServices: Array<{
    index: number;
    objectName: string;
    objectAddress: string;
    serviceName: string;
    method: string;
    quantity: string;
    unit: string;
    unitLabel: string;
    areaLabel: string;
  }> = [];
  let servicesLine = '';
  if (isObjectAct) {
    const svcRows = await db
      .select({
        customName: clientObjectServices.customName,
        method: clientObjectServices.method,
        unit: clientObjectServices.unit,
        quantity: clientObjectServices.quantity,
        serviceShort: services.shortName,
        serviceFull: services.name,
      })
      .from(clientObjectServices)
      .leftJoin(services, eq(clientObjectServices.serviceId, services.id))
      .where(eq(clientObjectServices.objectId, ctx.objectId!))
      .orderBy(asc(clientObjectServices.sortOrder));

    objectServices = svcRows.map((r, i) => {
      // Кол-во услуги; если не задано — берём площадь объекта (как в бумажных АВР).
      const qtyRaw = r.quantity ?? targetObject?.areaM2 ?? null;
      const lbl = unitLabel(r.unit);
      return {
        index: i + 1,
        objectName: targetObject?.name ?? '',
        objectAddress: targetObject?.address ?? '',
        serviceName: r.customName ?? r.serviceShort ?? r.serviceFull ?? '',
        method: r.method ?? '',
        quantity: formatQuantity(qtyRaw),
        unit: r.unit,
        unitLabel: lbl,
        areaLabel: qtyRaw != null ? `${formatQuantity(qtyRaw)} ${lbl}` : '',
      };
    });
    servicesLine = objectServices
      .map((s) => (s.areaLabel ? `${s.serviceName} — ${s.areaLabel}` : s.serviceName))
      .filter(Boolean)
      .join('; ');
  }

  // Sprint 10: дезинфектор = назначенный мастер сделки (для АО/АВР).
  let masterName = '';
  if (isObjectAct && deal?.assignedMasterId) {
    const [m] = await db
      .select({ fullName: users.fullName })
      .from(users)
      .where(eq(users.id, deal.assignedMasterId))
      .limit(1);
    masterName = m?.fullName ?? '';
  }

  // Базовые данные, общие для всех типов
  const data: Record<string, unknown> = {
    provider: CONTRACT_PROVIDER,
    client: client
      ? {
          shortName: client.shortName ?? '',
          fullName: client.fullName ?? client.shortName ?? '',
          directorName: client.directorName ?? '',
          // Инициалы для подписей: «Дёмин Алексей Анатольевич» → «А.А.Дёмин» (как в бумаге).
          directorShort: initialsName(client.directorName ?? ''),
          directorRole: client.directorRole ?? '',
          actingBasis: client.actingBasis ?? '',
          legalAddress: client.legalAddress ?? '',
          postalAddress: client.postalAddress ?? '',
          inn: client.inn ?? '',
          kpp: client.kpp ?? '',
          ogrn: client.ogrn ?? '',
          phone: client.phone ?? '',
          email: client.email ?? '',
          bankName: client.bankName ?? '',
          bankAccount: client.bankAccount ?? '',
          bankBik: client.bankBik ?? '',
          bankCorrAccount: client.bankCorrAccount ?? '',
        }
      : {},
    objects: templateObjects.map((o, i) => ({
      index: i + 1,
      name: o.name,
      address: o.address,
      area: formatQuantity(o.areaM2),
      service: o.objectType ?? '',
    })),
    priceItems,
    priceItemsByObject: priceGroupsByObject,
    // Sprint 10: услуги объекта для таблицы АО/АВР + строка-перечень + одиночные
    // поля под формат шаблона Регины ({object.*}, {contact.*}, {master.fio}, {services}).
    objectServices,
    services: servicesLine,
    object: targetObject
      ? {
          name: targetObject.name,
          address: targetObject.address,
          area: formatQuantity(targetObject.areaM2),
        }
      : {},
    contact: {
      fio: targetObject?.contactPerson ?? '',
      phone: targetObject?.contactPhone ?? '',
    },
    master: { fio: masterName },
    document: { number: ctx.documentNumber, date: formatHumanDate(ctx.documentDate) },
    deal: deal
      ? {
          contractNumber: deal.contractNumber ?? '',
          contractDateLong: formatHumanDate(deal.contractDate ?? ''),
        }
      : {},
    totalNet: formatMoney(totalNet),
    totalGross: formatMoney(totalGross),
    vatAmount: formatMoney(totalGross - totalNet),
  };

  // Тип-специфичные блоки данных
  switch (ctx.type) {
    case 'contract':
      data.contract = {
        number: deal?.contractNumber ?? ctx.documentNumber,
        date: formatHumanDate(deal?.contractDate ?? ctx.documentDate),
        place: deal?.contractPlace ?? 'г. Новороссийск',
        endDate: deal?.endDate ? formatHumanDate(deal.endDate) : '',
        ...(ctx.overrides ?? {}),
      };
      break;
    case 'addendum':
      data.contract = {
        number: deal?.contractNumber ?? '',
        date: formatHumanDate(deal?.contractDate ?? ''),
      };
      data.addendum = {
        number: addendum?.number ?? 1,
        date: formatHumanDate(addendum?.date ?? ctx.documentDate),
        place: deal?.contractPlace ?? 'г. Новороссийск',
        ...(ctx.overrides ?? {}),
      };
      break;
    case 'act_work':
      data.contract = {
        number: deal?.contractNumber ?? '',
        date: formatHumanDate(deal?.contractDate ?? ''),
      };
      data.act = {
        number: ctx.documentNumber,
        date: formatHumanDate(ctx.documentDate),
        qualityCheck: 'соответствует',
        areaCheck: 'совпадает',
        actualArea:
          workLogs.reduce((s, w) => s + (w.areaM2 ?? 0), 0) ||
          priceItemsRaw.reduce((s, p) => s + Number(p.areaM2), 0) ||
          (targetObject?.areaM2 ? Number(targetObject.areaM2) : 0),
        discrepancy: '',
        // Sprint 10: автозаполнение — дезинфектор (мастер сделки) + контакт объекта.
        disinfector: masterName,
        responsibleName: targetObject?.contactPerson ?? '',
        responsibleRole: '',
        responsiblePhone: targetObject?.contactPhone ?? '',
        ...(ctx.overrides ?? {}),
      };
      data.workLogs = workLogs.map((w, i) => ({
        index: i + 1,
        date: w.performedAt
          ? formatHumanDate(w.performedAt.toISOString().slice(0, 10))
          : '',
        description: w.description ?? '',
        area: w.areaM2 ?? '',
        master: w.masterName ?? '',
        notes: w.notes ?? '',
      }));
      break;
    case 'act_inspection':
      data.report = {
        number: ctx.documentNumber,
        date: formatHumanDate(ctx.documentDate),
        objectStatus: 'удовлетворительное',
        deviations: '',
        description: '',
        recommendation: '',
        infestationLevel: 'не заселён',
        hasJournal: 'нет',
        journalStatus: '',
        ...(ctx.overrides ?? {}),
      };
      break;
    case 'invoice':
      data.invoice = {
        number: ctx.documentNumber,
        date: formatHumanDate(ctx.documentDate),
        dueDate: formatHumanDate(addDays(ctx.documentDate, 5)),
        basis: deal ? `Договор № ${deal.contractNumber} от ${formatHumanDate(deal.contractDate)}` : '',
        totalNet: formatMoney(totalNet),
        vatAmount: formatMoney(totalGross - totalNet),
        totalGross: formatMoney(totalGross),
        totalInWords: '',
        ...(ctx.overrides ?? {}),
      };
      break;
    case 'upd':
      // УПД сочетает счёт-фактуру и акт. Базовый шаблон сейчас идентичен invoice
      // — Регина перевыложит реальный шаблон через /admin/templates.
      data.upd = {
        number: ctx.documentNumber,
        date: formatHumanDate(ctx.documentDate),
        basis: deal ? `Договор № ${deal.contractNumber} от ${formatHumanDate(deal.contractDate)}` : '',
        totalNet: formatMoney(totalNet),
        vatAmount: formatMoney(totalGross - totalNet),
        totalGross: formatMoney(totalGross),
        totalInWords: '',
        ...(ctx.overrides ?? {}),
      };
      // Также пробрасываем под старым ключом invoice — на случай если Регина
      // загрузит шаблон с переменными {{invoice.*}}.
      data.invoice = data.upd;
      break;
    case 'commercial_offer':
      data.offer = {
        number: ctx.documentNumber,
        date: formatHumanDate(ctx.documentDate),
        validUntil: formatHumanDate(addDays(ctx.documentDate, 14)),
        intro: '',
        totalNet: formatMoney(totalNet),
        totalGross: formatMoney(totalGross),
        totalInWords: '',
        ...(ctx.overrides ?? {}),
      };
      break;
    default:
      // 'other' — данных по умолчанию нет
      break;
  }

  return { data, client, deal };
}

const RU_MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

function formatHumanDate(d: string): string {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  const mNum = Number(m);
  if (!y || !day || isNaN(mNum) || mNum < 1 || mNum > 12) return d;
  return `${parseInt(day, 10)} ${RU_MONTHS[mNum - 1]} ${y} г.`;
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return isoDate;
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatMoney(n: string | number): string {
  const v = typeof n === 'string' ? Number(n) : n;
  if (isNaN(v)) return String(n);
  return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2 }).format(v);
}

/**
 * ФИО → инициалы для подписей: «Дёмин Алексей Анатольевич» → «А.А.Дёмин».
 * Формат хранения directorName — «Фамилия Имя Отчество». Если частей меньше —
 * возвращаем как есть (одно слово) или «И.Фамилия».
 */
function initialsName(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  const [last, first, middle] = parts;
  const i1 = first ? `${first[0]}.` : '';
  const i2 = middle ? `${middle[0]}.` : '';
  return `${i1}${i2}${last}`;
}
