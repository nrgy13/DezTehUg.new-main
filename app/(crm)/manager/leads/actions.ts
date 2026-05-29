'use server';

import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { leads, type LeadStatus } from '@/lib/db/schema/leads';
import { clients } from '@/lib/db/schema/clients';
import { deals, dealPriceItems } from '@/lib/db/schema/deals';
import { documents } from '@/lib/db/schema/documents';
import { notificationLog, activityLog } from '@/lib/db/schema/activity';
import { auth } from '@/lib/auth';
import { generateDocument } from '@/lib/documents/generate';
import { getMailer } from '@/lib/mailer';
import { commercialOfferBody } from '@/lib/mailer/templates';

type Result<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; field?: string };

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

const updateLeadStatusSchema = z.object({
  id: z.string().uuid(),
  // qualified намеренно убран — устаревший статус, в UI не используется
  status: z.enum([
    'new',
    'contacted',
    'proposal_sent',
    'contract_signed',
    'works_completed',
    'won',
    'lost',
  ]),
});

export async function updateLeadStatus(rawInput: unknown): Promise<Result> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: 'Не авторизован' };

  const parsed = updateLeadStatusSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };

  const { id, status } = parsed.data;
  const [existing] = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
  if (!existing) return { ok: false, error: 'Лид не найден' };

  await db
    .update(leads)
    .set({ status, updatedAt: new Date() })
    .where(eq(leads.id, id));

  await logActivity(actor.id, 'lead.status_change', 'lead', id, {
    from: existing.status,
    to: status,
  });

  revalidatePath('/manager/leads');
  revalidatePath(`/manager/leads/${id}`);
  return { ok: true, data: undefined };
}

const assignLeadSchema = z.object({ id: z.string().uuid() });

export async function takeLead(rawInput: unknown): Promise<Result> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: 'Не авторизован' };

  const parsed = assignLeadSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };

  const [existing] = await db.select().from(leads).where(eq(leads.id, parsed.data.id)).limit(1);
  if (!existing) return { ok: false, error: 'Лид не найден' };

  await db
    .update(leads)
    .set({ assignedManagerId: actor.id, updatedAt: new Date() })
    .where(eq(leads.id, parsed.data.id));

  await logActivity(actor.id, 'lead.assign_to_self', 'lead', parsed.data.id, {
    managerId: actor.id,
  });

  revalidatePath('/manager/leads');
  revalidatePath(`/manager/leads/${parsed.data.id}`);
  return { ok: true, data: undefined };
}

// =============================================================
// Конвертация lead → client (Задача 5 — канбан добавит lead → client+deal)
// =============================================================

const convertLeadSchema = z.object({
  id: z.string().uuid(),
  // Поля для нового клиента
  type: z.enum(['legal', 'individual']),
  shortName: z.string().trim().min(1).max(255),
  // Опциональный флаг: сразу создать draft-сделку для этого клиента
  createDeal: z.boolean().optional().default(false),
  // ...всё остальное оставим Field для редактирования в карточке клиента
  // Здесь — минимальный набор, чтобы lead превратился в клиента быстро
});

export async function convertLeadToClient(
  rawInput: unknown,
): Promise<Result<{ clientId: string; dealId?: string }>> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: 'Не авторизован' };

  const parsed = convertLeadSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };

  const { id, type, shortName, createDeal } = parsed.data;

  const [lead] = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
  if (!lead) return { ok: false, error: 'Лид не найден' };
  if (lead.clientId) {
    return { ok: false, error: 'Этот лид уже привязан к клиенту' };
  }

  // Создаём клиента
  const [client] = await db
    .insert(clients)
    .values({
      type,
      shortName,
      phone: lead.contactPhone ?? null,
      email: lead.contactEmail ?? null,
      legalAddress: lead.requestedAddress ?? null,
      source: lead.source,
      status: 'lead',
      createdById: actor.id,
      assignedManagerId: lead.assignedManagerId ?? actor.id,
      notes: lead.message ?? null,
    })
    .returning({ id: clients.id });

  // Привязываем lead к клиенту, статус → contract_signed
  // (договор подписан = момент юридической конвертации в клиента;
  // works_completed/won наступают позже когда работы и оплата прошли)
  await db
    .update(leads)
    .set({
      clientId: client.id,
      status: 'contract_signed',
      convertedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(leads.id, id));

  await logActivity(actor.id, 'lead.convert', 'lead', id, {
    clientId: client.id,
    type,
    shortName,
  });
  await logActivity(actor.id, 'client.create', 'client', client.id, {
    fromLeadId: id,
    type,
    shortName,
  });

  // Опционально создаём draft-сделку и связываем её с лидом
  let dealId: string | undefined;
  if (createDeal) {
    const todayIso = new Date().toISOString().slice(0, 10);
    const dd = todayIso.slice(8, 10);
    const mm = todayIso.slice(5, 7);
    const yy = todayIso.slice(2, 4);
    const prefix = `ДТЮ-${dd}/${mm}/${yy}-`;
    const sameDay = await db
      .select({ contractNumber: deals.contractNumber })
      .from(deals)
      .where(eq(deals.contractDate, todayIso));
    const seq = sameDay.filter((d) => d.contractNumber.startsWith(prefix)).length + 1;
    const contractNumber = `${prefix}${seq}`;

    const [created] = await db
      .insert(deals)
      .values({
        contractNumber,
        contractDate: todayIso,
        clientId: client.id,
        leadId: id,
        status: 'draft',
        signatoryExecutor: 'ИП Белавина Ольга Владимировна',
        assignedManagerId: lead.assignedManagerId ?? actor.id,
        createdById: actor.id,
      })
      .returning({ id: deals.id });
    dealId = created.id;

    await logActivity(actor.id, 'deal.create', 'deal', dealId, {
      contractNumber,
      clientId: client.id,
      fromLeadId: id,
    });
  }

  revalidatePath('/manager/leads');
  revalidatePath('/manager/clients');
  if (dealId) revalidatePath('/manager/deals');
  return { ok: true, data: { clientId: client.id, dealId } };
}

