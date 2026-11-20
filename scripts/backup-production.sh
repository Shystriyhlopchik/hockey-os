#!/usr/bin/env bash
set -euo pipefail
umask 077
project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
backup_dir="$project_root/backups"
mkdir -p "$backup_dir"
partial="$(mktemp "$backup_dir/hockey_$(date -u +%Y-%m-%d_%H-%M-%S)_XXXXXX.part")"
uploads_partial="${partial%.part}.uploads.part"
trap 'rm -f -- "$partial" "$uploads_partial"' EXIT
bash "$project_root/scripts/production.sh" exec -T database sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' > "$partial"
test -s "$partial"
bash "$project_root/scripts/production.sh" exec -T app \
  tar -C /app/uploads -czf - news > "$uploads_partial"
test -s "$uploads_partial"
destination="${partial%.part}.dump"
uploads_destination="${partial%.part}.uploads.tar.gz"
mv -- "$partial" "$destination"
mv -- "$uploads_partial" "$uploads_destination"
printf 'Database backup: %s\nImages backup: %s\n' "$destination" "$uploads_destination"
