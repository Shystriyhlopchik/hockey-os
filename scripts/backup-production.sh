#!/usr/bin/env bash
set -euo pipefail
umask 077
project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
backup_dir="$project_root/backups"
mkdir -p "$backup_dir"
partial="$(mktemp "$backup_dir/hockey_$(date -u +%Y-%m-%d_%H-%M-%S)_XXXXXX.part")"
trap 'rm -f -- "$partial"' EXIT
bash "$project_root/scripts/production.sh" exec -T database sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' > "$partial"
test -s "$partial"
destination="${partial%.part}.dump"
mv -- "$partial" "$destination"
printf 'Backup: %s\n' "$destination"
