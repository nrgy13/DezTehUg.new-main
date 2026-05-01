import { requireRole } from '@/lib/auth/helpers';
import { Wrench, Calendar, ListChecks } from 'lucide-react';

export const metadata = { title: 'Мастер — ДезТехЮг CRM' };

export default async function MasterDashboard() {
  const user = await requireRole('master');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Мои выезды</h1>
        <p className="text-slate-400 mt-1">Привет, {user.name}! Здесь будет список задач от менеджера.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Сегодня" value="—" icon={Calendar} />
        <StatCard label="На неделе" value="—" icon={Wrench} />
        <StatCard label="Завершено за месяц" value="—" icon={ListChecks} />
      </div>

      <div className="bg-slate-800/50 border border-slate-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-3">Скоро тут будет:</h2>
        <ul className="text-sm text-slate-400 space-y-1.5 list-disc pl-5">
          <li>Список выездов на сегодня и завтра</li>
          <li>Адреса с навигатором</li>
          <li>Кнопка «Выезд начат / завершён»</li>
          <li>Загрузка фото после работы</li>
          <li>Календарь моих задач</li>
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
