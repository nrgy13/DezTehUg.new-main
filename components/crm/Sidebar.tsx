'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  LayoutDashboard,
  Users,
  FileText,
  Calendar,
  Briefcase,
  ListChecks,
  Settings,
  LogOut,
  Inbox,
  Bell,
  Wrench,
  BarChart3,
  UserCircle,
  Trash2,
  BookOpen,
} from 'lucide-react';
import type { UserRole } from '@/lib/db/schema/users';
import { LogoText } from '@/components/layout/LogoText';

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
  // Тонкая рамка-маркер стадии воронки (Заявки → Клиенты → Договоры).
  // Видна постоянно, не зависит от active-state.
  stageBorder?: string;
  // Страница ещё не реализована — кнопка disabled, hover-tooltip «Скоро».
  disabled?: boolean;
};

const NAV: NavItem[] = [
  // Менеджер
  { href: '/manager', label: 'Дашборд', icon: LayoutDashboard, roles: ['manager'] },
  { href: '/manager/leads', label: 'Заявки', icon: Inbox, roles: ['manager'], stageBorder: 'border border-green-500/70' },
  { href: '/manager/clients', label: 'Клиенты', icon: Users, roles: ['manager'], stageBorder: 'border border-amber-400/80' },
  { href: '/manager/deals', label: 'Договоры', icon: Briefcase, roles: ['manager'], stageBorder: 'border border-blue-500/70' },
  { href: '/manager/analytics', label: 'Аналитика', icon: BarChart3, roles: ['manager'] },
  { href: '/manager/documents', label: 'Документы', icon: FileText, roles: ['manager'] },
  { href: '/manager/calendar', label: 'Календарь', icon: Calendar, roles: ['manager'] },
  { href: '/manager/reports', label: 'Отчёты', icon: BarChart3, roles: ['manager'] },
  { href: '/manager/inbox', label: 'Уведомления', icon: Bell, roles: ['manager'] },

  // Мастер
  { href: '/master', label: 'Мои выезды', icon: Wrench, roles: ['master'] },
  { href: '/master/calendar', label: 'Календарь', icon: Calendar, roles: ['master'] },
  { href: '/master/completed', label: 'Выполнено', icon: ListChecks, roles: ['master'] },

  // Админ
  { href: '/admin', label: 'Дашборд', icon: LayoutDashboard, roles: ['admin'] },
  { href: '/admin/users', label: 'Пользователи', icon: Users, roles: ['admin'] },
  // Sprint 9: Регина (manager) получила админ-разделы — всё, кроме «Пользователи».
  { href: '/admin/services', label: 'Услуги', icon: Wrench, roles: ['admin', 'manager'] },
  { href: '/admin/templates', label: 'Шаблоны', icon: FileText, roles: ['admin', 'manager'] },
  { href: '/admin/deletions', label: 'Удаления', icon: Trash2, roles: ['admin', 'manager'] },
  { href: '/admin/settings', label: 'Настройки', icon: Settings, roles: ['admin', 'manager'] },

  // Инструкция — для всех ролей, всегда в самом низу навигации.
  { href: '/manual', label: 'Инструкция', icon: BookOpen, roles: ['admin', 'manager', 'master'] },
];

const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Администратор',
  manager: 'Менеджер',
  master: 'Мастер',
};

export function Sidebar({
  user,
  pendingDeletionsCount = 0,
  inboxCount = 0,
}: {
  user: { id: string; email: string; name: string; role: UserRole };
  pendingDeletionsCount?: number;
  inboxCount?: number;
}) {
  const pathname = usePathname();
  const isProfile = pathname === '/profile' || pathname.startsWith('/profile/');

  const visibleItems = NAV.filter((item) => {
    if (user.role === 'admin') return item.roles.includes('admin');
    return item.roles.includes(user.role);
  });

  const homeHref = `/${user.role === 'admin' ? 'admin' : user.role === 'manager' ? 'manager' : 'master'}`;

  // Внутренняя обёртка сайдбара. Sticky/responsive — на уровне CrmShell <aside>.
  return (
    <div className="w-64 bg-bg-primary border-r border-gray-200 flex flex-col h-full">
      {/* Логотип */}
      <div className="px-5 py-5 border-b border-gray-200">
        <Link href={homeHref} className="block">
          <LogoText />
          <div className="text-[10px] font-orbitron tracking-widest text-content-muted mt-1 uppercase">
            CRM · v0.1
          </div>
        </Link>
      </div>

      {/* Навигация */}
      <nav className="flex-1 overflow-y-auto py-3 px-3">
        <ul className="space-y-0.5">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            // Для root-страниц роли (/manager, /admin, /master) — строгое равенство.
            // Иначе href '/manager' матчился бы на любой /manager/* и подсвечивал «Дашборд»
            // когда юзер на «Заявках», «Клиентах» и т.д.
            const isRootRole =
              item.href === '/manager' || item.href === '/admin' || item.href === '/master';
            const isActive = isRootRole
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(item.href + '/');
            // Disabled — страница ещё не реализована. Рендерим как <span>
            // вместо <Link>, чтобы клик не работал. Стили — приглушённые.
            if (item.disabled) {
              return (
                <li key={item.href}>
                  <span
                    title="Скоро"
                    aria-disabled="true"
                    className={`flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm text-content-muted/60 cursor-not-allowed select-none ${item.stageBorder ?? ''}`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0 opacity-60" />
                    <span className="flex-1">{item.label}</span>
                    <span className="text-[9px] font-orbitron tracking-wider uppercase text-content-muted/50">
                      скоро
                    </span>
                  </span>
                </li>
              );
            }
            const showDeletionsBadge =
              item.href === '/admin/deletions' && pendingDeletionsCount > 0;
            const showInboxBadge = item.href === '/manager/inbox' && inboxCount > 0;
            const badgeValue = showDeletionsBadge
              ? pendingDeletionsCount
              : showInboxBadge
                ? inboxCount
                : null;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm transition-all duration-200 ${
                    item.stageBorder ?? ''
                  } ${
                    isActive
                      ? 'bg-neon-orange/10 text-neon-orange font-medium border-l-2 border-l-neon-orange pl-[10px]'
                      : 'text-content-secondary hover:bg-poison-green/10 hover:text-poison-green'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {badgeValue !== null && (
                    <span className="px-1.5 py-0.5 text-[10px] font-orbitron font-semibold bg-neon-orange text-white rounded">
                      {badgeValue}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Профиль и выход */}
      <div className="border-t border-gray-200 p-3 space-y-1">
        <div className="px-3 py-2">
          <div className="text-sm text-content-primary font-medium truncate">{user.name}</div>
          <div className="text-xs text-content-muted truncate">{user.email}</div>
          <div className="text-[10px] font-orbitron tracking-wider text-neon-orange mt-1 uppercase">
            {ROLE_LABEL[user.role]}
          </div>
        </div>
        <Link
          href="/profile"
          className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm transition-all duration-200 ${
            isProfile
              ? 'bg-neon-orange/10 text-neon-orange font-medium border-l-2 border-neon-orange pl-[10px]'
              : 'text-content-secondary hover:bg-poison-green/10 hover:text-poison-green'
          }`}
        >
          <UserCircle className="w-4 h-4" />
          Профиль
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm text-content-secondary hover:bg-red-50 hover:text-red-600 transition-all duration-200"
        >
          <LogOut className="w-4 h-4" />
          Выйти
        </button>
      </div>
    </div>
  );
}
