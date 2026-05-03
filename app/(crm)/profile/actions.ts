'use server';

import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema/users';
import { activityLog } from '@/lib/db/schema/activity';
import { auth } from '@/lib/auth';

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
