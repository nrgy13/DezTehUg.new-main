/* Sprint 6 · Web Push — кастомный handler сервис-воркера.
 *
 * Подключается через next-pwa workboxOptions.importScripts = ['/push-sw.js'].
 * Workbox генерит основной sw.js, после регистрации он подгружает этот скрипт
 * через importScripts(). У нас здесь — push & notificationclick события.
 */

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
    self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag,
      // renotify: при том же tag — всё равно показывать как новое (вибрация и звук).
      renotify: true,
      data: { url },
      // Android: показать на полный экран если экран выключен.
      requireInteraction: false,
    }),
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
