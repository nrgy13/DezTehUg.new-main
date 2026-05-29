-- Sprint 9 — добавляем единицу измерения «м³» (кубометры) к price_item_unit.
--
-- ВАЖНО: ALTER TYPE ... ADD VALUE вынесено в ОТДЕЛЬНУЮ миграцию.
-- Новое значение enum нельзя использовать в той же транзакции, где оно добавлено
-- (Postgres бросит "unsafe use of new value"). Поэтому 0016 идёт следующим файлом.

ALTER TYPE "price_item_unit" ADD VALUE IF NOT EXISTS 'm3';
