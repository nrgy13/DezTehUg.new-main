-- Спринт 3 · фундамент сделок и документов
-- 1) deals: связь с лидом (lead_id), назначения менеджера/мастера
-- 2) deal_price_items: custom_name (свободное название услуги), frequency опциональным
-- 3) document_number_counters: сквозные счётчики номеров документов по году+типу
-- 4) deal_work_logs: журнал выполненных работ мастером (для акта работ)
--
-- Применять вручную: docker compose -f docker-compose.dev.yml exec -T postgres \
--   psql -U deztech deztech_crm -f /docker-entrypoint-initdb.d/0003_sprint3_deals_extras.sql
-- (или скопировать в контейнер через docker cp + psql -f)

-- ─── 1) deals: новые связи и назначения ──────────────────────
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "lead_id" uuid;
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "assigned_manager_id" uuid;
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "assigned_master_id" uuid;

DO $$ BEGIN
  ALTER TABLE "deals"
    ADD CONSTRAINT "deals_lead_id_leads_id_fk"
    FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "deals"
    ADD CONSTRAINT "deals_assigned_manager_id_users_id_fk"
    FOREIGN KEY ("assigned_manager_id") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "deals"
    ADD CONSTRAINT "deals_assigned_master_id_users_id_fk"
    FOREIGN KEY ("assigned_master_id") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ─── 2) deal_price_items: custom_name + frequency опциональный ──
ALTER TABLE "deal_price_items" ADD COLUMN IF NOT EXISTS "custom_name" varchar(255);
ALTER TABLE "deal_price_items" ALTER COLUMN "frequency" DROP NOT NULL;

-- ─── 3) document_number_counters ─────────────────────────────
-- Сквозная нумерация по (year, type). Используется через
--   INSERT ... ON CONFLICT (year, type) DO UPDATE SET last_number = ... + 1 RETURNING
-- для атомарности под параллельной генерацией.
CREATE TABLE IF NOT EXISTS "document_number_counters" (
  "year" integer NOT NULL,
  "type" "document_type" NOT NULL,
  "last_number" integer NOT NULL DEFAULT 0,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "document_number_counters_pk" PRIMARY KEY ("year", "type")
);

-- ─── 4) deal_work_logs: журнал работ мастера ─────────────────
CREATE TABLE IF NOT EXISTS "deal_work_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "deal_id" uuid NOT NULL,
  "master_id" uuid NOT NULL,
  "performed_at" timestamp with time zone NOT NULL DEFAULT now(),
  "description" text NOT NULL,
  "area_m2" integer,
  "notes" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE "deal_work_logs"
    ADD CONSTRAINT "deal_work_logs_deal_id_deals_id_fk"
    FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "deal_work_logs"
    ADD CONSTRAINT "deal_work_logs_master_id_users_id_fk"
    FOREIGN KEY ("master_id") REFERENCES "users"("id") ON DELETE RESTRICT;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "deal_work_logs_deal_id_idx" ON "deal_work_logs" ("deal_id");
CREATE INDEX IF NOT EXISTS "deal_work_logs_master_id_idx" ON "deal_work_logs" ("master_id");
