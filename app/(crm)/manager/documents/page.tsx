import Link from 'next/link';
import { eq, desc, and, gte, sql, type SQL } from 'drizzle-orm';
import { FileText, Download } from 'lucide-react';
import { requireRole } from '@/lib/auth/helpers';
import { db } from '@/lib/db';
import { documents, type DocumentType, type DocumentStatus } from '@/lib/db/schema/documents';
import { clients } from '@/lib/db/schema/clients';
import { deals } from '@/lib/db/schema/deals';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { PageTitle } from '@/components/crm/PageTitle';
import { DeleteDocumentButton } from './DeleteDocumentButton';

export const metadata = { title: 'Документы — ДезТехЮг CRM' };
export const dynamic = 'force-dynamic';

const TYPE_OPTIONS: Array<{ value: DocumentType; label: string }> = [
  { value: 'contract', label: 'Договор' },
  { value: 'addendum', label: 'Доп. соглашение' },
  { value: 'act_work', label: 'Акт работ' },
  { value: 'act_inspection', label: 'Акт обследования' },
  { value: 'invoice', label: 'Счёт' },
  { value: 'commercial_offer', label: 'КП' },
  { value: 'other', label: 'Другое' },
];

const STATUS_OPTIONS: Array<{ value: DocumentStatus; label: string; badge: string }> = [
  { value: 'draft', label: 'Черновик', badge: 'bg-gray-100 text-gray-700' },
  { value: 'generated', label: 'Готов', badge: 'bg-blue-100 text-blue-700' },
  { value: 'sent', label: 'Отправлен', badge: 'bg-amber-100 text-amber-700' },
  { value: 'signed', label: 'Подписан', badge: 'bg-emerald-100 text-emerald-700' },
  { value: 'archived', label: 'Архив', badge: 'bg-gray-200 text-gray-600' },
];

function typeLabel(t: DocumentType) {
  return TYPE_OPTIONS.find((o) => o.value === t)?.label ?? t;
}

function statusInfo(s: DocumentStatus) {
  return STATUS_OPTIONS.find((o) => o.value === s) ?? { label: s, badge: 'bg-gray-100 text-gray-700' };
}

function formatRu(d: Date | string | null) {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('ru-RU');
}

