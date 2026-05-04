import { asc } from 'drizzle-orm';
import { requireRole } from '@/lib/auth/helpers';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema/users';
import { UsersClient } from './UsersClient';

export const metadata = { title: 'Пользователи — ДезТехЮг CRM' };
export const dynamic = 'force-dynamic';

export default async function UsersAdminPage() {
  const me = await requireRole('admin');

  const list = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      phone: users.phone,
      role: users.role,
      isActive: users.isActive,
      passwordMustChange: users.passwordMustChange,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .orderBy(asc(users.fullName));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-orbitron font-bold tracking-wide text-content-primary uppercase">
          Пользователи
        </h1>
        <p className="text-content-muted mt-1 text-sm">
          Менеджеры, мастера, администраторы. При создании юзера и сбросе пароля показываем
          одноразовый временный пароль (запиши его перед закрытием — больше не покажем).
        </p>
      </div>

      <UsersClient
        currentUserId={me.id}
        users={list.map((u) => ({
          ...u,
          lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
        }))}
      />
    </div>
  );
}
