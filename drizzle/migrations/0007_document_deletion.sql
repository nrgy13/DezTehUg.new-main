-- Sprint 5 · Эпик B — soft-delete документов с approval-flow
-- Manager может только запросить удаление документа. Реальное удаление файлов
-- (DOCX/PDF/signed_scan из storage + запись из БД) выполняется только после
-- одобрения admin'ом из /admin/deletions.

-- Статусы запроса на удаление. 'none' — документ в обычном состоянии.
DO $$ BEGIN
  CREATE TYPE "deletion_status" AS ENUM ('none', 'pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "documents"
  ADD COLUMN IF NOT EXISTS "deletion_status" deletion_status NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS "deletion_requested_at"   timestamptz,
  ADD COLUMN IF NOT EXISTS "deletion_requested_by_id" uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "deletion_resolved_at"    timestamptz,
  ADD COLUMN IF NOT EXISTS "deletion_resolved_by_id" uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "deletion_reason"         text,
  ADD COLUMN IF NOT EXISTS "deletion_admin_note"     text;

-- Индекс для быстрого подсчёта pending в /admin/deletions и бейджа в sidebar.
CREATE INDEX IF NOT EXISTS "documents_deletion_status_idx"
  ON "documents" ("deletion_status")
  WHERE "deletion_status" != 'none';
