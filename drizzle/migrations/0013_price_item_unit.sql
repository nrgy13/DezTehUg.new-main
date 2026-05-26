-- Sprint 8: добавляем единицу измерения для прайс-позиций.
-- area_m2 переосмысливается как «количество в выбранной единице»:
--   unit='m2'  → 100 м²
--   unit='pcs' → 5 шт

CREATE TYPE price_item_unit AS ENUM ('m2', 'pcs');

ALTER TABLE deal_price_items
  ADD COLUMN unit price_item_unit NOT NULL DEFAULT 'm2';
