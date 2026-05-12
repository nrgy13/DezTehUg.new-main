/**
 * Управление Telegram webhook на проде.
 *
 * Установить webhook:
 *   npx tsx tools/telegram-set-webhook.ts https://crm.дезтехюг.рф
 *
 * Удалить webhook (для возврата к polling):
 *   npx tsx tools/telegram-set-webhook.ts --delete
 *
 * Узнать текущий webhook:
 *   npx tsx tools/telegram-set-webhook.ts --info
 *
 * Перед запуском должен быть задан:
 *   TELEGRAM_BOT_TOKEN — токен бота
 *   TELEGRAM_WEBHOOK_SECRET — (опц.) секрет для защиты webhook от посторонних запросов
 */
import { config as dotenvConfig } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { Bot } from 'grammy';
import { ProxyAgent, setGlobalDispatcher } from 'undici';

const localEnvPath = resolve(process.cwd(), '.env.local');
if (existsSync(localEnvPath)) {
  dotenvConfig({ path: localEnvPath, override: true });
}

const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy;
if (proxyUrl) {
  setGlobalDispatcher(new ProxyAgent(proxyUrl));
}

(async () => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error('TELEGRAM_BOT_TOKEN не задан');
    process.exit(1);
  }

  const bot = new Bot(token);
  const arg = process.argv[2];

  if (arg === '--info') {
    const info = await bot.api.getWebhookInfo();
    console.log(JSON.stringify(info, null, 2));
    return;
  }

  if (arg === '--delete') {
    await bot.api.deleteWebhook({ drop_pending_updates: true });
    console.log('Webhook удалён.');
    return;
  }

  if (!arg || !arg.startsWith('http')) {
    console.error('Использование:');
    console.error('  npx tsx tools/telegram-set-webhook.ts https://crm.example.com');
    console.error('  npx tsx tools/telegram-set-webhook.ts --delete');
    console.error('  npx tsx tools/telegram-set-webhook.ts --info');
    process.exit(1);
  }

  const baseUrl = arg.replace(/\/+$/, '');
  const webhookUrl = `${baseUrl}/api/telegram/webhook`;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

  await bot.api.setWebhook(webhookUrl, {
    secret_token: secret,
    drop_pending_updates: true,
    allowed_updates: ['message', 'callback_query'],
  });

  console.log(`Webhook установлен: ${webhookUrl}`);
  if (secret) {
    console.log('  secret_token: задан (Telegram будет слать заголовок X-Telegram-Bot-Api-Secret-Token)');
  } else {
    console.log('  ⚠ TELEGRAM_WEBHOOK_SECRET не задан — endpoint открыт для любых POST-запросов');
  }
})();
