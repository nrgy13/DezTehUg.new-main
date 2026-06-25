import { requireRole } from '@/lib/auth/helpers';
import {
  getDealEvents,
  getVisitHistory,
  serializeForClient,
  serializeVisitHistory,
} from '@/lib/calendar/deal-events';
import { CalendarWithHistory } from '@/components/crm/CalendarWithHistory';
import { PageTitle } from '@/components/crm/PageTitle';

export const metadata = { title: 'Календарь — ДезТехЮг CRM' };
export const dynamic = 'force-dynamic';

export default async function MasterCalendarPage() {
  const user = await requireRole('master');
  const [events, history] = await Promise.all([
    getDealEvents({ kind: 'master', userId: user.id }),
    getVisitHistory({ kind: 'master', userId: user.id }),
  ]);
  const serialized = serializeForClient(events);
  const historySerialized = serializeVisitHistory(history);

  return (
    <div className="space-y-4">
      <PageTitle>Мой календарь</PageTitle>
      <CalendarWithHistory
        active={serialized}
        history={historySerialized}
        dealHrefBase="/master/visits"
      />
    </div>
  );
}
