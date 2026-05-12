'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { z } from 'zod';
import { db } from '@/lib/db';
import { deals, dealWorkLogs } from '@/lib/db/schema/deals';
import { activityLog } from '@/lib/db/schema/activity';
import { auth } from '@/lib/auth';

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

async function getMaster() {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.role !== 'master' && session.user.role !== 'admin') return null;
  return session.user;
}

async function logActivity(
  userId: string,
  action: string,
  entityId: string,
  changes?: unknown,
) {
  const headersList = await headers();
  await db.insert(activityLog).values({
    userId,
    action,
    entityType: 'deal',
    entityId,
    changesJson: (changes as object) ?? null,
    ip: headersList.get('x-forwarded-for')?.split(',')[0].trim() ?? null,
    userAgent: headersList.get('user-agent') ?? null,
  });
}

const workLogSchema = z.object({
  performedAt: z.string().min(1, 'Укажи дату'),
  description: z.string().min(2, 'Опиши что было сделано'),
  areaM2: z.coerce.number().int().min(0).max(1_000_000).optional().nullable(),
  notes: z.string().max(2000).optional().or(z.literal('')),
});

export async function addWorkLog(
  dealId: string,
  input: unknown,
): Promise<Result<{ id: string }>> {
  const actor = await getMaster();
  if (!actor) return { ok: false, error: 'Нет доступа' };

  // Проверяем что мастер назначен на эту сделку (admin может всегда)
  const dealRows = await db
    .select({ id: deals.id, masterId: deals.assignedMasterId })
    .from(deals)
    .where(eq(deals.id, dealId))
    .limit(1);
  if (dealRows.length === 0) return { ok: false, error: 'Сделка не найдена' };
  if (actor.role !== 'admin' && dealRows[0].masterId !== actor.id) {
    return { ok: false, error: 'Эта сделка назначена не на тебя' };
  }

  const parsed = workLogSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };

  const [created] = await db
    .insert(dealWorkLogs)
    .values({
      dealId,
      masterId: actor.id,
      performedAt: new Date(parsed.data.performedAt),
      description: parsed.data.description,
      areaM2: parsed.data.areaM2 ?? null,
      notes: parsed.data.notes?.trim() || null,
    })
    .returning({ id: dealWorkLogs.id });

  await logActivity(actor.id, 'work_log.add', dealId, {
    workLogId: created.id,
    description: parsed.data.description.slice(0, 100),
  });

  revalidatePath(`/master/deals/${dealId}`);
  revalidatePath(`/manager/deals/${dealId}`);
  return { ok: true, data: { id: created.id } };
}

// =============================================================
// Запрос переноса дат (Sprint 5 эпик G)
// =============================================================

const dateChangeSchema = z.object({
  requestedStartDate: z.string().min(10, 'Укажи новую дату начала').max(10),
  requestedEndDate: z.string().min(10).max(10).optional().or(z.literal('')),
  reason: z.string().min(5, 'Объясни причину минимум 5 символов').max(1000),
});

/**
 * Master не может сам переносить даты выезда (drag-n-drop в календаре отключён).
 * Вместо этого — кидает запрос менеджеру через эту action. Запись попадает в
 * activity_log сделки (entityType=deal, action=deal.master_date_request),
 * откуда менеджер видит её на странице сделки во вкладке «История».
 *
 * Если у менеджера привязан Telegram — пушим ему уведомление сразу.
 */
