# AI World Atlas

A real full-stack geospatial application: Vite + Mapbox GL JS frontend, Express API, PostgreSQL/PostGIS persistence.

## Requirements
- Node.js 22 (`.nvmrc` pins it; `engines` requires `>=22 <23`)
- Docker Desktop (for PostGIS)
- Mapbox public token (only needed for the map; the app has a fallback renderer)

## 1. Environment
```bash
cp .env.example .env
```
`docker-compose.yml` requires `POSTGRES_PASSWORD` with no default, so this copy is not optional. `.env.example` already carries a working value for local development — replace it before deploying anywhere real.

## 2. Database
```bash
docker compose up -d
npm run db:setup
```
The schema is **not** loaded automatically. `db:setup` runs `db:migrate` (applies `apps/api/migrations/*.sql` in filename order) then `db:seed` (applies `apps/api/seeds/*.sql`). Both are idempotent: re-running converges rather than duplicating.

To throw the database away and rebuild it — the supported path off a pre-V1 database, since there is no schema upgrade migration — use `npm run db:reset`.

## 3. Install
```bash
npm install
```
It is an npm-workspaces monorepo, so one install at the root covers all three packages.

## 4. Run
```bash
npm run dev
```
Frontend: http://localhost:5173
API: http://localhost:8787/api/health

`npm run check` runs the four gates in order: `lint`, `typecheck`, `test`, `build`.

## Architecture
- `apps/web`: interactive atlas, Globe projection, clustering, filters, detail view, fallback renderer.
- `apps/api`: REST API, validation, PostGIS queries.
- `packages/contracts`: closed vocabularies and Zod wire schemas, shared by both apps.
- `apps/api/migrations`: schema. `apps/api/seeds`: audited seed data.
- `docker-compose.yml`: PostGIS.

## API
Read-only. There is no public write route.

GET `/api/projects?q=&type=&status=&sector=&location=`
GET `/api/locations`
GET `/api/events?projectId=`
GET `/api/stats`
GET `/api/health`

## V4 direction
This is the production foundation for temporal geospatial knowledge: provenance, evidence levels, locations, projects, events and relations can grow without coupling the data to UI components. The next backend layer can add authenticated admin workflows, source ingestion, deduplication/entity resolution, scheduled jobs, vector tiles and a graph service.
