/* Sprint 6 · Web Push — кастомный handler сервис-воркера.
 *
 * Подключается через next-pwa workboxOptions.importScripts = ['/push-sw.js'].
 * Workbox генерит основной sw.js, после регистрации он подгружает этот скрипт
 * через importScripts(). У нас здесь — push & notificationclick события.
 */

/* Цифра на иконке приложения (PWA Badging API, 10.2026 — «как на worka»).
 * Сервер кладёт в payload поле badge = число для ЭТОГО получателя (lib/push/badge.ts).
 * НЕ путать с options.badge в showNotification — это картинка-значок уведомления, а не счётчик.
 * iOS снимает разрешение за push без показа уведомления → showNotification вызываем ВСЕГДА,
 * а любые ошибки Badging API глушим: цифра — приятное дополнение, уведомление — главное.
 */
function badgeCount(data) {
  const n = data && data.badge;
  return Number.isInteger(n) && n >= 0 && n <= 99999 ? n : null;
}

function setIconCount(count) {
  try {
    const nav = self.navigator;
    if (count === null || !nav) return Promise.resolve();
    const fn = count === 0 ? nav.clearAppBadge : nav.setAppBadge;
    if (typeof fn !== 'function') return Promise.resolve();
    return Promise.resolve(count === 0 ? fn.call(nav) : fn.call(nav, count)).catch(() => {});
  } catch (err) {
    return Promise.resolve();
  }
}

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (err) {
    // Если payload не JSON — берём как текст.
    data = { title: 'ДТЮ', body: event.data?.text() || 'Новое уведомление' };
  }

  const title = data.title || 'ДезТехЮг CRM';
  const body = data.body || '';
  const url = data.url || '/';
  const tag = data.tag || 'dtu-default';

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, {
        body,
        icon: '/icons/icon-192.png',
        // Картинка-значок уведомления (Android), НЕ цифра на иконке — та ставится setIconCount.
        badge: '/icons/icon-192.png',
        tag,
        // renotify: при том же tag — всё равно показывать как новое (вибрация и звук).
        renotify: true,
        data: { url },
        // Android: показать на полный экран если экран выключен.
        requireInteraction: false,
      }),
      setIconCount(badgeCount(data)),
    ]),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || '/';

  // Фокус на существующее окно с этим URL или открыть новое.
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          // Если уже открыта вкладка приложения — фокусируем и навигируем.
          if ('focus' in client) {
            client.focus();
            if ('navigate' in client) {
              client.navigate(url);
            }
            return;
          }
        }
        // Иначе — открываем новое окно.
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      }),
  );
});
