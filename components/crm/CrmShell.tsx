'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { Sidebar } from './Sidebar';
import { PwaInstallBanner } from './PwaInstallBanner';
import type { UserRole } from '@/lib/db/schema/users';

type Props = {
  user: { id: string; email: string; name: string; role: UserRole };
  pendingDeletionsCount: number;
  inboxCount: number;
  children: React.ReactNode;
};

export function CrmShell({ user, pendingDeletionsCount, inboxCount, children }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Закрываем меню при смене страницы (мастер тапнул пункт → схлопываем).
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Блокируем скролл body когда drawer открыт.
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [mobileOpen]);

  const homeHref = `/${user.role === 'admin' ? 'admin' : user.role === 'manager' ? 'manager' : 'master'}`;

  return (
    <div className="min-h-screen lg:flex bg-bg-secondary text-content-primary">
      {/* Мобильная top-bar — видна только на мобиле */}
      <div className="lg:hidden sticky top-0 z-30 flex items-center justify-between gap-3 px-3 py-2 bg-bg-primary border-b border-gray-200">
        <button
          type="button"
          aria-label="Открыть меню"
          onClick={() => setMobileOpen(true)}
          className="p-2 -ml-2 rounded-lg hover:bg-bg-secondary active:bg-gray-100 touch-manipulation"
        >
          <Menu className="w-6 h-6 text-content-primary" />
        </button>
        <Link href={homeHref} className="flex items-center justify-center">
          <span className="text-base font-bebas font-bold tracking-wider">
            <span style={{ color: '#e20819' }}>ДЕЗ</span>
            <span style={{ color: '#4cb032' }}>ТЕХ</span>
            <span style={{ color: '#e20819' }}>ЮГ</span>
          </span>
        </Link>
        <div className="w-10" aria-hidden="true" />
      </div>

      {/* Десктопный sidebar — sticky слева, видим только на lg+. */}
      <aside className="hidden lg:block lg:sticky lg:top-0 lg:h-screen lg:flex-shrink-0">
        <Sidebar
          user={user}
          pendingDeletionsCount={pendingDeletionsCount}
          inboxCount={inboxCount}
        />
      </aside>

      {/* Мобильный drawer — fixed overlay, появляется по клику hamburger.
          Без анимации: tailwindcss-animate в dev-режиме конфликтует с
          React rerender — animation never settles. На мобиле drawer
          должен открываться мгновенно, это даже удобнее для UX. */}
      {mobileOpen && (
        <>
          <button
            type="button"
            aria-label="Закрыть меню (фон)"
            onClick={() => setMobileOpen(false)}
            className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          />
          <aside className="lg:hidden fixed inset-y-0 left-0 z-50 w-64 shadow-2xl">
            <button
              type="button"
              aria-label="Закрыть меню"
              onClick={() => setMobileOpen(false)}
              className="absolute top-3 right-3 z-10 p-1.5 rounded-lg hover:bg-bg-secondary"
            >
              <X className="w-5 h-5 text-content-muted" />
            </button>
            <Sidebar
              user={user}
              pendingDeletionsCount={pendingDeletionsCount}
              inboxCount={inboxCount}
            />
          </aside>
        </>
      )}

      <main className="flex-1 overflow-x-hidden min-w-0">
        <div className="px-4 sm:px-6 py-4 sm:py-6 max-w-7xl mx-auto">{children}</div>
      </main>

      {/* PWA install banner — только для master, только на мобиле */}
      {user.role === 'master' && <PwaInstallBanner />}
    </div>
  );
}
