import 'server-only';

import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { getMailer } from '@/lib/mailer';
import { stuckLeadsDigestBody, type StuckLeadRow } from '@/lib/mailer/templates';
import { STAGE_COLORS } from '@/lib/lead-stages';
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
  days: number;
};

/** Найти все «зависшие» лиды по всей системе. */
export async function findStuckLeads(): Promise<StuckLeadRaw[]> {
  const result = await db.execute<{
    id: string;
    contact_name: string | null;
    contact_phone: string | null;
    contact_email: string | null;
    status: LeadStatus;
    assigned_manager_id: string | null;
    manager_email: string | null;
    manager_name: string | null;
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
      u.email AS manager_email,
      u.full_name AS manager_name,
      FLOOR(EXTRACT(EPOCH FROM (NOW() - latest.changed_at)) / 86400)::int AS days
    FROM leads l
    JOIN latest ON latest.lead_id = l.id
    LEFT JOIN users u ON u.id = l.assigned_manager_id
    WHERE
      l.status NOT IN ('won', 'lost', 'contract_signed', 'qualified')
      AND EXTRACT(EPOCH FROM (NOW() - latest.changed_at)) / 86400 >= CASE l.status
        WHEN 'new' THEN 1
        WHEN 'contacted' THEN 3
        WHEN 'proposal_sent' THEN 7
        WHEN 'works_completed' THEN 5
        ELSE 999999
      END
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
    days: r.days,
  }));
}

/** Получить активных менеджеров (для лидов без assigned_manager_id). */
async function getActiveManagers(): Promise<{ id: string; email: string; name: string }[]> {
  const result = await db.execute<{ id: string; email: string; full_name: string }>(sql`
    SELECT id, email, full_name
    FROM users
    WHERE role = 'manager' AND is_active = true
  `);
  const rows = ((result as unknown as { rows?: unknown[] }).rows ?? result) as Array<{
    id: string;
    email: string;
    full_name: string;
  }>;
  return rows.map((r) => ({ id: r.id, email: r.email, name: r.full_name }));
}

export type StuckLeadsRunResult = {
  totalStuck: number;
  emailsSent: number;
  recipients: Array<{ email: string; name: string; leadCount: number }>;
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
    return { totalStuck: 0, emailsSent: 0, recipients: [], errors: [] };
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

  // Подготовка списка получателей: { email, name, leads[] }
  type Recipient = { email: string; name: string; leads: StuckLeadRaw[] };
  const recipients: Recipient[] = [];

  // 1. Лиды с назначенным менеджером — шлём только ему
  for (const [managerId, leads] of byManager.entries()) {
    if (managerId == null) continue;
    const first = leads[0];
    if (!first.managerEmail || !first.managerName) {
      // менеджер удалён / без email — пропускаем
      continue;
    }
    recipients.push({
      email: first.managerEmail,
      name: first.managerName,
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
        recipients.push({ email: m.email, name: m.name, leads: orphanLeads });
      }
    }
  }

  if (dryRun) {
    return {
      totalStuck: stuck.length,
      emailsSent: 0,
      recipients: recipients.map((r) => ({
        email: r.email,
        name: r.name,
        leadCount: r.leads.length,
      })),
      errors: [],
    };
  }

  // Отправка
  const mailer = await getMailer();
  const errors: Array<{ email: string; error: string }> = [];
  let sent = 0;

  for (const r of recipients) {
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
    try {
      await mailer.send({
        to: r.email,
        subject: `Зависших лидов в воронке: ${r.leads.length}`,
        text,
        html,
      });
      sent++;
    } catch (err) {
      errors.push({
        email: r.email,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    totalStuck: stuck.length,
    emailsSent: sent,
    recipients: recipients.map((r) => ({
      email: r.email,
      name: r.name,
      leadCount: r.leads.length,
    })),
    errors,
  };
}
