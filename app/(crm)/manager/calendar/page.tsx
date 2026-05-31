import { requireRole } from '@/lib/auth/helpers';
import { getDealEvents, serializeForClient } from '@/lib/calendar/deal-events';
import { CalendarFull } from '@/components/crm/CalendarFull';
import { PageTitle } from '@/components/crm/PageTitle';

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

  return (
    <div className="space-y-4">
      <PageTitle>Календарь выездов</PageTitle>
      <CalendarFull events={serialized} dealHrefBase="/manager/deals" canDragDates />
    </div>
  );
}
