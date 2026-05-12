-- Sprint 5+ · Inbox для менеджера — отметка «прочитано» для записей в activity_log.
-- Используется на странице /manager/inbox: запросы переноса дат от мастеров и
-- другие требующие реакции события можно пометить как обработанные.

ALTER TABLE "activity_log"
  ADD COLUMN IF NOT EXISTS "acknowledged_at"    timestamptz,
  ADD COLUMN IF NOT EXISTS "acknowledged_by_id" uuid REFERENCES users(id) ON DELETE SET NULL;

-- Индекс для быстрого подсчёта «непрочитанных» в /manager/inbox + sidebar бейдж.
CREATE INDEX IF NOT EXISTS "activity_log_inbox_idx"
  ON "activity_log" ("action", "acknowledged_at")
  WHERE "acknowledged_at" IS NULL;
