-- Категория клиента — информационная метка для директора (НЕ статус жизненного цикла).
-- new=Новый, old=Старый, permanent=Постоянный, tender=Тендер.
-- Дефолт 'old' → ВСЕ существующие клиенты при применении получают категорию «Старый».
-- Идемпотентно (миграции на проде применяются вручную psql -f, допускаем повторный прогон):
--   CREATE TYPE не поддерживает IF NOT EXISTS → оборачиваем в DO/EXCEPTION.
DO $$ BEGIN
  CREATE TYPE client_category AS ENUM ('new', 'old', 'permanent', 'tender');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

ALTER TABLE clients ADD COLUMN IF NOT EXISTS category client_category NOT NULL DEFAULT 'old';
