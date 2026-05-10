-- Sprint 5.0 · точные timestamps для сделок (этап 1: совместимый переход)
-- Сейчас deals.start_date / end_date — это date (без часа).
-- Для календаря на временные слоты нужен timestamp с TZ.
-- На этом спринте добавляем start_at / end_at как НОВЫЕ колонки рядом с date —
-- старые остаются для обратной совместимости форм. В Sprint 5.1 удалим их.

ALTER TABLE "deals"
  ADD COLUMN IF NOT EXISTS "start_at"   timestamptz,
  ADD COLUMN IF NOT EXISTS "end_at"     timestamptz,
  ADD COLUMN IF NOT EXISTS "is_all_day" boolean NOT NULL DEFAULT true;

-- Бэкфилл существующих строк: дата без часа → 00:00 МСК для start, 23:59 МСК для end.
-- AT TIME ZONE 'Europe/Moscow' переводит local-naive timestamp в timestamptz с UTC offset +03.
UPDATE "deals"
SET "start_at" = (("start_date"::text || ' 00:00:00')::timestamp AT TIME ZONE 'Europe/Moscow')
WHERE "start_date" IS NOT NULL AND "start_at" IS NULL;

UPDATE "deals"
SET "end_at" = (("end_date"::text || ' 23:59:59')::timestamp AT TIME ZONE 'Europe/Moscow')
WHERE "end_date" IS NOT NULL AND "end_at" IS NULL;

-- Все существующие сделки = is_all_day=true (без точного времени).
-- Default для новых строк тоже true; форма редактирования может выставить false при заполнении time.

CREATE INDEX IF NOT EXISTS "deals_start_at_idx" ON "deals" ("start_at");
CREATE INDEX IF NOT EXISTS "deals_end_at_idx"   ON "deals" ("end_at");
