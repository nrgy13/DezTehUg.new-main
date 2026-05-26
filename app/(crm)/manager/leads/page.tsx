import Link from 'next/link';
import { and, or, eq, ilike, desc, count } from 'drizzle-orm';
import { Search, RefreshCw } from 'lucide-react';
import { requireRole } from '@/lib/auth/helpers';
import { db } from '@/lib/db';
import { leads, type LeadStatus } from '@/lib/db/schema/leads';
import { users } from '@/lib/db/schema/users';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';
import { LeadStatusBadge } from '@/components/crm/LeadStatusBadge';
import { ViewToggle } from './_components/ViewToggle';
import { NewLeadButton } from './_components/NewLeadButton';
import { badgeClassesForLead, formatDays, stageHealthLevel } from '@/lib/lead-stages';
import { getDaysInStageBatch } from '@/lib/lead-stages-server';
import { Clock } from 'lucide-react';

export const metadata = { title: 'Заявки — ДезТехЮг CRM' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

type SearchParams = {
  q?: string;
  status?: LeadStatus | 'all';
  mine?: '1';
  page?: string;
};

const STATUS_TABS: { id: LeadStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'new', label: 'Новые' },
  { id: 'contacted', label: 'Связались' },
  { id: 'proposal_sent', label: 'КП' },
  { id: 'contract_signed', label: 'Договор' },
  { id: 'works_completed', label: 'Реализована' },
  { id: 'won', label: 'Оплата' },
  { id: 'lost', label: 'Не состоялась' },
];

