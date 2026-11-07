-- Деньги нарядов, ставки мастеров, отказ клиента, перенос наряда запросом (запрос Сани 01.11.2026).
--
-- Всё только ДОБАВЛЯЕТСЯ: старый код новых колонок/таблиц не знает и работает как раньше,
-- поэтому миграцию применяем ДО пересборки приложения. Бэкфилла нет: цены старых нарядов
-- Регина проставляет руками (решение Сани: «финансы с момента запуска», вариант А).
-- Идемпотентно (на проде миграции применяются вручную psql -f, допускаем повторный прогон).

-- 1) Цена строки услуги наряда (снимок). NULL = цена не указана.
--    price_source: 'contract' — подставлена из прайса договора, 'manual' — своя (по договорённости).
ALTER TABLE deal_work_log_services ADD COLUMN IF NOT EXISTS price numeric(12, 2);
ALTER TABLE deal_work_log_services ADD COLUMN IF NOT EXISTS price_source varchar(16);

-- 2) «Документальный» наряд: мастеру 0, вся сумма в кассу организации.
ALTER TABLE deal_work_logs ADD COLUMN IF NOT EXISTS no_master_pay boolean NOT NULL DEFAULT false;

-- 3) Ручная сумма мастеру в конкретном наряде (перекрывает расчёт по проценту).
CREATE TABLE IF NOT EXISTS deal_work_log_pay_overrides (
  work_log_id uuid NOT NULL REFERENCES deal_work_logs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  amount numeric(12, 2) NOT NULL CHECK (amount >= 0),
  set_by_id uuid REFERENCES users(id) ON DELETE SET NULL,
  set_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (work_log_id, user_id)
);

-- 4) Ставка мастера с историей: действует с effective_from (дата МСК) до следующей записи.
--    Сменили процент в декабре — ноябрь считается по старому.
CREATE TABLE IF NOT EXISTS master_pay_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  percent numeric(5, 2) NOT NULL CHECK (percent >= 0 AND percent <= 100),
  min_monthly numeric(12, 2) NOT NULL DEFAULT 0 CHECK (min_monthly >= 0),
  effective_from date NOT NULL,
  note text,
  created_by_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, effective_from)
);
CREATE INDEX IF NOT EXISTS master_pay_rates_user_idx ON master_pay_rates (user_id, effective_from);

-- 5) Отказ клиента: новый статус + причина. ADD VALUE нельзя использовать в той же транзакции,
--    поэтому здесь значение только добавляется (psql -f — каждая команда в своей транзакции).
ALTER TYPE client_status ADD VALUE IF NOT EXISTS 'refused';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS refusal_reason varchar(32);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS refusal_comment text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS refused_at timestamp with time zone;

-- 6) Запросы мастера на перенос наряда. Решает менеджер. Один висящий запрос на наряд.
DO $$ BEGIN
  CREATE TYPE reschedule_request_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS work_order_reschedule_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_log_id uuid NOT NULL REFERENCES deal_work_logs(id) ON DELETE CASCADE,
  requested_by_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  from_at timestamp with time zone,
  to_at timestamp with time zone NOT NULL,
  reason text NOT NULL,
  status reschedule_request_status NOT NULL DEFAULT 'pending',
  decided_by_id uuid REFERENCES users(id) ON DELETE SET NULL,
  decided_at timestamp with time zone,
  decision_comment text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wo_resched_req_work_log_idx ON work_order_reschedule_requests (work_log_id);
CREATE INDEX IF NOT EXISTS wo_resched_req_status_idx ON work_order_reschedule_requests (status, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS wo_resched_req_one_pending
  ON work_order_reschedule_requests (work_log_id) WHERE status = 'pending';
