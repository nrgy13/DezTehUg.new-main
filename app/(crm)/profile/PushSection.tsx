'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Bell, BellOff, AlertTriangle } from 'lucide-react';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';
import {
  enablePush,
  disablePush,
  getPushStatus,
  isPushSupported,
  type PushStatus,
} from '@/lib/push/client';

export function PushSection() {
  const [status, setStatus] = useState<PushStatus | 'loading'>('loading');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getPushStatus().then(setStatus).catch(() => setStatus('unsupported'));
  }, []);

  async function handleEnable() {
    setBusy(true);
    try {
      const next = await enablePush();
      setStatus(next);
      if (next === 'subscribed') {
        toast.success('Push-уведомления включены');
      } else if (next === 'denied') {
        toast.error('Браузер заблокировал уведомления. Разреши их в настройках сайта.');
      } else {
        toast.warning('Не удалось подписаться. Попробуй ещё раз.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Ошибка подписки: ' + (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable() {
    setBusy(true);
    try {
      const next = await disablePush();
      setStatus(next);
      toast.success('Push-уведомления выключены');
    } catch (err) {
      console.error(err);
      toast.error('Ошибка отписки');
    } finally {
      setBusy(false);
    }
  }

  if (status === 'loading') {
    return (
      <div className="text-sm text-content-muted">Проверяю поддержку push…</div>
    );
  }

  if (status === 'unsupported') {
    return (
      <div className="flex items-start gap-3 text-sm text-content-muted">
        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" />
        <div>
          Этот браузер не поддерживает push-уведомления. Открой CRM в Chrome
          (Android) или установи как PWA на главный экран (iOS 16.4+).
        </div>
      </div>
    );
  }

  if (status === 'not_configured') {
    return (
      <div className="flex items-start gap-3 text-sm text-content-muted">
        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" />
        <div>VAPID-ключи не настроены на сервере. Push временно недоступен.</div>
      </div>
    );
  }

  if (status === 'denied') {
    return (
      <div className="flex items-start gap-3 text-sm">
        <BellOff className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-500" />
        <div className="text-content-secondary">
          Уведомления запрещены в настройках браузера. Открой настройки сайта
          (значок замка в адресной строке) → разреши уведомления → перезагрузи
          страницу.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {status === 'subscribed' ? (
          <>
            <Bell className="w-5 h-5 text-poison-green flex-shrink-0" />
            <div className="flex-1">
              <div className="text-sm text-content-primary font-medium">
                Push-уведомления включены
              </div>
              <div className="text-xs text-content-muted">
                Приходят на это устройство, когда CRM закрыта
              </div>
            </div>
            <CyberpunkButton
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDisable}
              disabled={busy}
            >
              {busy ? 'Отключаю…' : 'Отключить'}
            </CyberpunkButton>
          </>
        ) : (
          <>
            <BellOff className="w-5 h-5 text-content-muted flex-shrink-0" />
            <div className="flex-1">
              <div className="text-sm text-content-primary font-medium">
                Push-уведомления выключены
              </div>
              <div className="text-xs text-content-muted">
                Получай уведомления о выездах прямо на телефон
              </div>
            </div>
            <CyberpunkButton
              type="button"
              size="sm"
              onClick={handleEnable}
              disabled={busy}
            >
              {busy ? 'Включаю…' : 'Включить'}
            </CyberpunkButton>
          </>
        )}
      </div>
    </div>
  );
}
