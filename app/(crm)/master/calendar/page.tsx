import { requireRole } from '@/lib/auth/helpers';
import { getDealEvents, groupByWeek } from '@/lib/calendar/deal-events';
import { CalendarList } from '@/components/crm/CalendarList';

export const metadata = { title: 'Календарь — ДезТехЮг CRM' };
export const dynamic = 'force-dynamic';

export default async function MasterCalendarPage() {
  const user = await requireRole('master');
  const events = await getDealEvents({ kind: 'master', userId: user.id });
  const groups = groupByWeek(events);

  const todayCount = events.filter((e) => e.health === 'today').length;
  const soonCount = events.filter((e) => e.health === 'soon').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-orbitron font-bold tracking-wide text-content-primary uppercase">
          Мой календарь
        </h1>
        <p className="text-content-muted mt-1 text-sm">
          Выезды по сделкам, где ты назначен исполнителем.
          {' '}Сегодня: <strong>{todayCount}</strong>, в течение недели: <strong>{soonCount}</strong>.
        </p>
      </div>
      <CalendarList groups={groups} dealHrefBase="/master/deals" />
    </div>
  );
}
