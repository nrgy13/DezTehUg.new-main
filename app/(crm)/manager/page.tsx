import Link from 'next/link';
import { count, eq, and, gte, inArray } from 'drizzle-orm';
import { Inbox, Users, Briefcase, FileText, ArrowRight, AlertTriangle } from 'lucide-react';
import { requireRole } from '@/lib/auth/helpers';
import { db } from '@/lib/db';
import { leads } from '@/lib/db/schema/leads';
import { clients } from '@/lib/db/schema/clients';
import { deals } from '@/lib/db/schema/deals';
import { documents } from '@/lib/db/schema/documents';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { getStaleLeadsCount } from '@/lib/lead-stages-server';

export const metadata = { title: 'Менеджер — ДезТехЮг CRM' };
export const dynamic = 'force-dynamic';

export default async function ManagerDashboard() {
  const user = await requireRole('manager');

  // Одним заходом — все нужные счётчики
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    [{ newLeads }],
    [{ myActive }],
    [{ clientsCount }],
    [{ activeDeals }],
    [{ docsPreparing }],
    [{ wonThisMonth }],
    staleLeads,
  ] = await Promise.all([
    db
      .select({ newLeads: count() })
      .from(leads)
      .where(eq(leads.status, 'new')),
    db
      .select({ myActive: count() })
      .from(leads)
      .where(
        and(
          eq(leads.assignedManagerId, user.id),
          inArray(leads.status, ['contacted', 'proposal_sent', 'contract_signed', 'works_completed'])
        )
      ),
    db.select({ clientsCount: count() }).from(clients),
    db
      .select({ activeDeals: count() })
      .from(deals)
      .where(inArray(deals.status, ['draft', 'sent', 'signed', 'active'])),
    db
      .select({ docsPreparing: count() })
      .from(documents)
      .where(eq(documents.status, 'draft')),
    db
      .select({ wonThisMonth: count() })
      .from(leads)
      .where(and(eq(leads.status, 'won'), gte(leads.updatedAt, monthAgo))),
    getStaleLeadsCount(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-orbitron font-bold tracking-wide text-content-primary uppercase">
          Дашборд менеджера
        </h1>
        <p className="text-content-muted mt-1 text-sm">
          Привет, {user.name}! Сводка по твоей работе и общему состоянию воронки.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          label="Новые заявки"
          value={newLeads}
          icon={Inbox}
          href="/manager/leads?status=new"
          accent={newLeads > 0 ? 'orange' : 'muted'}
        />
        <StatCard
          label="Мои в работе"
          value={myActive}
          icon={Briefcase}
          href="/manager/leads?mine=1"
          hint="связались / КП / договор / реализована"
        />
        <StatCard
          label="Реализованы за 30 дней"
          value={wonThisMonth}
          icon={FileText}
          href="/manager/leads?status=won"
          accent={wonThisMonth > 0 ? 'green' : 'muted'}
        />
        <StatCard label="Клиенты в базе" value={clientsCount} icon={Users} href="/manager/clients" />
        <StatCard
          label="Активные договоры"
          value={activeDeals}
          icon={Briefcase}
          href="/manager/deals"
          hint="черновик / отправлен / подписан / в работе"
        />
        <StatCard
          label="Документов готовится"
          value={docsPreparing}
          icon={FileText}
          href="/manager/deals"
          hint="DOCX/PDF в очереди генерации"
        />
        <StatCard
          label="Зависших лидов"
          value={staleLeads}
          icon={AlertTriangle}
          href="/manager/leads/board"
          hint="превышен порог дней на стадии"
          accent={staleLeads > 0 ? 'orange' : 'muted'}
        />
      </div>

      <CyberpunkCard variant="default" hoverEffect={false} className="p-6">
        <h2 className="text-base font-orbitron font-semibold tracking-wider text-content-primary mb-3 uppercase">
          Что доступно прямо сейчас
        </h2>
        <ul className="text-sm text-content-secondary space-y-1.5 list-disc pl-5">
          <li>
            <Link href="/manager/leads/board" className="text-poison-green hover:underline">
              Канбан воронки
            </Link>{' '}
            — drag-n-drop по 7 этапам, конвертация в клиента, причины потери
          </li>
          <li>
            <Link href="/manager/leads" className="text-poison-green hover:underline">
              Список заявок
            </Link>{' '}
            — фильтры, поиск, ручное создание
          </li>
          <li>
            <Link href="/manager/clients" className="text-poison-green hover:underline">
              База клиентов
            </Link>{' '}
            — реквизиты, объекты, история
          </li>
        </ul>
        <p className="text-xs text-content-muted mt-4">
          Договоры, документы и календарь — в разработке (Спринт 2–3).
        </p>
      </CyberpunkCard>
    </div>
  );
}

const ACCENT_CLASSES: Record<'muted' | 'orange' | 'green', string> = {
  muted: 'text-content-primary',
  orange: 'text-neon-orange',
  green: 'text-emerald-700',
};

function StatCard({
  label,
  value,
  icon: Icon,
  href,
  hint,
  accent = 'muted',
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  hint?: string;
  accent?: 'muted' | 'orange' | 'green';
}) {
  return (
    <Link href={href} className="group block">
      <CyberpunkCard variant="default" className="p-5 h-full transition-transform group-hover:-translate-y-0.5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-orbitron tracking-wider text-content-muted uppercase">
            {label}
          </span>
          <Icon className="w-4 h-4 text-content-muted group-hover:text-poison-green transition-colors" />
        </div>
        <div className="flex items-end justify-between gap-2">
          <div className={`text-3xl font-orbitron font-bold ${ACCENT_CLASSES[accent]}`}>
            {value}
          </div>
          <ArrowRight className="w-4 h-4 text-content-muted/40 group-hover:text-poison-green group-hover:translate-x-0.5 transition-all" />
        </div>
        {hint && <div className="text-[10px] text-content-muted mt-2">{hint}</div>}
      </CyberpunkCard>
    </Link>
  );
}
