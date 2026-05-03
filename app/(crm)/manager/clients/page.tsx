import Link from 'next/link';
import { and, or, eq, ilike, desc, sql, count } from 'drizzle-orm';
import { Plus, Search } from 'lucide-react';
import { requireRole } from '@/lib/auth/helpers';
import { db } from '@/lib/db';
import { clients, type ClientStatus, type ClientType } from '@/lib/db/schema/clients';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';
import { ClientStatusBadge, ClientTypeBadge } from '@/components/crm/ClientStatusBadge';

export const metadata = { title: 'Клиенты — ДезТехЮг CRM' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

type SearchParams = {
  q?: string;
  type?: ClientType | 'all';
  status?: ClientStatus | 'all';
  mine?: '1';
  page?: string;
};

export default async function ClientsListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireRole('manager');
  const sp = await searchParams;

  const q = sp.q?.trim() ?? '';
  const filterType = sp.type && sp.type !== 'all' ? sp.type : undefined;
  const filterStatus = sp.status && sp.status !== 'all' ? sp.status : undefined;
  const onlyMine = sp.mine === '1';
  const page = Math.max(1, Number(sp.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  // Сборка условий WHERE
  const conditions = [];
  if (q.length > 0) {
    conditions.push(
      or(
        ilike(clients.shortName, `%${q}%`),
        ilike(clients.fullName, `%${q}%`),
        ilike(clients.inn, `%${q}%`),
        ilike(clients.phone, `%${q}%`)
      )!
    );
  }
  if (filterType) conditions.push(eq(clients.type, filterType));
  if (filterStatus) conditions.push(eq(clients.status, filterStatus));
  if (onlyMine) conditions.push(eq(clients.assignedManagerId, user.id));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await db
    .select({ total: count() })
    .from(clients)
    .where(whereClause);

  const rows = await db
    .select({
      id: clients.id,
      type: clients.type,
      shortName: clients.shortName,
      inn: clients.inn,
      phone: clients.phone,
      email: clients.email,
      status: clients.status,
      createdAt: clients.createdAt,
    })
    .from(clients)
    .where(whereClause)
    .orderBy(desc(clients.createdAt))
    .limit(PAGE_SIZE)
    .offset(offset);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-orbitron font-bold tracking-wide text-content-primary uppercase">
            Клиенты
          </h1>
          <p className="text-content-muted mt-1 text-sm">
            Всего: <span className="font-semibold text-content-primary">{total}</span>
          </p>
        </div>
        <CyberpunkButton href="/manager/clients/new" variant="primary" size="default">
          <Plus className="w-4 h-4 mr-2" />
          Новый клиент
        </CyberpunkButton>
      </div>

      <CyberpunkCard variant="default" hoverEffect={false} className="p-4">
        <form className="grid grid-cols-1 md:grid-cols-12 gap-3" action="" method="get">
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-content-muted pointer-events-none" />
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Поиск по названию, ИНН, телефону…"
              className="h-11 w-full rounded-md bg-bg-primary pl-10 pr-3 py-2 text-sm border border-gray-200 focus:border-poison-green focus:ring-2 focus:ring-poison-green/20 focus:outline-none transition-all"
            />
          </div>
          <select
            name="type"
            defaultValue={sp.type ?? 'all'}
            className="md:col-span-2 h-11 rounded-md bg-bg-primary px-3 text-sm border border-gray-200 focus:border-poison-green focus:ring-2 focus:ring-poison-green/20 focus:outline-none"
          >
            <option value="all">Все типы</option>
            <option value="legal">Юрлица</option>
            <option value="individual">Физлица</option>
          </select>
          <select
            name="status"
            defaultValue={sp.status ?? 'all'}
            className="md:col-span-2 h-11 rounded-md bg-bg-primary px-3 text-sm border border-gray-200 focus:border-poison-green focus:ring-2 focus:ring-poison-green/20 focus:outline-none"
          >
            <option value="all">Все статусы</option>
            <option value="lead">Лиды</option>
            <option value="active">Активные</option>
            <option value="inactive">Неактивные</option>
            <option value="blocked">Заблокированы</option>
          </select>
          <label className="md:col-span-2 flex items-center gap-2 text-sm text-content-secondary cursor-pointer">
            <input
              type="checkbox"
              name="mine"
              value="1"
              defaultChecked={onlyMine}
              className="w-4 h-4 rounded border-gray-300 text-neon-orange focus:ring-neon-orange/40"
            />
            Только мои
          </label>
          <CyberpunkButton type="submit" variant="primary" size="default" className="md:col-span-1">
            ОК
          </CyberpunkButton>
        </form>
      </CyberpunkCard>

      {rows.length === 0 ? (
        <CyberpunkCard variant="default" hoverEffect={false} className="p-10 text-center">
          <p className="text-content-muted text-sm">
            {q || filterType || filterStatus || onlyMine
              ? 'По вашему запросу ничего не найдено. Попробуйте изменить фильтры.'
              : 'Пока ни одного клиента нет.'}
          </p>
          {!q && !filterType && !filterStatus && !onlyMine && (
            <div className="mt-4">
              <CyberpunkButton href="/manager/clients/new" variant="primary">
                Создать первого
              </CyberpunkButton>
            </div>
          )}
        </CyberpunkCard>
      ) : (
        <CyberpunkCard variant="default" hoverEffect={false} className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-bg-tertiary border-b border-gray-200">
              <tr className="text-left">
                <Th>Название</Th>
                <Th>Тип</Th>
                <Th>ИНН</Th>
                <Th>Контакты</Th>
                <Th>Статус</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-gray-100 hover:bg-poison-green/5 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/manager/clients/${c.id}`}
                      className="font-medium text-content-primary hover:text-neon-orange transition-colors"
                    >
                      {c.shortName}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <ClientTypeBadge type={c.type} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-content-secondary">
                    {c.inn ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-content-secondary">
                    <div>{c.phone ?? '—'}</div>
                    <div className="text-xs text-content-muted">{c.email ?? ''}</div>
                  </td>
                  <td className="px-4 py-3">
                    <ClientStatusBadge status={c.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CyberpunkCard>
      )}

      {totalPages > 1 && (
        <Pagination current={page} total={totalPages} sp={sp} />
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2.5 text-xs font-orbitron font-semibold tracking-wider text-content-secondary uppercase">
      {children}
    </th>
  );
}

function Pagination({
  current,
  total,
  sp,
}: {
  current: number;
  total: number;
  sp: SearchParams;
}) {
  const buildUrl = (page: number) => {
    const params = new URLSearchParams();
    if (sp.q) params.set('q', sp.q);
    if (sp.type) params.set('type', sp.type);
    if (sp.status) params.set('status', sp.status);
    if (sp.mine) params.set('mine', sp.mine);
    params.set('page', String(page));
    return `?${params.toString()}`;
  };

  const pages = [];
  const start = Math.max(1, current - 2);
  const end = Math.min(total, current + 2);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <nav className="flex items-center justify-center gap-1 text-sm">
      {current > 1 && (
        <Link
          href={buildUrl(current - 1)}
          className="px-3 py-1.5 rounded border border-gray-200 text-content-secondary hover:border-neon-orange hover:text-neon-orange transition-colors"
        >
          ←
        </Link>
      )}
      {pages.map((p) => (
        <Link
          key={p}
          href={buildUrl(p)}
          className={`px-3 py-1.5 rounded border text-sm transition-colors ${
            p === current
              ? 'border-neon-orange bg-neon-orange text-white font-orbitron'
              : 'border-gray-200 text-content-secondary hover:border-neon-orange hover:text-neon-orange'
          }`}
        >
          {p}
        </Link>
      ))}
      {current < total && (
        <Link
          href={buildUrl(current + 1)}
          className="px-3 py-1.5 rounded border border-gray-200 text-content-secondary hover:border-neon-orange hover:text-neon-orange transition-colors"
        >
          →
        </Link>
      )}
    </nav>
  );
}
