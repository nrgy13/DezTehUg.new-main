-- ════════════════════════════════════════════════════════════════════════════
-- merge-duplicate-services.sql — схлопывание дублей-тёзок в каталоге услуг
-- ════════════════════════════════════════════════════════════════════════════
-- ПРИЧИНА: форма /admin/services исторически дедуплила услуги только по `code`,
--   поэтому в каталоге расплодились «Дезинсекция» ×4 / «Дезинфекция» ×3 и т.п.
--   (один и тот же ВИДИМЫЙ ярлык, разные коды) — в выпадашках выбора услуги
--   (прайс / услуги объекта / заказ-наряд) это каша: непонятно что выбирать.
--   Превентив (запрет создавать тёзку) уже в коде; этот скрипт чистит то, что есть.
--
-- ЧТО ДЕЛАЕТ: для каждого видимого ярлыка (shortName ?? name, нормализованного)
--   оставляет ОДНУ каноническую услугу, перецепляет на неё ВСЕ ссылки и удаляет дубли.
--   Канон: предпочитаем услугу с «правильным» seed-кодом, иначе самую старую (min created_at).
--
-- FK на services.id (все 4, выверено по схеме lib/db/schema):
--   • deal_price_items.service_id        (ON DELETE set null)
--   • client_object_services.service_id  (ON DELETE set null)
--   • deal_work_log_services.service_id  (ON DELETE set null)
--   • service_checklists.service_id      (ON DELETE cascade, NOT NULL) ← обязательно перецепить!
--
-- ⚠️ ПЕРЕД ЗАПУСКОМ: бэкап БД
--   docker exec deztech-crm-postgres pg_dump -U deztech deztech_crm | gzip > prod-db-YYYYMMDD-before-merge-services.sql.gz
-- ⚠️ Скрипт по умолчанию заканчивается ROLLBACK. Сверь отчёт верификации → поменяй на COMMIT.
-- Запуск: docker exec -i deztech-crm-postgres psql -U deztech deztech_crm < tools/merge-duplicate-services.sql
-- ════════════════════════════════════════════════════════════════════════════

-- ── 0. ПРЕДПРОСМОТР дублей (read-only — можно прогнать отдельно ДО транзакции) ──
\echo === ДУБЛИ ПО ВИДИМОМУ ЯРЛЫКУ ===
SELECT lower(coalesce(nullif(trim(short_name), ''), trim(name))) AS label,
       count(*) AS cnt,
       string_agg(code, ', ' ORDER BY created_at) AS codes
FROM services
GROUP BY 1
HAVING count(*) > 1
ORDER BY cnt DESC, label;

-- ── 1. ЧИСТКА (в транзакции) ──
BEGIN;

CREATE TEMP TABLE svc_merge ON COMMIT DROP AS
WITH labeled AS (
  SELECT id,
         lower(coalesce(nullif(trim(short_name), ''), trim(name))) AS label,
         (code IN ('disinsection', 'deratization', 'disinfection', 'fumigation',
                   'deodorization', 'deserpentation', 'herbicide-treatment', 'water-analysis'))
           AS is_canon,
         created_at
  FROM services
),
winner AS (
  -- по одному «победителю» на ярлык: сначала канонический seed-код, потом самая старая запись
  SELECT DISTINCT ON (label) label, id AS keep_id
  FROM labeled
  ORDER BY label, is_canon DESC, created_at ASC
)
SELECT l.id AS dup_id, w.keep_id
FROM labeled l
JOIN winner w USING (label)
WHERE l.id <> w.keep_id;

\echo === ДУБЛЕЙ К СХЛОПЫВАНИЮ ===
SELECT count(*) AS dupes_to_merge FROM svc_merge;

-- Перецепка всех ссылок: дубль → канон
UPDATE deal_price_items      t SET service_id = m.keep_id FROM svc_merge m WHERE t.service_id = m.dup_id;
UPDATE client_object_services t SET service_id = m.keep_id FROM svc_merge m WHERE t.service_id = m.dup_id;
UPDATE deal_work_log_services t SET service_id = m.keep_id FROM svc_merge m WHERE t.service_id = m.dup_id;
-- Шаблоны чеклистов: FK cascade + NOT NULL — без перецепки удалились бы вместе с дублем.
-- NB: после перецепки на канон у услуги МОГУТ появиться дубли-пункты (если у схлопнутых
-- услуг были одинаковые шаблоны) — это не ломает работу, при желании дочистить отдельно.
UPDATE service_checklists    t SET service_id = m.keep_id FROM svc_merge m WHERE t.service_id = m.dup_id;

-- Удаляем дубли
DELETE FROM services WHERE id IN (SELECT dup_id FROM svc_merge);

-- ── 2. ВЕРИФИКАЦИЯ (оба отчёта должны быть ПУСТЫ / нули) ──
\echo === ОСТАЛОСЬ ДУБЛЕЙ ЯРЛЫКА (должно быть пусто) ===
SELECT lower(coalesce(nullif(trim(short_name), ''), trim(name))) AS label, count(*)
FROM services GROUP BY 1 HAVING count(*) > 1;

\echo === ОСИРОТЕВШИЕ ССЫЛКИ (все счётчики должны быть 0) ===
SELECT 'price_items' AS src, count(*) AS orphans
  FROM deal_price_items p LEFT JOIN services s ON s.id = p.service_id
  WHERE p.service_id IS NOT NULL AND s.id IS NULL
UNION ALL
SELECT 'object_services', count(*)
  FROM client_object_services c LEFT JOIN services s ON s.id = c.service_id
  WHERE c.service_id IS NOT NULL AND s.id IS NULL
UNION ALL
SELECT 'worklog_services', count(*)
  FROM deal_work_log_services w LEFT JOIN services s ON s.id = w.service_id
  WHERE w.service_id IS NOT NULL AND s.id IS NULL
UNION ALL
SELECT 'service_checklists', count(*)
  FROM service_checklists ch LEFT JOIN services s ON s.id = ch.service_id
  WHERE s.id IS NULL;

-- Отчёт чистый → замени ROLLBACK на COMMIT и перезапусти.
ROLLBACK;
-- COMMIT;
