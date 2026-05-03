import { requireRole } from '@/lib/auth/helpers';
import { Wrench, Calendar, ListChecks } from 'lucide-react';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';

export const metadata = { title: 'Мастер — ДезТехЮг CRM' };

export default async function MasterDashboard() {
  const user = await requireRole('master');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-orbitron font-bold tracking-wide text-content-primary uppercase">
          Мои выезды
        </h1>
        <p className="text-content-muted mt-1 text-sm">
          Привет, {user.name}! Здесь будет список задач от менеджера.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Сегодня" value="—" icon={Calendar} />
        <StatCard label="На неделе" value="—" icon={Wrench} />
        <StatCard label="Завершено за месяц" value="—" icon={ListChecks} />
      </div>

      <CyberpunkCard variant="default" hoverEffect={false} className="p-6">
        <h2 className="text-base font-orbitron font-semibold tracking-wider text-content-primary mb-3 uppercase">
          Скоро тут будет
        </h2>
        <ul className="text-sm text-content-secondary space-y-1.5 list-disc pl-5">
          <li>Список выездов на сегодня и завтра</li>
          <li>Адреса с навигатором</li>
          <li>Кнопка «Выезд начат / завершён»</li>
          <li>Загрузка фото после работы</li>
          <li>Календарь моих задач</li>
        </ul>
      </CyberpunkCard>
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
    <CyberpunkCard variant="default" className="p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-orbitron tracking-wider text-content-muted uppercase">{label}</span>
        <Icon className="w-4 h-4 text-content-muted" />
      </div>
      <div className="text-2xl font-orbitron font-bold text-content-primary">{value}</div>
    </CyberpunkCard>
  );
}
