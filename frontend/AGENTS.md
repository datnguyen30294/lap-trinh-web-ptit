# GoBus frontend

## Overview

This package is a React 19 application created with Vite 8 using JavaScript and JSX. `src/pages/StationsPage.jsx` and `src/components/stations/` implement station administration; App.jsx gates it with existing-user login.

## Key files

| File | Owns |
|---|---|
| `index.html` | Provides the `root` element and expects `/src/main.jsx`. |
| `vite.config.js` | Enables React and proxies /api to the root .env PORT (default 3001). |
| `eslint.config.js` | Configures JavaScript, React Hooks, and React Refresh lint rules. |
| `src/pages/` | Intended location for page components. |
| `src/components/` | Intended location for reusable components. |

## Commands

Run from `frontend/`:

```bash
npm install
npm run dev
npm run build
npm run lint
npm test
```

## Conventions

- Write React components in `.jsx` and keep shared components separate from page components.
- Request application data through backend APIs; do not connect the browser to MySQL.
- Check the design references in `../docs/design/` when implementing a designed screen.

- Design system: follow `design.md` and `src/styles.css`, sourced from Figma. Active station labels are green, inactive gray.
- Vitest and Testing Library cover UI behavior; browser verification covers native dialogs, responsive layout and real MySQL flows.

- Routes UI is at `/routes`, implemented in `src/pages/RoutesPage.jsx` and `src/components/routes/`. `routesApi.js` reuses the authenticated request helper exported by `stationsApi.js`.
- Route forms load real stations, derive endpoints from ordered stops, and keep user input when the API rejects a mutation.

- Schedules UI is at `/schedules`, with a right panel form, detail timeline and status confirmation. `scheduleTime.js` explicitly converts Vietnam datetime input to UTC and displays Asia/Ho_Chi_Minh.
- Vehicle capacity and total CONFIRMED tickets are separate values; do not derive segment availability from their difference.

## Gotchas

- Journey Planner origin input is `components/journey-planner/OriginAutocomplete.jsx`: database station suggestions debounce 400 ms; free addresses require Enter or Search through `services/geocodingService.js`. Public Nominatim must not be used for autocomplete. Editing A invalidates its coordinates and previous journeys; see `../docs/journey-origin.md`.
- JourneySidebar owns both A and B inputs. `PlaceAutocomplete.jsx` searches destination stations in the sidebar; JourneyPlannerPage owns the selection and passes `onDestinationSelect`/`onDestinationClear`. Keep the map free of duplicate search inputs and render selected destination names from props after sidebar remounts.

- Passenger homepage is `/user/home`, based on Figma 102:3, using scoped `pages/user-home.css` and local Manrope. See `../docs/user-home-module.md`.
- App.jsx resolves USER/ADMIN routes before rendering, rechecks session on focus/pageshow/visibility, and rejects stale auth responses. `/` resolves by role; unauthenticated visitors go to `/login`.
- `services/passengerApi.js` uses the existing request helper for read-only passenger APIs; never call ADMIN list endpoints from the passenger homepage.

- `src/main.jsx` loads App.jsx, local Geist fonts and styles.css. Stations UI is at /stations for ADMIN; / redirects according to the authenticated role.
- `src/services/stationsApi.js` uses fetch with session cookies and X-GoBus-Request. Refresh lists from the API after mutations.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
