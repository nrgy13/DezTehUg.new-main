import { requireRole } from '@/lib/auth/helpers';
import { getDealEvents, serializeForClient } from '@/lib/calendar/deal-events';
import { CalendarFull } from '@/components/crm/CalendarFull';

export const metadata = { title: 'Календарь — ДезТехЮг CRM' };
export const dynamic = 'force-dynamic';

export default async function MasterCalendarPage() {
  const user = await requireRole('master');
  const events = await getDealEvents({ kind: 'master', userId: user.id });
  const serialized = serializeForClient(events);

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-orbitron font-bold tracking-wide text-content-primary uppercase">
        Мой календарь
      </h1>
      <CalendarFull events={serialized} dealHrefBase="/master/visits" />
    </div>
  );
}
