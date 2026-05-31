import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { requireRole } from '@/lib/auth/helpers';
import { ClientForm } from '../ClientForm';
import { PageTitle } from '@/components/crm/PageTitle';

export const metadata = { title: 'Новый клиент — ДезТехЮг CRM' };
export const dynamic = 'force-dynamic';

export default async function NewClientPage() {
  await requireRole('manager');

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/manager/clients"
          className="inline-flex items-center gap-1 text-sm text-content-muted hover:text-neon-orange transition-colors mb-2"
        >
          <ChevronLeft className="w-4 h-4" />
          К списку клиентов
        </Link>
        <PageTitle>Новый клиент</PageTitle>
      </div>
      <ClientForm mode="create" />
    </div>
  );
}
