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
  Wrench,
  BarChart3,
} from 'lucide-react';
import type { UserRole } from '@/lib/db/schema/users';

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
};

const NAV: NavItem[] = [
  // Менеджер
  { href: '/manager', label: 'Дашборд', icon: LayoutDashboard, roles: ['manager'] },
  { href: '/manager/leads', label: 'Заявки', icon: Inbox, roles: ['manager'] },
  { href: '/manager/clients', label: 'Клиенты', icon: Users, roles: ['manager'] },
  { href: '/manager/deals', label: 'Договоры', icon: Briefcase, roles: ['manager'] },
  { href: '/manager/documents', label: 'Документы', icon: FileText, roles: ['manager'] },
  { href: '/manager/calendar', label: 'Календарь', icon: Calendar, roles: ['manager'] },
  { href: '/manager/reports', label: 'Отчёты', icon: BarChart3, roles: ['manager'] },

  // Мастер
  { href: '/master', label: 'Мои выезды', icon: Wrench, roles: ['master'] },
  { href: '/master/calendar', label: 'Календарь', icon: Calendar, roles: ['master'] },
  { href: '/master/completed', label: 'Выполнено', icon: ListChecks, roles: ['master'] },

  // Админ
  { href: '/admin', label: 'Дашборд', icon: LayoutDashboard, roles: ['admin'] },
  { href: '/admin/users', label: 'Пользователи', icon: Users, roles: ['admin'] },
  { href: '/admin/services', label: 'Услуги', icon: Wrench, roles: ['admin'] },
  { href: '/admin/templates', label: 'Шаблоны', icon: FileText, roles: ['admin'] },
  { href: '/admin/settings', label: 'Настройки', icon: Settings, roles: ['admin'] },
];

export function Sidebar({
  user,
}: {
  user: { id: string; email: string; name: string; role: UserRole };
}) {
  const pathname = usePathname();

  // Админу показываем все его пункты + (опционально) пункты других ролей
  const visibleItems = NAV.filter((item) => {
    if (user.role === 'admin') return item.roles.includes('admin');
    return item.roles.includes(user.role);
  });

  return (
    <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col h-screen sticky top-0">
      {/* Логотип */}
      <div className="px-5 py-5 border-b border-slate-800">
        <Link href={`/${user.role === 'admin' ? 'admin' : user.role === 'manager' ? 'manager' : 'master'}`}>
          <div className="text-lg font-bold text-white">ДезТехЮг</div>
          <div className="text-xs text-slate-500 mt-0.5">CRM v0.1</div>
        </Link>
      </div>

      {/* Навигация */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <ul className="space-y-1">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-orange-600/20 text-orange-300 font-medium'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Профиль и выход */}
      <div className="border-t border-slate-800 p-3 space-y-2">
        <div className="px-3 py-2">
          <div className="text-sm text-white font-medium truncate">{user.name}</div>
          <div className="text-xs text-slate-500 truncate">{user.email}</div>
          <div className="text-xs text-orange-400 mt-0.5 capitalize">{user.role}</div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-red-950/30 hover:text-red-300 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Выйти
        </button>
      </div>
    </aside>
  );
}
