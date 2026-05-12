/**
 * Клиентская часть web-push: подписка/отписка через браузерный PushManager.
 *
 * Использование:
 *   const status = await getPushStatus();
 *   if (status === 'unsubscribed') await enablePush();
 *
 * Требует HTTPS (или localhost для dev). На iOS работает только после
 * «Установить на главный экран» (Safari standalone), и только с iOS 16.4+.
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export type PushStatus =
  | 'unsupported' // браузер не поддерживает SW или PushManager
  | 'denied' // юзер запретил уведомления
  | 'unsubscribed' // SW есть, но подписки нет
  | 'subscribed' // активная подписка
  | 'not_configured'; // VAPID-ключ не прописан в env

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export async function getPushStatus(): Promise<PushStatus> {
  if (!isPushSupported()) return 'unsupported';
  if (!VAPID_PUBLIC_KEY) return 'not_configured';
  if (Notification.permission === 'denied') return 'denied';

  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return 'unsubscribed';
  const sub = await reg.pushManager.getSubscription();
  return sub ? 'subscribed' : 'unsubscribed';
}

/**
 * Запрашивает permission, подписывает SW, отправляет subscription на сервер.
 * Возвращает финальный статус.
 */
export async function enablePush(): Promise<PushStatus> {
  if (!isPushSupported()) return 'unsupported';
  if (!VAPID_PUBLIC_KEY) return 'not_configured';

  // 1) Спрашиваем permission — обязательно по жесту юзера.
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') {
    return perm === 'denied' ? 'denied' : 'unsubscribed';
  }

  // 2) Ждём готовности SW (next-pwa регистрирует его автоматически).
  const reg = await navigator.serviceWorker.ready;

  // 3) Подписываемся (или достаём существующую подписку).
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  // 4) Шлём на сервер.
  const subJson = sub.toJSON() as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
  if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) {
    throw new Error('Subscription is missing endpoint/keys');
  }
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: subJson.endpoint,
      keys: { p256dh: subJson.keys.p256dh, auth: subJson.keys.auth },
      userAgent: navigator.userAgent,
    }),
  });
  if (!res.ok) {
    throw new Error(`subscribe failed: ${res.status}`);
  }

  return 'subscribed';
}

/**
 * Отписывается локально (PushManager.unsubscribe) и удаляет запись с сервера.
 */
export async function disablePush(): Promise<PushStatus> {
  if (!isPushSupported()) return 'unsupported';
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return 'unsubscribed';
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return 'unsubscribed';

  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  await fetch('/api/push/unsubscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint }),
  }).catch(() => {
    // Даже если сервер недоступен — локально мы отписались.
  });
  return 'unsubscribed';
}
