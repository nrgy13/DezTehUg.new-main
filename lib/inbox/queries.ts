import 'server-only';

import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';

// SERVER-ONLY: запросы для /manager/inbox.
// «Inbox» = активные события которые требуют реакции менеджера.
// Сейчас включает только `deal.master_date_request` (запросы переноса дат от мастеров).
// Список расширяется — добавляй сюда другие action'ы которые ждут обработки.

const INBOX_ACTIONS = [
  'deal.master_date_request',
  // в будущем: 'deal.client_complaint', 'lead.escalation', ...
] as const;

const INBOX_ACTIONS_SQL = INBOX_ACTIONS.map((a) => `'${a}'`).join(', ');

export type InboxItem = {
  id: string;
  action: string;
  createdAt: string;
  dealId: string | null;
  dealNumber: string | null;
  clientShortName: string | null;
  fromUserName: string | null;
  changesJson: Record<string, unknown> | null;
};

/**
 * Получить активные (неотмеченные) inbox-записи. Если userId передан —
 * показываем только записи по сделкам где этот юзер назначен менеджером.
 * Если userId === null (admin без фильтра) — показываем все.
 */
export async function getInboxItems(
  userId: string | null,
): Promise<InboxItem[]> {
  const userFilter = userId
    ? `AND (deals.assigned_manager_id = '${userId}'::uuid OR deals.assigned_manager_id IS NULL)`
    : '';
  const result = await db.execute<{
    id: string;
    action: string;
    created_at: Date;
    deal_id: string | null;
    deal_number: string | null;
    client_short_name: string | null;
    from_user_name: string | null;
    changes_json: Record<string, unknown> | null;
  }>(sql.raw(`
    SELECT
      a.id,
      a.action,
      a.created_at,
      deals.id              AS deal_id,
      deals.contract_number AS deal_number,
      cl.short_name         AS client_short_name,
      u.full_name           AS from_user_name,
      a.changes_json
    FROM activity_log a
    LEFT JOIN deals    ON deals.id = a.entity_id AND a.entity_type = 'deal'
    LEFT JOIN clients cl ON cl.id = deals.client_id
    LEFT JOIN users    u  ON u.id  = a.user_id
    WHERE a.action IN (${INBOX_ACTIONS_SQL})
      AND a.acknowledged_at IS NULL
      ${userFilter}
    ORDER BY a.created_at DESC
    LIMIT 200
  `));
  const rows = ((result as unknown as { rows?: unknown[] }).rows ?? result) as Array<{
    id: string;
    action: string;
    created_at: Date | string;
    deal_id: string | null;
    deal_number: string | null;
    client_short_name: string | null;
    from_user_name: string | null;
    changes_json: Record<string, unknown> | null;
  }>;
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    createdAt:
      r.created_at instanceof Date
        ? r.created_at.toISOString()
        : new Date(r.created_at).toISOString(),
    dealId: r.deal_id,
    dealNumber: r.deal_number,
    clientShortName: r.client_short_name,
    fromUserName: r.from_user_name,
    changesJson: r.changes_json,
  }));
}

/** Количество непрочитанных inbox-записей для бейджа в Sidebar. */
export async function getInboxCount(userId: string | null): Promise<number> {
  const userFilter = userId
    ? `AND (deals.assigned_manager_id = '${userId}'::uuid OR deals.assigned_manager_id IS NULL)`
    : '';
  const result = await db.execute<{ cnt: number }>(sql.raw(`
    SELECT COUNT(*)::int AS cnt
    FROM activity_log a
    LEFT JOIN deals ON deals.id = a.entity_id AND a.entity_type = 'deal'
    WHERE a.action IN (${INBOX_ACTIONS_SQL})
      AND a.acknowledged_at IS NULL
      ${userFilter}
  `));
  const rows = ((result as unknown as { rows?: unknown[] }).rows ?? result) as Array<{
    cnt: number;
  }>;
  return rows[0]?.cnt ?? 0;
}
