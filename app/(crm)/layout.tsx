import { requireAuth } from '@/lib/auth/helpers';
import { Sidebar } from '@/components/crm/Sidebar';
import { CrmProviders } from '@/components/crm/CrmProviders';
import { Toaster } from '@/components/ui/sonner';

export const dynamic = 'force-dynamic';

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();

  return (
    <CrmProviders>
      {/* data-crm-root → отключает body { zoom: 0.9 } публичного сайта,
          иначе FullCalendar в timeGrid ломает позиционирование событий
          (offsetTop unscaled vs getBoundingClientRect scaled). */}
      <div
        data-crm-root
        className="min-h-screen flex bg-bg-secondary text-content-primary"
      >
        <Sidebar user={user} />
        <main className="flex-1 overflow-x-hidden">
          <div className="px-6 py-6 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
      <Toaster theme="light" position="top-right" richColors />
    </CrmProviders>
  );
}
