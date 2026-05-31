import Link from 'next/link';
import {
  Inbox,
  Users,
  Briefcase,
  FileText,
  ArrowRight,
  AlertTriangle,
  CalendarDays,
  Wallet,
  TrendingUp,
  BarChart3,
  KanbanSquare,
  CalendarClock,
} from 'lucide-react';
import { requireRole } from '@/lib/auth/helpers';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { getManagerDashboardStats, formatRubShort } from '@/lib/dashboard/manager-stats';
import { PageTitle } from '@/components/crm/PageTitle';

export const metadata = { title: 'Менеджер — ДезТехЮг CRM' };
export const dynamic = 'force-dynamic';

export default async function ManagerDashboard() {
  const user = await requireRole('manager');
  const stats = await getManagerDashboardStats(user.id);

  return (
    <div className="space-y-6">
      <div>
        <PageTitle>Дашборд менеджера</PageTitle>
        <p className="text-content-muted mt-1 text-sm">
          Привет, {user.name}! Сводка по твоей работе и общему состоянию воронки.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <StatCard
          label="Новые заявки"
          value={stats.newLeads}
          icon={Inbox}
          href="/manager/leads?status=new"
          accent={stats.newLeads > 0 ? 'orange' : 'muted'}
        />
        <StatCard
          label="Мои в работе"
          value={stats.myActive}
          icon={Briefcase}
          href="/manager/leads?mine=1"
          hint="связались / КП / договор / реализована"
        />
        <StatCard
          label="Реализованы за 30 дней"
          value={stats.wonThisMonth}
          icon={FileText}
          href="/manager/leads?status=won"
          accent={stats.wonThisMonth > 0 ? 'green' : 'muted'}
        />
        <StatCard
          label="Конверсия за 30 дней"
          value={stats.conversion30d !== null ? `${stats.conversion30d}%` : '—'}
          icon={TrendingUp}
          href="/manager/analytics"
          hint="won / (won + lost) среди новых лидов"
          accent={
            stats.conversion30d === null
              ? 'muted'
              : stats.conversion30d >= 30
                ? 'green'
                : stats.conversion30d >= 15
                  ? 'orange'
                  : 'muted'
          }
        />
        <StatCard
          label="Ближайшие выезды (7д)"
          value={stats.upcomingVisits7d}
          icon={CalendarDays}
          href="/manager/calendar"
          hint="договоры в работе на этой неделе"
          accent={stats.upcomingVisits7d > 0 ? 'orange' : 'muted'}
        />
        <StatCard
          label="Выручка за 30 дней"
          value={formatRubShort(stats.revenue30d)}
          icon={Wallet}
          href="/manager/analytics"
          hint="по завершённым договорам"
          accent={stats.revenue30d > 0 ? 'green' : 'muted'}
        />
        <StatCard
          label="Клиенты в базе"
          value={stats.clientsCount}
          icon={Users}
          href="/manager/clients"
        />
        <StatCard
          label="Активные договоры"
          value={stats.activeDeals}
          icon={Briefcase}
          href="/manager/deals"
          hint="черновик / отправлен / подписан / в работе"
        />
        <StatCard
          label="Документов готовится"
          value={stats.docsPreparing}
          icon={FileText}
          href="/manager/documents"
          hint="DOCX/PDF в очереди генерации"
        />
        <StatCard
          label="Зависших лидов"
          value={stats.staleLeads}
          icon={AlertTriangle}
          href="/manager/leads/board"
          hint="превышен порог дней на стадии"
          accent={stats.staleLeads > 0 ? 'orange' : 'muted'}
        />
      </div>

      <CyberpunkCard variant="default" hoverEffect={false} className="p-6">
        <h2 className="text-base font-orbitron font-semibold tracking-wider text-content-primary mb-3 uppercase">
          Быстрые переходы
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <QuickLink
            href="/manager/analytics"
            icon={BarChart3}
            title="Аналитика воронки"
            subtitle="Конверсии, время в стадиях, причины потери"
          />
          <QuickLink
            href="/manager/leads/board"
            icon={KanbanSquare}
            title="Канбан воронки"
            subtitle="Лиды по 7 этапам, drag-n-drop"
          />
          <QuickLink
            href="/manager/deals/board"
            icon={KanbanSquare}
            title="Канбан сделок"
            subtitle="Договоры по статусам жизненного цикла"
          />
          <QuickLink
            href="/manager/calendar"
            icon={CalendarClock}
            title="Календарь выездов"
            subtitle="Расписание мастеров, drag-n-drop переноса дат"
          />
          <QuickLink
            href="/manager/documents"
            icon={FileText}
            title="Документы"
            subtitle="Все договоры, акты, КП, ДС с фильтрами"
          />
          <QuickLink
            href="/manager/clients"
            icon={Users}
            title="Клиенты"
            subtitle="Реквизиты, объекты, история"
          />
        </div>
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
          <div className={`text-2xl font-orbitron font-bold ${ACCENT_CLASSES[accent]}`}>
            {value}
          </div>
          <ArrowRight className="w-4 h-4 text-content-muted/40 group-hover:text-poison-green group-hover:translate-x-0.5 transition-all" />
        </div>
        {hint && <div className="text-[10px] text-content-muted mt-2">{hint}</div>}
      </CyberpunkCard>
    </Link>
  );
}

function QuickLink({
  href,
  icon: Icon,
  title,
  subtitle,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-md border border-border/40 bg-bg-card/40 px-3 py-2.5 transition-all hover:border-poison-green/60 hover:bg-bg-card/80"
    >
      <Icon className="w-5 h-5 text-content-muted group-hover:text-poison-green transition-colors mt-0.5 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-content-primary group-hover:text-poison-green transition-colors">
          {title}
        </div>
        <div className="text-[11px] text-content-muted leading-snug mt-0.5">{subtitle}</div>
      </div>
      <ArrowRight className="w-4 h-4 text-content-muted/40 group-hover:text-poison-green group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-0.5" />
    </Link>
  );
}
