#!/usr/bin/env bash
# ─── backup.sh ────────────────────────────────────────────────────────────────
# Daily backup of all customer PostgreSQL databases and upload volumes.
# Run via cron:  0 2 * * * /opt/tutordesk/scripts/backup.sh >> /var/log/tutordesk-backup.log 2>&1
#
# Backups are stored in /opt/tutordesk/backups/ and retained for RETENTION_DAYS.
# Optionally synced to remote storage via rclone (configure separately).
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

BASE_DIR="/opt/tutordesk/customers"
BACKUP_DIR="/opt/tutordesk/backups"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

echo "[$DATE] Starting backup..."

backup_customer() {
  local CUSTOMER_ID="$1"
  local DIR="$BASE_DIR/$CUSTOMER_ID"
  local BACKUP_PATH="$BACKUP_DIR/$CUSTOMER_ID"

  mkdir -p "$BACKUP_PATH"

  # Load env
  if [[ ! -f "$DIR/.env" ]]; then
    echo "  WARN: No .env for '$CUSTOMER_ID', skipping."
    return
  fi
  set -a; source "$DIR/.env"; set +a

  # ── Database dump ─────────────────────────────────────────────────────────
  local DB_FILE="$BACKUP_PATH/db_${DATE}.sql.gz"
  echo "  Backing up DB for $CUSTOMER_ID..."
  docker exec "${CUSTOMER_ID}_db" \
    pg_dump -U "$DB_USER" "$DB_NAME" \
    | gzip > "$DB_FILE"
  echo "    Saved: $DB_FILE"

  # ── Upload volume backup ──────────────────────────────────────────────────
  local UPLOADS_FILE="$BACKUP_PATH/uploads_${DATE}.tar.gz"
  VOLUME_PATH=$(docker volume inspect "${CUSTOMER_ID}_uploads" \
    --format '{{.Mountpoint}}' 2>/dev/null || echo "")
  if [[ -n "$VOLUME_PATH" && -d "$VOLUME_PATH" ]]; then
    echo "  Backing up uploads for $CUSTOMER_ID..."
    tar -czf "$UPLOADS_FILE" -C "$VOLUME_PATH" .
    echo "    Saved: $UPLOADS_FILE"
  fi

  # ── Prune old backups ─────────────────────────────────────────────────────
  find "$BACKUP_PATH" -name "db_*.sql.gz"        -mtime "+$RETENTION_DAYS" -delete
  find "$BACKUP_PATH" -name "uploads_*.tar.gz"   -mtime "+$RETENTION_DAYS" -delete
}

for dir in "$BASE_DIR"/*/; do
  [[ -d "$dir" ]] || continue
  backup_customer "$(basename "$dir")" || echo "  ERROR: Failed backup for $(basename "$dir")"
done

# ── Sync to remote (configure rclone remote named 'backup') ─────────────────
if command -v rclone &>/dev/null && rclone listremotes | grep -q "^backup:"; then
  echo "Syncing to remote storage..."
  rclone sync "$BACKUP_DIR" backup:tutordesk-backups/ \
    --transfers 4 --checkers 8 --log-level INFO
  echo "Remote sync complete."
else
  echo "INFO: rclone 'backup' remote not configured. Backups stored locally only."
fi

echo "[$(date +%Y%m%d_%H%M%S)] Backup complete."
