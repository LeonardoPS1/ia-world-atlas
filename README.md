# AI World Atlas V4

A real full-stack geospatial application: Vite + Mapbox GL JS frontend, Express API, PostgreSQL/PostGIS persistence.

## Requirements
- Node.js 20+
- Docker Desktop (for PostGIS)
- Mapbox public token

## 1. Database
```bash
docker compose up -d
```
The schema and seed data are loaded automatically on first database creation.

## 2. Install
```bash
npm install
cd apps/web && npm install
cd ../api && npm install
cd ../..
```

## 3. Environment
Copy `apps/web/.env.example` to `apps/web/.env` and add your Mapbox public token.
Copy `apps/api/.env.example` to `apps/api/.env` if you need to override defaults.

## 4. Run
```bash
npm run dev
```
Frontend: http://localhost:5173
API: http://localhost:8787/api/health

## Architecture
- `apps/web`: interactive atlas, Globe projection, clustering, filters, detail view, fallback renderer.
- `apps/api`: REST API, validation, PostGIS queries.
- `apps/api/sql`: schema + seed.
- `docker-compose.yml`: PostGIS.

## API
GET `/api/projects?q=&type=&status=&sector=&location=`
GET `/api/locations`
GET `/api/events?projectId=`
GET `/api/stats`
POST `/api/projects`
GET `/api/health`

## V4 direction
This is the production foundation for temporal geospatial knowledge: provenance, evidence levels, locations, projects, events and relations can grow without coupling the data to UI components. The next backend layer can add authenticated admin workflows, source ingestion, deduplication/entity resolution, scheduled jobs, vector tiles and a graph service.
