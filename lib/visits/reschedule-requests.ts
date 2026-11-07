import 'server-only';

/**
 * Перенос заказ-наряда ЗАПРОСОМ (11.2026, решение Сани msg 536): мастер сам дату не меняет —
 * официально просит менеджера с обязательной причиной; менеджеру уходит срочное уведомление
 * (push с высоким приоритетом + Telegram + письмо). Менеджер одобряет (наряд переезжает,
 * бригаде push) или отклоняет с комментарием (мастеру push). Один висящий запрос на наряд —
 * гарантия уникальным частичным индексом в БД, а не только проверкой в коде.
 *
 * Все функции принимают уже проверенного актора (роль проверяет server action).
 */

import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { dealWorkLogs, deals } from '@/lib/db/schema/deals';
import { clients } from '@/lib/db/schema/clients';
import { clientObjects } from '@/lib/db/schema/objects';
import { users } from '@/lib/db/schema/users';
import { activityLog } from '@/lib/db/schema/activity';
import { workOrderRescheduleRequests } from '@/lib/db/schema/finance';
import { getCrewIds, isWorkLogMember } from '@/lib/visits/crew';
import { MSK_TZ } from '@/lib/datetime/msk';
import { getMailer } from '@/lib/mailer';
import { sendTelegramMessage } from '@/lib/notifications/telegram';

export const RESCHEDULE_REASON_MIN = 10;
export const RESCHEDULE_REASON_MAX = 1000;

type Ok<T = undefined> = { ok: true; data: T };
type Err = { ok: false; error: string };

