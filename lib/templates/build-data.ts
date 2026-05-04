import { eq, asc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { clients, type Client } from '@/lib/db/schema/clients';
import { clientObjects } from '@/lib/db/schema/objects';
import { deals, dealPriceItems, dealAddendums, dealWorkLogs, type Deal } from '@/lib/db/schema/deals';
import { services } from '@/lib/db/schema/services';
import { users } from '@/lib/db/schema/users';
import { CONTRACT_PROVIDER } from '@/lib/contract-provider';
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

  // Прайс-позиции сделки
  const priceItemsRaw = deal
    ? await db
        .select({
          id: dealPriceItems.id,
          objectId: dealPriceItems.objectId,
          serviceId: dealPriceItems.serviceId,
          customName: dealPriceItems.customName,
          areaM2: dealPriceItems.areaM2,
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

  // Имена услуг (для priceItems из каталога)
  const serviceIds = priceItemsRaw.map((p) => p.serviceId).filter((x): x is string => !!x);
  const svcMap = new Map<string, string>();
  if (serviceIds.length > 0) {
    const svcs = await db.select().from(services);
    for (const s of svcs) svcMap.set(s.id, s.shortName ?? s.name);
  }

  const objMap = new Map(objects.map((o) => [o.id, o]));

  const priceItems = priceItemsRaw.map((p, idx) => {
    const obj = p.objectId ? objMap.get(p.objectId) : null;
    return {
      index: idx + 1,
      serviceName: p.customName || (p.serviceId ? svcMap.get(p.serviceId) ?? '' : ''),
      objectName: obj?.name ?? '',
      objectAddress: obj?.address ?? '',
      area: p.areaM2,
      method: p.method ?? '',
      frequency: p.frequency ?? '',
      priceNet: formatMoney(p.priceNoVat),
      priceGross: formatMoney(p.priceWithVat),
      vatRate: Number(p.vatRate),
      quantity: 1,
      unit: 'усл.',
      amount: formatMoney(p.priceWithVat),
    };
  });

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

  // Базовые данные, общие для всех типов
  const data: Record<string, unknown> = {
    provider: CONTRACT_PROVIDER,
    client: client
      ? {
          shortName: client.shortName ?? '',
          fullName: client.fullName ?? client.shortName ?? '',
          directorName: client.directorName ?? '',
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
    objects: objects.map((o, i) => ({
      index: i + 1,
      name: o.name,
      address: o.address,
      area: o.areaM2 ?? '',
      service: o.objectType ?? '',
    })),
    priceItems,
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
          priceItemsRaw.reduce((s, p) => s + p.areaM2, 0),
        discrepancy: '',
        disinfector: '',
        responsibleName: '',
        responsibleRole: '',
        responsiblePhone: '',
        ...(ctx.overrides ?? {}),
      };
      data.workLogs = workLogs.map((w, i) => ({
        index: i + 1,
        date: formatHumanDate(w.performedAt.toISOString().slice(0, 10)),
        description: w.description,
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
