import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { ChevronLeft } from 'lucide-react';
import { requireRole } from '@/lib/auth/helpers';
import { db } from '@/lib/db';
import { clients } from '@/lib/db/schema/clients';
import { ObjectForm } from '../../../ObjectForm';

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
        <h1 className="text-3xl font-orbitron font-bold tracking-wide text-content-primary uppercase">
          Новый объект
        </h1>
        <p className="text-sm text-content-muted mt-1">Клиент: {client.shortName}</p>
      </div>
      <ObjectForm mode="create" clientId={id} />
    </div>
  );
}
