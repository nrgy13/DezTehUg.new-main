import { requireRole } from '@/lib/auth/helpers';
import { getDealEvents, serializeForClient } from '@/lib/calendar/deal-events';
import { CalendarFull } from '@/components/crm/CalendarFull';
import { PageTitle } from '@/components/crm/PageTitle';
import { getWorkOrderFormData } from './work-order-actions';
import { WorkOrderLauncher } from './WorkOrderLauncher';

export const metadata = { title: 'Календарь — ДезТехЮг CRM' };
export const dynamic = 'force-dynamic';

export default async function ManagerCalendarPage() {
  const user = await requireRole('manager');
  const [events, workOrderData] = await Promise.all([
    getDealEvents({
      kind: 'manager',
      userId: user.id,
      isAdmin: user.role === 'admin',
    }),
    getWorkOrderFormData(),
  ]);
  const serialized = serializeForClient(events);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <PageTitle>Календарь выездов</PageTitle>
        <WorkOrderLauncher data={workOrderData} />
      </div>
      <CalendarFull events={serialized} dealHrefBase="/manager/deals" canDragDates />
    </div>
  );
}
