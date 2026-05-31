import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq, asc } from 'drizzle-orm';
import { ChevronLeft } from 'lucide-react';
import { requireRole } from '@/lib/auth/helpers';
import { db } from '@/lib/db';
import { clients } from '@/lib/db/schema/clients';
import { services } from '@/lib/db/schema/services';
import { ObjectForm } from '../../../ObjectForm';
import { PageTitle } from '@/components/crm/PageTitle';

export const metadata = { title: 'Новый объект — ДезТехЮг CRM' };
export const dynamic = 'force-dynamic';

export default async function NewObjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole('manager');
  const { id } = await params;

  const [client] = await db
    .select({ id: clients.id, shortName: clients.shortName })
    .from(clients)
    .where(eq(clients.id, id))
    .limit(1);
  if (!client) notFound();

  const serviceList = await db
    .select({ id: services.id, name: services.name })
    .from(services)
    .where(eq(services.isActive, true))
    .orderBy(asc(services.sortOrder), asc(services.name));

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/manager/clients/${id}?tab=objects`}
          className="inline-flex items-center gap-1 text-sm text-content-muted hover:text-neon-orange transition-colors mb-2"
        >
          <ChevronLeft className="w-4 h-4" />
          К карточке клиента
        </Link>
        <PageTitle>Новый объект</PageTitle>
        <p className="text-sm text-content-muted mt-1">Клиент: {client.shortName}</p>
      </div>
      <ObjectForm mode="create" clientId={id} services={serviceList} />
    </div>
  );
}
