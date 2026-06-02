-- Sprint 10 — единицы измерения + количество у услуг объекта.
--
-- Услуги объекта (client_object_services) становятся источником данных для
-- таблицы АО/АВР: «№ | Объект | Адрес | Площадь | Услуга». Раньше единица была
-- захардкожена «м²» — теперь у каждой услуги своя единица (м²/ед./м³) и кол-во.
--
-- enum "price_item_unit" (m2/pcs/m3) уже существует (миграции 0013/0015) —
-- переиспользуем его, новую enum-миграцию делать НЕ нужно.

ALTER TABLE "client_object_services"
  ADD COLUMN IF NOT EXISTS "unit" "price_item_unit" NOT NULL DEFAULT 'm2';

ALTER TABLE "client_object_services"
  ADD COLUMN IF NOT EXISTS "quantity" numeric(10, 2);
