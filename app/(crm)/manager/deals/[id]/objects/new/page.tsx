import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq, asc } from 'drizzle-orm';
import { ChevronLeft } from 'lucide-react';
import { requireRole } from '@/lib/auth/helpers';
import { db } from '@/lib/db';
import { deals } from '@/lib/db/schema/deals';
import { clients } from '@/lib/db/schema/clients';
import { services } from '@/lib/db/schema/services';
import { ObjectForm } from '../../../../clients/ObjectForm';

export const metadata = { title: 'Новый объект договора — ДезТехЮг CRM' };
export const dynamic = 'force-dynamic';

export default async function NewDealObjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole('manager');
  const { id } = await params;

  const [deal] = await db
    .select({
      id: deals.id,
      clientId: deals.clientId,
      contractNumber: deals.contractNumber,
    })
    .from(deals)
    .where(eq(deals.id, id))
    .limit(1);
  if (!deal) notFound();

  const [client] = await db
    .select({ id: clients.id, shortName: clients.shortName })
    .from(clients)
    .where(eq(clients.id, deal.clientId))
    .limit(1);

  const serviceList = await db
    .select({ id: services.id, name: services.name })
    .from(services)
    .where(eq(services.isActive, true))
    .orderBy(asc(services.sortOrder), asc(services.name));

  const backHref = `/manager/deals/${id}?tab=objects`;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-sm text-content-muted hover:text-neon-orange transition-colors mb-2"
        >
          <ChevronLeft className="w-4 h-4" />К договору {deal.contractNumber}
        </Link>
        <h1 className="text-2xl font-orbitron font-bold tracking-wide text-content-primary uppercase">
          Новый объект договора
        </h1>
        <p className="text-sm text-content-muted mt-1">
          Договор {deal.contractNumber} · {client?.shortName ?? '—'}
        </p>
      </div>
      <ObjectForm
        mode="create"
        clientId={deal.clientId}
        dealId={deal.id}
        services={serviceList}
        redirectTo={backHref}
      />
    </div>
  );
}
