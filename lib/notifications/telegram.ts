// NB: НЕ ставим `import 'server-only'` чтобы этот модуль можно было загружать
// из tools/telegram-polling.ts (запускается как самостоятельный Node-процесс
// через tsx, без Next.js webpack). Не импортируй из client components —
// будет exposed TELEGRAM_BOT_TOKEN через process.env (хотя в client он будет
// undefined и getBot() кинет ошибку).
import { Bot, GrammyError, HttpError } from 'grammy';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { eq, and, gte } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema/users';

// HTTPS_PROXY support — для dev в РФ где api.telegram.org заблокирован.
// На проде VPS обычно прямой доступ — переменная не задана, прокси не активен.
// grammy использует node-fetch v2 — пробрасываем proxy через agent опцию.
function getFetchAgent() {
  const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy;
  return proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;
}

// SERVER-ONLY: обёртка над Telegram Bot API через grammy.
// Используется:
// 1. В webhook /api/telegram/webhook для обработки команд бота (/start <token>)
// 2. В lib/notifications/stuck-leads.ts для отправки уведомлений
// 3. В app/(crm)/profile/actions.ts для генерации одноразовых токенов привязки

let cachedBot: Bot | null = null;
let cachedBotUsername: string | null = null;

function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error(
      'TELEGRAM_BOT_TOKEN не задан. Зарегистрируй бота через @BotFather и положи токен в .env.local',
    );
  }
  return token;
}

/** Singleton instance grammy Bot. */
export function getBot(): Bot {
  if (!cachedBot) {
    const agent = getFetchAgent();
    cachedBot = new Bot(getBotToken(), {
      client: agent ? { baseFetchConfig: { agent } } : undefined,
    });
    registerBotHandlers(cachedBot);
  }
  return cachedBot;
}

/** Username бота (для построения t.me ссылок). Кэшируется на uptime процесса. */
export async function getBotUsername(): Promise<string> {
  if (cachedBotUsername) return cachedBotUsername;
  if (process.env.TELEGRAM_BOT_USERNAME) {
    cachedBotUsername = process.env.TELEGRAM_BOT_USERNAME;
    return cachedBotUsername;
  }
  const me = await getBot().api.getMe();
  cachedBotUsername = me.username;
  return cachedBotUsername;
}

/**
 * Отправить сообщение в чат. Возвращает true если ОК. Если юзер заблокировал
 * бота или чата больше нет — false (не пробрасываем, просто логируем).
 * Любые другие ошибки пробрасываем.
 */
export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  options: { parseMode?: 'HTML' | 'MarkdownV2'; disableWebPagePreview?: boolean } = {},
): Promise<boolean> {
  const bot = getBot();
  try {
    await bot.api.sendMessage(chatId, text, {
      parse_mode: options.parseMode,
      link_preview_options: options.disableWebPagePreview
        ? { is_disabled: true }
        : undefined,
    });
    return true;
  } catch (err) {
    if (err instanceof GrammyError) {
      // 403 = юзер заблокировал бота, 400 chat not found = удалил себя
      if (err.error_code === 403 || /chat not found|user is deactivated/i.test(err.description)) {
        console.warn(`[telegram] cannot send to ${chatId}: ${err.description}`);
        return false;
      }
    }
    if (err instanceof HttpError) {
      console.error(`[telegram] network error sending to ${chatId}:`, err.message);
      return false;
    }
    throw err;
  }
}

/**
 * Регистрация обработчиков бота. Дёргается один раз на singleton.
 * Сейчас единственная команда — /start <token> для привязки чата к юзеру.
 */
function registerBotHandlers(bot: Bot): void {
  bot.command('start', async (ctx) => {
    const token = ctx.match?.trim();
    if (!token) {
      await ctx.reply(
        'Привет! Я бот ДезТехЮг CRM — шлю уведомления о зависших лидах и важных событиях.\n\n' +
          'Чтобы привязать этот чат к своему аккаунту, открой раздел Профиль в CRM и нажми «Привязать Telegram».',
      );
      return;
    }

    const result = await linkUserByToken(token, {
      chatId: String(ctx.chat.id),
      username: ctx.from?.username ?? null,
    });

    if (result.ok) {
      await ctx.reply(
        `✅ Готово, ${result.userName}! Теперь буду слать тебе уведомления сюда.\n\n` +
          'Отвязать в любой момент можно через раздел Профиль в CRM.',
      );
    } else {
      await ctx.reply(`❌ ${result.error}`);
    }
  });

  bot.catch((err) => {
    console.error('[telegram] bot error:', err);
  });
}

type LinkResult =
  | { ok: true; userName: string; userId: string }
  | { ok: false; error: string };

/**
 * Связать chat_id с юзером по одноразовому токену.
 * Токен живёт 30 минут (см. generateTelegramLinkToken).
 */
export async function linkUserByToken(
  token: string,
  ctx: { chatId: string; username: string | null },
): Promise<LinkResult> {
  if (token.length < 16 || token.length > 64) {
    return { ok: false, error: 'Токен невалидный' };
  }

  // Найдём юзера по живому токену
  const now = new Date();
  const matched = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      telegramChatId: users.telegramChatId,
    })
    .from(users)
    .where(
      and(
        eq(users.telegramLinkToken, token),
        gte(users.telegramLinkTokenExpiresAt, now),
      ),
    )
    .limit(1);

  if (matched.length === 0) {
    return { ok: false, error: 'Ссылка устарела или некорректна. Сгенерируй новую в /profile.' };
  }
  const user = matched[0];

  // Проверим что чат не уже привязан к ДРУГОМУ юзеру
  const conflict = await db
    .select({ id: users.id, fullName: users.fullName })
    .from(users)
    .where(eq(users.telegramChatId, ctx.chatId))
    .limit(1);
  if (conflict.length > 0 && conflict[0].id !== user.id) {
    return {
      ok: false,
      error: `Этот чат уже привязан к ${conflict[0].fullName}. Сначала отвяжи его в их профиле.`,
    };
  }

  await db
    .update(users)
    .set({
      telegramChatId: ctx.chatId,
      telegramUsername: ctx.username,
      telegramLinkedAt: new Date(),
      telegramLinkToken: null,
      telegramLinkTokenExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  return { ok: true, userName: user.fullName, userId: user.id };
}
