import { requireRole } from '@/lib/auth/helpers';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { Inbox } from 'lucide-react';
import { getInboxItems } from '@/lib/inbox/queries';
import { InboxClient } from './InboxClient';

export const metadata = { title: 'Уведомления — ДезТехЮг CRM' };
export const dynamic = 'force-dynamic';

export default async function ManagerInboxPage() {
  const user = await requireRole('manager');
  // admin видит все события, manager — только по своим сделкам
  const items = await getInboxItems(user.role === 'admin' ? null : user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-orbitron font-bold tracking-wide text-content-primary uppercase">
          Уведомления
        </h1>
        <p className="text-content-muted mt-1 text-sm">
          События по твоим сделкам требующие реакции: запросы переноса дат от мастеров и др.
          Когда обработал — отметь «Прочитано», и запись исчезнет из списка.
        </p>
      </div>

      {items.length === 0 ? (
        <CyberpunkCard variant="default" hoverEffect={false} className="p-10 text-center">
          <Inbox className="w-8 h-8 mx-auto mb-2 text-content-muted opacity-40" />
          <p className="text-sm text-content-muted">
            Нет необработанных уведомлений. Все события рассмотрены.
          </p>
        </CyberpunkCard>
      ) : (
        <InboxClient items={items} />
      )}
    </div>
  );
}
