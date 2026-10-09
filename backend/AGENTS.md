# GoBus backend

## Overview

This package serves the GoBus API with NestJS 12, TypeORM, and MySQL. Stations provides paginated search, create, edit and status APIs protected by ADMIN sessions.

## Key files

| File | Owns |
|---|---|
| `src/main.ts` | Starts NestJS and enables CORS for `http://localhost:5173`. |
| `src/app.module.ts` | Loads root environment settings, MySQL connection, and feature modules. |
| `src/routes/` | ADMIN route and ordered stop APIs, using parameterized TypeORM transaction queries against the inspected schema. |
| `src/stations/` | Station entity, repository service, module, and controller. |
| `vitest.config.ts` and `vitest.config.e2e.ts` | Unit and end to end test configuration. |

## Commands

Run from `backend/`:

```bash
npm install
npm run start:dev
npm run build
npm run lint
npm run test
npm run test:e2e
```

## Conventions

- Use NestJS modules and constructor injection. The stations service receives its TypeORM repository through `@InjectRepository`.
- The package uses ESM. Relative imports in TypeScript source use `.js` suffixes.
- Database connection settings come from the root `.env` through `ConfigModule`, with `envFilePath: '../.env'`.
- SQL files in `../database/` own the schema. TypeORM entity synchronization is disabled.

- `src/setup-app.ts` owns session cookies, CSRF header/origin validation, login throttling and global DTO validation. SESSION_SECRET is required; local PORT is 3001.
- Sessions are in memory for local development; production needs a shared persistent store and HTTPS/proxy configuration.

- Route mutations lock stations in ascending ID order before the route, then schedules and bookings. Future schedule/booking writers must use the same order and recheck state.
- Route journey changes preserve all booking history, including cancelled bookings; unchanged journeys retain stop IDs and legacy NULL minutes.

- Schedule mutations use READ COMMITTED and lock stations, routes, route_stops, vehicles, schedule, then bookings; sort station/route/vehicle IDs. The vehicle lock coordinates interval overlap checks. Booking writers must lock schedule and recheck status/time before inserting.
- `src/schedules/` exposes ADMIN list/detail/create/update/status plus paginated vehicle options. Datetime API uses UTC Z strings and explicit SQL date formatting; Vietnam day filters use UTC half open bounds.

## Gotchas

- `src/bookings/` owns passenger trip search, per passenger booking, receipts, owned ticket detail/QR and cancellation. Booking E2E uses port 3105 and cleans only its fixtures; see `src/bookings/AGENTS.md` and `../docs/bookings-module.md`.
- `src/journey-planner/geocoding.service.ts` proxies explicit Hanoi address searches with PassengerGuard, bounded results, cache and a single process request queue. Default Nominatim needs no key; `NOMINATIM_SEARCH_URL` optionally changes provider. Do not call public Nominatim on every keystroke. Tracking accepts optional `origin_label` for session restoration; see `../docs/journey-origin.md`.

- `src/passenger/` provides authenticated read-only station options and paginated direct-route searches. PassengerGuard rechecks current active USER/ADMIN roles; AdminGuard remains unchanged. No schema migration is needed.
- Passenger E2E tests use port 3104 and preserve all original rows. See `../docs/user-home-module.md` for scope and verification.

- `stations.is_active` is mapped; never delete stations. Reject deactivation when an ACTIVE route uses the station as an endpoint or intermediate stop.
- `src/auth/` supports USER registration and login with bcrypt and express-session; AdminGuard reads the current role and active flag from MySQL on every protected request.
- Registration accepts only full_name, email, password, confirm_password and terms_accepted=true; role/is_active are server controlled. Preserve the 72 byte UTF-8 password limit and unique email conflict handling. Registration E2E uses port 3107 and cleans only its generated accounts; see `../docs/registration-module.md`.
- `npm run test:e2e` builds first, requires MySQL and TEST_ADMIN_EMAIL/PASSWORD + TEST_USER_EMAIL/PASSWORD in root .env; station tests start a server on port 3101 and clean only their fixtures.

- Route integration tests use port 3102 and local vehicles schema. E2E suites run sequentially because they checksum the same database; clean only owned fixtures.

- Schedule E2E uses port 3103 with TZ America/Los_Angeles and the inspected vehicles schema; tests keep original row checksums and clean only their own fixtures. Legacy NULL stop minutes block creating/departing schedules, not reading history.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
