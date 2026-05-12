/**
 * Серверная отправка web-push уведомлений.
 *
 * Используется из server actions / API routes / cron-задач:
 *   await sendPushToUser(masterUserId, {
 *     title: 'Новый выезд',
 *     body: 'Клиент: ООО Ромашка, 15.05',
 *     url: '/master/deals/abc-123',
 *   });
 *
 * Бьёт по всем зарегистрированным подпискам юзера (один мастер может иметь
 * несколько устройств). 410 Gone / 404 → удаляем подписку из БД.
 */

import 'server-only';
import webpush, { type PushSubscription } from 'web-push';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { pushSubscriptions } from '@/lib/db/schema/push';

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:noreply@deztehug.ru';

// Конфигурируем webpush один раз при загрузке модуля, но безопасно для build-time
// (если VAPID не задан — оставляем как noop, чтобы build не падал).
let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return false;
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  configured = true;
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  /** Куда переходить по клику. Абсолютный URL или относительный (path). */
  url?: string;
  /** Произвольный тег: одинаковый тег схлопывает уведомления того же типа. */
  tag?: string;
};

export type PushSendResult = {
  sent: number;
  removed: number;
  failed: number;
};

/**
 * Отправляет push всем активным подпискам юзера.
 * Подписки, на которые сервер вернул 404/410 — удаляются автоматически.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<PushSendResult> {
  if (!ensureConfigured()) {
    console.warn('[push] VAPID keys не настроены, пропускаю отправку');
    return { sent: 0, removed: 0, failed: 0 };
  }

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  if (subs.length === 0) {
    return { sent: 0, removed: 0, failed: 0 };
  }

  const json = JSON.stringify(payload);
  let sent = 0;
  let removed = 0;
  let failed = 0;

  await Promise.all(
    subs.map(async (s) => {
      const subscription: PushSubscription = {
        endpoint: s.endpoint,
        keys: { p256dh: s.p256dh, auth: s.auth },
      };
      try {
        await webpush.sendNotification(subscription, json, { TTL: 60 * 60 * 24 });
        sent++;
        // Обновим last_used_at — для отладки и очистки протухших подписок.
        await db
          .update(pushSubscriptions)
          .set({ lastUsedAt: new Date() })
          .where(eq(pushSubscriptions.id, s.id));
      } catch (err) {
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          // Подписка протухла — удаляем.
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id));
          removed++;
        } else {
          failed++;
          console.error('[push] sendNotification failed:', status, err);
        }
      }
    }),
  );

  return { sent, removed, failed };
}

/** Сахар: отправить нескольким юзерам сразу. Параллельно. */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload,
): Promise<PushSendResult> {
  const results = await Promise.all(userIds.map((id) => sendPushToUser(id, payload)));
  return results.reduce(
    (acc, r) => ({
      sent: acc.sent + r.sent,
      removed: acc.removed + r.removed,
      failed: acc.failed + r.failed,
    }),
    { sent: 0, removed: 0, failed: 0 },
  );
}

/** Проверка, настроены ли VAPID-ключи. Используется в UI для скрытия тумблера. */
export function isPushConfigured(): boolean {
  return !!(VAPID_PUBLIC && VAPID_PRIVATE);
}
