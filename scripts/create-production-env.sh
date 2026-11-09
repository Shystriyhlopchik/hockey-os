#!/usr/bin/env bash
set -euo pipefail
umask 077
origin="${1:?Usage: bash scripts/create-production-env.sh https://your-domain.ru}"
if [[ ! "$origin" =~ ^https://[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$ ]]; then
  printf '%s\n' 'Укажите HTTPS-домен без пути, порта и завершающего слеша.' >&2
  exit 1
fi
project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"
if [[ -e .env.production ]]; then
  printf '%s\n' '.env.production уже существует; настройки не изменены.' >&2
  exit 1
fi
command -v openssl >/dev/null
database_password="$(openssl rand -hex 32)"
jwt_secret="$(openssl rand -hex 48)"
admin_password="$(openssl rand -hex 24)"
(
  set -o noclobber
  cat > .env.production <<EOF
POSTGRES_USER=hockey
POSTGRES_PASSWORD=$database_password
POSTGRES_DB=hockey_os
JWT_SECRET=$jwt_secret
INITIAL_ADMIN_PASSWORD=$admin_password
FRONTEND_ORIGIN=$origin
APP_BIND_PORT=8082
HOCKEY_IMAGE_TAG=first
EOF
)
chmod 600 .env.production
printf '%s\n' 'Создан .env.production с отдельными случайными паролями и ключом сессии.'
