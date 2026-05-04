'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '@/lib/db';
import { users, userRoleEnum, type UserRole } from '@/lib/db/schema/users';
import { activityLog } from '@/lib/db/schema/activity';
import { auth } from '@/lib/auth';

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

async function getAdmin() {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.role !== 'admin') return null;
  return session.user;
}

async function logActivity(
  userId: string,
  action: string,
  entityId: string,
  changes?: unknown,
) {
  const headersList = await headers();
  await db.insert(activityLog).values({
    userId,
    action,
    entityType: 'user',
    entityId,
    changesJson: (changes as object) ?? null,
    ip: headersList.get('x-forwarded-for')?.split(',')[0].trim() ?? null,
    userAgent: headersList.get('user-agent') ?? null,
  });
}

/**
 * Генерирует временный пароль 12 chars (ascii letters + digits + 2 special).
 * Используется при создании юзера и при reset.
 */
function generateTempPassword(): string {
  const buf = randomBytes(12);
  // base64url + дополнить специальными чтобы пройти любые требования
  const base = buf.toString('base64url').slice(0, 10);
  return `${base}!2`;
}

const createSchema = z.object({
  email: z.string().email().max(255),
  fullName: z.string().min(2).max(255),
  phone: z.string().max(32).optional().or(z.literal('')),
  role: z.enum(userRoleEnum.enumValues),
});

export async function createUser(
  input: unknown,
): Promise<Result<{ id: string; tempPassword: string }>> {
  const actor = await getAdmin();
  if (!actor) return { ok: false, error: 'Доступ только для администратора' };

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
  const data = parsed.data;

  const email = data.email.trim().toLowerCase();

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing.length > 0) {
    return { ok: false, error: 'Юзер с таким email уже существует' };
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  const [created] = await db
    .insert(users)
    .values({
      email,
      fullName: data.fullName.trim(),
      phone: data.phone?.trim() || null,
      role: data.role,
      passwordHash,
      passwordMustChange: true,
      isActive: true,
    })
    .returning({ id: users.id });

  await logActivity(actor.id, 'user.create', created.id, {
    email,
    fullName: data.fullName,
    role: data.role,
  });

  revalidatePath('/admin/users');
  return { ok: true, data: { id: created.id, tempPassword } };
}

const updateSchema = z.object({
  fullName: z.string().min(2).max(255),
  phone: z.string().max(32).optional().or(z.literal('')),
  role: z.enum(userRoleEnum.enumValues),
  isActive: z.boolean(),
});

export async function updateUser(id: string, input: unknown): Promise<Result> {
  const actor = await getAdmin();
  if (!actor) return { ok: false, error: 'Доступ только для администратора' };

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
  const data = parsed.data;

  const existing = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (existing.length === 0) return { ok: false, error: 'Юзер не найден' };

  // Защита: admin не может разлогинить сам себя
  if (id === actor.id && !data.isActive) {
    return { ok: false, error: 'Нельзя деактивировать самого себя' };
  }
  if (id === actor.id && data.role !== 'admin') {
    return { ok: false, error: 'Нельзя сменить свою роль с admin' };
  }

  await db
    .update(users)
    .set({
      fullName: data.fullName.trim(),
      phone: data.phone?.trim() || null,
      role: data.role,
      isActive: data.isActive,
      updatedAt: new Date(),
    })
    .where(eq(users.id, id));

  await logActivity(actor.id, 'user.update', id, data);
  revalidatePath('/admin/users');
  return { ok: true, data: undefined };
}

export async function resetUserPassword(
  id: string,
): Promise<Result<{ tempPassword: string }>> {
  const actor = await getAdmin();
  if (!actor) return { ok: false, error: 'Доступ только для администратора' };

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1);
  if (existing.length === 0) return { ok: false, error: 'Юзер не найден' };

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  await db
    .update(users)
    .set({
      passwordHash,
      passwordMustChange: true,
      passwordResetToken: null,
      passwordResetExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, id));

  await logActivity(actor.id, 'user.password_reset', id, {});
  revalidatePath('/admin/users');
  return { ok: true, data: { tempPassword } };
}
