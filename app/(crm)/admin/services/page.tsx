import { asc } from 'drizzle-orm';
import { requireRole } from '@/lib/auth/helpers';
import { db } from '@/lib/db';
import { services } from '@/lib/db/schema/services';
import { ServicesClient } from './ServicesClient';

export const metadata = { title: 'Каталог услуг — ДезТехЮг CRM' };
export const dynamic = 'force-dynamic';

export default async function ServicesAdminPage() {
  await requireRole('admin');

  const list = await db.select().from(services).orderBy(asc(services.sortOrder), asc(services.name));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-orbitron font-bold tracking-wide text-content-primary uppercase">
          Каталог услуг
        </h1>
        <p className="text-content-muted mt-1 text-sm">
          Справочник услуг ДезТехЮг. Используется в карточке сделки как dropdown для прайс-позиций.
        </p>
      </div>

      <ServicesClient services={list} />
    </div>
  );
}
