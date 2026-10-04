# Operations

## Environment variables

### API (read at boot, validated by Zod; a missing value fails the process)

| Variable | Required | Notes |
| --- | --- | --- |
| `NODE_ENV` | no | `development` by default |
| `PORT` | no | `8787` |
| `DATABASE_URL` | yes | `postgres://user:pass@host:5432/db` |
| `CORS_ORIGIN` | no | Comma-separated allowlist. `*` is honoured only outside production |
| `LOG_LEVEL` | no | `debug`, `info`, `warn`, `error` |
| `ATLAS_REPOS` | no | `postgres` by default; `memory` serves the audited seed from memory and is for tests and E2E only |

### Web (read at **build** time by Vite, inlined into the bundle)

| Variable | Default | Notes |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `/api` | Same origin is why nginx proxies `/api` |
| `VITE_MAPBOX_TOKEN` | empty | Empty means the fallback map, with a visible banner |
| `VITE_MAPBOX_STYLE` | `mapbox://styles/mapbox/dark-v11` | |
| `VITE_ALLOW_HTTP_SOURCES` | `false` | Only for local development servers |

Rotating `VITE_MAPBOX_TOKEN` requires rebuilding the web image. It is not a runtime secret.

## Health

- `GET /api/health` — liveness and database reachability. `200` with `status: ok` or `degraded`.
- `GET /healthz` on the web container — static `ok`, used by the nginx health check.

## Migrations

Migrations are plain SQL files in `apps/api/migrations`, applied in filename order and
recorded in `schema_migrations`. The runner is idempotent: re-running applies nothing.
The API container runs the runner on boot, so a new volume is migrated automatically.

To add a migration, create `00N_description.sql`, write it against a database that has
the previous migrations applied, and never edit an already released migration.

## Resetting a local database

`npm run db:reset` runs `docker compose down -v && docker compose up -d && npm run db:setup`.
**It destroys the local Docker volume and every row in it.** It is a local convenience only:
never run it against a database whose host is not `localhost`.

## Seeding

`npm run db:seed` is idempotent: it upserts by primary key and never invents a relation.
Re-running it is the supported way to repair drifted data.

## Deploying to Dokploy

1. Create a PostgreSQL 16 service with the PostGIS image and note the credentials.
2. Create an application from this repository using `apps/api/Dockerfile`, with
   `DATABASE_URL`, `CORS_ORIGIN` set to the public web origin, and `LOG_LEVEL=info`.
3. Deploy the web as a static build of `apps/web` with `VITE_API_BASE_URL` pointed at
   the public API origin, or as a second service with the nginx config that proxies
   `/api`. Same origin is preferred: it removes CORS from the picture entirely.
4. Run `npm run db:migrate && npm run db:seed` once, as a one-off command, against the
   production database. Do not put the seed in a boot loop.

## Incident notes

- **Amber banner in the map region.** Either no token or no WebGL. Check
  `GET /api/health` first: if it answers `degraded`, the problem is the database.
- **`status: degraded` in the badge.** The API is up, the database is not. The app stays
  usable with the last data it loaded and the badge says why.
- **Counts disagree with the map.** They cannot: both read the same response. If they do,
  it is a bug in `buildSelectors`, and the selectors unit tests are the place to fix it.