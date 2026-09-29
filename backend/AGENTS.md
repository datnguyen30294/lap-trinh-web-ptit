# GoBus backend

## Overview

This package serves the GoBus API with NestJS 12, TypeORM, and MySQL. Stations provides paginated search, create, edit and status APIs protected by ADMIN sessions.

## Key files

| File | Owns |
|---|---|
| `src/main.ts` | Starts NestJS and enables CORS for `http://localhost:5173`. |
| `src/app.module.ts` | Loads root environment settings, MySQL connection, and feature modules. |
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

## Gotchas

- `stations.is_active` is mapped; never delete stations. Reject deactivation when an ACTIVE route uses the station as an endpoint or intermediate stop.
- `src/auth/` authenticates existing users with bcrypt and express-session; AdminGuard reads the current role and active flag from MySQL on every protected request.
- `npm run test:e2e` builds first, requires MySQL and TEST_ADMIN_EMAIL/PASSWORD + TEST_USER_EMAIL/PASSWORD in root .env; station tests start a server on port 3101 and clean only their fixtures.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
