import { pgTable, uuid, varchar, text, boolean, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Роли пользователей CRM
export const userRoleEnum = pgEnum('user_role', ['admin', 'manager', 'master']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash'), // null до первой установки пароля
  fullName: varchar('full_name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 32 }),
  role: userRoleEnum('role').notNull(),

  // Telegram для уведомлений (привязывается через бота).
  // Юзер генерит на /profile одноразовый telegram_link_token, переходит в @bot
  // и шлёт /start <token>. Webhook сохраняет chat_id и обнуляет токен.
  telegramChatId: varchar('telegram_chat_id', { length: 64 }),
  telegramUsername: varchar('telegram_username', { length: 64 }),
  telegramLinkedAt: timestamp('telegram_linked_at', { withTimezone: true }),
  telegramLinkToken: varchar('telegram_link_token', { length: 64 }),
  telegramLinkTokenExpiresAt: timestamp('telegram_link_token_expires_at', {
    withTimezone: true,
  }),

  // Управление активностью
  isActive: boolean('is_active').notNull().default(true),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),

  // Принудительная смена пароля при следующем входе
  // (true для seed-юзеров с временным `welcome123`, для новых юзеров заведённых админом — true)
  passwordMustChange: boolean('password_must_change').notNull().default(false),

  // Токен для установки/сброса пароля через email
  passwordResetToken: varchar('password_reset_token', { length: 128 }),
  passwordResetExpiresAt: timestamp('password_reset_expires_at', { withTimezone: true }),

  // Last login для логов
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Сессии Auth.js
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  sessionToken: varchar('session_token', { length: 255 }).notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type UserRole = (typeof userRoleEnum.enumValues)[number];
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
