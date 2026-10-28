// Создание лида с сайта + уведомление менеджеров. Общий код для двух входов:
//   • /api/leads/inbound — штатный путь (сайт → n8n → CRM);
//   • /api/booking — страховка: n8n не ответил ⟹ лид пишется в CRM напрямую.
//
// Зачем страховка (28.10.2026): форма шлёт заявку в CRM ТОЛЬКО через n8n, а n8n живёт
// на офисном сервере за воротами Beget. Ляжет любое звено — заявка пропадёт молча,
// клиенту при этом «спасибо». Повторов у формы нет.

import { and, eq, gt, gte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { leads } from '@/lib/db/schema/leads';
import { activityLog } from '@/lib/db/schema/activity';
import { notifyManagersAboutNewLead } from '@/lib/notifications/new-lead';

/** Метка в raw_payload лида, созданного страховкой формы (мимо n8n). */
export const BOOKING_FALLBACK_VIA = 'booking-fallback';

const NOTIFY_TIMEOUT_MS = 15_000;

type LeadSource = (typeof leads.source.enumValues)[number];

export type SiteLeadInput = {
  contactName?: string;
  contactPhone: string;
  contactEmail?: string;
  serviceTypes?: string[] | null;
  requestedAddress?: string | null;
  areaM2Estimate?: number | null;
  message?: string | null;
  source: LeadSource;
  channel: string;
  rawPayload: unknown;
};

export type SiteLeadMeta = {
  /** action в activity_log: 'lead.create_from_n8n' | 'lead.create_from_booking_fallback' */
  action: string;
  ip: string | null;
  userAgent: string | null;
  /** Ждать ли уведомления (до 15с). false — уведомления уходят в фоне, ответ не задерживают. */
  awaitNotify: boolean;
  /** Префикс для console-логов. */
  logTag: string;
};

/** Только цифры: «+7 (989) 197-52-08» и «89891975208» сравниваем по хвосту из 10 цифр. */
function phoneKey(phone: string): string {
  return phone.replace(/\D/g, '').slice(-10);
}

/** По такому телефону лиды можно сопоставлять (иначе сверка по телефону бессмысленна). */
export function isMatchablePhone(phone: string): boolean {
  return phoneKey(phone).length >= 5;
}

const phoneKeySql = sql`right(regexp_replace(coalesce(${leads.contactPhone}, ''), '\\D', '', 'g'), 10)`;

/**
 * Любой лид с формы сайта (channel=site_form) с тем же телефоном, созданный не раньше `since`.
 * Нужен страховке /api/booking в обе стороны от n8n:
 *   • n8n не ответил форме вовремя, но успел довезти лид в CRM ⟹ второй не пишем;
 *   • n8n ответил «принял», но лид в CRM так и не появился ⟹ пишем сами.
 * Не бросает: при сбое возвращает undefined (вызывающий решает, что делать с неизвестностью).
 */
export async function findSiteLeadByPhoneSince(phone: string, since: Date): Promise<string | null | undefined> {
  const key = phoneKey(phone);
  if (key.length < 5) return null;
  try {
    const [row] = await db
      .select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.channel, 'site_form'), sql`${phoneKeySql} = ${key}`, gte(leads.createdAt, since)))
      .limit(1);
    return row?.id ?? null;
  } catch (err) {
    console.error('[site-lead] поиск лида по телефону не удался:', err);
    return undefined;
  }
}

/**
 * Лид, созданный страховкой формы за последние 30 мин с тем же телефоном (окно, в которое
 * n8n ещё может довезти ту же заявку).
 * Нужен входу от n8n: если n8n принял заявку, но не успел ответить форме (таймаут),
 * форма записала лид сама — второй экземпляр от n8n не создаём.
 * Не бросает: сбой проверки не должен валить приём лида — тогда считаем, что дубля нет.
 */
