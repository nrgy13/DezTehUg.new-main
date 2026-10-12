-- Парный наряд / бригада (запрос Сани 12.10.2026: «есть объекты, где мастера трудятся вместе»).
--
-- На один выезд можно поставить нескольких мастеров. Основной мастер остаётся в
-- deal_work_logs.master_id (NOT NULL, ничего не переносим), а здесь лежат НАПАРНИКИ.
-- Наряд без строк в этой таблице — наряд на одного, поэтому старые наряды бэкфилл не требуют.
-- Члены бригады равноправны: видят наряд у себя, отмечают чеклист, грузят фото, завершают.
--
-- ON DELETE CASCADE по наряду: удалили наряд — бригада снимается вместе с ним.
-- ON DELETE RESTRICT по юзеру: как у deal_work_logs.master_id (юзеров деактивируют, а не удаляют).
-- Идемпотентно (миграции на проде применяются вручную psql -f, допускаем повторный прогон).

CREATE TABLE IF NOT EXISTS "deal_work_log_masters" (
  "work_log_id" uuid NOT NULL REFERENCES "deal_work_logs"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("work_log_id", "user_id")
);

CREATE INDEX IF NOT EXISTS "deal_work_log_masters_user_idx"
  ON "deal_work_log_masters" ("user_id");
