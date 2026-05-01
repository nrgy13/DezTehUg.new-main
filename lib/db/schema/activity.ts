import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

// Канал уведомления
export const notificationChannelEnum = pgEnum('notification_channel', [
  'email',
  'telegram',
  'webpush',
  'sms',
]);

// Статус отправки
export const notificationStatusEnum = pgEnum('notification_status', [
  'queued',
  'sent',
  'failed',
]);

// Лог отправки уведомлений
export const notificationLog = pgTable(
  'notification_log',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),

    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),

    channel: notificationChannelEnum('channel').notNull(),
    subject: varchar('subject', { length: 512 }),
    body: text('body'),

    payloadJson: jsonb('payload_json'),

    status: notificationStatusEnum('status').notNull().default('queued'),
    errorMessage: text('error_message'),

    // Связанная сущность (lead, deal, document...)
    relatedEntityType: varchar('related_entity_type', { length: 64 }),
    relatedEntityId: uuid('related_entity_id'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
  },
  (t) => ({
    userIdx: index('notification_log_user_idx').on(t.userId),
    statusIdx: index('notification_log_status_idx').on(t.status),
    createdAtIdx: index('notification_log_created_at_idx').on(t.createdAt),
  })
);

// Журнал активности — для аудита и анализа паттернов поведения
// (В будущем — машинное обучение для автоматизации повторяющихся сценариев)
export const activityLog = pgTable(
  'activity_log',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),

    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),

    action: varchar('action', { length: 128 }).notNull(), // "client.create", "deal.update", "doc.generate"
    entityType: varchar('entity_type', { length: 64 }), // "client", "deal", "document"
    entityId: uuid('entity_id'),

    // Что поменялось: до/после (jsonpatch или просто два снимка)
    changesJson: jsonb('changes_json'),

    // Контекст
    ip: varchar('ip', { length: 45 }), // IPv4 или IPv6
    userAgent: text('user_agent'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('activity_log_user_idx').on(t.userId),
    entityIdx: index('activity_log_entity_idx').on(t.entityType, t.entityId),
    actionIdx: index('activity_log_action_idx').on(t.action),
    createdAtIdx: index('activity_log_created_at_idx').on(t.createdAt),
  })
);

export type NotificationChannel = (typeof notificationChannelEnum.enumValues)[number];
export type NotificationStatus = (typeof notificationStatusEnum.enumValues)[number];
export type NotificationLog = typeof notificationLog.$inferSelect;
export type NewNotificationLog = typeof notificationLog.$inferInsert;
export type ActivityLog = typeof activityLog.$inferSelect;
export type NewActivityLog = typeof activityLog.$inferInsert;
