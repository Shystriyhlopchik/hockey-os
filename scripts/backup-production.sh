#!/usr/bin/env bash
set -euo pipefail
umask 077
project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
backup_dir="$project_root/backups"
mkdir -p "$backup_dir"
partial="$(mktemp "$backup_dir/hockey_$(date -u +%Y-%m-%d_%H-%M-%S)_XXXXXX.part")"
uploads_partial="${partial%.part}.uploads.part"
lock_pid=""
lock_input=""
release_lock() {
  if [[ -n "$lock_pid" ]]; then
    printf 'release\n' >&"$lock_input" || true
    wait "$lock_pid"
    lock_pid=""
  fi
}
cleanup() {
  release_lock || true
  rm -f -- "$partial" "$uploads_partial"
}
trap cleanup EXIT
# Before the first media update the currently running image has no photographs
# and no lock helper yet. This keeps the pre-update backup compatible with it.
if bash "$project_root/scripts/production.sh" exec -T app test -f /app/backend/dist/media/backup-lock.js; then
  coproc MEDIA_LOCK { bash "$project_root/scripts/production.sh" exec -T app node backend/dist/media/backup-lock.js; }
  lock_pid="$MEDIA_LOCK_PID"
  lock_input="${MEDIA_LOCK[1]}"
  lock_output="${MEDIA_LOCK[0]}"
  if ! read -r -t 35 ready <&"$lock_output" || [[ "$ready" != "LOCKED" ]]; then
    printf 'Could not lock image updates for backup.\n' >&2
    exit 1
  fi
fi
bash "$project_root/scripts/production.sh" exec -T database sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' > "$partial"
test -s "$partial"
bash "$project_root/scripts/production.sh" exec -T app \
  tar -C /app/uploads -czf - . > "$uploads_partial"
test -s "$uploads_partial"
destination="${partial%.part}.dump"
uploads_destination="${partial%.part}.uploads.tar.gz"
mv -- "$partial" "$destination"
mv -- "$uploads_partial" "$uploads_destination"
release_lock
printf 'Database backup: %s\nImages backup: %s\n' "$destination" "$uploads_destination"
