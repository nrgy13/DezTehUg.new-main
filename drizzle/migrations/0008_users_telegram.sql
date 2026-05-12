-- Sprint 5 · Эпик C — Telegram бот: привязка пользователя к чату
-- Привязка идёт через одноразовый токен: юзер генерит /profile → Бот /start <token> → chat_id сохраняется.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "telegram_link_token"            varchar(64),
  ADD COLUMN IF NOT EXISTS "telegram_link_token_expires_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "telegram_linked_at"             timestamptz,
  ADD COLUMN IF NOT EXISTS "telegram_username"              varchar(64);

-- Уникальный индекс на токене (только пока он не использован).
CREATE UNIQUE INDEX IF NOT EXISTS "users_telegram_link_token_idx"
  ON "users" ("telegram_link_token")
  WHERE "telegram_link_token" IS NOT NULL;

-- Колонка telegram_chat_id уже существует с MVP — добавим уникальный индекс
-- чтобы один TG-чат не мог быть привязан к нескольким юзерам.
CREATE UNIQUE INDEX IF NOT EXISTS "users_telegram_chat_id_idx"
  ON "users" ("telegram_chat_id")
  WHERE "telegram_chat_id" IS NOT NULL;
