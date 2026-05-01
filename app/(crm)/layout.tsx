import { requireAuth } from '@/lib/auth/helpers';
import { Sidebar } from '@/components/crm/Sidebar';

export const dynamic = 'force-dynamic';

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();

  return (
    <div className="min-h-screen flex bg-slate-900 text-slate-100">
      <Sidebar user={user} />
      <main className="flex-1 overflow-x-hidden">
        <div className="px-6 py-6 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
