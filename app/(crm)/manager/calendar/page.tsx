import { requireRole } from '@/lib/auth/helpers';
import {
  getDealEvents,
  getVisitHistory,
  serializeForClient,
  serializeVisitHistory,
} from '@/lib/calendar/deal-events';
import { getObjectReminders } from '@/lib/calendar/object-reminders';
import { CalendarWithHistory } from '@/components/crm/CalendarWithHistory';
import { PageTitle } from '@/components/crm/PageTitle';
import { getWorkOrderFormData } from './work-order-actions';
import { WorkOrderLauncher } from './WorkOrderLauncher';
import { ObjectRemindersPanel } from './ObjectRemindersPanel';

export const metadata = { title: 'Календарь — ДезТехЮг CRM' };
export const dynamic = 'force-dynamic';

export default async function ManagerCalendarPage() {
  const user = await requireRole('manager');
  const isAdmin = user.role === 'admin';
  const [events, history, workOrderData, reminders] = await Promise.all([
    getDealEvents({
      kind: 'manager',
      userId: user.id,
      isAdmin,
    }),
    getVisitHistory({ kind: 'manager', userId: user.id, isAdmin }),
    getWorkOrderFormData(),
    getObjectReminders({ userId: user.id, isAdmin }),
  ]);
  const serialized = serializeForClient(events);
  const historySerialized = serializeVisitHistory(history);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <PageTitle>Календарь выездов</PageTitle>
        <WorkOrderLauncher data={workOrderData} />
      </div>
      <ObjectRemindersPanel reminders={reminders} formData={workOrderData} />
      <CalendarWithHistory
        active={serialized}
        history={historySerialized}
        dealHrefBase="/manager/deals"
        canDragDates
        canGenerateActs
      />
    </div>
  );
}
