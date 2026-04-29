# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**CODA** (Contextual Operations Data Activation) is a NASA full-stack TypeScript web application for consolidating mission, training, and testing context into a unified platform with real-time data visualization, interactive maps, and historical event management.

## Commands

```bash
npm i                        # Install dependencies
npm run dev                  # Start frontend (Vite HMR) + backend (ESBuild watch + auto-restart)
npm run build                # Production build (frontend + backend)
npm run test                 # Run tests (Vitest)
npm run test:coverage        # Run tests with coverage
npm run test:all             # Full check: lint + tsc + build + test
npm run lint                 # Lint JS and CSS in parallel
npm run lint:fix             # Auto-fix lint issues
npm run tsc                  # TypeScript type check

# Run a single test file
npx vitest src/path/to/file.spec.ts

# Database migrations
npm run migration:up
npm run migration:down
npm run migration:create

# Docker: start only the supporting services (PostgreSQL etc.)
npm run docker:services
```

Development requires PostgreSQL running (via `npm run docker:services`) before starting `npm run dev`. The dev server runs at `http://coda-local.fit.nasa.gov:3000`.

## Architecture

CODA is a **full-stack monorepo** with a clear frontend/backend split:

- **Frontend**: React 19 SPA, built by Vite → `.local/vite/dist/`
- **Backend**: Express 5 REST API + Socket.IO, bundled by ESBuild → `.local/express/dist/api.js`
- **Database**: PostgreSQL via MikroORM 6 (using entity decorators, `experimentalDecorators: true`)
- **State**: Redux Toolkit slices + async thunks on the client

### Source Layout

```
src/
├── components/          # React UI components
├── pages/               # React Router pages
├── store/               # Redux slices and thunks (thunk/ subdirectory)
├── server/
│   ├── express/         # HTTP server, REST routes, Socket.IO handlers
│   ├── database/        # MikroORM config, entity models, migrations, seeds
│   ├── processing/      # Business logic (ephemeris, GPS, day/night, graphs)
│   └── services/        # External API integrations
├── utils/               # Shared utilities (logging, env, Redux hooks)
├── packages/            # Reusable logic packages
└── typings/             # Global TypeScript type definitions
```

### Data Flow

```
External APIs (SpaceTrack, EMSS, Maestro, LaunchPad)
  → Express routes → Processing layer → MikroORM → PostgreSQL
  → Socket.IO events → Redux store → React components
```

REST API is served at `/api/v1/`. Key route groups: `/db/*` (CRUD), `/emss/*`, `/user/current`, `/external/daynight/*`, `/log/from-client`.

### Key Patterns

- **TypeScript strict mode** throughout; `baseUrl: "./src"` enables `import from "components/..."` style imports.
- **MikroORM RequestContext** wraps each HTTP request for identity-map isolation.
- **Socket.IO** handles real-time updates: GPS, sequences, video/photo timeline, ephemeris, talkybot.
- **Redux** uses `useAppSelector` / `useAppDispatch` wrappers — ESLint enforces this; bare `useSelector`/`useDispatch` imports are forbidden.
- **Lodash**: import specific functions only (`import sortBy from "lodash/sortBy"`), not the full package.
- **CSS Modules** for all component styling; Stylelint enforces CSS module best practices.

### Build Config Files

- `vite.config.mts` — Frontend build, dev proxy to backend port 3001, chunk splitting for react/plotly/mapbox/fonts/paper.
- `esbuild.mjs` — Backend ESM bundle, watch mode with auto-server-restart, Node debugger on port 8229.
- `vitest.config.mts` — Tests in `src/**/*.spec.ts`, JUnit output to `./junit.xml` for CI.
- `eslint.config.mjs` — ESLint 9 flat config with TypeScript, React, Prettier, and CSS Modules plugins.

### External Integrations

- **SpaceTrack**: TLE orbital data for ephemeris calculations
- **EMSS Matrix**: Mission operations data
- **Maestro**: Day/night terminator calculations
- **Talkybot**: Server-to-server real-time communication
- **LaunchPad**: NASA OAuth2 user authentication proxy
- **Mapbox/MapLibre**: Map rendering

### Deployment (GitLab CI)

- `int` branch → `coda-int.fit.nasa.gov`
- `prod` branch → `coda.fit.nasa.gov`
- Feature branches → element-named dev servers
