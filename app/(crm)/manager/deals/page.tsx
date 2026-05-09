import Link from 'next/link';
import { and, or, eq, ilike, desc, sql, count } from 'drizzle-orm';
import { Search, Briefcase, LayoutGrid, Calendar as CalendarIcon, List as ListIcon } from 'lucide-react';
import { requireRole } from '@/lib/auth/helpers';
import { db } from '@/lib/db';
import { deals, type DealStatus } from '@/lib/db/schema/deals';
import { clients } from '@/lib/db/schema/clients';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { DealStatusBadge, DEAL_STATUS_LABELS, DEAL_STATUSES_ORDER } from '@/components/crm/DealStatusBadge';

export const metadata = { title: 'Сделки — ДезТехЮг CRM' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

type SearchParams = {
  q?: string;
  status?: DealStatus | 'all';
  mine?: '1';
  page?: string;
};

export default async function DealsListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireRole('manager');
  const sp = await searchParams;

  const q = sp.q?.trim() ?? '';
  const filterStatus = sp.status && sp.status !== 'all' ? sp.status : undefined;
  const onlyMine = sp.mine === '1';
  const page = Math.max(1, Number(sp.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const conditions = [];
  if (q.length > 0) {
    conditions.push(
      or(
        ilike(deals.contractNumber, `%${q}%`),
        ilike(clients.shortName, `%${q}%`),
        ilike(clients.inn, `%${q}%`),
      )!,
    );
  }
  if (filterStatus) conditions.push(eq(deals.status, filterStatus));
  if (onlyMine) conditions.push(eq(deals.assignedManagerId, user.id));
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await db
    .select({ total: count() })
    .from(deals)
    .leftJoin(clients, eq(deals.clientId, clients.id))
    .where(whereClause);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const list = await db
    .select({
      id: deals.id,
      contractNumber: deals.contractNumber,
      contractDate: deals.contractDate,
      status: deals.status,
      totalAmount: deals.totalAmount,
      clientId: clients.id,
      clientShortName: clients.shortName,
      clientType: clients.type,
    })
    .from(deals)
    .leftJoin(clients, eq(deals.clientId, clients.id))
    .where(whereClause)
    .orderBy(desc(deals.contractDate), desc(deals.createdAt))
    .limit(PAGE_SIZE)
    .offset(offset);

  // Счётчики по статусам — для табов
  const statusCounts = await db
    .select({ status: deals.status, c: count() })
    .from(deals)
    .groupBy(deals.status);
  const countByStatus: Record<string, number> = {};
  for (const row of statusCounts) countByStatus[row.status] = row.c;
  const totalAll = Object.values(countByStatus).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-orbitron font-bold tracking-wide text-content-primary uppercase">
            Сделки
          </h1>
          <p className="text-content-muted mt-1 text-sm">
            Договоры и работы по клиентам.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-1">
          <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-neon-orange text-white rounded font-medium">
            <ListIcon className="w-3.5 h-3.5" />
            Список
          </span>
          <Link
            href="/manager/deals/board"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-content-secondary hover:bg-gray-50 rounded transition-colors"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Канбан
          </Link>
          <Link
            href="/manager/calendar"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-content-secondary hover:bg-gray-50 rounded transition-colors"
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            Календарь
          </Link>
        </div>
      </div>

      {/* Tabs по статусам */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200">
        <StatusTab
          href={buildHref(sp, { status: 'all', page: undefined })}
          active={!filterStatus}
          label="Все"
          count={totalAll}
        />
        {DEAL_STATUSES_ORDER.map((st) => (
          <StatusTab
            key={st}
            href={buildHref(sp, { status: st, page: undefined })}
            active={filterStatus === st}
            label={DEAL_STATUS_LABELS[st]}
            count={countByStatus[st] ?? 0}
          />
        ))}
      </div>

      {/* Поиск + mine */}
      <form className="flex gap-2" method="get">
        {filterStatus && <input type="hidden" name="status" value={filterStatus} />}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Поиск по номеру, клиенту, ИНН"
            className="w-full pl-10 pr-3 py-2 text-sm bg-bg-primary border border-gray-300 rounded-md focus:border-neon-orange focus:outline-none"
          />
        </div>
        <label className="flex items-center gap-2 px-3 text-sm text-content-secondary cursor-pointer">
          <input
            type="checkbox"
            name="mine"
            value="1"
            defaultChecked={onlyMine}
            className="accent-neon-orange"
          />
          Только мои
        </label>
        <button
          type="submit"
          className="px-4 py-2 text-sm bg-neon-orange/10 text-neon-orange border border-neon-orange/40 rounded-md hover:bg-neon-orange/20"
        >
          Применить
        </button>
      </form>

      {/* Список */}
      <CyberpunkCard variant="default" hoverEffect={false} className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-bg-secondary border-b border-gray-200">
            <tr className="text-xs uppercase font-orbitron tracking-wider text-content-muted">
              <th className="text-left px-4 py-3 w-44">Номер</th>
              <th className="text-left px-4 py-3 w-32">Дата</th>
              <th className="text-left px-4 py-3">Клиент</th>
              <th className="text-left px-4 py-3 w-32">Статус</th>
              <th className="text-right px-4 py-3 w-32">Сумма</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {list.map((d) => (
              <tr key={d.id} className="hover:bg-bg-secondary/50">
                <td className="px-4 py-3">
                  <Link
                    href={`/manager/deals/${d.id}`}
                    className="text-neon-orange hover:underline font-mono text-xs"
                  >
                    {d.contractNumber}
                  </Link>
                </td>
                <td className="px-4 py-3 text-content-secondary">{formatDate(d.contractDate)}</td>
                <td className="px-4 py-3">
                  {d.clientId ? (
                    <Link
                      href={`/manager/clients/${d.clientId}`}
                      className="text-content-primary hover:text-neon-orange"
                    >
                      {d.clientShortName}
                    </Link>
                  ) : (
                    <span className="text-content-muted">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <DealStatusBadge status={d.status} />
                </td>
                <td className="px-4 py-3 text-right text-content-secondary">
                  {d.totalAmount ? `${formatMoney(d.totalAmount)} ₽` : '—'}
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-content-muted">
                  <Briefcase className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p>Сделок пока нет.</p>
                  <p className="text-xs mt-1">
                    Создай сделку из карточки клиента или конвертируй лид в воронке.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </CyberpunkCard>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 text-sm">
          {page > 1 && (
            <Link
              href={buildHref(sp, { page: String(page - 1) })}
              className="px-3 py-1 border border-gray-300 rounded hover:border-neon-orange"
            >
              ← Назад
            </Link>
          )}
          <span className="px-3 py-1 text-content-muted">
            Страница {page} из {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={buildHref(sp, { page: String(page + 1) })}
              className="px-3 py-1 border border-gray-300 rounded hover:border-neon-orange"
            >
              Вперёд →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function StatusTab({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      className={`px-3 py-2 text-xs font-orbitron uppercase tracking-wider border-b-2 -mb-[1px] ${
        active
          ? 'border-neon-orange text-neon-orange'
          : 'border-transparent text-content-muted hover:text-content-primary'
      }`}
    >
      {label} <span className="ml-1 text-[10px] opacity-70">{count}</span>
    </Link>
  );
}

function buildHref(current: SearchParams, override: Partial<SearchParams> & { status?: DealStatus | 'all' }): string {
  const params = new URLSearchParams();
  const merged: Record<string, string | undefined> = {
    q: current.q,
    status: current.status,
    mine: current.mine,
    page: current.page,
    ...override,
  };
  for (const [k, v] of Object.entries(merged)) {
    if (v !== undefined && v !== '' && v !== 'all') params.set(k, String(v));
  }
  const qs = params.toString();
  return `/manager/deals${qs ? `?${qs}` : ''}`;
}

function formatDate(d: string | null): string {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}.${m}.${y}`;
}

function formatMoney(s: string): string {
  const n = Number(s);
  if (isNaN(n)) return s;
  return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2 }).format(n);
}