export default async function DocumentsListPage({
  searchParams,
}: {
  searchParams: { type?: string; status?: string; period?: string };
}) {
  await requireRole('manager');

  const typeFilter = (searchParams.type as DocumentType | undefined) || null;
  const statusFilter = (searchParams.status as DocumentStatus | undefined) || null;
  const periodRaw = searchParams.period ?? '90';
  const periodDays = periodRaw === '0' ? null : Number(periodRaw) || 90;

  const conditions: SQL[] = [];
  if (typeFilter) conditions.push(eq(documents.type, typeFilter));
  if (statusFilter) conditions.push(eq(documents.status, statusFilter));
  if (periodDays) {
    const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
    conditions.push(gte(documents.createdAt, since));
  }

  const rows = await db
    .select({
      id: documents.id,
      type: documents.type,
      number: documents.number,
      title: documents.title,
      status: documents.status,
      createdAt: documents.createdAt,
      docxKey: documents.docxS3Key,
      clientId: clients.id,
      clientName: clients.shortName,
      dealNumber: deals.contractNumber,
      dealId: deals.id,
    })
    .from(documents)
    .leftJoin(clients, eq(clients.id, documents.clientId))
    .leftJoin(deals, eq(deals.id, documents.dealId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(documents.createdAt))
    .limit(200);

  // Простой COUNT(*) — без groupBy, чтоб не было undefined-проблем
  const totalRow = await db.execute<{ count: number }>(
    sql`SELECT COUNT(*)::int AS count FROM documents`,
  );
  const totalRows = ((totalRow as unknown as { rows?: unknown[] }).rows ?? totalRow) as Array<{
    count: number;
  }>;
  const totalCount = totalRows[0]?.count ?? 0;

  function buildLink(patch: { type?: string | null; status?: string | null; period?: string | null }) {
    const params = new URLSearchParams();
    const nextType = patch.type !== undefined ? patch.type : typeFilter;
    const nextStatus = patch.status !== undefined ? patch.status : statusFilter;
    const nextPeriod =
      patch.period !== undefined ? patch.period : periodDays ? String(periodDays) : '0';
    if (nextType) params.set('type', String(nextType));
    if (nextStatus) params.set('status', String(nextStatus));
    if (nextPeriod && nextPeriod !== '90') params.set('period', String(nextPeriod));
    const qs = params.toString();
    return qs ? `/manager/documents?${qs}` : '/manager/documents';
  }

  return (
    <div className="space-y-6">
      <div>
        <PageTitle>Документы</PageTitle>
        <p className="text-content-muted mt-1 text-sm">
          Все документы по сделкам в одном списке. Всего в системе: {totalCount}.
        </p>
      </div>

      {/* Фильтры */}
      <CyberpunkCard variant="default" hoverEffect={false} className="p-4">
        <div className="flex flex-wrap gap-4">
          <FilterGroup
            label="Тип"
            currentValue={typeFilter ?? ''}
            options={[
              { value: '', label: 'Все', href: buildLink({ type: null }) },
              ...TYPE_OPTIONS.map((o) => ({
                value: o.value,
                label: o.label,
                href: buildLink({ type: o.value }),
              })),
            ]}
          />
          <FilterGroup
            label="Статус"
            currentValue={statusFilter ?? ''}
            options={[
              { value: '', label: 'Все', href: buildLink({ status: null }) },
              ...STATUS_OPTIONS.map((o) => ({
                value: o.value,
                label: o.label,
                href: buildLink({ status: o.value }),
              })),
            ]}
          />
          <FilterGroup
            label="Период"
            currentValue={periodDays?.toString() ?? '0'}
            options={[
              { value: '30', label: '30 дней', href: buildLink({ period: '30' }) },
              { value: '90', label: '90 дней', href: buildLink({ period: '90' }) },
              { value: '365', label: 'Год', href: buildLink({ period: '365' }) },
              { value: '0', label: 'Всё', href: buildLink({ period: '0' }) },
            ]}
          />
        </div>
      </CyberpunkCard>

      {/* Таблица */}
      <CyberpunkCard variant="default" hoverEffect={false} className="overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-8 text-center text-content-muted text-sm">
            Документов по выбранным фильтрам не найдено.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[10px] font-orbitron tracking-wider uppercase text-content-muted">
                <tr>
                  <th className="px-4 py-2 text-left">Тип</th>
                  <th className="px-4 py-2 text-left">Номер</th>
                  <th className="px-4 py-2 text-left">Клиент</th>
                  <th className="px-4 py-2 text-left">Сделка</th>
                  <th className="px-4 py-2 text-left">Дата</th>
                  <th className="px-4 py-2 text-left">Статус</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const si = statusInfo(r.status);
                  return (
                    <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-2">
                        <span className="inline-flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-content-muted" />
                          {typeLabel(r.type)}
                        </span>
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">{r.number ?? '—'}</td>
                      <td className="px-4 py-2">
                        {r.clientId ? (
                          <Link
                            href={`/manager/clients/${r.clientId}`}
                            className="text-poison-green hover:underline"
                          >
                            {r.clientName ?? '—'}
                          </Link>
                        ) : (
                          <span className="text-content-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs">
                        {r.dealId ? (
                          <Link
                            href={`/manager/deals/${r.dealId}`}
                            className="text-poison-green hover:underline"
                          >
                            {r.dealNumber ?? r.dealId.slice(0, 8)}
                          </Link>
                        ) : (
                          <span className="text-content-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs">{formatRu(r.createdAt)}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-medium ${si.badge}`}
                        >
                          {si.label}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-end gap-3">
                          {r.docxKey && (
                            <a
                              href={`/api/documents/${r.id}/download`}
                              className="inline-flex items-center gap-1 text-xs text-poison-green hover:underline"
                              title="Скачать DOCX"
                            >
                              <Download className="w-3.5 h-3.5" />
                              DOCX
                            </a>
                          )}
                          <DeleteDocumentButton
                            id={r.id}
                            label={`${typeLabel(r.type)} ${r.number ?? ''}`.trim()}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CyberpunkCard>
    </div>
  );
}

function FilterGroup({
  label,
  currentValue,
  options,
}: {
  label: string;
  currentValue: string;
  options: Array<{ value: string; label: string; href: string }>;
}) {
  return (
    <div>
      <div className="text-[10px] font-orbitron tracking-wider text-content-muted uppercase mb-1.5">
        {label}
      </div>
      <div className="flex flex-wrap gap-1">
        {options.map((opt) => {
          const active = opt.value === currentValue;
          return (
            <Link
              key={opt.value || 'all'}
              href={opt.href}
              className={`px-2.5 py-1 rounded text-xs transition-colors ${
                active
                  ? 'bg-neon-orange/10 text-neon-orange border border-neon-orange/40'
                  : 'bg-gray-100 text-content-secondary hover:bg-gray-200 border border-transparent'
              }`}
            >
              {opt.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
