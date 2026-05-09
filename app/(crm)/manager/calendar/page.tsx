import { requireRole } from '@/lib/auth/helpers';
import { getDealEvents, groupByWeek } from '@/lib/calendar/deal-events';
import { CalendarList } from '@/components/crm/CalendarList';

export const metadata = { title: 'Календарь — ДезТехЮг CRM' };
export const dynamic = 'force-dynamic';

export default async function ManagerCalendarPage() {
  const user = await requireRole('manager');
  const events = await getDealEvents({
    kind: 'manager',
    userId: user.id,
    isAdmin: user.role === 'admin',
  });
  const groups = groupByWeek(events);

  const todayCount = events.filter((e) => e.health === 'today').length;
  const soonCount = events.filter((e) => e.health === 'soon').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-orbitron font-bold tracking-wide text-content-primary uppercase">
          Календарь выездов
        </h1>
        <p className="text-content-muted mt-1 text-sm">
          {user.role === 'admin'
            ? 'Все запланированные выезды (как admin — видишь всё).'
            : 'Выезды по сделкам, где ты ответственный менеджер.'}
          {' '}
          Сегодня: <strong>{todayCount}</strong>, в течение недели: <strong>{soonCount}</strong>.
        </p>
      </div>
      <CalendarList groups={groups} dealHrefBase="/manager/deals" />
    </div>
  );
}
