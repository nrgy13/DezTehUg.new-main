import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { ChevronLeft } from 'lucide-react';
import { requireRole } from '@/lib/auth/helpers';
import { db } from '@/lib/db';
import { clients } from '@/lib/db/schema/clients';
import { ClientForm } from '../../ClientForm';
import { PageTitle } from '@/components/crm/PageTitle';

export const metadata = { title: 'Редактирование клиента — ДезТехЮг CRM' };
export const dynamic = 'force-dynamic';

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole('manager');
  const { id } = await params;

  const [client] = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  if (!client) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/manager/clients/${id}`}
          className="inline-flex items-center gap-1 text-sm text-content-muted hover:text-neon-orange transition-colors mb-2"
        >
          <ChevronLeft className="w-4 h-4" />
          К карточке клиента
        </Link>
        <PageTitle>{client.shortName}</PageTitle>
        <p className="text-sm text-content-muted mt-1">Редактирование</p>
      </div>
      <ClientForm mode="edit" initial={client} />
    </div>
  );
}
