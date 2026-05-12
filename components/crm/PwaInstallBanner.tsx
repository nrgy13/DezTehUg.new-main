'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

// Chrome/Edge: beforeinstallprompt event с .prompt()/.userChoice.
// iOS: события нет — показываем инструкцию вручную, если standalone не активен.
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'pwa-install-dismissed-at';
const DISMISS_DAYS = 7;

/**
 * Баннер «Установить ДТЮ CRM» — показывается мастеру на мобиле,
 * если PWA не установлена. Закрытие — на неделю (localStorage).
 *
 * На Android: при наличии beforeinstallprompt — кнопка вызывает нативный prompt.
 * На iOS: показывается инструкция «Поделиться → На экран Домой».
 */
export function PwaInstallBanner() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Уже установлено как PWA? — не показываем.
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // @ts-expect-error iOS Safari proprietary
      (typeof window.navigator.standalone === 'boolean' && window.navigator.standalone);
    if (standalone) {
      setDismissed(true);
      return;
    }

    // Проверка cooldown
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const since = Date.now() - Number(dismissedAt);
      if (since < DISMISS_DAYS * 24 * 60 * 60 * 1000) {
        setDismissed(true);
        return;
      }
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);

    // iOS hint: показываем только на iPhone/iPad, и только если не в standalone.
    const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent);
    if (isIos && !standalone) {
      // Подождём чуть-чуть — чтобы не дёргать сразу при первом заходе.
      const t = setTimeout(() => setShowIosHint(true), 3_000);
      return () => {
        clearTimeout(t);
        window.removeEventListener('beforeinstallprompt', onPrompt);
      };
    }

    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (dismissed) return null;
  if (!installEvent && !showIosHint) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  }

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    const result = await installEvent.userChoice;
    if (result.outcome === 'accepted') {
      setInstallEvent(null);
      setDismissed(true);
    } else {
      dismiss(); // отказался — не дёргаем неделю
    }
  }

  return (
    <div className="lg:hidden fixed bottom-3 left-3 right-3 z-40 bg-bg-primary border border-neon-orange/40 rounded-xl shadow-2xl p-3 flex items-start gap-3">
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-neon-orange/10 flex items-center justify-center">
        <Download className="w-5 h-5 text-neon-orange" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-content-primary">
          Установить ДТЮ CRM
        </div>
        {installEvent ? (
          <div className="text-xs text-content-muted mt-0.5">
            Один тап — и приложение появится на главном экране
          </div>
        ) : (
          <div className="text-xs text-content-muted mt-0.5 leading-snug">
            Тапни <span className="font-medium">«Поделиться»</span> внизу Safari →{' '}
            <span className="font-medium">«На экран &laquo;Домой&raquo;»</span>
          </div>
        )}
        {installEvent && (
          <button
            type="button"
            onClick={install}
            className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-neon-orange text-white text-xs font-medium hover:bg-neon-orange/90 active:bg-neon-orange/80"
          >
            <Download className="w-3 h-3" />
            Установить
          </button>
        )}
      </div>
      <button
        type="button"
        aria-label="Закрыть"
        onClick={dismiss}
        className="flex-shrink-0 p-1 -mt-0.5 -mr-0.5 rounded text-content-muted hover:text-content-primary"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
