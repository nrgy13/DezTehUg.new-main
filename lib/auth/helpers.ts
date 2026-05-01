import { redirect } from 'next/navigation';
import { auth } from './index';
import type { UserRole } from '@/lib/db/schema/users';

/**
 * Получить текущего пользователя в server component / action.
 * Возвращает null если не авторизован.
 */
export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}

/**
 * Требует авторизации. Если не авторизован — редирект на /login.
 */
export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

/**
 * Требует определённую роль. Если нет — редирект на /login.
 * Admin имеет доступ ко всему.
 */
export async function requireRole(...allowedRoles: UserRole[]) {
  const user = await requireAuth();
  if (user.role === 'admin') return user; // admin имеет доступ ко всему
  if (!allowedRoles.includes(user.role)) {
    redirect('/login?error=forbidden');
  }
  return user;
}
