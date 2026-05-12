import { webhookCallback } from 'grammy';
import { getBot } from '@/lib/notifications/telegram';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Endpoint для Telegram webhook.
// Установка webhook: tools/telegram-set-webhook.ts (одноразово при деплое).
// Защита от посторонних — secret_token в заголовке X-Telegram-Bot-Api-Secret-Token,
// который Telegram добавляет если задан при setWebhook.
//
// Для DEV (localhost не доступен снаружи) — не устанавливаем webhook,
// вместо этого запускаем polling через `npx tsx tools/telegram-polling.ts`.
//
// Handler создаётся ЛЕНИВО (внутри POST), а не на top-level. Иначе при сборке
// `next build` (стадия "Collecting page data") пытается импортировать модуль,
// getBot() вызывает getBotToken() → throws если TELEGRAM_BOT_TOKEN не задан
// (а в build-time на проде он недоступен — env только в runtime).

let cachedHandler: ((req: Request) => Promise<Response>) | null = null;

function getHandler() {
  if (!cachedHandler) {
    cachedHandler = webhookCallback(getBot(), 'std/http', {
      secretToken: process.env.TELEGRAM_WEBHOOK_SECRET,
    });
  }
  return cachedHandler;
}

export async function POST(req: Request): Promise<Response> {
  return getHandler()(req);
}
