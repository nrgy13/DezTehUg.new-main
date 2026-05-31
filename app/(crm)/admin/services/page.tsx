import { asc, eq, sql } from 'drizzle-orm';
import { requireRole } from '@/lib/auth/helpers';
import { db } from '@/lib/db';
import { services } from '@/lib/db/schema/services';
import { serviceChecklists } from '@/lib/db/schema/checklists';
import { ServicesClient } from './ServicesClient';
import { PageTitle } from '@/components/crm/PageTitle';

export const metadata = { title: 'Каталог услуг — ДезТехЮг CRM' };
export const dynamic = 'force-dynamic';

export default async function ServicesAdminPage() {
  await requireRole('admin', 'manager');

  const list = await db
    .select({
      id: services.id,
      code: services.code,
      name: services.name,
      shortName: services.shortName,
      description: services.description,
      defaultMethod: services.defaultMethod,
      sortOrder: services.sortOrder,
      isActive: services.isActive,
      createdAt: services.createdAt,
      updatedAt: services.updatedAt,
      checklistCount: sql<number>`COALESCE(COUNT(${serviceChecklists.id}), 0)::int`,
    })
    .from(services)
    .leftJoin(serviceChecklists, eq(serviceChecklists.serviceId, services.id))
    .groupBy(services.id)
    .orderBy(asc(services.sortOrder), asc(services.name));

  return (
    <div className="space-y-6">
      <div>
        <PageTitle>Каталог услуг</PageTitle>
        <p className="text-content-muted mt-1 text-sm">
          Справочник услуг ДезТехЮг. Используется в карточке сделки как dropdown для прайс-позиций.
        </p>
      </div>

      <ServicesClient services={list} />
    </div>
  );
}
