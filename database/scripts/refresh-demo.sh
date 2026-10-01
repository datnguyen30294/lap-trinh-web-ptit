#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
# Only for the application demo schema. The seed has no hardcoded USE statement.
# Do not use to migrate an ERD/production database; see database/README.md.
node database/scripts/setup-local.mjs
docker compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysql --default-character-set=utf8mb4 -u"$MYSQL_USER" "$MYSQL_DATABASE"' < database/02-seed-hanoi.sql
