import { requireRole } from '@/lib/auth/helpers';
import { getDealEvents, serializeForClient } from '@/lib/calendar/deal-events';
import { CalendarFull } from '@/components/crm/CalendarFull';

export const metadata = { title: 'Календарь — ДезТехЮг CRM' };
export const dynamic = 'force-dynamic';

export default async function ManagerCalendarPage() {
  const user = await requireRole('manager');
  const events = await getDealEvents({
    kind: 'manager',
    userId: user.id,
    isAdmin: user.role === 'admin',
  });
  const serialized = serializeForClient(events);

  const todayCount = events.filter((e) => e.health === 'today').length;
  const soonCount = events.filter((e) => e.health === 'soon').length;
  const totalCount = events.length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-orbitron font-bold tracking-wide text-content-primary uppercase">
          Календарь выездов
        </h1>
        <p className="text-content-muted mt-1 text-sm">
          {user.role === 'admin'
            ? 'Все запланированные выезды (как admin — видишь всё).'
            : 'Выезды по сделкам, где ты ответственный менеджер.'}
          {' '}Всего: <strong>{totalCount}</strong> · сегодня: <strong>{todayCount}</strong>
          {' '}· в течение недели: <strong>{soonCount}</strong>.
        </p>
      </div>
      <CalendarFull events={serialized} dealHrefBase="/manager/deals" />
    </div>
  );
}
