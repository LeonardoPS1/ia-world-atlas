# AI World Atlas

A navigable atlas of AI projects, policies, research and infrastructure, mapped to
where they happen. This repository contains **V1: the navigable core** — a globe map,
a geographic hierarchy, server-side filters, project details with primary sources,
a status vocabulary and a basic timeline.

> The product concept and every scope decision live in
> [`docs/superpowers/specs/2026-09-25-ai-world-atlas-core-design.md`](docs/superpowers/specs/2026-09-25-ai-world-atlas-core-design.md).

## Why it is built this way

- **No frontend framework.** Vite plus TypeScript modules and a single observable store.
  The app has no framework-shaped problems, so a framework would only add indirection.
- **Filtering happens on the server.** The map, the cluster counters, the fallback list
  and the totals all read one response. There is no second, drifting client-side filter.
- **The API is read-only.** V1 has no anonymous write path and no admin surface.
- **Every marker has a colour and a label.** State is never conveyed by colour alone.
- **The map degrades to data.** Without a Mapbox token or WebGL the app still works:
  it renders a projected, data-only map and says so in a visible banner.

## Requirements

- Node.js 22 LTS (the images and `engines` field pin it)
- PostgreSQL 16 with PostGIS, or Docker to run it

## Quick start

```bash
npm install
cp .env.example .env          # then set DATABASE_URL and VITE_MAPBOX_TOKEN
npm run db:migrate            # creates the schema; safe to re-run
npm run db:seed               # loads the audited seed
npm run dev                   # api on :8787, web on :5173
```

Without a Mapbox token the map region shows the data-only fallback and a banner
explaining why. Everything else still works.

## The whole stack in Docker

```bash
cp .env.example .env
docker compose up --build -d  # http://localhost:8080
docker compose down -v
```

The API container runs the migration runner before the server, so an empty volume
is migrated on first boot.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Runs the API and the web app together |
| `npm run build` | Builds contracts, then the API, then the web app, in that order |
| `npm run check` | `lint` + `typecheck` + `test` + `build`. The gate that must pass |
| `npm run test:e2e` | Playwright suite against in-memory repositories |
| `npm run db:migrate` | Applies pending SQL migrations |
| `npm run db:seed` | Loads the audited seed data |
| `npm run db:setup` | `db:migrate` followed by `db:seed` |
| `npm run db:reset` | **Destructive.** Drops the local Docker volume, recreates it and re-seeds |

## Layout

```
apps/web         Vite + TypeScript frontend, no framework
apps/api         Express + pg read-only API
packages/contracts  Zod schemas and closed vocabularies shared by both
docs/superpowers/specs   Product and architecture specification
docs/decisions          Architecture decision records
```

## Data honesty

The seed is audited, not generated. `VERIFIED` evidence appears only where a real
audit exists. There are zero invented relations. Sources are primary documents and
each one is rendered in the drawer next to the claim it supports.

## Licence

Private repository. All rights reserved.