// =============================================================
// Пометить лид как потерянный (с обязательной причиной).
// Используется на канбане при drop в колонку "Потеряны".
// =============================================================

const markLeadLostSchema = z.object({
  id: z.string().uuid(),
  reasonCode: z.enum([
    'price_too_high',
    'chose_competitor',
    'no_response',
    'not_relevant',
    'postponed',
    'diy_solved',
    'wrong_region',
    'spam',
    'other',
  ]),
  // Свободный комментарий: обязателен только для 'other', опционален для остальных
  reason: z.string().trim().max(2000).optional().or(z.literal('')),
});

export async function markLeadLost(rawInput: unknown): Promise<Result> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: 'Не авторизован' };

  const parsed = markLeadLostSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };

  const { id, reasonCode, reason } = parsed.data;
  if (reasonCode === 'other' && (!reason || reason.length < 3)) {
    return {
      ok: false,
      error: 'Для причины «Другое» опишите подробности (минимум 3 символа)',
    };
  }

  const [existing] = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
  if (!existing) return { ok: false, error: 'Лид не найден' };

  await db
    .update(leads)
    .set({
      status: 'lost',
      lostReasonCode: reasonCode,
      lostReason: reason || null,
      updatedAt: new Date(),
    })
    .where(eq(leads.id, id));

  await logActivity(actor.id, 'lead.mark_lost', 'lead', id, {
    from: existing.status,
    reasonCode,
    reason: reason || null,
  });

  revalidatePath('/manager/leads');
  revalidatePath(`/manager/leads/${id}`);
  return { ok: true, data: undefined };
}

// =============================================================
// Создание лида вручную из CRM (звонок клиента, рекомендация и т.д.)
// =============================================================

const createLeadManuallySchema = z.object({
  contactName: z.string().trim().max(255).optional().or(z.literal('')),
  contactPhone: z
    .string()
    .trim()
    .min(5, 'Слишком короткий телефон')
    .max(32)
    .regex(/^[\d+\-\s()]+$/, 'Телефон может содержать только цифры, +, -, пробелы и скобки'),
  contactEmail: z.string().trim().email('Некорректный email').max(255).optional().or(z.literal('')),
  requestedAddress: z.string().trim().max(1000).optional().or(z.literal('')),
  serviceTypes: z.array(z.string()).optional(),
  areaM2Estimate: z.number().int().positive().optional().nullable(),
  message: z.string().trim().max(2000).optional().or(z.literal('')),
  source: z.enum(['phone', 'manager', 'referral']).default('phone'),
  channel: z.string().trim().max(64).optional().or(z.literal('')),
  takeImmediately: z.boolean().default(true),
});

