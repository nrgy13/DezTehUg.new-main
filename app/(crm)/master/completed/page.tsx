import Link from 'next/link';
import { eq, and, desc } from 'drizzle-orm';
import { Briefcase, Calendar } from 'lucide-react';
import { requireRole } from '@/lib/auth/helpers';
import { db } from '@/lib/db';
import { deals } from '@/lib/db/schema/deals';
import { clients } from '@/lib/db/schema/clients';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';

export const metadata = { title: 'Выполнено — ДезТехЮг CRM' };
export const dynamic = 'force-dynamic';

function formatRu(d: Date | string | null) {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('ru-RU');
}

export default async function MasterCompletedPage() {
  const user = await requireRole('master');

  const rows = await db
    .select({
      id: deals.id,
      contractNumber: deals.contractNumber,
      contractDate: deals.contractDate,
      startDate: deals.startDate,
      endDate: deals.endDate,
      clientId: clients.id,
      clientShortName: clients.shortName,
      clientPhone: clients.phone,
    })
    .from(deals)
    .leftJoin(clients, eq(deals.clientId, clients.id))
    .where(and(eq(deals.assignedMasterId, user.id), eq(deals.status, 'completed')))
    .orderBy(desc(deals.endDate), desc(deals.contractDate));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-orbitron font-bold tracking-wide text-content-primary uppercase">
          Выполненные работы
        </h1>
        <p className="text-content-muted mt-1 text-sm">
          Архив сделок со статусом «Выполнен», где ты был назначен исполнителем.
          Всего: {rows.length}.
        </p>
      </div>

      {rows.length === 0 ? (
        <CyberpunkCard variant="default" hoverEffect={false} className="p-8 text-center">
          <p className="text-content-muted text-sm">
            Завершённых сделок пока нет.
          </p>
        </CyberpunkCard>
      ) : (
        <CyberpunkCard variant="default" hoverEffect={false} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[10px] font-orbitron tracking-wider uppercase text-content-muted">
                <tr>
                  <th className="px-4 py-2 text-left">Договор</th>
                  <th className="px-4 py-2 text-left">Клиент</th>
                  <th className="px-4 py-2 text-left">Дата начала</th>
                  <th className="px-4 py-2 text-left">Дата завершения</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center gap-1.5 font-mono text-xs">
                        <Briefcase className="w-3.5 h-3.5 text-content-muted" />
                        {r.contractNumber}
                      </span>
                      <div className="text-[11px] text-content-muted mt-0.5">
                        от {formatRu(r.contractDate)}
                      </div>
                    </td>
                    <td className="px-4 py-2">{r.clientShortName ?? '—'}</td>
                    <td className="px-4 py-2 text-xs">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-content-muted" />
                        {formatRu(r.startDate)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs">{formatRu(r.endDate)}</td>
                    <td className="px-4 py-2 text-right">
                      <Link
                        href={`/master/deals/${r.id}`}
                        className="text-xs text-poison-green hover:underline"
                      >
                        Открыть →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CyberpunkCard>
      )}
    </div>
  );
}
