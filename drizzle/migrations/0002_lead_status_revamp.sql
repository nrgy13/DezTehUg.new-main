-- Спринт 2 · обновление воронки лидов
-- 1) Добавляем 2 промежуточных этапа: contract_signed (Договор подписан), works_completed (Реализована).
--    Won теперь = "Оплата" (финальный успешный статус).
-- 2) Старый этап qualified ("Потребность подтверждена") убираем из активного использования —
--    переводим существующие лиды в proposal_sent. В enum значение остаётся (postgres не позволяет удалять
--    enum value без пересоздания типа; не критично, в UI/zod больше не используется).
-- 3) Заодно вводим enum причин потери (lead_lost_reason) и колонку lost_reason_code.

-- ─── Перевод данных ──────────────────────────────────────────
UPDATE "leads" SET "status" = 'proposal_sent' WHERE "status" = 'qualified';

-- ─── Расширение lead_status enum ─────────────────────────────
-- ALTER TYPE ... ADD VALUE не может работать в транзакции, делаем через DO с подзапросами
ALTER TYPE "lead_status" ADD VALUE IF NOT EXISTS 'contract_signed';
ALTER TYPE "lead_status" ADD VALUE IF NOT EXISTS 'works_completed';

-- ─── Enum причин потери ──────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "lead_lost_reason" AS ENUM (
    'price_too_high',
    'chose_competitor',
    'no_response',
    'not_relevant',
    'postponed',
    'diy_solved',
    'wrong_region',
    'spam',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "lost_reason_code" "lead_lost_reason";
