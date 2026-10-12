'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { setIconBadge } from '@/lib/push/app-badge';

const POLL_MS = 60_000;

/**
 * Держит цифру на иконке приложения в синхроне с CRM, пока приложение открыто:
 * при старте, при смене страницы (закрыл наряд → вернулся к списку), при возврате
 * на вкладку и раз в минуту, пока вкладка видна. Ставит цифру ТОЛЬКО по успешному
 * ответу сервера: сбой сети или протухшая сессия не должны стирать цифру от push.
 * Ничего не рисует.
 */
export function AppBadgeSync() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('setAppBadge' in navigator)) return;
    let cancelled = false;

    async function refresh() {
      if (document.visibilityState !== 'visible') return;
      try {
        const res = await fetch('/api/push/badge', { cache: 'no-store' });
        if (!res.ok) return;
        const data: unknown = await res.json();
        const count = (data as { count?: unknown })?.count;
        if (!cancelled && typeof count === 'number') setIconBadge(count);
      } catch {
        /* оффлайн — оставляем как есть */
      }
    }

    void refresh();
    const timer = window.setInterval(refresh, POLL_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [pathname]);

  return null;
}