export async function findRecentFallbackLead(phone: string): Promise<string | null> {
  const key = phoneKey(phone);
  if (key.length < 5) return null;
  try {
    const [row] = await db
      .select({ id: leads.id })
      .from(leads)
      .where(
        and(
          sql`${leads.rawPayload}->>'via' = ${BOOKING_FALLBACK_VIA}`,
          sql`${phoneKeySql} = ${key}`,
          gt(leads.createdAt, sql`now() - interval '30 minutes'`),
        ),
      )
      .limit(1);
    return row?.id ?? null;
  } catch (err) {
    console.error('[site-lead] проверка дубля не удалась — создаём лид как обычно:', err);
    return null;
  }
}

async function notifyAndLog(
  lead: { id: string } & SiteLeadInput,
  logTag: string,
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const notify = await Promise.race([
      notifyManagersAboutNewLead({
        id: lead.id,
        contactName: lead.contactName ?? null,
        contactPhone: lead.contactPhone,
        contactEmail: lead.contactEmail ?? null,
        services: lead.serviceTypes ?? null,
        address: lead.requestedAddress ?? null,
        message: lead.message ?? null,
      }),
      new Promise<'timeout'>((resolve) => {
        timer = setTimeout(() => resolve('timeout'), NOTIFY_TIMEOUT_MS);
      }),
    ]);
    clearTimeout(timer);
    console.info(`[${logTag}] notify managers:`, lead.id, JSON.stringify(notify));
    await db.insert(activityLog).values({
      userId: null,
      action: 'lead.notify_managers',
      entityType: 'lead',
      entityId: lead.id,
      changesJson: notify === 'timeout' ? { timeout: true } : notify,
    });
  } catch (err) {
    console.error(`[${logTag}] notify managers failed:`, lead.id, err);
  }
}

/**
 * Пишет лид + activity_log и уведомляет менеджеров. Бросает только при ошибке БД
 * на вставке лида; сбой уведомлений ответ не ломает (итог — в activity_log).
 */
export async function createSiteLead(input: SiteLeadInput, meta: SiteLeadMeta): Promise<{ id: string }> {
  const [created] = await db
    .insert(leads)
    .values({
      contactName: input.contactName?.slice(0, 255),
      contactPhone: input.contactPhone.slice(0, 32),
      contactEmail: input.contactEmail?.slice(0, 255),
      serviceTypes: input.serviceTypes ?? null,
      requestedAddress: input.requestedAddress ?? null,
      areaM2Estimate: input.areaM2Estimate ?? null,
      message: input.message ?? null,
      source: input.source,
      channel: input.channel.slice(0, 64),
      rawPayload: input.rawPayload,
      status: 'new',
    })
    .returning({ id: leads.id });

  // Запись в activity_log (без userId — это система)
  await db.insert(activityLog).values({
    userId: null,
    action: meta.action,
    entityType: 'lead',
    entityId: created.id,
    changesJson: { phone: input.contactPhone, name: input.contactName, channel: input.channel },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  const job = notifyAndLog({ id: created.id, ...input }, meta.logTag);
  if (meta.awaitNotify) await job;

  return { id: created.id };
}

/** Для ответа на дубль: пометить в журнале, что n8n довёз уже записанную заявку. */
export async function logDedupedN8nLead(leadId: string, ip: string | null): Promise<void> {
  await db.insert(activityLog).values({
    userId: null,
    action: 'lead.dedupe_after_booking_fallback',
    entityType: 'lead',
    entityId: leadId,
    changesJson: { note: 'n8n довёз заявку, уже записанную страховкой формы — второй лид не создан' },
    ip,
    userAgent: null,
  });
}

/** Страховка формы не стала писать лид: n8n уже довёз эту заявку сам. Сбой записи не бросает. */
export async function logSkippedBookingFallback(leadId: string, n8nReason: string): Promise<void> {
  try {
    await db.insert(activityLog).values({
      userId: null,
      action: 'lead.dedupe_booking_fallback',
      entityType: 'lead',
      entityId: leadId,
      changesJson: { note: 'форма не дождалась ответа n8n, но лид от n8n уже есть — второй не создан', n8nError: n8nReason },
      ip: null,
      userAgent: null,
    });
  } catch (err) {
    console.error('[site-lead] не записал отметку о дубле:', leadId, err);
  }
}
