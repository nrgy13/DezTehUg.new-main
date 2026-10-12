/**
 * Клиентская обёртка над PWA Badging API (цифра на иконке приложения).
 * Без поддержки (браузерная вкладка iOS, Firefox) — молча ничего не делает: цифра —
 * приятное дополнение, ронять из-за неё интерфейс нельзя.
 */

type BadgeNavigator = Navigator & {
  setAppBadge?: (n?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

export function setIconBadge(n: number): void {
  if (typeof navigator === 'undefined' || !Number.isInteger(n) || n < 0) return;
  try {
    const nav = navigator as BadgeNavigator;
    const p = n === 0 ? nav.clearAppBadge?.() : nav.setAppBadge?.(Math.min(n, 99999));
    void p?.catch(() => undefined);
  } catch {
    /* без цифры — не беда */
  }
}

export function clearIconBadge(): void {
  setIconBadge(0);
}
