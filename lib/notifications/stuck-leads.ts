import 'server-only';

import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { getMailer } from '@/lib/mailer';
import { stuckLeadsDigestBody, type StuckLeadRow } from '@/lib/mailer/templates';
import { STAGE_COLORS } from '@/lib/lead-stages';
import { sendTelegramMessage } from '@/lib/notifications/telegram';
import { getThresholds, THRESHOLD_STATUSES } from '@/lib/notifications/thresholds';
import type { LeadStatus } from '@/lib/db/schema/leads';

// SERVER-ONLY: проверка зависших лидов и рассылка дайджеста менеджерам.
// Вызывается из /api/cron/stuck-leads или вручную из скрипта.
//
// «Зависший» лид — тот, что слишком долго стоит на текущей стадии.
// Пороги взяты из STALE_THRESHOLDS (lib/lead-stages.ts), но здесь захардкожены
// в SQL-CASE для атомарного запроса. Если изменишь STALE_THRESHOLDS —
// поправь и SQL ниже (см. sprint4-decisions.md, D-2).

type StuckLeadRaw = {
  id: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  status: LeadStatus;
  assignedManagerId: string | null;
  managerEmail: string | null;
  managerName: string | null;
  managerTelegramChatId: string | null;
  days: number;
};

/** Найти все «зависшие» лиды по всей системе. */
export async function findStuckLeads(): Promise<StuckLeadRaw[]> {
  const thresholds = await getThresholds();

  // Динамически собираем CASE WHEN — пороги настраиваются в /admin/settings.
  // Безопасно: статусы из whitelist (THRESHOLD_STATUSES), значения — числа.
  const caseStatements = THRESHOLD_STATUSES
    .map((s) => `WHEN '${s}' THEN ${thresholds[s].stale}`)
    .join(' ');
  const stalenessCase = sql.raw(`CASE l.status ${caseStatements} ELSE 999999 END`);

  const result = await db.execute<{
    id: string;
    contact_name: string | null;
    contact_phone: string | null;
    contact_email: string | null;
    status: LeadStatus;
    assigned_manager_id: string | null;
    manager_email: string | null;
    manager_name: string | null;
    manager_telegram_chat_id: string | null;
    days: number;
  }>(sql`
    WITH latest AS (
      SELECT DISTINCT ON (lead_id) lead_id, changed_at
      FROM lead_status_history
      ORDER BY lead_id, changed_at DESC
    )
    SELECT
      l.id,
      l.contact_name,
      l.contact_phone,
      l.contact_email,
      l.status,
      l.assigned_manager_id,
      u.email             AS manager_email,
      u.full_name         AS manager_name,
      u.telegram_chat_id  AS manager_telegram_chat_id,
      FLOOR(EXTRACT(EPOCH FROM (NOW() - latest.changed_at)) / 86400)::int AS days
    FROM leads l
    JOIN latest ON latest.lead_id = l.id
    LEFT JOIN users u ON u.id = l.assigned_manager_id
    WHERE
      l.status NOT IN ('won', 'lost')
      AND EXTRACT(EPOCH FROM (NOW() - latest.changed_at)) / 86400 >= ${stalenessCase}
    ORDER BY l.assigned_manager_id NULLS LAST, days DESC
  `);

  const rows = ((result as unknown as { rows?: unknown[] }).rows ?? result) as Array<{
    id: string;
    contact_name: string | null;
    contact_phone: string | null;
    contact_email: string | null;
    status: LeadStatus;
    assigned_manager_id: string | null;
    manager_email: string | null;
    manager_name: string | null;
    manager_telegram_chat_id: string | null;
    days: number;
  }>;

  return rows.map((r) => ({
    id: r.id,
    contactName: r.contact_name,
    contactPhone: r.contact_phone,
    contactEmail: r.contact_email,
    status: r.status,
    assignedManagerId: r.assigned_manager_id,
    managerEmail: r.manager_email,
    managerName: r.manager_name,
    managerTelegramChatId: r.manager_telegram_chat_id,
    days: r.days,
  }));
}

/** Получить активных менеджеров (для лидов без assigned_manager_id). */
async function getActiveManagers(): Promise<
  { id: string; email: string; name: string; telegramChatId: string | null }[]
> {
  const result = await db.execute<{
    id: string;
    email: string;
    full_name: string;
    telegram_chat_id: string | null;
  }>(sql`
    SELECT id, email, full_name, telegram_chat_id
    FROM users
    WHERE role = 'manager' AND is_active = true
  `);
  const rows = ((result as unknown as { rows?: unknown[] }).rows ?? result) as Array<{
    id: string;
    email: string;
    full_name: string;
    telegram_chat_id: string | null;
  }>;
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    name: r.full_name,
    telegramChatId: r.telegram_chat_id,
  }));
}

/** Краткий текст для Telegram-уведомления (plain text, без HTML). */
function buildTelegramDigest(name: string, leads: StuckLeadRaw[]): string {
  const TOP = 10;
  const head = `⚠️ Привет, ${name}! Зависших лидов в воронке: ${leads.length}\n\n`;
  const items = leads
    .slice(0, TOP)
    .map((l, i) => {
      const who = l.contactName || l.contactPhone || l.contactEmail || 'Без имени';
      const stage = STAGE_COLORS[l.status]?.label ?? l.status;
      return `${i + 1}. ${who} — ${l.days} дн. в стадии «${stage}»`;
    })
    .join('\n');
  const more = leads.length > TOP ? `\n\n…и ещё ${leads.length - TOP}.` : '';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://crm.дезтехюг.рф';
  const footer = `\n\nКанбан: ${appUrl}/manager/leads/board`;
  return head + items + more + footer;
}