export async function requestDateChange(
  dealId: string,
  input: unknown,
): Promise<Result> {
  const actor = await getMaster();
  if (!actor) return { ok: false, error: 'Нет доступа' };

  const parsed = dateChangeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };

  const dealRows = await db
    .select({
      id: deals.id,
      masterId: deals.assignedMasterId,
      managerId: deals.assignedManagerId,
      contractNumber: deals.contractNumber,
      startDate: deals.startDate,
      endDate: deals.endDate,
    })
    .from(deals)
    .where(eq(deals.id, dealId))
    .limit(1);
  if (dealRows.length === 0) return { ok: false, error: 'Сделка не найдена' };
  if (actor.role !== 'admin' && dealRows[0].masterId !== actor.id) {
    return { ok: false, error: 'Эта сделка назначена не на тебя' };
  }
  const deal = dealRows[0];

  await logActivity(actor.id, 'deal.master_date_request', dealId, {
    from: { startDate: deal.startDate, endDate: deal.endDate },
    to: {
      startDate: parsed.data.requestedStartDate,
      endDate: parsed.data.requestedEndDate || null,
    },
    reason: parsed.data.reason,
    requesterName: actor.name,
  });

  // Уведомление менеджеру: Telegram если привязан, иначе email. Best-effort.
  if (deal.managerId) {
    try {
      const { db: dbForUser } = await import('@/lib/db');
      const { users } = await import('@/lib/db/schema/users');
      const [mgr] = await dbForUser
        .select({
          chatId: users.telegramChatId,
          email: users.email,
          name: users.fullName,
        })
        .from(users)
        .where(eq(users.id, deal.managerId))
        .limit(1);

      if (mgr) {
        const oldDates = formatDateRange(deal.startDate, deal.endDate);
        const newDates = formatDateRange(
          parsed.data.requestedStartDate,
          parsed.data.requestedEndDate || null,
        );
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://crm.дезтехюг.рф';
        const dealUrl = `${appUrl}/manager/deals/${dealId}`;
        const inboxUrl = `${appUrl}/manager/inbox`;

        let tgSent = false;
        if (mgr.chatId) {
          const { sendTelegramMessage } = await import('@/lib/notifications/telegram');
          const text =
            `📅 ${actor.name} (мастер) просит перенести выезд по сделке ${deal.contractNumber}\n\n` +
            `Сейчас: ${oldDates}\nПредлагает: ${newDates}\n\n` +
            `Причина: ${parsed.data.reason}\n\n` +
            `Открыть сделку: ${dealUrl}\nВсе уведомления: ${inboxUrl}`;
          tgSent = await sendTelegramMessage(mgr.chatId, text, {
            disableWebPagePreview: true,
          });
        }

        // Если TG не привязан или sendTelegramMessage вернул false (заблокировал бота) — email
        if (!tgSent && mgr.email) {
          const { getMailer } = await import('@/lib/mailer');
          const mailer = await getMailer();
          const text =
            `Менеджер ${mgr.name}, добрый день!\n\n` +
            `Мастер ${actor.name} запросил перенос дат выезда по сделке ${deal.contractNumber}.\n\n` +
            `Текущие даты: ${oldDates}\n` +
            `Предлагаемые даты: ${newDates}\n\n` +
            `Причина: ${parsed.data.reason}\n\n` +
            `Открыть сделку: ${dealUrl}\n` +
            `Все уведомления: ${inboxUrl}\n\n` +
            `— ДезТехЮг CRM`;
          const html = `<p>Менеджер <strong>${mgr.name}</strong>, добрый день!</p>` +
            `<p>Мастер <strong>${actor.name}</strong> запросил перенос дат выезда по сделке <strong>${deal.contractNumber}</strong>.</p>` +
            `<p><strong>Текущие даты:</strong> ${oldDates}<br/><strong>Предлагаемые:</strong> ${newDates}</p>` +
            `<p><strong>Причина:</strong> ${parsed.data.reason}</p>` +
            `<p><a href="${dealUrl}">Открыть сделку</a> · <a href="${inboxUrl}">Все уведомления</a></p>` +
            `<hr/><p style="font-size:11px;color:#888">ДезТехЮг CRM</p>`;
          try {
            await mailer.send({
              to: mgr.email,
              subject: `Запрос переноса дат · ${deal.contractNumber}`,
              text,
              html,
            });
          } catch (err) {
            console.warn('[requestDateChange] email fallback failed:', err);
          }
        }
      }
    } catch (err) {
      console.warn('[requestDateChange] notification failed:', err);
    }
  }

  revalidatePath(`/master/deals/${dealId}`);
  revalidatePath(`/manager/deals/${dealId}`);
  return { ok: true, data: undefined };
}

function formatDateRange(start: string | null, end: string | null): string {
  const fmt = (s: string) => {
    const [y, m, d] = s.split('-');
    return `${d}.${m}.${y}`;
  };
  if (!start && !end) return 'без дат';
  if (start && end && start !== end) return `${fmt(start)} — ${fmt(end)}`;
  return fmt(start ?? end!);
}

export async function markDealCompleted(dealId: string): Promise<Result> {
  const actor = await getMaster();
  if (!actor) return { ok: false, error: 'Нет доступа' };

  const dealRows = await db
    .select({ id: deals.id, masterId: deals.assignedMasterId, status: deals.status })
    .from(deals)
    .where(eq(deals.id, dealId))
    .limit(1);
  if (dealRows.length === 0) return { ok: false, error: 'Сделка не найдена' };
  if (actor.role !== 'admin' && dealRows[0].masterId !== actor.id) {
    return { ok: false, error: 'Эта сделка назначена не на тебя' };
  }

  await db
    .update(deals)
    .set({ status: 'completed', updatedAt: new Date() })
    .where(eq(deals.id, dealId));

  await logActivity(actor.id, 'deal.mark_completed', dealId, {
    from: dealRows[0].status,
  });

  revalidatePath(`/master/deals/${dealId}`);
  revalidatePath(`/master`);
  revalidatePath(`/manager/deals/${dealId}`);
  return { ok: true, data: undefined };
}
