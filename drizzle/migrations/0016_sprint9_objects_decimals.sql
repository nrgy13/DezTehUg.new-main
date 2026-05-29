-- Sprint 9 — объекты на основании договора, десятичные количества,
-- услуги объекта (несколько на объект), перевод физлиц/ИП в юрлица.

-- 1) Десятичные количества: area_m2 integer → numeric(10,2) ------------------
-- В прайсе кол-во теперь может быть дробным (7,7 м²). Квадратура объекта тоже.
ALTER TABLE "deal_price_items"
  ALTER COLUMN "area_m2" TYPE numeric(10, 2) USING "area_m2"::numeric;

ALTER TABLE "client_objects"
  ALTER COLUMN "area_m2" TYPE numeric(10, 2) USING "area_m2"::numeric;

-- 2) Объекты на основании договора ------------------------------------------
-- client_id остаётся обязательным (объект всегда принадлежит клиенту).
-- deal_id NULLABLE: старые объекты без договора не ломаются (Регина
-- привяжет их вручную), новые создаются внутри договора.
ALTER TABLE "client_objects"
  ADD COLUMN IF NOT EXISTS "deal_id" uuid REFERENCES "deals"("id") ON DELETE SET NULL;

-- Плановая дата обработки объекта (на её основе формируются заявки мастерам).
ALTER TABLE "client_objects"
  ADD COLUMN IF NOT EXISTS "planned_treatment_date" date;

CREATE INDEX IF NOT EXISTS "client_objects_deal_id_idx"
  ON "client_objects" ("deal_id");

-- 3) Услуги объекта ----------------------------------------------------------
-- Несколько услуг на один объект, у каждой свой способ обработки.
CREATE TABLE IF NOT EXISTS "client_object_services" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "object_id"   uuid        NOT NULL REFERENCES "client_objects"("id") ON DELETE CASCADE,
  "service_id"  uuid        REFERENCES "services"("id") ON DELETE SET NULL,
  "custom_name" varchar(255),                 -- если услуга вне каталога
  "method"      varchar(128),                 -- способ обработки (из справочника)
  "sort_order"  integer     NOT NULL DEFAULT 0,
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  "updated_at"  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "client_object_services_object_idx"
  ON "client_object_services" ("object_id", "sort_order");

-- 4) Все физлица/ИП → юрлица (data) ------------------------------------------
-- В БД ИП и физлица хранятся одинаково (type='individual'). Переводим всех
-- в 'legal'. На PROD выполнять ТОЛЬКО после бекапа БД.
UPDATE "clients" SET "type" = 'legal' WHERE "type" = 'individual';
