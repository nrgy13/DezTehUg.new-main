import { requireRole } from '@/lib/auth/helpers';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema/users';
import { clients } from '@/lib/db/schema/clients';
import { sql } from 'drizzle-orm';
import { Users, UserCog, Wrench, FileText } from 'lucide-react';

export const metadata = { title: 'Админ — ДезТехЮг CRM' };

export default async function AdminDashboard() {
  const user = await requireRole('admin');

  const [usersCount] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
  const [clientsCount] = await db.select({ count: sql<number>`count(*)::int` }).from(clients);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Админ-дашборд</h1>
        <p className="text-slate-400 mt-1">Привет, {user.name}! Это панель администратора.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Пользователей" value={usersCount?.count ?? 0} icon={UserCog} />
        <StatCard label="Клиентов" value={clientsCount?.count ?? 0} icon={Users} />
        <StatCard label="Услуг" value="—" icon={Wrench} hint="загрузится позже" />
        <StatCard label="Шаблонов" value="—" icon={FileText} hint="загрузится позже" />
      </div>

      <div className="bg-slate-800/50 border border-slate-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-3">Что дальше</h2>
        <ul className="text-sm text-slate-400 space-y-1.5 list-disc pl-5">
          <li>Этап 1-3 — БД, Auth, каркас панели — <span className="text-emerald-400">в работе</span></li>
          <li>Этап 4 — модуль клиентов и сделок — далее</li>
          <li>Этап 5 — интеграция с n8n (заявки с сайта)</li>
          <li>Этап 6 — документооборот (договоры, акты, КП)</li>
        </ul>
      </div>
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
    <div className="bg-slate-800/50 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-slate-400">{label}</span>
        <Icon className="w-4 h-4 text-slate-500" />
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}
