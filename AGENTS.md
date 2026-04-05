# CODA

## Overview
Contextual Operations Data Activation (CODA) is a full-stack web application that consolidates the context of NASA missions, training, and testing into a platform for reliving and revisiting each moment, deployed at coda.fit.nasa.gov.

## Tech Stack
- TypeScript / JavaScript (full-stack)
- React 19 (front-end UI)
- Redux Toolkit (global state management)
- Vite 7 (front-end dev server and build)
- Express 5 (back-end API server)
- esbuild (back-end bundling)
- PostgreSQL with MikroORM (database and migrations)
- Socket.IO (real-time client-server communication)
- Docker / Docker Compose (containerized deployment)
- Vitest (testing framework)
- ESLint + Stylelint + Prettier (linting and formatting)
- Mapbox GL / MapLibre GL (mapping)
- GitLab CI/CD (deployment pipeline)

## Project Structure
- `src/` — Application source code
  - `src/components/` — React UI components
  - `src/pages/` — Page-level React components
  - `src/store/` — Redux store configuration and slices
  - `src/server/` — Express back-end API and services
  - `src/packages/` — Internal shared packages
  - `src/utils/` — Shared utility functions
  - `src/typings/` — TypeScript type definitions
  - `src/public/` — Static assets
- `docker/` — Dockerfiles for API, nginx, and MediaMTX mock
- `scripts/` — Dev SSL cert generation, DB upgrade scripts
- `ci/` — CI/CD configuration (dependency suppression)
- `appcompose` — Docker Compose orchestration wrapper

## Development

### Prerequisites
- Node.js (see `docker/apiv1/Dockerfile` for version)
- Docker Desktop (optional, for containerized preview)
- NOCA certificate (`.env.local.cert.pem`) for NASA API authentication
- Host entry mapping `coda-local.fit.nasa.gov` to `127.0.0.1`

### Build / Run
```bash
# Install dependencies
npm i

# Create environment config
npm run make-dotenv

# Start backing services (Postgres, etc.)
npm run docker:services

# Start dev server (hot-reloading)
npm run dev
```
Then visit http://coda-local.fit.nasa.gov:3000

For a production-like Docker preview:
```bash
npm run docker:preview
```

### Test
```bash
# Run tests
npm run test

# Run tests with coverage
npm run test:coverage

# Full CI check (lint + typecheck + build + test)
npm run test:all
```

## Key Conventions
- All times are stored internally in UTC; all durations in seconds
- TypeScript is used throughout (front-end and back-end)
- Database migrations managed via MikroORM CLI (`npm run migration:*`)
- Environment secrets are stored in `env.secret.ts` (not committed)
- ESLint flat config (`eslint.config.mjs`) with Prettier integration
- CSS Modules with Stylelint for style linting
- Deployment follows a branch-based model: `prod` -> production, `int` -> integration, any branch -> dev servers
