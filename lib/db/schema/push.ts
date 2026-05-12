import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

// Sprint 6 · PWA — web-push subscriptions.
// Один юзер может иметь несколько подписок (мобила + рабочий ноут + домашний браузер).
export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // endpoint — URL который выдаёт push-сервер браузера (FCM/Mozilla/Apple).
    // По нему мы делаем POST с зашифрованным payload через web-push lib.
    endpoint: text('endpoint').notNull().unique(),
    // Публичный ключ устройства (p256dh) и auth secret — для шифрования полезной нагрузки.
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  },
  (t) => ({
    userIdx: index('push_subscriptions_user_idx').on(t.userId),
  }),
);

export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;
export type NewPushSubscription = typeof pushSubscriptions.$inferInsert;
