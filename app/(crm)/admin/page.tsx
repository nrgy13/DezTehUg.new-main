import { requireRole } from '@/lib/auth/helpers';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema/users';
import { clients } from '@/lib/db/schema/clients';
import { sql } from 'drizzle-orm';
import { Users, UserCog, Wrench, FileText } from 'lucide-react';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { PageTitle } from '@/components/crm/PageTitle';

export const metadata = { title: 'Админ — ДезТехЮг CRM' };

export default async function AdminDashboard() {
  const user = await requireRole('admin');

  const [usersCount] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
  const [clientsCount] = await db.select({ count: sql<number>`count(*)::int` }).from(clients);

  return (
    <div className="space-y-6">
      <div>
        <PageTitle>Админ-дашборд</PageTitle>
        <p className="text-content-muted mt-1 text-sm">
          Привет, {user.name}! Это панель администратора.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Пользователей" value={usersCount?.count ?? 0} icon={UserCog} />
        <StatCard label="Клиентов" value={clientsCount?.count ?? 0} icon={Users} />
        <StatCard label="Услуг" value="—" icon={Wrench} hint="загрузится позже" />
        <StatCard label="Шаблонов" value="—" icon={FileText} hint="загрузится позже" />
      </div>

      <CyberpunkCard variant="default" hoverEffect={false} className="p-6">
        <h2 className="text-base font-orbitron font-semibold tracking-wider text-content-primary mb-3 uppercase">
          Что дальше
        </h2>
        <ul className="text-sm text-content-secondary space-y-1.5 list-disc pl-5">
          <li>
            Этап 1-3 — БД, Auth, каркас панели —{' '}
            <span className="text-poison-green font-semibold">завершён</span>
          </li>
          <li>Этап 4 — модуль клиентов и сделок — далее</li>
          <li>Этап 5 — интеграция с n8n (заявки с сайта)</li>
          <li>Этап 6 — документооборот (договоры, акты, КП)</li>
        </ul>
      </CyberpunkCard>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
}) {
  return (
    <CyberpunkCard variant="default" className="p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-orbitron tracking-wider text-content-muted uppercase">{label}</span>
        <Icon className="w-4 h-4 text-content-muted" />
      </div>
      <div className="text-2xl font-orbitron font-bold text-content-primary">{value}</div>
      {hint && <div className="text-xs text-content-muted mt-1">{hint}</div>}
    </CyberpunkCard>
  );
}
