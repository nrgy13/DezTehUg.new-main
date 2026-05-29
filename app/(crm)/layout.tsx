import { requireAuth } from '@/lib/auth/helpers';
import { CrmShell } from '@/components/crm/CrmShell';
import { CrmProviders } from '@/components/crm/CrmProviders';
import { Toaster } from '@/components/ui/sonner';
import { getPendingDeletionsCount } from '@/lib/documents/deletion';
import { getInboxCount } from '@/lib/inbox/queries';

export const dynamic = 'force-dynamic';

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();

  // Бейдж pending запросов на удаление — для админа и менеджера
  // (Sprint 9: Регина получила доступ к /admin/deletions).
  // Бейдж inbox — для менеджера (и админа). Для master не нужен.
  const [pendingDeletionsCount, inboxCount] = await Promise.all([
    user.role === 'admin' || user.role === 'manager'
      ? getPendingDeletionsCount()
      : Promise.resolve(0),
    user.role === 'manager' || user.role === 'admin'
      ? getInboxCount(user.role === 'admin' ? null : user.id)
      : Promise.resolve(0),
  ]);

  return (
    <CrmProviders>
      {/* data-crm-root → отключает body { zoom: 0.9 } публичного сайта,
          иначе FullCalendar в timeGrid ломает позиционирование событий
          (offsetTop unscaled vs getBoundingClientRect scaled). */}
      <div data-crm-root>
        <CrmShell
          user={user}
          pendingDeletionsCount={pendingDeletionsCount}
          inboxCount={inboxCount}
        >
          {children}
        </CrmShell>
      </div>
      <Toaster theme="light" position="top-right" richColors />
    </CrmProviders>
  );
}
