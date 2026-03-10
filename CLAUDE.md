# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CODA (Contextual Operations Data Activation) is a NASA full-stack web application for consolidating mission, training, and testing data into a unified interface. It uses a React frontend and Express backend, with PostgreSQL for persistence and Socket.IO for real-time communication.

## Development Commands

```bash
# Install dependencies
npm ci

# Local development (recommended) - runs Vite on :3000 and Express on :3001 concurrently
npm run docker:services   # Start Postgres, Redis, etc. in Docker
npm run dev               # Start Vite + Express with hot reload

# Full Docker stack (production-like)
npm run docker:preview

# Build
npm run build             # Build both frontend (Vite) and backend (esbuild)
npm run api:build         # Build backend only

# Testing
npm run test              # Run Vitest once
npm run test:coverage     # Run with coverage reports
npm run test:all          # Lint + TSC + build + test + coverage

# Run a single test file
npx vitest run src/path/to/file.spec.ts

# Linting & type checking
npm run lint              # ESLint + Stylelint
npm run lint:fix          # Auto-fix
npm run tsc               # TypeScript type check only

# Database migrations
npm run migration:create  # Create a new migration
npm run migration:up      # Apply pending migrations
npm run migration:down    # Revert last migration
```

Access local dev at `http://coda-local.fit.nasa.gov:3000` (requires `/etc/hosts` entry pointing to 127.0.0.1).

## Architecture

### Frontend (`src/`)
- **React 19** with TypeScript, built by Vite with SWC
- **React Router v7** for routing; main app router in `src/App.tsx`
- **Redux Toolkit** for state management; all slices in `src/store/`
- **CSS Modules** for component styling (camelCase references)
- Component structure:
  - `src/components/framework/` — layout chrome (Dockview-based panel system)
  - `src/components/interface/` — reusable UI components
  - `src/components/panes/` — data visualization panes (graphs, video)
  - `src/pages/` — route-level page components (admin, view/ISS, view/NBL, etc.)
- Data visualization: Plotly.js for graphs, Paper.js for drawing, Mapbox GL / MapLibre GL for maps
- Entry point: `src/index.tsx`

### Backend (`src/server/`)
- **Express 5** with ESM modules, entry point `src/server/express/server.ts`, port 3001
- **Socket.IO** at path `/api/v1/socketio` for real-time data push
- **MikroORM 6** with PostgreSQL; config at `src/server/database/mikro-orm.config.ts`
  - Entity models in `src/server/database/models/`
  - Migrations in `src/server/database/migrations/`
- API routes in `src/server/express/routes/` grouped by domain: `db/`, `emss/`, `user/`, `time/`, `daynight/`, `profiler/`
- Background schedulers in `src/server/processing/`:
  - `dataRetrievalScheduler.ts` — fetches external operational data
  - `spacetrackScheduler.ts` — updates TLE (Two-Line Element) orbital data
- Built to `.local/express/dist/api.js` via esbuild
- Health check: `GET /api/v1/health` | Version: `GET /api/v1/version`

### Key conventions
- **All times stored internally in UTC**; durations stored in seconds
- Use custom Redux hooks (not raw `useDispatch`/`useSelector`) — enforced by ESLint
- No `any` types — ESLint rule is enforced
- Lodash imports are restricted to specific allowed methods
- Test files: `src/**/*.spec.ts`

### Path aliases (from `tsconfig.json`)
`components`, `packages`, `pages`, `public`, `server`, `store`, `typings`, `utils` all resolve to their respective `src/` subdirectories.

### Environment / Auth
- Three environments: `local`, `fit` (integration/production), `test`
- NASA LaunchPad OAuth2 via oauth2-proxy (sandbox in non-prod); configured in `env.config.ts`
- NASA NOCA certificates required for SSL verification in CI and Docker builds

## CI/CD (GitLab)
- Pipeline: `.gitlab-ci.yml` (main), `.gitlab/.gitlab-ci.yml` variants
- Branches map to environments: `int` → `coda-int.fit.nasa.gov`, `prod` → `coda.fit.nasa.gov`
- Dev server deployments (carbon/gold/iron/neon/oxygen) are manually triggered
- CI runs: yaml-lint, dependency-check, npm audit, TypeScript check, Vitest with coverage, Docker image builds via Kaniko
