'use server';

import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema/users';
import { activityLog } from '@/lib/db/schema/activity';
import { auth } from '@/lib/auth';
import { getBotUsername } from '@/lib/notifications/telegram';

const BCRYPT_ROUNDS = 10;

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Введите текущий пароль').max(128),
    newPassword: z
      .string()
      .min(8, 'Минимум 8 символов')
      .max(128, 'Максимум 128 символов'),
    confirmPassword: z.string().min(1).max(128),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Пароли не совпадают',
    path: ['confirmPassword'],
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: 'Новый пароль должен отличаться от текущего',
    path: ['newPassword'],
  });

export type ChangePasswordResult =
  | { ok: true }
  | { ok: false; error: string; field?: 'currentPassword' | 'newPassword' | 'confirmPassword' };

export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<ChangePasswordResult> {
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    return {
      ok: false,
      error: first.message,
      field: first.path[0] as 'currentPassword' | 'newPassword' | 'confirmPassword',
    };
  }

  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: 'Не авторизован' };
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user || !user.passwordHash || !user.isActive) {
    return { ok: false, error: 'Пользователь не найден' };
  }

  const isValid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!isValid) {
    return { ok: false, error: 'Текущий пароль неверный', field: 'currentPassword' };
  }

  const newHash = await bcrypt.hash(parsed.data.newPassword, BCRYPT_ROUNDS);

  await db
    .update(users)
    .set({
      passwordHash: newHash,
      passwordMustChange: false,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  // activity_log запись
  const headersList = await headers();
  const ip = headersList.get('x-forwarded-for')?.split(',')[0].trim() ?? null;
  const userAgent = headersList.get('user-agent') ?? null;

  await db.insert(activityLog).values({
    userId: user.id,
    action: 'user.password_changed',
    entityType: 'user',
    entityId: user.id,
    ip,
    userAgent,
  });

  return { ok: true };
}

// =============================================================
// TELEGRAM привязка (Sprint 5 эпик C)
// =============================================================

const TELEGRAM_LINK_TOKEN_TTL_MIN = 30;

export type TelegramLinkResult =
  | { ok: true; deepLink: string; expiresAt: string }
  | { ok: false; error: string };

/**
 * Сгенерировать одноразовый токен и вернуть deep-link на @bot?start=<token>.
 * Юзер открывает ссылку, шлёт /start, бот привязывает chat_id (см. linkUserByToken).
 */
export async function generateTelegramLinkToken(): Promise<TelegramLinkResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: 'Не авторизован' };

  let botUsername: string;
  try {
    botUsername = await getBotUsername();
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? `Бот не настроен: ${err.message}`
          : 'Не удалось получить username бота',
    };
  }

  const token = randomBytes(24).toString('base64url'); // 32 символа
  const expiresAt = new Date(Date.now() + TELEGRAM_LINK_TOKEN_TTL_MIN * 60 * 1000);

  await db
    .update(users)
    .set({
      telegramLinkToken: token,
      telegramLinkTokenExpiresAt: expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(users.id, session.user.id));

  revalidatePath('/profile');

  return {
    ok: true,
    deepLink: `https://t.me/${botUsername}?start=${token}`,
    expiresAt: expiresAt.toISOString(),
  };
}

/**
 * Отвязать Telegram-чат от профиля. После этого юзер перестаёт получать
 * уведомления в TG (но email-fallback продолжит работать).
 */
export async function unlinkTelegram(): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: 'Не авторизован' };

  await db
    .update(users)
    .set({
      telegramChatId: null,
      telegramUsername: null,
      telegramLinkedAt: null,
      telegramLinkToken: null,
      telegramLinkTokenExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, session.user.id));

  const headersList = await headers();
  const ip = headersList.get('x-forwarded-for')?.split(',')[0].trim() ?? null;
  const userAgent = headersList.get('user-agent') ?? null;
  await db.insert(activityLog).values({
    userId: session.user.id,
    action: 'user.telegram_unlink',
    entityType: 'user',
    entityId: session.user.id,
    ip,
    userAgent,
  });

  revalidatePath('/profile');
  return { ok: true };
}
