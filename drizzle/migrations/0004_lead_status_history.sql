-- Спринт 3.5 · история стадий лида
-- 1) Таблица lead_status_history — каждая смена статуса = строка
-- 2) Триггер на leads.status — авто-запись при INSERT/UPDATE
-- 3) Backfill для существующих лидов

-- ─── 1. Таблица ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "lead_status_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "lead_id" uuid NOT NULL,
  "from_status" "lead_status",
  "to_status" "lead_status" NOT NULL,
  "changed_by_id" uuid,
  "changed_at" timestamp with time zone NOT NULL DEFAULT now(),
  "notes" text
);

DO $$ BEGIN
  ALTER TABLE "lead_status_history"
    ADD CONSTRAINT "lsh_lead_id_fk"
    FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "lead_status_history"
    ADD CONSTRAINT "lsh_changed_by_id_fk"
    FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "idx_lsh_lead" ON "lead_status_history" ("lead_id", "changed_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_lsh_status" ON "lead_status_history" ("to_status", "changed_at" DESC);

-- ─── 2. Триггер ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION lead_status_change_trigger()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO lead_status_history (lead_id, from_status, to_status, changed_by_id)
    VALUES (NEW.id, NULL, NEW.status, NEW.assigned_manager_id);
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO lead_status_history (lead_id, from_status, to_status, changed_by_id)
    VALUES (NEW.id, OLD.status, NEW.status, NEW.assigned_manager_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lead_status_history ON leads;
CREATE TRIGGER trg_lead_status_history
AFTER INSERT OR UPDATE OF status ON leads
FOR EACH ROW EXECUTE FUNCTION lead_status_change_trigger();

-- ─── 3. Backfill существующих лидов ──────────────────────────
-- Для каждого лида создаём стартовую запись если её нет
INSERT INTO lead_status_history (lead_id, from_status, to_status, changed_by_id, changed_at)
SELECT l.id, NULL, l.status, l.assigned_manager_id, l.created_at
FROM leads l
WHERE NOT EXISTS (
  SELECT 1 FROM lead_status_history h WHERE h.lead_id = l.id
);
