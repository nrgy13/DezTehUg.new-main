-- Sprint 5 · Эпик E — generic table для системных настроек.
-- Хранит произвольные конфиги в JSONB. Сейчас используется для:
--   notification_thresholds — пороги «зависания» лидов (раньше были захардкожены)

CREATE TABLE IF NOT EXISTS "app_settings" (
  "key"            text PRIMARY KEY,
  "value"          jsonb NOT NULL,
  "updated_at"     timestamptz NOT NULL DEFAULT NOW(),
  "updated_by_id"  uuid REFERENCES users(id) ON DELETE SET NULL
);
