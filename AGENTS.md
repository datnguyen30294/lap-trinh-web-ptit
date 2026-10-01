# GoBus

## Stack

- **Language / Runtime**: JavaScript in frontend, TypeScript on Node.js in backend.
- **Framework**: React 19 with Vite 8; NestJS 12 with TypeORM.
- **Database**: MySQL 8.4, initialized from SQL files in `database/`.
- **Package manager**: npm, with separate `frontend/` and `backend/` packages.

## Build approach

<TBD, set by /scope>

## Commands

Fresh clone: `node database/scripts/setup-local.mjs` creates local env/session secret and initializes the matching application database without overwriting existing data. See `database/README.md` for old ERD databases.

```bash
docker compose up -d
cd backend && npm install && npm run start:dev
cd frontend && npm install && npm run dev
cd backend && npm run build && npm run test
cd frontend && npm run build && npm run lint
```

Run each `cd` command from the repository root in a separate terminal or return to the root first.

## Specs

Store new workflow specs in `docs/specs/NNNN-title.md`. Existing project requirements and wireframe links are in `docs/design/`. Station module design is `docs/specs/0001-stations-management.md`; run instructions are in `docs/stations-module.md`.

Route module design is `docs/specs/0002-routes-stops-management.md`; run and migration instructions are in `docs/routes-module.md`.

Schedule module design is `docs/specs/0003-schedules-management.md`; run and verification instructions are in `docs/schedules-module.md` and `docs/schedules-verification.md`.

## Rules

- Passenger homepage and role navigation spec: `docs/specs/0004-user-home.md`; run and verification notes: `docs/user-home-module.md`.

- Read the current code and manifests before changing a feature. The root README and database setup describe the current application stack.
- Keep database access in the NestJS backend. The React frontend calls backend APIs.
- Treat `database/01-schema.sql` as the database structure. TypeORM has `synchronize: false`; change the schema deliberately instead of relying on entity synchronization.
- Keep environment values in the ignored root `.env`; do not put credentials in source files or these context files.
- Preserve the existing SQL data and Docker volume while developing. Database setup is documented in `database/README.md`.

## Agent skills

- [audit](.agents/skills/audit/): `jsmastery-pro/skills`, document project context.
- [scope](.agents/skills/scope/): `jsmastery-pro/skills`, plan features.
- [architect](.agents/skills/architect/): `jsmastery-pro/skills`, record design decisions.
- [develop](.agents/skills/develop/): `jsmastery-pro/skills`, implement features.
- [check](.agents/skills/check/): `jsmastery-pro/skills`, verify or review changes.
- [test](.agents/skills/test/): `jsmastery-pro/skills`, add tests for changed code.
- [debug](.agents/skills/debug/): `jsmastery-pro/skills`, investigate bugs.
- [document](.agents/skills/document/): `jsmastery-pro/skills`, write change documentation.
- [sync](.agents/skills/sync/): `jsmastery-pro/skills`, refresh project context after changes.

## Context files

- [backend/AGENTS.md](backend/AGENTS.md) (NestJS API and TypeORM conventions)
- [frontend/AGENTS.md](frontend/AGENTS.md) (React and Vite workspace)
- [database/AGENTS.md](database/AGENTS.md) (MySQL schema, seed data, and views)

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
