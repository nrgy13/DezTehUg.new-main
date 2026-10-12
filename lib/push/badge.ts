/**
 * Цифра на иконке приложения (PWA Badging API, 10.2026 — «как на worka»).
 *
 * Считается ОДНОЙ серверной функцией и для push, и для открытого приложения,
 * чтобы число на иконке совпадало с тем, что юзер видит внутри:
 * - мастер — его активные наряды (planned + in_progress), включая те, где он напарник;
 * - менеджер / админ — новые необработанные заявки (status = 'new') + непрочитанные
 *   записи «Входящих» (запросы мастеров на перенос дат).
 * Неактивный или несуществующий юзер — 0.
 *
 * Где не работает: iOS — только PWA с экрана «Домой» и с разрешёнными уведомлениями;
 * Android — зависит от лаунчера; тихих web-push нет, поэтому на телефоне цифра
 * обновляется при следующем push или открытии приложения.
 */

import 'server-only';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema/users';
import { leads } from '@/lib/db/schema/leads';
import { dealWorkLogs } from '@/lib/db/schema/deals';
import { getInboxCount } from '@/lib/inbox/queries';
import { workLogHasMember } from '@/lib/visits/crew';

/** Потолок, который браузеры гарантированно рисуют; дальше смысла нет. */
const BADGE_MAX = 99999;

export async function getBadgeCount(userId: string): Promise<number> {
  const [u] = await db
    .select({ role: users.role, isActive: users.isActive })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!u || !u.isActive) return 0;

  if (u.role === 'master') {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(dealWorkLogs)
      .where(
        and(inArray(dealWorkLogs.status, ['planned', 'in_progress']), workLogHasMember(userId)),
      );
    return Math.min(row?.n ?? 0, BADGE_MAX);
  }

  // manager / admin: как в CRM — заявки в статусе «новая» + «Входящие» (админ видит все).
  const [[leadRow], inbox] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(leads)
      .where(eq(leads.status, 'new')),
    getInboxCount(u.role === 'admin' ? null : userId),
  ]);
  return Math.min((leadRow?.n ?? 0) + inbox, BADGE_MAX);
}