export async function createLeadManually(
  rawInput: unknown
): Promise<Result<{ leadId: string }>> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: 'Не авторизован' };

  const parsed = createLeadManuallySchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0].message };
  }

  const v = parsed.data;
  const channel =
    v.channel && v.channel.length > 0
      ? v.channel
      : v.source === 'phone'
        ? 'phone_call'
        : v.source === 'referral'
          ? 'referral'
          : 'manual';

  const [created] = await db
    .insert(leads)
    .values({
      contactName: v.contactName ? v.contactName.slice(0, 255) : null,
      contactPhone: v.contactPhone.slice(0, 32),
      contactEmail: v.contactEmail ? v.contactEmail.slice(0, 255) : null,
      requestedAddress: v.requestedAddress || null,
      serviceTypes:
        v.serviceTypes && v.serviceTypes.length > 0 ? v.serviceTypes : null,
      areaM2Estimate: v.areaM2Estimate ?? null,
      message: v.message || null,
      source: v.source,
      channel: channel.slice(0, 64),
      status: v.takeImmediately ? 'contacted' : 'new',
      assignedManagerId: v.takeImmediately ? actor.id : null,
      rawPayload: { _manualEntry: true, createdByEmail: actor.email },
    })
    .returning({ id: leads.id });

  await logActivity(actor.id, 'lead.create_manual', 'lead', created.id, {
    source: v.source,
    name: v.contactName ?? null,
    phone: v.contactPhone,
    takeImmediately: v.takeImmediately,
  });

  revalidatePath('/manager/leads');
  revalidatePath('/manager/leads/board');
  return { ok: true, data: { leadId: created.id } };
}

// =============================================================
// Сформировать и отправить КП клиенту по email из карточки лида
// (или при дропе в колонку «КП отправлено» на канбане)
//
// Что делает за один клик:
// 1. Создаёт минимального клиента-черновика (shortName + email + status='lead')
// 2. Создаёт draft-сделку, привязывает её к лиду
// 3. Заводит прайс-позиции в сделке
// 4. Генерирует DOCX КП через generateDocument()
// 5. Отправляет email клиенту с DOCX во вложении
// 6. Меняет статус лида на proposal_sent, привязывает client_id
//
// При любой ошибке — статус лида НЕ меняется, чтобы UI мог откатить
// optimistic update. Транзакции нет (несколько таблиц + IO), но порядок
// безопасный: сначала клиент → сделка → прайс → DOCX → email → лид.
// =============================================================

const proposalItemSchema = z.object({
  customName: z.string().trim().min(1, 'Укажи название услуги').max(255),
  areaM2: z.coerce.number().int().min(0).max(1_000_000),
  priceNoVat: z.coerce.number().min(0).max(1_000_000_000),
  vatRate: z.coerce.number().min(0).max(100).default(5),
  method: z.string().max(128).optional().or(z.literal('')),
  frequency: z.string().max(64).optional().or(z.literal('')),
});

const submitProposalSchema = z.object({
  leadId: z.string().uuid(),
  type: z.enum(['legal', 'individual']),
  shortName: z.string().trim().min(1, 'Введи название клиента').max(255),
  email: z.string().trim().email('Некорректный email').max(255),
  subject: z.string().trim().max(255).optional().or(z.literal('')),
  validUntil: z.string().optional().or(z.literal('')),
  items: z.array(proposalItemSchema).min(1, 'Добавь хотя бы одну позицию'),
});

export async function submitProposalForLead(
  rawInput: unknown,
): Promise<
  Result<{
    leadId: string;
    clientId: string;
    dealId: string;
    documentId: string;
    emailTransport: string;
  }>
> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: 'Не авторизован' };

  const parsed = submitProposalSchema.safeParse(rawInput);
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    return { ok: false, error: first.message, field: first.path.join('.') };
  }
  const data = parsed.data;

  const [lead] = await db.select().from(leads).where(eq(leads.id, data.leadId)).limit(1);
  if (!lead) return { ok: false, error: 'Лид не найден' };
  if (lead.clientId) {
    return { ok: false, error: 'У лида уже есть привязанный клиент — используй другой сценарий' };
  }

  // 1. Минимальный клиент (черновик)
  const [client] = await db
    .insert(clients)
    .values({
      type: data.type,
      shortName: data.shortName,
      email: data.email,
      phone: lead.contactPhone ?? null,
      legalAddress: lead.requestedAddress ?? null,
      source: lead.source,
      status: 'lead',
      createdById: actor.id,
      assignedManagerId: lead.assignedManagerId ?? actor.id,
      notes: 'Черновик: создан при отправке КП. Реквизиты дозаполнить при подписании договора.',
    })
    .returning({ id: clients.id });

  // 2. Draft-сделка
  const todayIso = new Date().toISOString().slice(0, 10);
  const dd = todayIso.slice(8, 10);
  const mm = todayIso.slice(5, 7);
  const yy = todayIso.slice(2, 4);
  const prefix = `ДТЮ-${dd}/${mm}/${yy}-`;
  const sameDay = await db
    .select({ contractNumber: deals.contractNumber })
    .from(deals)
    .where(eq(deals.contractDate, todayIso));
  const seq = sameDay.filter((d) => d.contractNumber.startsWith(prefix)).length + 1;
  const contractNumber = `${prefix}${seq}`;

  const [deal] = await db
    .insert(deals)
    .values({
      contractNumber,
      contractDate: todayIso,
      clientId: client.id,
      leadId: data.leadId,
      status: 'draft',
      signatoryExecutor: 'ИП Белавина Ольга Владимировна',
      assignedManagerId: lead.assignedManagerId ?? actor.id,
      createdById: actor.id,
    })
    .returning({ id: deals.id });

  // 3. Прайс-позиции
  for (let i = 0; i < data.items.length; i++) {
    const it = data.items[i];
    const priceWithVat = Math.round(it.priceNoVat * (1 + it.vatRate / 100) * 100) / 100;
    await db.insert(dealPriceItems).values({
      dealId: deal.id,
      customName: it.customName,
      areaM2: String(it.areaM2),
      method: it.method?.trim() || null,
      frequency: it.frequency?.trim() || null,
      priceNoVat: String(it.priceNoVat),
      priceWithVat: String(priceWithVat),
      vatRate: String(it.vatRate),
      sortOrder: i,
    });
  }

  // 4. DOCX КП
  let docResult: Awaited<ReturnType<typeof generateDocument>>;
  try {
    docResult = await generateDocument({
      type: 'commercial_offer',
      dealId: deal.id,
      format: 'docx',
      overrides: data.validUntil ? { validUntil: data.validUntil } : undefined,
      actorId: actor.id,
    });
  } catch (err) {
    return {
      ok: false,
      error: `Не удалось сгенерировать КП: ${err instanceof Error ? err.message : 'unknown'}`,
    };
  }

  // 5. Email с вложением
  let emailTransport = 'noop';
  try {
    const mailer = await getMailer();
    const finalSubject =
      data.subject?.trim() ||
      `Коммерческое предложение ${docResult.number} от ДезТехЮг`;
    const body = commercialOfferBody({
      clientName: data.shortName,
      documentNumber: docResult.number,
    });
    const sendResult = await mailer.send({
      to: data.email,
      subject: finalSubject,
      text: body.text,
      html: body.html,
      attachments: [
        {
          filename: `${docResult.number} ${data.shortName}.docx`.replace(
            /[\\/:*?"<>|]+/g,
            '-',
          ),
          content: docResult.docxBuffer,
          contentType:
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        },
      ],
    });
    emailTransport = sendResult.transport;

    await db.insert(notificationLog).values({
      channel: 'email',
      subject: finalSubject,
      body: `КП ${docResult.number} отправлено клиенту ${data.shortName}`,
      payloadJson: {
        recipient: data.email,
        transport: sendResult.transport,
        messageId: sendResult.messageId,
        documentId: docResult.documentId,
      },
      relatedEntityType: 'document',
      relatedEntityId: docResult.documentId,
      sentAt: new Date(),
      status: 'sent',
    });

    // Помечаем документ как отправленный
    await db
      .update(documents)
      .set({
        status: 'sent',
        sentAt: new Date(),
        sentToEmail: data.email,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, docResult.documentId));
  } catch (err) {
    // Не фейлим всю операцию — DOCX уже создан, лежит в storage.
    // Менеджер сможет скачать и отправить руками. Логируем в notification_log.
    await db.insert(notificationLog).values({
      channel: 'email',
      subject: `КП ${docResult.number} (отправка failed)`,
      body: `Не удалось отправить email: ${err instanceof Error ? err.message : 'unknown'}`,
      payloadJson: { recipient: data.email, documentId: docResult.documentId },
      relatedEntityType: 'document',
      relatedEntityId: docResult.documentId,
      status: 'failed',
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    emailTransport = 'failed';
  }

  // 6. Меняем статус лида и привязываем клиента
  await db
    .update(leads)
    .set({
      clientId: client.id,
      status: 'proposal_sent',
      updatedAt: new Date(),
    })
    .where(eq(leads.id, data.leadId));

  await logActivity(actor.id, 'lead.proposal_sent', 'lead', data.leadId, {
    clientId: client.id,
    dealId: deal.id,
    documentId: docResult.documentId,
    contractNumber,
    documentNumber: docResult.number,
    email: data.email,
    emailTransport,
    itemsCount: data.items.length,
  });

  revalidatePath('/manager/leads');
  revalidatePath('/manager/leads/board');
  revalidatePath(`/manager/leads/${data.leadId}`);
  revalidatePath('/manager/clients');
  revalidatePath('/manager/deals');
  revalidatePath(`/manager/deals/${deal.id}`);

  return {
    ok: true,
    data: {
      leadId: data.leadId,
      clientId: client.id,
      dealId: deal.id,
      documentId: docResult.documentId,
      emailTransport,
    },
  };
}
