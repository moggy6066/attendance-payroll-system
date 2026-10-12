#!/usr/bin/env bash
# Daily PostgreSQL backup for the Docker stack (Linux server).
#   ./scripts/backup.sh                    -> backups/hr-YYYY-MM-DD_HHMM.sql.gz
# Env overrides: BACKUP_DIR (default ./backups), KEEP_DAYS (default 14),
#                RCLONE_REMOTE (optional, e.g. "gdrive:hr-backups" -> off-site copy via rclone).
#
# Cron example (every day at 02:30, run `crontab -e` as the user that runs docker):
#   30 2 * * * cd /opt/attendance-payroll-system && ./scripts/backup.sh >> backups/backup.log 2>&1
#
# Restore (REPLACES current data, stop the backend first):
#   docker compose stop backend
#   gunzip -c backups/FILE.sql.gz | docker compose exec -T postgres psql -U postgres -d hr_attendance_db
#   docker compose start backend
#
# Exit code 0 = OK, non-zero = failed (cron mails / logs it).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
PG_USER="postgres"
PG_DB="hr_attendance_db"
if [ -f .env ]; then
  v="$(grep -E '^POSTGRES_USER=' .env | tail -1 | cut -d= -f2- | tr -d '"'"'"' ')" || true
  [ -n "${v:-}" ] && PG_USER="$v"
  v="$(grep -E '^POSTGRES_DB=' .env | tail -1 | cut -d= -f2- | tr -d '"'"'"' ')" || true
  [ -n "${v:-}" ] && PG_DB="$v"
fi

log() { echo "$(date '+%F %T') $*"; }

mkdir -p "$BACKUP_DIR"
name="hr-$(date +%F_%H%M).sql.gz"
tmp="$BACKUP_DIR/.$name.partial"
trap 'rm -f "$tmp"' EXIT

log "backup start: db=$PG_DB user=$PG_USER -> $BACKUP_DIR/$name"
docker compose exec -T postgres pg_dump -U "$PG_USER" -d "$PG_DB" --no-owner | gzip -9 > "$tmp"

gzip -t "$tmp"
size=$(wc -c < "$tmp")
if [ "$size" -lt 1024 ]; then
  log "ERROR: backup is only $size bytes - refusing to keep it (is the database empty or the stack down?)"
  exit 1
fi
gunzip -c "$tmp" | grep -q 'PostgreSQL database dump complete' || { log "ERROR: dump is incomplete"; exit 1; }
mv "$tmp" "$BACKUP_DIR/$name"
log "backup ok: $name ($size bytes)"

if [ -n "${RCLONE_REMOTE:-}" ]; then
  command -v rclone >/dev/null || { log "ERROR: RCLONE_REMOTE is set but rclone is not installed"; exit 1; }
  rclone copy "$BACKUP_DIR/$name" "$RCLONE_REMOTE"
  log "off-site copy ok: $RCLONE_REMOTE/$name"
fi

deleted=$(find "$BACKUP_DIR" -maxdepth 1 -name 'hr-*.sql.gz' -mtime "+$KEEP_DAYS" -print -delete | wc -l)
log "retention: deleted $deleted backup(s) older than $KEEP_DAYS days"
