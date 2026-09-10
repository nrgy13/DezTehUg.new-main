-- Мульти-объектный заказ-наряд (запрос Регины 03.09.2026).
--
-- Один выезд может охватывать НЕСКОЛЬКО объектов клиента (АРУМ: Отель 4*, ТКО 4*, Отель 5*,
-- ТП 5, … одним нарядом), а АВР/АО по выезду печатает строку на КАЖДЫЙ объект со своей
-- площадью и услугой (как ручные акты Регины). До этого наряд = один объект, и акт по
-- выезду подписывал все строки услуг именем одного объекта (АР-2026-056).
--
-- Объект хранится у КАЖДОЙ услуги наряда (deal_work_log_services.object_id).
-- deal_work_logs.object_id остаётся ОСНОВНЫМ (первым) объектом наряда — для календаря,
-- списков и обратной совместимости. ON DELETE SET NULL: удаление объекта не ломает историю.
-- Идемпотентно (миграции на проде применяются вручную psql -f, допускаем повторный прогон).

ALTER TABLE "deal_work_log_services"
  ADD COLUMN IF NOT EXISTS "object_id" uuid REFERENCES "client_objects"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "deal_work_log_services_object_idx"
  ON "deal_work_log_services" ("object_id");

-- Бэкфилл: услуги уже существующих нарядов относятся к объекту своего наряда.
-- Только NULL → повторный прогон ничего не перезапишет.
UPDATE "deal_work_log_services" s
   SET "object_id" = w."object_id"
  FROM "deal_work_logs" w
 WHERE w."id" = s."work_log_id"
   AND s."object_id" IS NULL
   AND w."object_id" IS NOT NULL;
