-- Релиз B (заказ-наряды, цикл): периодичность обработки на услугу объекта.
-- На её основе формируется серия виртуальных напоминаний «оформи заказ-наряд»
-- в календаре (опорная дата = client_objects.planned_treatment_date).
-- Значения из справочника TREATMENT_FREQUENCIES (Разово/Ежемесячно/.../По заявке).
-- NULL — периодичность не задана (без авто-напоминаний по циклу).
ALTER TABLE client_object_services ADD COLUMN IF NOT EXISTS frequency varchar(64);
