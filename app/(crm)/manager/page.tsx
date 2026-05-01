import { requireRole } from '@/lib/auth/helpers';
import { Inbox, Users, Briefcase, FileText } from 'lucide-react';

export const metadata = { title: 'Менеджер — ДезТехЮг CRM' };

export default async function ManagerDashboard() {
  const user = await requireRole('manager');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Дашборд менеджера</h1>
        <p className="text-slate-400 mt-1">Привет, {user.name}! Здесь будут твои заявки, клиенты и сделки.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Новые заявки" value="—" icon={Inbox} />
        <StatCard label="Клиенты" value="—" icon={Users} />
        <StatCard label="Активные договоры" value="—" icon={Briefcase} />
        <StatCard label="Документов готовится" value="—" icon={FileText} />
      </div>

      <div className="bg-slate-800/50 border border-slate-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-3">Скоро тут будет:</h2>
        <ul className="text-sm text-slate-400 space-y-1.5 list-disc pl-5">
          <li>Канбан заявок (новая → согласование → договор → оплачено)</li>
          <li>Карточки клиентов с реквизитами и историей</li>
          <li>Создание договоров по шаблонам с автозаполнением</li>
          <li>Календарь работ с назначением мастеров</li>
        </ul>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="bg-slate-800/50 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-slate-400">{label}</span>
        <Icon className="w-4 h-4 text-slate-500" />
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  );
}
