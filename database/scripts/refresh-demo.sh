#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
# Add only missing Hanoi demo rows; do not overwrite existing edits or history.
docker compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysql --default-character-set=utf8mb4 -u"$MYSQL_USER" "$MYSQL_DATABASE"' < database/02-seed-hanoi.sql
