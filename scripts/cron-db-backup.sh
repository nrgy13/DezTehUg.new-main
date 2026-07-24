#!/usr/bin/env bash
#
# Ежедневный автобэкап прод-окружения DezTehYug CRM.
#
# Зачем: 22.07.2026 менеджер одним кликом снёс договор ИП Гончарова
# (31 позиция прайса + 3 документа). Спас СЛУЧАЙНЫЙ ручной архив, снятый
# неделей раньше перед переездом VPS. Регулярных бэкапов до этого не было.
#
# Снимает ДВЕ вещи — сегодня понадобились обе:
#   1. дамп БД        → записи (сделки, прайс, документы, клиенты);
#   2. app-storage    → САМИ ФАЙЛЫ документов (docx/pdf), их удаление
#                       из БД чистит и с диска.
#
# Установка (на VPS, разово):
#   chmod +x /opt/deztech-crm/scripts/cron-db-backup.sh
#   (crontab -l; echo '30 3 * * * /opt/deztech-crm/scripts/cron-db-backup.sh >> /var/log/deztech-crm-backup.log 2>&1') | crontab -
#
# Восстановление одной сущности (НЕ раскатывать дамп целиком — снесёт
# работу, сделанную после бэкапа!): см. docs/HANDOFF.md, запись #34 —
# там разобран точечный возврат строк одной сделки.

set -uo pipefail

BASE=/opt/deztech-crm
DEST="$BASE/backups/auto"
VOLUME=/var/lib/docker/volumes/deztech-crm_app-storage/_data
KEEP_DAYS=14

# Пороги «дамп получился битый/пустой». Прод: БД ~140КБ, документы ~3МБ.
# Контейнер лежит → pg_dump отдаст пустоту, и без порога мы бы радостно
# положили в бэкапы ноль байт и через 14 дней вытеснили живые копии.
MIN_DB_BYTES=50000
MIN_FILES_BYTES=100000

STAMP=$(date +%Y%m%d-%H%M)
TAG="[backup $STAMP]"

log() { echo "$TAG $*"; }
fail() { echo "$TAG ❌ ОШИБКА: $*"; exit 1; }

mkdir -p "$DEST" || fail "не создать $DEST"

# Хвосты прошлых упавших прогонов
find "$DEST" -maxdepth 1 -name '.tmp-*' -mmin +120 -delete 2>/dev/null

FREE_MB=$(df -Pm "$DEST" | awk 'NR==2 {print $4}')
log "свободно на диске: ${FREE_MB} МБ"
[ "$FREE_MB" -lt 1024 ] && fail "меньше 1 ГБ свободного места — бэкап не делаю"

# ---------- 1. База ----------
TMP_DB="$DEST/.tmp-db-$STAMP.sql.gz"
docker exec deztech-crm-postgres pg_dump -U deztech deztech_crm | gzip > "$TMP_DB"
# pipefail → сюда попадёт ненулевой код и от pg_dump, и от gzip
if [ $? -ne 0 ]; then rm -f "$TMP_DB"; fail "pg_dump не отработал"; fi
gzip -t "$TMP_DB" 2>/dev/null || { rm -f "$TMP_DB"; fail "архив БД не проходит gzip -t"; }
DB_SIZE=$(stat -c%s "$TMP_DB")
if [ "$DB_SIZE" -lt "$MIN_DB_BYTES" ]; then
  rm -f "$TMP_DB"
  fail "дамп БД подозрительно мал ($DB_SIZE б < $MIN_DB_BYTES) — считаю битым"
fi
mv "$TMP_DB" "$DEST/db-$STAMP.sql.gz"
log "✅ БД: $DB_SIZE б"

# ---------- 2. Документы (app-storage) ----------
TMP_FILES="$DEST/.tmp-files-$STAMP.tar.gz"
if [ -d "$VOLUME" ]; then
  tar -czf "$TMP_FILES" -C "$VOLUME" . 2>/dev/null
  if [ $? -ne 0 ]; then rm -f "$TMP_FILES"; fail "tar по app-storage упал"; fi
  gzip -t "$TMP_FILES" 2>/dev/null || { rm -f "$TMP_FILES"; fail "архив документов не проходит gzip -t"; }
  F_SIZE=$(stat -c%s "$TMP_FILES")
  if [ "$F_SIZE" -lt "$MIN_FILES_BYTES" ]; then
    rm -f "$TMP_FILES"
    fail "архив документов подозрительно мал ($F_SIZE б) — считаю битым"
  fi
  mv "$TMP_FILES" "$DEST/files-$STAMP.tar.gz"
  F_COUNT=$(find "$VOLUME" -type f | wc -l)
  log "✅ Документы: $F_SIZE б, файлов в хранилище: $F_COUNT"
else
  fail "не найден volume app-storage: $VOLUME"
fi

# ---------- 3. Ротация ----------
OLD=$(find "$DEST" -maxdepth 1 \( -name 'db-*.sql.gz' -o -name 'files-*.tar.gz' \) -mtime +$KEEP_DAYS | wc -l)
find "$DEST" -maxdepth 1 \( -name 'db-*.sql.gz' -o -name 'files-*.tar.gz' \) -mtime +$KEEP_DAYS -delete
KEPT=$(find "$DEST" -maxdepth 1 -name 'db-*.sql.gz' | wc -l)
log "ротация: удалено старше ${KEEP_DAYS}д — $OLD, осталось копий БД — $KEPT"

date '+%Y-%m-%d %H:%M:%S %Z' > "$BASE/backups/LAST_SUCCESS"
log "🟢 готово"
