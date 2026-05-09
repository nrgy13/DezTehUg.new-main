import { requireRole } from '@/lib/auth/helpers';
import { getDealEvents, serializeForClient } from '@/lib/calendar/deal-events';
import { CalendarFull } from '@/components/crm/CalendarFull';

export const metadata = { title: 'Календарь — ДезТехЮг CRM' };
export const dynamic = 'force-dynamic';

export default async function MasterCalendarPage() {
  const user = await requireRole('master');
  const events = await getDealEvents({ kind: 'master', userId: user.id });
  const serialized = serializeForClient(events);

  const todayCount = events.filter((e) => e.health === 'today').length;
  const soonCount = events.filter((e) => e.health === 'soon').length;
  const totalCount = events.length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-orbitron font-bold tracking-wide text-content-primary uppercase">
          Мой календарь
        </h1>
        <p className="text-content-muted mt-1 text-sm">
          Выезды по сделкам, где ты назначен исполнителем.
          {' '}Всего: <strong>{totalCount}</strong> · сегодня: <strong>{todayCount}</strong>
          {' '}· в течение недели: <strong>{soonCount}</strong>.
        </p>
      </div>
      <CalendarFull events={serialized} dealHrefBase="/master/deals" />
    </div>
  );
}
