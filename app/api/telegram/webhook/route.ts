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

const handler = webhookCallback(getBot(), 'std/http', {
  secretToken: process.env.TELEGRAM_WEBHOOK_SECRET,
});

export async function POST(req: Request): Promise<Response> {
  return handler(req);
}
