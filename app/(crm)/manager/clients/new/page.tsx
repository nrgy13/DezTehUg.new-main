import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { requireRole } from '@/lib/auth/helpers';
import { ClientForm } from '../ClientForm';

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
        <h1 className="text-2xl font-orbitron font-bold tracking-wide text-content-primary uppercase">
          Новый клиент
        </h1>
      </div>
      <ClientForm mode="create" />
    </div>
  );
}