function fmtMsk(d: Date | null): string {
  if (!d) return 'без даты';
  return d.toLocaleString('ru-RU', {
    timeZone: MSK_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Уникальный частичный индекс «один pending на наряд» сработал. */
function isPendingDuplicate(err: unknown): boolean {
  const e = err as { code?: string; constraint?: string; cause?: { code?: string; constraint?: string } };
  const code = e?.code ?? e?.cause?.code;
  const constraint = e?.constraint ?? e?.cause?.constraint;
  return code === '23505' && (!constraint || constraint === 'wo_resched_req_one_pending');
}

async function loadWorkLog(workLogId: string) {
  const [wl] = await db
    .select({
      id: dealWorkLogs.id,
      dealId: dealWorkLogs.dealId,
      objectId: dealWorkLogs.objectId,
      masterId: dealWorkLogs.masterId,
      status: dealWorkLogs.status,
      plannedAt: dealWorkLogs.plannedAt,
      objectName: clientObjects.name,
      clientName: clients.shortName,
    })
    .from(dealWorkLogs)
    .innerJoin(deals, eq(deals.id, dealWorkLogs.dealId))
    .innerJoin(clients, eq(clients.id, deals.clientId))
    .leftJoin(clientObjects, eq(clientObjects.id, dealWorkLogs.objectId))
    .where(eq(dealWorkLogs.id, workLogId))
    .limit(1);
  return wl ?? null;
}

// ─── Мастер: создать запрос ───────────────────────────────────────

export type NotifyResult = { recipients: number; telegram: number; email: number; push: number; errors: string[] };

export async function createRescheduleRequest(
  actor: { id: string; name?: string | null },
  input: { workLogId: string; toAt: Date; reason: string },
  now = new Date(),
): Promise<Ok<{ requestId: string; notify: NotifyResult }> | Err> {
  const reason = input.reason.trim();
  if (reason.length < RESCHEDULE_REASON_MIN) {
    return { ok: false, error: `Опиши причину подробнее (минимум ${RESCHEDULE_REASON_MIN} символов)` };
  }
  if (reason.length > RESCHEDULE_REASON_MAX) return { ok: false, error: 'Слишком длинная причина' };
  if (Number.isNaN(input.toAt.getTime())) return { ok: false, error: 'Некорректная дата или время' };
  // Задним числом не переносим (час люфта — на часовые пояса и долгое заполнение формы).
  if (input.toAt.getTime() < now.getTime() - 60 * 60 * 1000) {
    return { ok: false, error: 'Новая дата уже прошла' };
  }

  const wl = await loadWorkLog(input.workLogId);
  if (!wl) return { ok: false, error: 'Наряд не найден' };
  if (!(await isWorkLogMember({ id: wl.id, masterId: wl.masterId }, actor.id))) {
    return { ok: false, error: 'Это не твой наряд' };
  }
  if (wl.status !== 'planned') {
    return { ok: false, error: 'Перенести можно только запланированный наряд' };
  }
  if (wl.plannedAt && wl.plannedAt.getTime() === input.toAt.getTime()) {
    return { ok: false, error: 'Это то же самое время' };
  }

  let requestId: string;
  try {
    const [created] = await db
      .insert(workOrderRescheduleRequests)
      .values({
        workLogId: wl.id,
        requestedById: actor.id,
        fromAt: wl.plannedAt,
        toAt: input.toAt,
        reason,
      })
      .returning({ id: workOrderRescheduleRequests.id });
    requestId = created.id;
  } catch (err) {
    if (isPendingDuplicate(err)) {
      return { ok: false, error: 'По этому наряду уже есть запрос — дождись ответа менеджера' };
    }
    throw err;
  }

  try {
    await db.insert(activityLog).values({
      userId: actor.id,
      action: 'work_order.reschedule_request',
      entityType: 'deal',
      entityId: wl.dealId,
      changesJson: {
        workLogId: wl.id,
        requestId,
        from: wl.plannedAt?.toISOString() ?? null,
        to: input.toAt.toISOString(),
        reason,
      },
    });
  } catch (err) {
    console.warn('[reschedule-request] activity log failed:', err);
  }

  const [master] = await db
    .select({ fullName: users.fullName })
    .from(users)
    .where(eq(users.id, actor.id))
    .limit(1);
  const notify = await notifyManagersAboutRequest({
    requestId,
    masterName: master?.fullName ?? actor.name ?? 'Мастер',
    clientName: wl.clientName,
    objectName: wl.objectName,
    fromAt: wl.plannedAt,
    toAt: input.toAt,
    reason,
  });
  return { ok: true, data: { requestId, notify } };
}

/**
 * Срочно — всем активным менеджерам (Регина), всеми каналами сразу (как заявка с сайта).
 * Админ получает, только если активных менеджеров нет (иначе запрос остался бы без адресата).
 * Не бросает: каналы изолированы, сбои — в errors.
 */
async function notifyManagersAboutRequest(r: {
  requestId: string;
  masterName: string;
  clientName: string;
  objectName: string | null;
  fromAt: Date | null;
  toAt: Date;
  reason: string;
}): Promise<NotifyResult> {
  const result: NotifyResult = { recipients: 0, telegram: 0, email: 0, push: 0, errors: [] };
  try {
    let recipients = await db
      .select({ id: users.id, email: users.email, telegramChatId: users.telegramChatId })
      .from(users)
      .where(and(eq(users.role, 'manager'), eq(users.isActive, true)));
    if (recipients.length === 0) {
      recipients = await db
        .select({ id: users.id, email: users.email, telegramChatId: users.telegramChatId })
        .from(users)
        .where(and(eq(users.role, 'admin'), eq(users.isActive, true)));
    }
    result.recipients = recipients.length;

    const where = [r.clientName, r.objectName].filter(Boolean).join(' · ');
    const tgText = [
      '⏰ СРОЧНО: мастер просит перенести наряд',
      '',
      `👷 ${r.masterName}`,
      `📍 ${where}`,
      `🗓 ${fmtMsk(r.fromAt)} → ${fmtMsk(r.toAt)} (МСК)`,
      `💬 ${r.reason}`,
      '',
      'Одобрить или отклонить: https://crm.дезтехюг.рф/manager',
    ].join('\n');
    const subject = `Срочно: ${r.masterName} просит перенести наряд (${where})`;
    const text = [
      `${r.masterName} просит перенести наряд.`,
      `Клиент/объект: ${where}`,
      `Было: ${fmtMsk(r.fromAt)} (МСК)`,
      `Просит: ${fmtMsk(r.toAt)} (МСК)`,
      `Причина: ${r.reason}`,
      '',
      'Решение — на дашборде CRM: https://crm.дезтехюг.рф/manager',
    ].join('\n');

    await Promise.all(
      recipients.map(async (m) => {
        const jobs: Promise<void>[] = [];
        if (m.telegramChatId) {
          jobs.push(
            sendTelegramMessage(m.telegramChatId, tgText, { disableWebPagePreview: true }).then((ok) => {
              if (ok) result.telegram++;
              else result.errors.push(`telegram ${m.email}: чат недоступен`);
            }),
          );
        }
        jobs.push(
          getMailer()
            .then((mailer) => mailer.send({ to: m.email, subject, text }))
            .then((res) => {
              if (res.transport === 'noop') result.errors.push(`email ${m.email}: MAILER_TRANSPORT=noop`);
              else result.email++;
            }),
        );
        jobs.push(
          import('@/lib/push/server')
            .then(({ sendPushToUser }) =>
              sendPushToUser(m.id, {
                title: '⏰ Запрос на перенос наряда',
                body: `${r.masterName}: ${where} → ${fmtMsk(r.toAt)}. ${r.reason}`.slice(0, 240),
                url: '/manager',
                tag: `resched-${r.requestId}`,
                urgent: true,
              }),
            )
            .then((res) => {
              result.push += res.sent;
            }),
        );
        const settled = await Promise.allSettled(jobs);
        for (const s of settled) {
          if (s.status === 'rejected') result.errors.push(`${m.email}: ${errText(s.reason)}`);
        }
      }),
    );
  } catch (err) {
    result.errors.push(errText(err));
  }
  try {
    await db.insert(activityLog).values({
      action: 'work_order.reschedule_request_notify',
      entityType: 'reschedule_request',
      entityId: r.requestId,
      changesJson: result,
    });
  } catch (err) {
    console.warn('[reschedule-request] notify log failed:', err);
  }
  return result;
}

// ─── Мастер: отозвать свой запрос ─────────────────────────────────

export async function cancelRescheduleRequest(
  actor: { id: string },
  requestId: string,
): Promise<Ok | Err> {
  const updated = await db
    .update(workOrderRescheduleRequests)
    .set({ status: 'cancelled', decidedAt: new Date(), decidedById: actor.id })
    .where(
      and(
        eq(workOrderRescheduleRequests.id, requestId),
        eq(workOrderRescheduleRequests.requestedById, actor.id),
        eq(workOrderRescheduleRequests.status, 'pending'),
      ),
    )
    .returning({ id: workOrderRescheduleRequests.id, workLogId: workOrderRescheduleRequests.workLogId });
  if (updated.length === 0) return { ok: false, error: 'Запрос уже рассмотрен или не найден' };
  return { ok: true, data: undefined };
}

// ─── Менеджер: решение ────────────────────────────────────────────

export async function decideRescheduleRequest(
  actor: { id: string },
  input: { requestId: string; decision: 'approve' | 'reject'; comment?: string | null },
): Promise<Ok<{ workLogId: string; dealId: string; objectId: string | null }> | Err> {
  const comment = input.comment?.trim() || null;
  if (comment && comment.length > RESCHEDULE_REASON_MAX) return { ok: false, error: 'Слишком длинный комментарий' };

  type Decided = {
    workLogId: string;
    dealId: string;
    objectId: string | null;
    masterIdOfOrder: string;
    requestedById: string;
    fromAt: Date | null;
    toAt: Date;
    objectName: string | null;
  };
  let decided: Decided;
  try {
    decided = await db.transaction(async (tx) => {
      // Блокируем запрос: два менеджера/двойной клик не решат его дважды.
      const reqRows = await tx.execute(sql`
        SELECT id, work_log_id, requested_by_id, from_at, to_at, status::text AS status
        FROM work_order_reschedule_requests WHERE id = ${input.requestId}::uuid FOR UPDATE
      `);
      const req = ((reqRows as unknown as { rows?: unknown[] }).rows ?? reqRows) as {
        id: string;
        work_log_id: string;
        requested_by_id: string;
        from_at: string | null;
        to_at: string;
        status: string;
      }[];
      const r = req[0];
      if (!r) throw new Error('Запрос не найден');
      if (r.status !== 'pending') throw new Error('Запрос уже рассмотрен');

      const [wl] = await tx
        .select({
          id: dealWorkLogs.id,
          dealId: dealWorkLogs.dealId,
          objectId: dealWorkLogs.objectId,
          masterId: dealWorkLogs.masterId,
          status: dealWorkLogs.status,
          plannedAt: dealWorkLogs.plannedAt,
          objectName: clientObjects.name,
        })
        .from(dealWorkLogs)
        .leftJoin(clientObjects, eq(clientObjects.id, dealWorkLogs.objectId))
        .where(eq(dealWorkLogs.id, r.work_log_id))
        .limit(1);
      if (!wl) throw new Error('Наряд не найден');

      const toAt = new Date(r.to_at);
      if (input.decision === 'approve') {
        if (wl.status !== 'planned') {
          throw new Error('Наряд уже в работе или выполнен — перенос невозможен, отклони запрос');
        }
        const moved = await tx
          .update(dealWorkLogs)
          .set({ plannedAt: toAt })
          .where(and(eq(dealWorkLogs.id, wl.id), eq(dealWorkLogs.status, 'planned')))
          .returning({ id: dealWorkLogs.id });
        if (moved.length === 0) throw new Error('Наряд уже в работе — перенос невозможен');
      }
      await tx
        .update(workOrderRescheduleRequests)
        .set({
          status: input.decision === 'approve' ? 'approved' : 'rejected',
          decidedById: actor.id,
          decidedAt: new Date(),
          decisionComment: comment,
        })
        .where(eq(workOrderRescheduleRequests.id, r.id));
      await tx.insert(activityLog).values({
        userId: actor.id,
        action: input.decision === 'approve' ? 'work_order.reschedule' : 'work_order.reschedule_rejected',
        entityType: 'deal',
        entityId: wl.dealId,
        changesJson: {
          workLogId: wl.id,
          requestId: r.id,
          from: wl.plannedAt?.toISOString() ?? null,
          to: toAt.toISOString(),
          comment,
        },
      });
      return {
        workLogId: wl.id,
        dealId: wl.dealId,
        objectId: wl.objectId,
        masterIdOfOrder: wl.masterId,
        requestedById: r.requested_by_id,
        fromAt: wl.plannedAt,
        toAt,
        objectName: wl.objectName,
      };
    });
  } catch (err) {
    return { ok: false, error: errText(err) };
  }

  // Push (best-effort): одобрено — всей бригаде (мастер приедет в новый день),
  // отклонено — тому, кто просил, с комментарием менеджера.
  try {
    const { sendPushToUsers } = await import('@/lib/push/server');
    if (input.decision === 'approve') {
      const crewIds = await getCrewIds(decided.workLogId, decided.masterIdOfOrder);
      await sendPushToUsers(crewIds, {
        title: 'Перенос одобрен',
        body: `${decided.objectName ?? 'Выезд'} → ${fmtMsk(decided.toAt)}`,
        url: `/master/visits/${decided.workLogId}`,
        tag: `wo-moved-${decided.workLogId}`,
      });
    } else {
      await sendPushToUsers([decided.requestedById], {
        title: 'Перенос отклонён',
        body: `${decided.objectName ?? 'Выезд'}: остаётся ${fmtMsk(decided.fromAt)}${comment ? `. ${comment}` : ''}`.slice(
          0,
          240,
        ),
        url: `/master/visits/${decided.workLogId}`,
        tag: `wo-resched-${decided.workLogId}`,
      });
    }
  } catch (err) {
    console.warn('[reschedule-decide] push failed:', err);
  }

  return {
    ok: true,
    data: { workLogId: decided.workLogId, dealId: decided.dealId, objectId: decided.objectId },
  };
}

// ─── Списки ───────────────────────────────────────────────────────

export type RescheduleRequestView = {
  id: string;
  workLogId: string;
  dealId: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  masterName: string;
  clientName: string;
  objectName: string | null;
  objectAddress: string | null;
  fromAt: string | null;
  toAt: string;
  reason: string;
  createdAt: string;
  decisionComment: string | null;
  decidedAt: string | null;
};

/** Висящие запросы (для дашборда менеджера), старые сверху. */
export async function listPendingRescheduleRequests(): Promise<RescheduleRequestView[]> {
  return listRequests({ pendingOnly: true });
}

/** Последний запрос по наряду (для экрана мастера: «ждёт ответа» / «отклонён: …»). */
export async function latestRequestForWorkLog(workLogId: string): Promise<RescheduleRequestView | null> {
  const rows = await listRequests({ workLogIds: [workLogId], limit: 1 });
  return rows[0] ?? null;
}

async function listRequests(opts: {
  pendingOnly?: boolean;
  workLogIds?: string[];
  limit?: number;
}): Promise<RescheduleRequestView[]> {
  const conds = [];
  if (opts.pendingOnly) conds.push(eq(workOrderRescheduleRequests.status, 'pending'));
  if (opts.workLogIds?.length) conds.push(inArray(workOrderRescheduleRequests.workLogId, opts.workLogIds));
  const q = db
    .select({
      id: workOrderRescheduleRequests.id,
      workLogId: workOrderRescheduleRequests.workLogId,
      dealId: dealWorkLogs.dealId,
      status: workOrderRescheduleRequests.status,
      masterName: users.fullName,
      clientName: clients.shortName,
      objectName: clientObjects.name,
      objectAddress: clientObjects.address,
      fromAt: workOrderRescheduleRequests.fromAt,
      toAt: workOrderRescheduleRequests.toAt,
      reason: workOrderRescheduleRequests.reason,
      createdAt: workOrderRescheduleRequests.createdAt,
      decisionComment: workOrderRescheduleRequests.decisionComment,
      decidedAt: workOrderRescheduleRequests.decidedAt,
    })
    .from(workOrderRescheduleRequests)
    .innerJoin(dealWorkLogs, eq(dealWorkLogs.id, workOrderRescheduleRequests.workLogId))
    .innerJoin(deals, eq(deals.id, dealWorkLogs.dealId))
    .innerJoin(clients, eq(clients.id, deals.clientId))
    .leftJoin(clientObjects, eq(clientObjects.id, dealWorkLogs.objectId))
    .innerJoin(users, eq(users.id, workOrderRescheduleRequests.requestedById))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(
      opts.pendingOnly ? workOrderRescheduleRequests.createdAt : desc(workOrderRescheduleRequests.createdAt),
    );
  const rows = opts.limit ? await q.limit(opts.limit) : await q;
  return rows.map((r) => ({
    ...r,
    fromAt: r.fromAt ? r.fromAt.toISOString() : null,
    toAt: r.toAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
    decidedAt: r.decidedAt ? r.decidedAt.toISOString() : null,
  }));
}