export default async function LeadsListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireRole('manager');
  const sp = await searchParams;

  const q = sp.q?.trim() ?? '';
  const filterStatus: LeadStatus | undefined =
    sp.status && sp.status !== 'all' ? sp.status : undefined;
  const onlyMine = sp.mine === '1';
  const page = Math.max(1, Number(sp.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const conditions = [];
  if (q.length > 0) {
    conditions.push(
      or(
        ilike(leads.contactName, `%${q}%`),
        ilike(leads.contactPhone, `%${q}%`),
        ilike(leads.contactEmail, `%${q}%`),
        ilike(leads.requestedAddress, `%${q}%`)
      )!
    );
  }
  if (filterStatus) conditions.push(eq(leads.status, filterStatus));
  if (onlyMine) conditions.push(eq(leads.assignedManagerId, user.id));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await db.select({ total: count() }).from(leads).where(whereClause);

  const rows = await db
    .select({
      id: leads.id,
      contactName: leads.contactName,
      contactPhone: leads.contactPhone,
      contactEmail: leads.contactEmail,
      requestedAddress: leads.requestedAddress,
      status: leads.status,
      channel: leads.channel,
      createdAt: leads.createdAt,
      assignedManagerId: leads.assignedManagerId,
      managerName: users.fullName,
    })
    .from(leads)
    .leftJoin(users, eq(leads.assignedManagerId, users.id))
    .where(whereClause)
    .orderBy(desc(leads.createdAt))
    .limit(PAGE_SIZE)
    .offset(offset);

  // Счётчик новых
  const [{ newCount }] = await db
    .select({ newCount: count() })
    .from(leads)
    .where(eq(leads.status, 'new'));

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const dateFmt = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' });

  // Дни на текущей стадии для отображаемых лидов
  const daysMap = await getDaysInStageBatch(rows.map((r) => r.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-orbitron font-bold tracking-wide text-content-primary uppercase">
            Заявки
          </h1>
          <p className="text-content-muted mt-1 text-sm">
            Всего: <span className="font-semibold text-content-primary">{total}</span>
            {newCount > 0 && (
              <>
                {' '}
                · Новых:{' '}
                <span className="font-orbitron font-semibold text-electric-blue">{newCount}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <NewLeadButton />
          <ViewToggle current="list" />
          <Link
            href="/manager/leads"
            className="inline-flex items-center gap-1.5 text-sm text-content-muted hover:text-poison-green transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Обновить
          </Link>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 border-b border-gray-200 -mb-px overflow-x-auto">
        {STATUS_TABS.map((t) => {
          const isActive = (t.id === 'all' && !filterStatus) || t.id === filterStatus;
          const url = new URLSearchParams();
          if (q) url.set('q', q);
          if (onlyMine) url.set('mine', '1');
          if (t.id !== 'all') url.set('status', t.id);
          return (
            <Link
              key={t.id}
              href={`/manager/leads${url.toString() ? '?' + url : ''}`}
              className={`px-4 py-2 text-sm font-orbitron uppercase tracking-wider whitespace-nowrap transition-colors border-b-2 ${
                isActive
                  ? 'border-neon-orange text-neon-orange'
                  : 'border-transparent text-content-muted hover:text-content-primary hover:border-gray-300'
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {/* Search + mine */}
      <CyberpunkCard variant="default" hoverEffect={false} className="p-4">
        <form className="grid grid-cols-1 md:grid-cols-12 gap-3" action="" method="get">
          {filterStatus && <input type="hidden" name="status" value={filterStatus} />}
          <div className="md:col-span-8 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-content-muted pointer-events-none" />
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Поиск по имени, телефону, email, адресу…"
              className="h-11 w-full rounded-md bg-bg-primary pl-10 pr-3 py-2 text-sm border border-gray-200 focus:border-poison-green focus:ring-2 focus:ring-poison-green/20 focus:outline-none transition-all"
            />
          </div>
          <label className="md:col-span-3 flex items-center gap-2 text-sm text-content-secondary cursor-pointer">
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
            {q || filterStatus || onlyMine
              ? 'По вашему запросу заявок не найдено.'
              : 'Заявок пока нет. Жди — n8n пришлёт их сам как только клиент оставит на сайте.'}
          </p>
        </CyberpunkCard>
      ) : (
        <CyberpunkCard variant="default" hoverEffect={false} className="overflow-hidden">
          {/* Desktop: таблица */}
          <table className="hidden md:table w-full text-sm">
            <thead className="bg-bg-tertiary border-b border-gray-200">
              <tr className="text-left">
                <Th>Контакт</Th>
                <Th>Адрес</Th>
                <Th>Статус</Th>
                <Th>Дней</Th>
                <Th>Канал</Th>
                <Th>Менеджер</Th>
                <Th>Создана</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id} className="border-b border-gray-100 hover:bg-poison-green/5 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/manager/leads/${l.id}`}
                      className="font-medium text-content-primary hover:text-neon-orange transition-colors"
                    >
                      {l.contactName ?? '— без имени —'}
                    </Link>
                    <div className="text-xs text-content-muted mt-0.5">
                      {l.contactPhone ?? '—'}{' '}
                      {l.contactEmail && <span>· {l.contactEmail}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-content-secondary">
                    {l.requestedAddress ?? <span className="text-content-muted">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <LeadStatusBadge status={l.status} />
                  </td>
                  <td className="px-4 py-3">
                    <DaysCell status={l.status} days={daysMap[l.id] ?? 0} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-content-secondary">
                    {l.channel ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-content-secondary">
                    {l.managerName ?? <span className="text-content-muted">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-content-muted whitespace-nowrap">
                    {dateFmt.format(l.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile: карточки */}
          <div className="md:hidden divide-y divide-gray-100">
            {rows.map((l) => (
              <Link
                key={l.id}
                href={`/manager/leads/${l.id}`}
                className="block p-4 hover:bg-poison-green/5 active:bg-poison-green/10 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <span className="font-medium text-content-primary line-clamp-1">
                    {l.contactName ?? '— без имени —'}
                  </span>
                  <LeadStatusBadge status={l.status} />
                </div>
                <div className="text-xs text-content-secondary mb-1">
                  {l.contactPhone ?? '—'}
                  {l.contactEmail && <span className="text-content-muted"> · {l.contactEmail}</span>}
                </div>
                {l.requestedAddress && (
                  <div className="text-xs text-content-muted mb-1.5 line-clamp-2">
                    {l.requestedAddress}
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <DaysCell status={l.status} days={daysMap[l.id] ?? 0} />
                  <span className="text-xs text-content-muted">{dateFmt.format(l.createdAt)}</span>
                </div>
                {(l.channel || l.managerName) && (
                  <div className="flex items-center gap-2 mt-1.5 text-[11px] text-content-muted">
                    {l.channel && <span className="font-mono">{l.channel}</span>}
                    {l.managerName && <span className="ml-auto truncate">мен.: {l.managerName}</span>}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </CyberpunkCard>
      )}

      {totalPages > 1 && <Pagination current={page} total={totalPages} sp={sp} />}
    </div>
  );
}

function DaysCell({ status, days }: { status: LeadStatus; days: number }) {
  const health = stageHealthLevel(status, days);
  if (health === 'final') {
    return <span className="text-xs text-content-muted">—</span>;
  }
  const c = badgeClassesForLead(status, days);
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-orbitron font-semibold ${c.bg} ${c.text}`}
      title={
        health === 'stale'
          ? `⚠ Зависший: ${days} дн.`
          : `${days} дн. на стадии`
      }
    >
      <Clock className="w-3 h-3" />
      {formatDays(days)}
    </span>
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
