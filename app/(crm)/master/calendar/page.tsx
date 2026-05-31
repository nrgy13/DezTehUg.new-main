import { requireRole } from '@/lib/auth/helpers';
import { getDealEvents, serializeForClient } from '@/lib/calendar/deal-events';
import { CalendarFull } from '@/components/crm/CalendarFull';
import { PageTitle } from '@/components/crm/PageTitle';

export const metadata = { title: 'Календарь — ДезТехЮг CRM' };
export const dynamic = 'force-dynamic';

export default async function MasterCalendarPage() {
  const user = await requireRole('master');
  const events = await getDealEvents({ kind: 'master', userId: user.id });
  const serialized = serializeForClient(events);

  return (
    <div className="space-y-4">
      <PageTitle>Мой календарь</PageTitle>
      <CalendarFull events={serialized} dealHrefBase="/master/visits" />
    </div>
  );
}
