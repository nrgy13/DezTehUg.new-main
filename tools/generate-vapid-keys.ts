/**
 * Генератор VAPID ключей для web-push.
 *
 * Запуск: `npm run push:gen-vapid`
 *
 * Печатает пару (public + private). Public также экспортируется как
 * NEXT_PUBLIC_VAPID_PUBLIC_KEY для клиента (registerPush() должен передать
 * его в pushManager.subscribe → серверу).
 *
 * ОДИН РАЗ генерируется на проект. Если ключи перегенерить — все существующие
 * подписки в push_subscriptions перестанут работать (нужно будет пере-подписаться).
 *
 * Куда класть:
 *   .env.local   (dev)
 *   /opt/deztech-crm/.env  (prod, через SSH)
 */

import webpush from 'web-push';

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

console.log('');
console.log('VAPID keys сгенерированы. Положи в .env.local (и потом на prod):');
console.log('');
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_SUBJECT=mailto:sanctumizm@gmail.com`);
console.log('');
console.log('NEXT_PUBLIC_VAPID_PUBLIC_KEY доступен в браузерном коде через process.env.');
console.log('VAPID_PUBLIC_KEY/PRIVATE_KEY — только на сервере.');
console.log('VAPID_SUBJECT — контактный email/URL, прописывается в JWT (требуется RFC8292).');
console.log('');
