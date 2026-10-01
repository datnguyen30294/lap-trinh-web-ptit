# GoBus database

## Overview

This directory defines the MySQL 8.4 database used by GoBus. The schema has seven business tables: `users`, `stations`, `routes`, `route_stops`, `schedules`, `fares`, and `bookings`.

## Key files

| File | Owns |
|---|---|
| `01-schema.sql` | Creates the database, tables, constraints, and indexes. |
| `02-seed-hanoi.sql` | Adds demo data for selected Hanoi bus routes. |
| `03-views.sql` | Defines route, schedule, availability, and booking views. |
| `04-example-queries.sql` | Read only query examples. |
| `README.md` | Setup instructions, data limits, and business invariants. |

## Conventions

- Treat the SQL schema as the source of truth; backend TypeORM synchronization is disabled.
- Preserve existing rows and the Docker volume. The Compose imports run only when the MySQL volume is initialized.
- Store datetimes in UTC and convert for display in Vietnam time (`+07:00`).
- Use `is_active` to retire stations where appropriate; routes, route stops, fares, and bookings reference stations with restrictive foreign keys.
- Keep the demo data labeled as demo data; route times, capacity, and fares are not official service data.

## Gotchas

- Constraints across several rows need backend transactions, especially station order, fare segments, and booking capacity.
- Booking capacity is checked per overlapping route segment, not by subtracting all bookings for a schedule.
- Read `README.md` before changing schema or seed behavior.
- Inspect the actual DB selected by .env before migrations: the local gobus_hanoi_student schema differs from 01-schema.sql and has vehicles rather than fares. Never switch the selected DB to match documentation.
- `migrations/004-stations-module.mjs` adds only missing stations.is_active, users.is_active and routes.status, saving private JSON backups under ignored .local/backups and verifying original-row checksums.

- `migrations/005-routes-module.mjs` adds nullable route_stops.minutes_from_origin only when absent, with private backup and original column checksums. Do not infer missing historical minutes or alter booked journeys.

- Schedule administration needs no new migration on the inspected local schema. Preserve unique(vehicle_id,departure_at), including cancelled schedules, and store DATETIME(3) in UTC.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
