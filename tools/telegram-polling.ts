/**
 * Локальный dev-режим для Telegram-бота: long polling вместо webhook.
 * Запуск: `npx tsx tools/telegram-polling.ts`
 *
 * Перед запуском убедись что:
 * - В .env.local задан TELEGRAM_BOT_TOKEN
 * - Webhook удалён (через tools/telegram-set-webhook.ts --delete или вручную)
 *   — Telegram не позволяет одновременно polling и webhook.
 *
 * Внимание: polling должен крутиться в ОДНОМ месте. Если бот обрабатывает
 * команды одновременно из polling и webhook — одна из них пропускает события.
 */
import 'dotenv/config';
// dotenv-cli тоже работает: `dotenv -e .env.local -- tsx tools/telegram-polling.ts`
// но для упрощения пытаемся подгрузить .env.local вручную.
import { config as dotenvConfig } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';

const localEnvPath = resolve(process.cwd(), '.env.local');
if (existsSync(localEnvPath)) {
  dotenvConfig({ path: localEnvPath, override: true });
}

// Proxy уведомление — фактическая настройка происходит в lib/notifications/telegram.ts
// через grammy.client.baseFetchConfig.agent (node-fetch).
const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy;
if (proxyUrl) {
  console.log(`[telegram-polling] using proxy: ${proxyUrl}`);
}

(async () => {
  const { getBot } = await import('../lib/notifications/telegram');
  const bot = getBot();

  console.log('[telegram-polling] starting…');
  const me = await bot.api.getMe();
  console.log(`[telegram-polling] bot: @${me.username} (${me.first_name})`);

  // Удалим webhook на всякий случай (polling требует чтобы webhook был снят).
  try {
    await bot.api.deleteWebhook();
    console.log('[telegram-polling] webhook cleared');
  } catch (err) {
    console.warn('[telegram-polling] deleteWebhook failed (probably not set):', err);
  }

  bot.start({
    onStart: (info) => {
      console.log(`[telegram-polling] polling started for @${info.username}`);
      console.log('[telegram-polling] press Ctrl+C to stop');
    },
  });

  // Корректное завершение по SIGINT
  const stop = () => {
    console.log('\n[telegram-polling] stopping…');
    void bot.stop();
    process.exit(0);
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
})();
