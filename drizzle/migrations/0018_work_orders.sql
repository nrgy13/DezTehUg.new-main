-- Релиз A: Заказ-наряды — выезды по объекту.
--
-- Выезд (deal_work_logs) получает прямую связь с объектом (object_id) и текстовое
-- поле препаратов (preparations). Несколько услуг на один выезд хранятся snapshot'ом
-- в новой таблице deal_work_log_services — копия услуг объекта на момент наряда,
-- чтобы история «что делали» не плыла при изменении услуг объекта.
-- master_id НЕ трогаем (заказ-наряд всегда с мастером).
-- enum "price_item_unit" (m2/pcs/m3) уже существует (0013/0015) — переиспользуем.

ALTER TABLE "deal_work_logs"
  ADD COLUMN IF NOT EXISTS "object_id" uuid REFERENCES "client_objects"("id") ON DELETE SET NULL;

ALTER TABLE "deal_work_logs"
  ADD COLUMN IF NOT EXISTS "preparations" text;

CREATE INDEX IF NOT EXISTS "deal_work_logs_object_id_idx"
  ON "deal_work_logs" ("object_id");

CREATE TABLE IF NOT EXISTS "deal_work_log_services" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "work_log_id" uuid NOT NULL REFERENCES "deal_work_logs"("id") ON DELETE CASCADE,
  "service_id" uuid REFERENCES "services"("id") ON DELETE SET NULL,
  "custom_name" varchar(255),
  "method" varchar(128),
  "unit" "price_item_unit" NOT NULL DEFAULT 'm2',
  "quantity" numeric(10, 2),
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "deal_work_log_services_work_log_idx"
  ON "deal_work_log_services" ("work_log_id");