export type StuckLeadsRunResult = {
  totalStuck: number;
  emailsSent: number;
  telegramSent: number;
  recipients: Array<{
    email: string;
    name: string;
    leadCount: number;
    channel: 'telegram' | 'email';
  }>;
  errors: Array<{ email: string; error: string }>;
};

/**
 * Полный цикл: найти зависшие лиды → сгруппировать по менеджеру → разослать дайджесты.
 * Лиды без assigned_manager_id рассылаются всем активным менеджерам.
 *
 * @param dryRun если true — не отправляет, только считает (для отладки)
 */
export async function runStuckLeadsCheck(
  options: { dryRun?: boolean } = {},
): Promise<StuckLeadsRunResult> {
  const { dryRun = false } = options;
  const stuck = await findStuckLeads();

  if (stuck.length === 0) {
    return {
      totalStuck: 0,
      emailsSent: 0,
      telegramSent: 0,
      recipients: [],
      errors: [],
    };
  }

  // Группируем: assignedManagerId → лиды.
  // Лиды без менеджера складываем в null-ключ.
  const byManager = new Map<string | null, StuckLeadRaw[]>();
  for (const lead of stuck) {
    const key = lead.assignedManagerId;
    const arr = byManager.get(key) ?? [];
    arr.push(lead);
    byManager.set(key, arr);
  }

  type Recipient = {
    email: string;
    name: string;
    telegramChatId: string | null;
    leads: StuckLeadRaw[];
  };
  const recipients: Recipient[] = [];

  // 1. Лиды с назначенным менеджером — шлём только ему
  for (const [managerId, leads] of Array.from(byManager.entries())) {
    if (managerId == null) continue;
    const first = leads[0];
    if (!first.managerEmail || !first.managerName) continue; // менеджер удалён
    recipients.push({
      email: first.managerEmail,
      name: first.managerName,
      telegramChatId: first.managerTelegramChatId,
      leads,
    });
  }

  // 2. Лиды без менеджера — шлём всем активным менеджерам
  const orphanLeads = byManager.get(null) ?? [];
  if (orphanLeads.length > 0) {
    const activeManagers = await getActiveManagers();
    for (const m of activeManagers) {
      const existing = recipients.find((r) => r.email === m.email);
      if (existing) {
        existing.leads = [...existing.leads, ...orphanLeads];
      } else {
        recipients.push({
          email: m.email,
          name: m.name,
          telegramChatId: m.telegramChatId,
          leads: orphanLeads,
        });
      }
    }
  }

  if (dryRun) {
    return {
      totalStuck: stuck.length,
      emailsSent: 0,
      telegramSent: 0,
      recipients: recipients.map((r) => ({
        email: r.email,
        name: r.name,
        leadCount: r.leads.length,
        channel: r.telegramChatId ? ('telegram' as const) : ('email' as const),
      })),
      errors: [],
    };
  }

  // Отправка. Если у юзера есть TG → шлём в TG. Иначе fallback на email.
  // Email-канал остаётся «резервом», ничего не дублируем.
  const mailer = await getMailer();
  const errors: Array<{ email: string; error: string }> = [];
  let emailsSent = 0;
  let telegramSent = 0;

  for (const r of recipients) {
    if (r.telegramChatId) {
      const text = buildTelegramDigest(r.name, r.leads);
      try {
        const ok = await sendTelegramMessage(r.telegramChatId, text, {
          disableWebPagePreview: true,
        });
        if (ok) {
          telegramSent++;
        } else {
          // TG отказал (заблокировали бота, чат удалён) — fallback на email
          await sendEmailDigest(mailer, r);
          emailsSent++;
        }
      } catch (err) {
        errors.push({
          email: r.email,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    } else {
      try {
        await sendEmailDigest(mailer, r);
        emailsSent++;
      } catch (err) {
        errors.push({
          email: r.email,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  return {
    totalStuck: stuck.length,
    emailsSent,
    telegramSent,
    recipients: recipients.map((r) => ({
      email: r.email,
      name: r.name,
      leadCount: r.leads.length,
      channel: r.telegramChatId ? ('telegram' as const) : ('email' as const),
    })),
    errors,
  };
}

async function sendEmailDigest(
  mailer: Awaited<ReturnType<typeof getMailer>>,
  r: { email: string; name: string; leads: StuckLeadRaw[] },
): Promise<void> {
  const tableRows: StuckLeadRow[] = r.leads.map((l) => ({
    id: l.id,
    contactName: l.contactName,
    contactPhone: l.contactPhone,
    contactEmail: l.contactEmail,
    statusLabel: STAGE_COLORS[l.status]?.label ?? l.status,
    days: l.days,
  }));
  const { text, html } = stuckLeadsDigestBody({
    managerName: r.name,
    leads: tableRows,
  });
  await mailer.send({
    to: r.email,
    subject: `Зависших лидов в воронке: ${r.leads.length}`,
    text,
    html,
  });
}
