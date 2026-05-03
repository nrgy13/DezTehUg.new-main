import { requireAuth } from '@/lib/auth/helpers';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { PasswordForm } from './PasswordForm';

export const dynamic = 'force-dynamic';

const ROLE_LABELS: Record<'admin' | 'manager' | 'master', string> = {
  admin: 'Администратор',
  manager: 'Менеджер',
  master: 'Мастер',
};

export default async function ProfilePage() {
  const user = await requireAuth();

  return (
    <div className="max-w-xl">
      <h1 className="text-3xl font-orbitron font-bold tracking-wide text-content-primary mb-1 uppercase">
        Профиль
      </h1>
      <p className="text-sm text-content-muted mb-6">
        {user.name} · {ROLE_LABELS[user.role]} · {user.email}
      </p>

      <CyberpunkCard variant="default" hoverEffect={false} className="p-6">
        <div className="mb-5">
          <h2 className="text-lg font-orbitron font-semibold text-content-primary mb-1 uppercase tracking-wider">
            Смена пароля
          </h2>
          <p className="text-sm text-content-muted">
            Минимум 8 символов. Новый пароль не должен совпадать с текущим.
          </p>
        </div>
        <PasswordForm userRole={user.role} mustChange={user.passwordMustChange} />
      </CyberpunkCard>
    </div>
  );
}
