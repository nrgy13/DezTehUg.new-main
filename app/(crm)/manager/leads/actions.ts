'use server';

import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { leads, type LeadStatus } from '@/lib/db/schema/leads';
import { clients } from '@/lib/db/schema/clients';
import { activityLog } from '@/lib/db/schema/activity';
import { auth } from '@/lib/auth';

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
  // ...всё остальное оставим Field для редактирования в карточке клиента
  // Здесь — минимальный набор, чтобы lead превратился в клиента быстро
});

export async function convertLeadToClient(rawInput: unknown): Promise<Result<{ clientId: string }>> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: 'Не авторизован' };

  const parsed = convertLeadSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };

  const { id, type, shortName } = parsed.data;

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

  revalidatePath('/manager/leads');
  revalidatePath('/manager/clients');
  return { ok: true, data: { clientId: client.id } };
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
