-- Sprint 6 · PWA — таблица для подписок web-push.
-- Каждый юзер может иметь несколько подписок (разные браузеры/устройства).
-- Endpoint уникален в рамках всей системы (URL из PushSubscription API).

CREATE TABLE IF NOT EXISTS "push_subscriptions" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"      uuid        NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "endpoint"     text        NOT NULL UNIQUE,
  "p256dh"       text        NOT NULL,
  "auth"         text        NOT NULL,
  "user_agent"   text,
  "created_at"   timestamptz NOT NULL DEFAULT now(),
  "last_used_at" timestamptz
);

CREATE INDEX IF NOT EXISTS "push_subscriptions_user_idx"
  ON "push_subscriptions" ("user_id");
