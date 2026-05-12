-- Sprint 6 · Эпик 2 — Выезды + чек-листы для мастера.
--
-- Расширяем deal_work_logs до полноценного «выезда» со статусом и привязкой
-- к позиции прайса. Добавляем шаблоны чеклистов (привязка к услуге) и
-- снимок выполнения чеклиста на конкретный выезд (с фото/заметками).
--
-- Исторические work_logs из Sprint 3-5 автоматически получают status='completed'
-- через DEFAULT — это правильно, т.к. они уже завершены де-факто.

-- 1) Расширение deal_work_logs ----------------------------------------------

CREATE TYPE "work_log_status" AS ENUM ('planned', 'in_progress', 'completed');

ALTER TABLE "deal_work_logs"
  ADD COLUMN IF NOT EXISTS "price_item_id"  uuid REFERENCES "deal_price_items"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "status"         "work_log_status" NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS "planned_at"     timestamptz,
  ADD COLUMN IF NOT EXISTS "started_at"     timestamptz,
  ADD COLUMN IF NOT EXISTS "finalized_at"   timestamptz;

-- Для planned-выездов description/performed_at могут быть пустыми (заполнятся
-- мастером в процессе). Старые записи имеют значения — не страдают.
ALTER TABLE "deal_work_logs"
  ALTER COLUMN "description"  DROP NOT NULL,
  ALTER COLUMN "performed_at" DROP DEFAULT,
  ALTER COLUMN "performed_at" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "deal_work_logs_status_idx"
  ON "deal_work_logs" ("status");
CREATE INDEX IF NOT EXISTS "deal_work_logs_price_item_idx"
  ON "deal_work_logs" ("price_item_id");

-- 2) Шаблоны чеклистов по услугам -------------------------------------------

CREATE TABLE IF NOT EXISTS "service_checklists" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "service_id"  uuid        NOT NULL REFERENCES "services"("id") ON DELETE CASCADE,
  "position"    integer     NOT NULL DEFAULT 0,
  "title"       text        NOT NULL,
  "description" text,
  "required"    boolean     NOT NULL DEFAULT true,
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  "updated_at"  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "service_checklists_service_idx"
  ON "service_checklists" ("service_id", "position");

-- 3) Снимок чеклиста под конкретный выезд ----------------------------------

CREATE TYPE "checklist_item_source" AS ENUM ('template', 'manager', 'master');
CREATE TYPE "checklist_item_status" AS ENUM ('pending', 'done', 'na');

CREATE TABLE IF NOT EXISTS "deal_checklist_items" (
  "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "work_log_id"         uuid        NOT NULL REFERENCES "deal_work_logs"("id") ON DELETE CASCADE,
  "source"              "checklist_item_source" NOT NULL,
  "source_template_id"  uuid        REFERENCES "service_checklists"("id") ON DELETE SET NULL,
  "position"            integer     NOT NULL DEFAULT 0,
  "title"               text        NOT NULL,
  "description"         text,
  "required"            boolean     NOT NULL DEFAULT false,
  "status"              "checklist_item_status" NOT NULL DEFAULT 'pending',
  "note"                text,
  "photos"              jsonb       NOT NULL DEFAULT '[]'::jsonb,
  "done_at"             timestamptz,
  "done_by_user_id"     uuid        REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at"          timestamptz NOT NULL DEFAULT now(),
  "updated_at"          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "deal_checklist_items_worklog_idx"
  ON "deal_checklist_items" ("work_log_id", "position");
