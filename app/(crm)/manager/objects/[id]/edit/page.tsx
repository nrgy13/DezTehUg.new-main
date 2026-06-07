import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq, asc } from 'drizzle-orm';
import { ChevronLeft } from 'lucide-react';
import { requireRole } from '@/lib/auth/helpers';
import { db } from '@/lib/db';
import { clientObjects, clientObjectServices } from '@/lib/db/schema/objects';
import { services } from '@/lib/db/schema/services';
import { ObjectForm } from '../../../clients/ObjectForm';
import { PageTitle } from '@/components/crm/PageTitle';

export const metadata = { title: 'Редактирование объекта — ДезТехЮг CRM' };
export const dynamic = 'force-dynamic';

export default async function EditObjectPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole('manager');
  const { id } = await params;

  const [object] = await db.select().from(clientObjects).where(eq(clientObjects.id, id)).limit(1);
  if (!object) notFound();

  const serviceRows = await db
    .select({
      serviceId: clientObjectServices.serviceId,
      customName: clientObjectServices.customName,
      method: clientObjectServices.method,
      unit: clientObjectServices.unit,
      quantity: clientObjectServices.quantity,
      frequency: clientObjectServices.frequency,
    })
    .from(clientObjectServices)
    .where(eq(clientObjectServices.objectId, id))
    .orderBy(asc(clientObjectServices.sortOrder));

  const serviceList = await db
    .select({ id: services.id, name: services.name })
    .from(services)
    .where(eq(services.isActive, true))
    .orderBy(asc(services.sortOrder), asc(services.name));

  const backHref = `/manager/objects/${id}`;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-sm text-content-muted hover:text-neon-orange transition-colors mb-2"
        >
          <ChevronLeft className="w-4 h-4" />К карточке объекта
        </Link>
        <PageTitle>Редактирование объекта</PageTitle>
        <p className="text-sm text-content-muted mt-1">{object.name}</p>
      </div>
      <ObjectForm
        mode="edit"
        clientId={object.clientId}
        services={serviceList}
        initial={object}
        initialServices={serviceRows}
        redirectTo={backHref}
      />
    </div>
  );
}
