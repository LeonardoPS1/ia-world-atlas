# AI World Atlas — Core Navigable Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the "Núcleo Navegable" of AI World Atlas — a dark-editorial, map-first web app backed by a read-only PostGIS API — with audited seed data, closed vocabularies, secure rendering, tests and green quality gates, pushed to `LeonardoPS1/ia-world-atlas`.

**Architecture:** npm-workspaces monorepo with three packages: `packages/contracts` (closed vocabularies + Zod schemas shared by both apps), `apps/api` (Express + `pg`, repository pattern, SQL migration runner, read-only routes), `apps/web` (Vite + TypeScript, no framework, single observable store, Mapbox GL JS globe with a data-only fallback). Filtering and search happen server-side so the map, clusters, fallback list and counters all derive from one response.

**Tech Stack:** Node 22 LTS, npm workspaces, TypeScript 5.7, Vite 6, Mapbox GL JS 3, Express 5, `pg` 8, Zod 3, PostGIS 3.4 on PostgreSQL 16, Vitest 3, Playwright 1.50, `@axe-core/playwright`, ESLint 9 flat config, Docker multi-stage builds.

**Source spec:** `docs/superpowers/specs/2026-09-25-ai-world-atlas-core-design.md` (646 lines, approved by Leonardo), with its rendered PDF in the same folder. The spec carries two post-approval corrections, both committed: the search predicate is `plainto_tsquery('spanish', q)`, and a `yRanking` typo is `ranking`.

---

## Global Constraints

These apply to every task. Values are copied verbatim from the spec.

- **Node:** 22 LTS. `.nvmrc` contains `22`. `package.json#engines.node` is `">=22 <23"`.
- **Package manager:** npm workspaces (no pnpm/yarn). Root `package.json#workspaces` is `["apps/*", "packages/*"]`.
- **Package names:** `@atlas/contracts`, `@atlas/api`, `@atlas/web`.
- **No React, no framework, no icon library, no emoji as product iconography.** Icons are inline linear SVG generated in code.
- **`innerHTML`, `insertAdjacentHTML` and `document.write` are forbidden** in `apps/web/src`. External data is inserted with `textContent` or DOM nodes only.
- **Source URLs:** only `http:` in local development, only `https:` in production. Anything else (including `javascript:`, `data:`, `vbscript:`) is rejected and rendered as unlinked text.
- **Vocabularios are closed** and enforced by both Zod and SQL `CHECK` constraints: 16 project types, 12 statuses, 6 evidence levels, 6 location levels, 7 source types, 3 confidence levels, 12 relation types, 8 impact categories.
- **No public write route in V1.** `POST /api/projects` must not exist. It falls through to `notFoundHandler` and answers `404 NOT_FOUND` with the standard error envelope. `405 METHOD_NOT_ALLOWED` is also acceptable if an implementation prefers to add the distinction, but do not build a router abstraction to produce it.
- **`VERIFIED` evidence is never auto-assigned.** The seed uses `REPORTED` / `ANNOUNCED` only.
- **No invented numbers.** No rankings, no "leaders", no density-derived metrics. No "58 centres" or "20 solutions" claims.
- **Mapbox globe must never auto-rotate.** No `rotateTo`, no `dragRotate` on init loop, no autoplay. Initial camera centers on Viña del Mar.
- **Map occupies ≥ 70% of the visible area** at 1440×900, measured on the viewport excluding header and bottom strip.
- **Project pins are never solid circles.** Each location level has its own shape (open ring, radar, hexagon, orbital arc, constellation). Clusters are open rings with a counter.
- **CORS is an allowlist.** `*` is only honoured when `CORS_ORIGIN` is literally `*` and `NODE_ENV !== "production"`.
- **All four gates always run:** `lint`, `typecheck`, `test`, `build`, aggregated in `npm run check`. Only DB integration tests may skip, and the runner prints `skipped: db integration` — never `passed`.
- **Colors:** obsidian `#08090C`, ink `#11141A`, warm white `#E9E6DF`, electric blue `#4B8CFF`, ultraviolet `#8567FF`, mint `#70D6B2`, amber `#E5A84B`, ice `#70C8E8`, coral `#E47C71`, lime `#A9D66F`, lavender `#B59AFF`. Transitions 160/280/420 ms with `cubic-bezier(0.22, 0.61, 0.36, 1)`, no bounce.
- **Transitions between panels: 250–450 ms.** `prefers-reduced-motion: reduce` removes pulses, orbits and long timings while keeping navigation functional.
- **No secrets in the bundle.** `VITE_MAPBOX_TOKEN` is public by design; `DATABASE_URL` and any admin token never reach the client.
- **No `git commit --amend`, no force push, no skipping hooks.**
- **A task is not done until its stated test command passes.** Never report success without running the command.

**Environment constraints on this machine (already verified):** Node `v26.8.2` and npm `11.9.0` are installed; **Docker is NOT installed**, so any step requiring a live PostGIS server must be marked `skipped: db integration` locally and left to CI. `rg` is not on PATH — use `functions.grep`.

---

## File Structure Map

Everything below is created or rewritten by this plan. Nothing else is in scope.

```text
ai-world-atlas/
├─ .env.example                      NEW   root-level shared env template (no secrets)
├─ .gitattributes                    NEW   LF normalization for code, CRLF for .bat/.ps1
├─ .nvmrc                            NEW   "22"
├─ .prettierrc.json                  NEW
├─ .dockerignore                     NEW   keeps the build context small and secrets out
├─ eslint.config.js                  NEW   flat config, shared by both apps
├─ package.json                      REWRITE  workspaces + gate scripts
├─ package-lock.json                 NEW   generated by npm install
├─ tsconfig.base.json                NEW
├─ vitest.shared.ts                  NEW   shared test defaults (globals, timeout)
├─ vitest.config.ts                  NEW   three projects: contracts, api, web
├─ .github/workflows/ci.yml          NEW   check + integration + e2e + images
├─ docker-compose.yml                REWRITE  db + api + web, healthchecks, no container_name
├─ docker-compose.prod.yml           NEW   prepared for Dokploy, not deployed in this delivery
├─ README.md                         NEW
├─ docs/
│  ├─ OPERATIONS.md                  NEW   env, health, migrations, Dokploy, incidents
│  ├─ decisions/0001-modular-vite-without-a-framework.md               NEW
│  ├─ decisions/0002-server-side-filtering-as-single-source-of-truth.md NEW
│  ├─ decisions/0003-read-only-api-in-v1.md                            NEW
│  ├─ decisions/0004-data-only-fallback-map.md                          NEW
│  └─ superpowers/
│     ├─ specs/2026-09-25-ai-world-atlas-core-design.md   (exists, approved, 2 corrections committed)
│     ├─ specs/2026-09-25-ai-world-atlas-core-design.pdf  (exists, 19 pages, regenerated)
│     └─ plans/2026-09-25-ai-world-atlas-core-navigation.md  (this file)
├─ packages/contracts/
│  ├─ package.json                   NEW   @atlas/contracts
│  ├─ tsconfig.json                  NEW
│  ├─ vitest.config.ts               NEW   project "contracts", node environment
│  └─ src/
│     ├─ index.ts                    NEW   barrel
│     ├─ vocabularies.ts             NEW   the 8 closed vocabularies
│     ├─ schemas.ts                  NEW   Zod schemas for every wire shape
│     ├─ types.ts                    NEW   inferred types + Paginated<T>
│     └─ __tests__/{vocabularies,schemas}.test.ts  NEW
├─ apps/api/
│  ├─ package.json                   REWRITE  @atlas/api, TS
│  ├─ tsconfig.json                  NEW
│  ├─ vitest.config.ts               NEW
│  ├─ Dockerfile                     NEW   multi-stage, non-root, healthcheck
│  ├─ migrations/001_core.sql        NEW   final idempotent schema
│  ├─ seeds/001_core_seed.sql        NEW   11 locations, 5 projects, ≥5 sources, ≥5 events, 0 relations
│  ├─ src/
│  │  ├─ app.ts                      NEW   buildApp(deps) → Express, mounts /api/health + /api
│  │  ├─ server.ts                   NEW   listen, graceful shutdown, ATLAS_REPOS switch
│  │  ├─ config/{env,logger}.ts      NEW   Zod env validation that fails fast, structured logger
│  │  ├─ errors/{HttpError,errorHandler}.ts NEW
│  │  ├─ middleware/{requestId,security}.ts NEW   request id, helmet, CORS allowlist, body limit
│  │  ├─ db/{pool,migrate,migrate-cli,seed}.ts NEW  runner records applied files in schema_migrations
│  │  ├─ repositories/types.ts       NEW   AtlasRepositories interface
│  │  ├─ repositories/pg/{index,locations,projects,events,relations,stats}.ts NEW
│  │  ├─ repositories/fake.ts        NEW   in-memory double for tests and E2E
│  │  ├─ schemas/query.ts            NEW   Zod query schemas for every route
│  │  ├─ services/filters.ts         NEW   the filter rules the fake and the SQL must agree on
│  │  ├─ routes/{index,locations,projects,events,relations,stats}.ts NEW
│  │  ├─ testing/fixtures.ts         NEW   deterministic audited dataset
│  │  └─ **/*.test.ts                NEW   colocated unit tests
│  └─ test/{health,routes,security,errors}.test.ts  NEW  supertest suites
└─ apps/web/
   ├─ package.json                   REWRITE  @atlas/web, Vite, TS
   ├─ tsconfig.json                  NEW
   ├─ vite.config.ts                 NEW
   ├─ vitest.config.ts               NEW
   ├─ index.html                     REWRITE  lang, meta, no inline JS
   ├─ Dockerfile                     NEW   build with the Vite vars, serve with nginx
   ├─ nginx.conf                     NEW   SPA fallback, /api proxy, /healthz
   ├─ playwright.config.ts           NEW
   ├─ e2e/{helpers,atlas,fallback}.spec.ts  NEW
   └─ src/
      ├─ main.ts                     NEW   reads import.meta.env, builds the client, calls boot
      ├─ vite-env.d.ts               NEW   import.meta.env typing
      ├─ app/{boot,dataController}.ts NEW   bootstrap, query orchestration, abort + debounce
      ├─ data/{client,query,types,urls,normalize}.ts NEW  typed client, query builder, re-exports, URL sanitiser, wire → view model
      ├─ state/{store,filters,timeline,geo,palette,colors,selectors}.ts NEW
      ├─ map/{globe,markers,cluster,fallback,diagnostics}.ts NEW
      ├─ ui/{dom,icons}.ts           NEW
      ├─ ui/{shell,header,breadcrumb,rail,scaleControls,drawer,strip,legend,statusBadge}.ts NEW
      ├─ testing/{fixtures,fixture-data}.ts NEW  mirror of the API fixtures
      └─ styles/{tokens,base,layout,components}.css NEW
```

**Deleted as part of this plan:** `apps/web/src/main.js`, `apps/web/src/style.css`, `apps/api/src/server.js`, `apps/api/sql/001_schema.sql`, `apps/api/sql/002_seed.sql`. Their replacements are listed above. Task 3 performs the SQL deletions and Task 9 the frontend deletions, so the repository never has two competing schemas or two competing frontends.

---

## Phase 0 — Foundations

### Task 1: Monorepo workspace, TypeScript and lint tooling

**Files:**
- Modify: `package.json` (root)
- Create: `.nvmrc`, `.gitattributes`, `tsconfig.base.json`, `vitest.shared.ts`, `vitest.config.ts`, `eslint.config.js`, `.prettierrc.json`, `packages/contracts/package.json`, `packages/contracts/tsconfig.json`, `packages/contracts/vitest.config.ts`, `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/vitest.config.ts`, `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/vite.config.ts`, `apps/web/vitest.config.ts`, `apps/web/index.html`
- Delete: `apps/web/.env.example`, `apps/api/.env.example`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: workspace resolution `@atlas/contracts` from both apps; scripts `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `check`, `db:migrate`, `db:seed`, `db:setup`, `db:reset`, `test:e2e`; shared `tsconfig.base.json`; shared Vitest defaults exported from `vitest.shared.ts`.

- [ ] **Step 1: Create `.nvmrc` and `.gitattributes`**

`.nvmrc`:
```
22
```

`.gitattributes`:
```gitattributes
* text=auto eol=lf
*.bat text eol=crlf
*.ps1 text eol=crlf
*.png binary
*.pdf binary
```

- [ ] **Step 2: Rewrite root `package.json`**

```json
{
  "name": "ai-world-atlas",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "engines": { "node": ">=22 <23" },
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "npm run dev --workspaces --if-present",
    "build": "npm run build -w @atlas/contracts && npm run build -w @atlas/api -w @atlas/web",
    "start": "npm run start --workspace @atlas/api",
    "lint": "eslint .",
    "typecheck": "npm run build -w @atlas/contracts && npm run typecheck -w @atlas/contracts -w @atlas/api -w @atlas/web",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "check": "npm run lint && npm run typecheck && npm test && npm run build",
    "db:migrate": "npm run db:migrate --workspace @atlas/api",
    "db:seed": "npm run db:seed --workspace @atlas/api",
    "db:setup": "npm run db:setup --workspace @atlas/api",
    "db:reset": "npm run db:reset --workspace @atlas/api",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  },
  "devDependencies": {
    "@eslint/js": "^9.17.0",
    "@playwright/test": "^1.49.1",
    "@types/node": "^22.10.2",
    "@vitest/coverage-v8": "^3.0.0",
    "eslint": "^9.17.0",
    "globals": "^15.14.0",
    "prettier": "^3.4.2",
    "typescript": "^5.7.2",
    "typescript-eslint": "^8.18.1",
    "vite": "^6.0.5",
    "vitest": "^3.0.0"
  }
}
```

Note: `vitest run` at the root works because Vitest resolves `vitest.config.ts` in each workspace package through the `test.projects` file added in Step 8. Root `test` must NOT use `--workspaces` (each package's Vitest run is orchestrated by the root config so DB-integration skip logic lives in one place).

Note: `format` and `format:check` run Prettier but are **not** part of `npm run check`. Formatting is not a gate; adding it there would make the gate fail on the legacy V4 files that Task 9 deletes.

Note on `build` and `typecheck`: both build `@atlas/contracts` first, explicitly. `npm run build --workspaces` iterates workspaces in glob order, not topological order, and both apps resolve `@atlas/contracts` through its `dist` entry points, so an implicit order produces a confusing "cannot find module '@atlas/contracts'" failure. Never replace these with `--workspaces`.

- [ ] **Step 3: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": false,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true,
    "verbatimModuleSyntax": false
  }
}
```

- [ ] **Step 4: Create `vitest.shared.ts`**

```ts
import { defineConfig } from 'vitest/config';

export const sharedTestConfig = defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],
    testTimeout: 15000,
    hookTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
    },
  },
});
```

- [ ] **Step 5: Create `eslint.config.js` and `.prettierrc.json`**

`eslint.config.js`:
```js
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', '**/playwright-report/**', '**/test-results/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'smart'],
    },
  },
  {
    files: ['apps/web/**/*.ts', 'apps/web/**/*.tsx'],
    rules: { 'no-console': 'off' },
  },
);
```

`.prettierrc.json`:
```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

- [ ] **Step 6: Create the three package manifests**

`packages/contracts/package.json`:
```json
{
  "name": "@atlas/contracts",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": { ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.test.json"
  },
  "dependencies": { "zod": "^3.24.1" },
  "devDependencies": { "typescript": "^5.7.2" }
}
```

`packages/contracts/tsconfig.test.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "noEmit": true },
  "include": ["src/**/*.ts"]
}
```

Two configs, because `tsconfig.json` has to exclude `__tests__` for the build while `typecheck` must still
cover the tests. Adding `exclude` alone would have quietly dropped the two test files out of the
typecheck program, which is the exact coverage loss Task 1's `apps/api/tsconfig.test.json` already
exists to prevent. A single `tsconfig.json` cannot be both "emit the package" and "check the tests"
once the tests live under `src/`.

`apps/api/package.json`:
```json
{
  "name": "@atlas/api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/server.js",
  "scripts": {
    "dev": "node --experimental-strip-types --watch src/server.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/server.js",
    "typecheck": "tsc -p tsconfig.json --noEmit && tsc -p tsconfig.test.json",
    "db:migrate": "node --experimental-strip-types src/db/migrate.ts",
    "db:seed": "node --experimental-strip-types src/db/seed.ts",
    "db:setup": "npm run db:migrate && npm run db:seed"
  },
  "dependencies": {
    "@atlas/contracts": "*",
    "cors": "^2.8.5",
    "dotenv": "^16.4.7",
    "express": "^5.1.0",
    "helmet": "^8.0.0",
    "pg": "^8.16.3",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "@types/pg": "^8.11.10",
    "@types/supertest": "^6.0.2",
    "supertest": "^7.0.0",
    "typescript": "^5.7.2",
    "vitest": "^3.0.0"
  }
}
```

`apps/web/package.json`:
```json
{
  "name": "@atlas/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -p tsconfig.json --noEmit && vite build",
    "preview": "vite preview",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@atlas/contracts": "*",
    "mapbox-gl": "^3.9.0"
  },
  "devDependencies": {
    "@axe-core/playwright": "^4.10.1",
    "@playwright/test": "^1.49.1",
    "@types/mapbox-gl": "^3.4.1",
    "typescript": "^5.7.2",
    "vite": "^6.0.5",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 7: Create the three `tsconfig.json` files**

`packages/contracts/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "./dist", "rootDir": "./src" },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/__tests__/**"]
}
```

The `exclude` is load-bearing, not cosmetic. Without it this package emits `dist/__tests__/schemas.test.js`, and that file does `import 'vitest'` at runtime. The API Dockerfile runs `npm prune --omit=dev`, so in production the file would sit in the image with no `vitest` to resolve. Excluding it does not affect `vitest`, which collects `**/*.test.ts` on its own. Because this file also backs `typecheck`, `packages/contracts/tsconfig.test.json` below is what restores test coverage there.

`apps/api/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "types": ["node"]
  },
  "include": ["src/**/*.ts"]
}
```

`apps/api/tsconfig.test.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true,
    "rootDir": ".",
    "types": ["node"]
  },
  "include": ["src/**/*.ts", "test/**/*.ts", "seeds/**/*.ts"]
}
```

The API test suite lives in `apps/api/test/`, outside `rootDir: "./src"`, so it cannot be added
to the main tsconfig: `rootDir` is reported even under `--noEmit` (TS6059), and dropping
`rootDir` would move the build output to `dist/src/server.js`, which breaks the Docker
`CMD`. The second config exists so `typecheck` covers the five HTTP-level tests that
`npm run check` depends on, and it emits nothing.

`apps/web/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "types": ["vite/client"],
    "noEmit": true,
    "allowImportingTsExtensions": true
  },
  "include": ["src/**/*.ts", "e2e/**/*.ts", "vite.config.ts", "playwright.config.ts"]
}
```

- [ ] **Step 8: Create the Vitest configs and the root Vitest project registry**

`apps/api/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import { sharedTestConfig } from '../../vitest.shared';

export default defineConfig({
  test: {
    ...sharedTestConfig.test,
    name: 'api',
    environment: 'node',
  },
});
```

`apps/web/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import { sharedTestConfig } from '../../vitest.shared';

export default defineConfig({
  test: {
    ...sharedTestConfig.test,
    name: 'web',
    environment: 'jsdom',
    setupFiles: ['./src/testing/setup.ts'],
  },
});
```

`packages/contracts/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import { sharedTestConfig } from '../../vitest.shared';

export default defineConfig({
  test: {
    ...sharedTestConfig.test,
    name: 'contracts',
    environment: 'node',
  },
});
```

Root `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/contracts', 'apps/api', 'apps/web'],
  },
});
```

The registry must list `packages/contracts`. Every contract test is written as a path relative to the repository root and invoked with `npx vitest run --project contracts <path>`; a project that is not registered silently matches no files and the suite would never run.

Also create the web jsdom setup file referenced above (needed immediately so Vitest does not fail):
`apps/web/src/testing/setup.ts`
```ts
import '@testing-library/jest-dom/vitest';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto });
}
```

Add `"@testing-library/jest-dom": "^6.6.3"` and `"@testing-library/dom": "^10.4.0"` to `apps/web/package.json#devDependencies` in this step, and add `environment: 'jsdom'` support by installing `jsdom` (`"jsdom": "^25.0.1"`).

- [ ] **Step 9: Create `apps/web/vite.config.ts` and `apps/web/index.html`**

`apps/web/vite.config.ts`:
```ts
import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': { target: 'http://127.0.0.1:8787', changeOrigin: false } },
  },
  build: { outDir: 'dist', sourcemap: true, target: 'es2022' },
});
```

`apps/web/index.html`:
```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta
      name="description"
      content="AI World Atlas — navegación geográfica de la inteligencia artificial con evidencia y fuentes."
    />
    <meta name="color-scheme" content="dark" />
    <title>AI World Atlas</title>
  </head>
  <body>
    <div id="app" data-testid="app-root"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 10: Create `.env.example` at the repository root and delete the per-app examples**

`.env.example`:
```dotenv
# API
NODE_ENV=development
PORT=8787
DATABASE_URL=postgres://atlas:atlas@127.0.0.1:5432/aiworldatlas
# Test-only. Unset locally to skip DB integration tests (runner prints "skipped: db integration").
TEST_DATABASE_URL=
CORS_ORIGIN=http://localhost:5173
LOG_LEVEL=info

# Web (public by design — restrict by URL in the Mapbox dashboard for production)
VITE_MAPBOX_TOKEN=
VITE_API_BASE=/api
```

Delete `apps/web/.env.example` and `apps/api/.env.example`. `.gitignore` already ignores `.env` and keeps `.env.example`.

- [ ] **Step 11: Install and verify the workspace**

Run: `npm install`
Expected: lockfile `package-lock.json` created, three workspace links present, no `ERESOLVE` errors. If `@atlas/contracts` fails to resolve from the apps, confirm `"@atlas/contracts": "*"` in both app manifests and re-run `npm install`.

- [ ] **Step 12: Verify the tooling skeleton typechecks**

Run: `npm run typecheck`
Expected: **not green yet, and that is correct.** After this task the three packages hold config files but no `.ts` sources — the first sources arrive in Task 2 (`packages/contracts`) and Task 5 (`apps/api`) — so `tsc` exits 2 with `TS18003` ("No inputs were found in config file") for each empty package. The gate is not broken; it has nothing to check yet.

Do **not** make it green by adding a stub `src/index.ts` (Task 2 creates that exact file), by setting `passWithNoTests`, or by loosening `tsc` options. Instead, prove each gate is real rather than vacuous: temporarily create a file with a deliberate type error, confirm `npm run typecheck` fails with it, then delete it. Do the same for `lint` and `test`. Record those three commands and their failing output in your report; that is the evidence the gates will catch real breakage from Task 2 onward.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "chore: initialize workspace tooling typescript lint and vitest"
```

---

### Task 2: `packages/contracts` — closed vocabularies and Zod schemas

**Files:**
- Create: `packages/contracts/src/vocabularies.ts`, `packages/contracts/src/schemas.ts`, `packages/contracts/src/types.ts`, `packages/contracts/src/index.ts`, `packages/contracts/src/__tests__/vocabularies.test.ts`, `packages/contracts/src/__tests__/schemas.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (the complete public surface every later task imports from `@atlas/contracts`):
  - `PROJECT_TYPES: readonly string[]` (16), `PROJECT_STATUSES` (12), `EVIDENCE_LEVELS` (6), `LOCATION_LEVELS` (6), `SOURCE_TYPES` (7), `CONFIDENCE_LEVELS` (3), `RELATION_TYPES` (12), `IMPACT_CATEGORIES` (8)
  - `projectTypeSchema`, `projectStatusSchema`, `evidenceSchema`, `locationLevelSchema`, `sourceTypeSchema`, `confidenceSchema`, `relationTypeSchema`, `impactCategorySchema` (all `ZodEnum`)
  - `paginatedSchema<T>(item: T): ZodType<Paginated<T>>`
  - `locationSchema`, `sourceSchema`, `eventSchema`, `relationSchema`, `statusHistoryEntrySchema`, `impactRecordSchema`, `projectSummarySchema`, `projectDetailSchema`, `statsResponseSchema`, `apiErrorSchema`
  - `healthResponseSchema`
  - `srcUrlSchema` (rejects unsafe protocols)
  - Types: `ProjectType`, `ProjectStatus`, `EvidenceLevel`, `LocationLevel`, `SourceType`, `ConfidenceLevel`, `RelationType`, `ImpactCategory`, `Location`, `Source`, `Event`, `Relation`, `StatusHistoryEntry`, `ImpactRecord`, `ProjectSummary`, `ProjectDetail`, `StatsResponse`, `ApiError`, `HealthResponse`, `Paginated<T>`

- [ ] **Step 1: Write the failing vocabulary test**

`packages/contracts/src/__tests__/vocabularies.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import {
  CONFIDENCE_LEVELS,
  EVIDENCE_LEVELS,
  IMPACT_CATEGORIES,
  LOCATION_LEVELS,
  PROJECT_STATUSES,
  PROJECT_TYPES,
  RELATION_TYPES,
  SOURCE_TYPES,
  RELATION_DIRECTIONS,
  TIMELINE_SORTS,
} from '../vocabularies.js';

describe('closed vocabularies', () => {
  it('exposes exactly the specified cardinalities', () => {
    expect(PROJECT_TYPES).toHaveLength(16);
    expect(PROJECT_STATUSES).toHaveLength(12);
    expect(EVIDENCE_LEVELS).toHaveLength(6);
    expect(LOCATION_LEVELS).toHaveLength(6);
    expect(SOURCE_TYPES).toHaveLength(7);
    expect(CONFIDENCE_LEVELS).toHaveLength(3);
    expect(RELATION_TYPES).toHaveLength(12);
    expect(IMPACT_CATEGORIES).toHaveLength(8);
  });

  it('contains no duplicates', () => {
    // The three tests in this file are not redundant with the pinning test below.
    // If the pin fails, this one tells you whether a member was corrupted or the list
    // merely reordered.
    for (const vocabulary of [
      PROJECT_TYPES,
      PROJECT_STATUSES,
      EVIDENCE_LEVELS,
      LOCATION_LEVELS,
      SOURCE_TYPES,
      CONFIDENCE_LEVELS,
      RELATION_TYPES,
      IMPACT_CATEGORIES,
    ]) {
      expect(new Set(vocabulary).size).toBe(vocabulary.length);
    }
  });

  it('includes CITY and LOCAL_AREA as distinct location levels', () => {
    expect(LOCATION_LEVELS).toContain('CITY');
    expect(LOCATION_LEVELS).toContain('LOCAL_AREA');
  });

  it('pins every member, so a same-cardinality corruption is not silent', () => {
    expect(PROJECT_TYPES).toEqual([
      'PROJECT',
      'NEWS',
      'LAUNCH',
      'COMPANY',
      'GOVERNMENT',
      'UNIVERSITY',
      'RESEARCH',
      'INFRASTRUCTURE',
      'ROBOTICS',
      'POLICY',
      'INVESTMENT',
      'EDUCATION',
      'APPLICATION',
      'IMPACT',
      'SIGNAL',
      'POSSIBILITY',
    ]);
    expect(PROJECT_STATUSES).toEqual([
      'IDEA',
      'RESEARCH',
      'ANNOUNCED',
      'FUNDED',
      'PILOT',
      'BUILDING',
      'DEPLOYING',
      'ACTIVE',
      'SCALING',
      'COMPLETED',
      'PAUSED',
      'CANCELLED',
    ]);
    expect(EVIDENCE_LEVELS).toEqual([
      'VERIFIED',
      'REPORTED',
      'ANNOUNCED',
      'ANALYSIS',
      'SIGNAL',
      'POSSIBILITY',
    ]);
    expect(LOCATION_LEVELS).toEqual(['WORLD', 'CONTINENT', 'COUNTRY', 'REGION', 'CITY', 'LOCAL_AREA']);
    expect(SOURCE_TYPES).toEqual([
      'GOVERNMENT',
      'UNIVERSITY',
      'ORGANIZATION',
      'COMPANY',
      'PAPER',
      'MEDIA',
      'OTHER',
    ]);
    expect(CONFIDENCE_LEVELS).toEqual(['HIGH', 'MEDIUM', 'LOW']);
    expect(RELATION_TYPES).toEqual([
      'PARTNERSHIP',
      'FUNDING',
      'RESEARCH',
      'INFRASTRUCTURE',
      'GOVERNMENT',
      'SUPPLIER',
      'UNIVERSITY',
      'DEPLOYMENT',
      'LOCATION',
      'POLICY',
      'TECHNOLOGY',
      'INVESTMENT',
    ]);
    expect(IMPACT_CATEGORIES).toEqual([
      'ECONOMIC',
      'SOCIAL',
      'EDUCATIONAL',
      'HEALTH',
      'ENVIRONMENTAL',
      'INFRASTRUCTURE',
      'REGULATORY',
      'OTHER',
    ]);
    expect(RELATION_DIRECTIONS).toEqual(['OUTGOING', 'INCOMING']);
    expect(TIMELINE_SORTS).toEqual(['publishedAt', 'name']);
  });
});
```

- [ ] **Step 2: Run it and confirm failure**

Run: `npx vitest run --project contracts packages/contracts/src/__tests__/vocabularies.test.ts`
Expected: FAIL — `Failed to resolve import "../vocabularies.js"`.

- [ ] **Step 3: Implement `vocabularies.ts`**

`packages/contracts/src/vocabularies.ts`:
```ts
export const PROJECT_TYPES = [
  'PROJECT',
  'NEWS',
  'LAUNCH',
  'COMPANY',
  'GOVERNMENT',
  'UNIVERSITY',
  'RESEARCH',
  'INFRASTRUCTURE',
  'ROBOTICS',
  'POLICY',
  'INVESTMENT',
  'EDUCATION',
  'APPLICATION',
  'IMPACT',
  'SIGNAL',
  'POSSIBILITY',
] as const;

export const PROJECT_STATUSES = [
  'IDEA',
  'RESEARCH',
  'ANNOUNCED',
  'FUNDED',
  'PILOT',
  'BUILDING',
  'DEPLOYING',
  'ACTIVE',
  'SCALING',
  'COMPLETED',
  'PAUSED',
  'CANCELLED',
] as const;

export const EVIDENCE_LEVELS = [
  'VERIFIED',
  'REPORTED',
  'ANNOUNCED',
  'ANALYSIS',
  'SIGNAL',
  'POSSIBILITY',
] as const;

export const LOCATION_LEVELS = [
  'WORLD',
  'CONTINENT',
  'COUNTRY',
  'REGION',
  'CITY',
  'LOCAL_AREA',
] as const;

export const SOURCE_TYPES = [
  'GOVERNMENT',
  'UNIVERSITY',
  'ORGANIZATION',
  'COMPANY',
  'PAPER',
  'MEDIA',
  'OTHER',
] as const;

export const CONFIDENCE_LEVELS = ['HIGH', 'MEDIUM', 'LOW'] as const;

export const RELATION_TYPES = [
  'PARTNERSHIP',
  'FUNDING',
  'RESEARCH',
  'INFRASTRUCTURE',
  'GOVERNMENT',
  'SUPPLIER',
  'UNIVERSITY',
  'DEPLOYMENT',
  'LOCATION',
  'POLICY',
  'TECHNOLOGY',
  'INVESTMENT',
] as const;

export const IMPACT_CATEGORIES = [
  'ECONOMIC',
  'SOCIAL',
  'EDUCATIONAL',
  'HEALTH',
  'ENVIRONMENTAL',
  'INFRASTRUCTURE',
  'REGULATORY',
  'OTHER',
] as const;

export const RELATION_DIRECTIONS = ['OUTGOING', 'INCOMING'] as const;
export const TIMELINE_SORTS = ['publishedAt', 'name'] as const;
```

- [ ] **Step 4: Run the vocabulary test and confirm it passes**

Run: `npx vitest run packages/contracts/src/__tests__/vocabularies.test.ts`
Expected: PASS, 4 tests.

The cardinality test and the pinning test are not redundant. Cardinality alone cannot see `'CONTINENT'` → `'PLANET'` or `'MEDIA'` → `'BLOG'`, and Task 3 mirrors these exact arrays into SQL `CHECK` constraints, where a silent divergence only shows up as an `INSERT` failing against a live Postgres. The two older tests are kept as the diagnosis when the pin fails: "contains no duplicates" separates a corrupted member from a reordered list, and "CITY and LOCAL_AREA" names the specific pair a future edit is most likely to merge.

- [ ] **Step 5: Write the failing schema test**

`packages/contracts/src/__tests__/schemas.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import {
  healthResponseSchema,
  projectSummarySchema,
  srcUrlSchema,
  statsResponseSchema,
  projectTypeSchema,
  sourceSchema,
  statusHistoryEntrySchema,
} from '../schemas.js';

const validSummary = {
  id: 'chile-national-ai-policy',
  name: 'Política Nacional de Inteligencia Artificial',
  type: 'POLICY',
  status: 'ACTIVE',
  evidence: 'REPORTED',
  sector: 'Política pública',
  summary: 'Política vigente desde 2021 con plan de acción.',
  year: 2021,
  locationId: 'chile',
  longitude: -70.6693,
  latitude: -33.4489,
  actors: ['Ministerio de Ciencia'],
  tags: ['política', 'nacional'],
  publishedAt: '2021-10-01T00:00:00.000Z',
  lastVerifiedAt: '2026-09-25T00:00:00.000Z',
  sourceCount: 1,
  eventCount: 1,
};

const validSource = {
  id: 'src-1',
  name: 'Ley 19.628',
  url: 'https://www.bcn.cl/leychile/navegar?idNorma=297746',
  sourceType: 'GOVERNMENT',
  publicationDate: '2021-10-01T00:00:00.000Z',
  lastVerifiedAt: '2026-09-25T00:00:00.000Z',
  confidence: 'HIGH',
  snippet: 'Texto oficial de la ley.',
  isPrimary: true,
};

const validHistory = {
  id: 1,
  fromStatus: null,
  toStatus: 'ACTIVE',
  changedAt: '2021-10-01T00:00:00.000Z',
  note: 'Publicación inicial.',
  sourceId: 'src-1',
};

const validHealth = {
  status: 'ok',
  api: 'atlas-api',
  database: 'up',
  version: '0.1.0',
  time: '2026-09-25T12:00:00.000Z',
};

describe('wire schemas', () => {
  it('accepts a well formed project summary', () => {
    expect(projectSummarySchema.parse(validSummary).id).toBe('chile-national-ai-policy');
  });

  it('rejects a type outside the closed vocabulary', () => {
    expect(projectTypeSchema.safeParse('ROCKET').success).toBe(false);
  });

  it('rejects a longitude out of range', () => {
    const parsed = projectSummarySchema.safeParse({ ...validSummary, longitude: 220 });
    expect(parsed.success).toBe(false);
  });

  it('rejects a timestamp that is not a real date', () => {
    expect(projectSummarySchema.safeParse({ ...validSummary, publishedAt: 'not a date' }).success).toBe(false);
    expect(
      projectSummarySchema.safeParse({ ...validSummary, lastVerifiedAt: 'definitely not a date' }).success,
    ).toBe(false);
  });

  it('accepts a null publishedAt, because the column is nullable', () => {
    expect(projectSummarySchema.safeParse({ ...validSummary, publishedAt: null }).success).toBe(true);
  });

  it('validates timestamps on every schema that carries one', () => {
    expect(
      sourceSchema.safeParse({ ...validSource, lastVerifiedAt: 'definitely not a date' }).success,
    ).toBe(false);
    expect(
      statusHistoryEntrySchema.safeParse({ ...validHistory, changedAt: 'definitely not a date' }).success,
    ).toBe(false);
    expect(healthResponseSchema.safeParse({ ...validHealth, time: 'definitely not a date' }).success).toBe(false);
  });

  it('accepts each of those fixtures unchanged, so the negative tests above are not vacuous', () => {
    expect(sourceSchema.safeParse(validSource).success).toBe(true);
    expect(statusHistoryEntrySchema.safeParse(validHistory).success).toBe(true);
    expect(healthResponseSchema.safeParse(validHealth).success).toBe(true);
  });

  it('accepts https and http but rejects javascript and data protocols', () => {
    expect(srcUrlSchema.safeParse('https://example.org/a').success).toBe(true);
    expect(srcUrlSchema.safeParse('http://localhost:3000/a').success).toBe(true);
    expect(srcUrlSchema.safeParse('javascript:alert(1)').success).toBe(false);
    expect(srcUrlSchema.safeParse('data:text/html,<script>').success).toBe(false);
  });

  it('exposes global totals with evidence distribution', () => {
    const stats = statsResponseSchema.parse({
      totals: { projects: 5, locations: 11, sources: 6 },
      byEvidence: { REPORTED: 4, ANNOUNCED: 1 },
      byType: { POLICY: 1, INFRASTRUCTURE: 2, RESEARCH: 1, GOVERNMENT: 1 },
      byStatus: { ACTIVE: 4, DEPLOYING: 1 },
    });
    expect(stats.totals.projects).toBe(5);
    expect(stats.byEvidence).toEqual({ REPORTED: 4, ANNOUNCED: 1 });
  });

  it('rejects a count map keyed outside its vocabulary', () => {
    const base = {
      totals: { projects: 5, locations: 11, sources: 6 },
      byType: { POLICY: 1 },
      byStatus: { ACTIVE: 4 },
    };
    expect(
      statsResponseSchema.safeParse({ ...base, byEvidence: { NOT_A_REAL_EVIDENCE_LEVEL: 7 } }).success,
    ).toBe(false);
    expect(statsResponseSchema.safeParse({ ...base, byType: { POLICY: 1 }, byStatus: { NOPE: 1 } }).success).toBe(
      false,
    );
  });
});
```

- [ ] **Step 6: Run it and confirm failure**

Run: `npx vitest run packages/contracts/src/__tests__/schemas.test.ts`
Expected: FAIL — `Failed to resolve import "../schemas.js"`.

- [ ] **Step 7: Implement `schemas.ts`**

`packages/contracts/src/schemas.ts`:
```ts
import { z } from 'zod';
import {
  CONFIDENCE_LEVELS,
  EVIDENCE_LEVELS,
  IMPACT_CATEGORIES,
  LOCATION_LEVELS,
  PROJECT_STATUSES,
  PROJECT_TYPES,
  RELATION_DIRECTIONS,
  RELATION_TYPES,
  SOURCE_TYPES,
  TIMELINE_SORTS,
} from './vocabularies.js';
import type { Paginated } from './types.js';

export const projectTypeSchema = z.enum(PROJECT_TYPES);
export const projectStatusSchema = z.enum(PROJECT_STATUSES);
export const evidenceSchema = z.enum(EVIDENCE_LEVELS);
export const locationLevelSchema = z.enum(LOCATION_LEVELS);
export const sourceTypeSchema = z.enum(SOURCE_TYPES);
export const confidenceSchema = z.enum(CONFIDENCE_LEVELS);
export const relationTypeSchema = z.enum(RELATION_TYPES);
export const relationDirectionSchema = z.enum(RELATION_DIRECTIONS);
export const impactCategorySchema = z.enum(IMPACT_CATEGORIES);
export const sortSchema = z.enum(TIMELINE_SORTS);

// Every timestamp in this package goes through `isoDate`, including
// `healthResponseSchema.time`. The columns behind the rest are `timestamptz`, so a
// bare `z.string()` would let a malformed value cross the wire and surface later as
// `NaN` from `new Date(...)` in the web timeline, far from the query that produced
// it. `isoDate` is deliberately a floor, not a full ISO parser: it rejects the junk a
// bad cast produces without trying to enumerate every legal ISO-8601 form.
const isoDate = z
  .string()
  .min(10)
  .refine((value) => !Number.isNaN(Date.parse(value)), { message: 'expected ISO-8601 date' });

export const srcUrlSchema = z
  .string()
  .min(1)
  .max(2048)
  .refine(
    (value) => {
      try {
        const protocol = new URL(value).protocol;
        return protocol === 'https:' || protocol === 'http:';
      } catch {
        return false;
      }
    },
    { message: 'source url must be an absolute http(s) url' },
  );

export const locationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  level: locationLevelSchema,
  parentId: z.string().min(1).nullable(),
  countryCode: z.string().length(2).nullable(),
  longitude: z.number().min(-180).max(180),
  latitude: z.number().min(-90).max(90),
  childCount: z.number().int().nonnegative(),
  projectCount: z.number().int().nonnegative(),
  metadata: z.record(z.unknown()),
});

export const sourceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  url: srcUrlSchema,
  sourceType: sourceTypeSchema,
  publicationDate: isoDate.nullable(),
  lastVerifiedAt: isoDate,
  confidence: confidenceSchema,
  snippet: z.string().min(1),
  isPrimary: z.boolean(),
});

export const eventSchema = z.object({
  id: z.number().int(),
  projectId: z.string().min(1),
  title: z.string().min(1),
  occurredAt: isoDate,
  kind: z.string().min(1),
  description: z.string(),
  sourceId: z.string().nullable(),
});

export const relationSchema = z.object({
  id: z.string().min(1),
  fromProject: z.string().min(1),
  toProject: z.string().min(1),
  type: relationTypeSchema,
  direction: relationDirectionSchema,
  description: z.string(),
  sourceId: z.string().nullable(),
});

export const statusHistoryEntrySchema = z.object({
  id: z.number().int(),
  fromStatus: projectStatusSchema.nullable(),
  toStatus: projectStatusSchema,
  changedAt: isoDate,
  note: z.string().nullable(),
  sourceId: z.string().nullable(),
});

export const impactRecordSchema = z.object({
  id: z.number().int(),
  category: impactCategorySchema,
  description: z.string().min(1),
  sourceId: z.string().nullable(),
});

export const projectSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: projectTypeSchema,
  status: projectStatusSchema,
  evidence: evidenceSchema,
  sector: z.string().nullable(),
  summary: z.string().min(1),
  year: z.number().int().min(1900).max(2100).nullable(),
  locationId: z.string().min(1),
  longitude: z.number().min(-180).max(180),
  latitude: z.number().min(-90).max(90),
  actors: z.array(z.string()),
  tags: z.array(z.string()),
  publishedAt: isoDate.nullable(),
  lastVerifiedAt: isoDate,
  sourceCount: z.number().int().nonnegative(),
  eventCount: z.number().int().nonnegative(),
});

export const projectDetailSchema = projectSummarySchema.extend({
  impact: z.string().nullable(),
  location: locationSchema,
  sources: z.array(sourceSchema),
  events: z.array(eventSchema),
  relations: z.array(relationSchema),
  statusHistory: z.array(statusHistoryEntrySchema),
  impactRecords: z.array(impactRecordSchema),
  geometrySource: z.enum(['project', 'location']),
});

// A count map is keyed by a vocabulary, so the key set is part of the contract.
// Without this, `byEvidence: { NOT_A_REAL_EVIDENCE_LEVEL: 7 }` parses, and the API can
// emit a distribution nobody downstream knows how to read.
function countMap(allowed: readonly string[]) {
  return z
    .record(z.number().int().nonnegative())
    .refine((map) => Object.keys(map).every((key) => allowed.includes(key)), {
      message: 'count map contains a key outside its vocabulary',
    });
}

export const statsResponseSchema = z.object({
  totals: z.object({
    projects: z.number().int().nonnegative(),
    locations: z.number().int().nonnegative(),
    sources: z.number().int().nonnegative(),
  }),
  byEvidence: countMap(EVIDENCE_LEVELS),
  byType: countMap(PROJECT_TYPES),
  byStatus: countMap(PROJECT_STATUSES),
});

export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  api: z.literal('atlas-api'),
  database: z.enum(['up', 'down']),
  version: z.string().min(1),
  time: isoDate,
});

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    details: z.array(z.unknown()),
    requestId: z.string().min(1),
  }),
});

export function paginatedSchema<T extends z.ZodTypeAny>(item: T): z.ZodType<Paginated<z.infer<T>>> {
  return z.object({
    data: z.array(item),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  });
}
```

- [ ] **Step 8: Implement `types.ts` and `index.ts`**

`packages/contracts/src/types.ts`:
```ts
import type { z } from 'zod';
import type {
  apiErrorSchema,
  eventSchema,
  healthResponseSchema,
  impactRecordSchema,
  locationSchema,
  projectDetailSchema,
  projectSummarySchema,
  relationSchema,
  sourceSchema,
  statsResponseSchema,
  statusHistoryEntrySchema,
} from './schemas.js';
import type {
  CONFIDENCE_LEVELS,
  EVIDENCE_LEVELS,
  IMPACT_CATEGORIES,
  LOCATION_LEVELS,
  PROJECT_STATUSES,
  PROJECT_TYPES,
  RELATION_DIRECTIONS,
  RELATION_TYPES,
  SOURCE_TYPES,
} from './vocabularies.js';

export type ProjectType = (typeof PROJECT_TYPES)[number];
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type EvidenceLevel = (typeof EVIDENCE_LEVELS)[number];
export type LocationLevel = (typeof LOCATION_LEVELS)[number];
export type SourceType = (typeof SOURCE_TYPES)[number];
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];
export type RelationType = (typeof RELATION_TYPES)[number];
export type RelationDirection = (typeof RELATION_DIRECTIONS)[number];
export type ImpactCategory = (typeof IMPACT_CATEGORIES)[number];

export type Location = z.infer<typeof locationSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type Event = z.infer<typeof eventSchema>;
export type Relation = z.infer<typeof relationSchema>;
export type StatusHistoryEntry = z.infer<typeof statusHistoryEntrySchema>;
export type ImpactRecord = z.infer<typeof impactRecordSchema>;
export type ProjectSummary = z.infer<typeof projectSummarySchema>;
export type ProjectDetail = z.infer<typeof projectDetailSchema>;
export type StatsResponse = z.infer<typeof statsResponseSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
```

`packages/contracts/src/index.ts`:
```ts
export * from './vocabularies.js';
export * from './schemas.js';
export type * from './types.js';
```

- [ ] **Step 9: Run all contract tests and typecheck**

Run: `npx vitest run packages/contracts && npm run typecheck --workspace @atlas/contracts`
Expected: PASS, 14 tests total across both files (4 vocabulary + 10 schema), and `tsc --noEmit` clean.

A negative assertion over a hand-built fixture proves nothing unless the fixture itself is valid. `sourceType: 'LAW'` sat in an earlier draft of `validSource`; `LAW` is not in `SOURCE_TYPES`, so the fixture failed on the enum before the timestamp was ever evaluated and the test passed no matter what the schema did. That is why the last test above asserts the fixtures parse. When you add a negative test over a new fixture, add its positive twin in the same commit, or prove it with a mutation: revert the line under test and confirm the test goes red.

The same trap has a second form, and it is easy to hit again. A rejection test only exercises the validator it reaches, and a short junk string reaches the *first* guard rather than the parser. `'someday'` is 7 characters, so `isoDate`'s `.min(10)` rejected it and `Date.parse` never ran; relaxing `.min(10)` to `.min(1)` left the suite green. Every negative timestamp assertion in this plan therefore uses a value at least 10 characters long, so the length floor is satisfied and the `refine` is what rejects it. If you add one, count the characters.

A third form is an assertion that cannot fail. This file used to end with `expect(Object.keys(stats.byEvidence)).toEqual(['REPORTED', 'ANNOUNCED'])`, which read like a key-ordering contract. Zod's record echoes the input object's own insertion order, so the test was asserting the shape of its own fixture and would have passed under any implementation. It is replaced by `toEqual` on the map plus a test that an out-of-vocabulary key is rejected, which is the property the schema actually has. If a later task needs a specific key order out of `/api/stats`, it has to sort the result there and say so; nothing in this package promises an order.

One annotation in this step is a trap worth naming, because `tsc` cannot catch it. `paginatedSchema` takes a schema `T` and must return a schema of the *parsed* shape, so the return type is `z.ZodType<Paginated<z.infer<T>>>`. Writing `Paginated<T>` is satisfiable — the body really does return a schema that produces `Paginated<ZodObject<...>>` — so it typechecks clean and only fails at a call site that reads `data[0].id`. Nothing in this package calls it yet, so no gate here will ever see it. When you annotate a factory's return type against a generic interface, check which side of the schema/type split each type parameter sits on.

- [ ] **Step 10: Build the package so the apps can resolve it**

Run: `npm run build --workspace @atlas/contracts`
Expected: `packages/contracts/dist/index.js` and `index.d.ts` exist. Both apps import `@atlas/contracts` through the `dist` entry, so this build must run before any app `typecheck`.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat(contracts): add closed vocabularies and wire schemas"
```

---

## Phase 1 — Data

### Task 3: Final schema, migration runner, and removal of the legacy SQL

**Files:**
- Create: `apps/api/migrations/001_core.sql`, `apps/api/src/db/pool.ts`, `apps/api/src/db/migrate.ts`, `apps/api/src/db/migrate.test.ts`, `apps/api/src/db/types.ts`, `apps/api/src/db/schema-vocabularies.test.ts`
- Delete: `apps/api/sql/001_schema.sql`, `apps/api/sql/002_seed.sql` (and the now-empty `apps/api/sql/` directory)
- Modify: `docker-compose.yml`, `.env.example`, `apps/api/tsconfig.json`

**Interfaces:**
- Consumes: nothing from earlier tasks except the workspace.
- Produces:
  - `ClientLike` interface (`src/db/types.ts`): `query(sql: string, values?: unknown[]): Promise<QueryResultLike>` and `release(): void`.
  - `PoolLike` interface (`src/db/types.ts`): `query(...)`, `connect(): Promise<ClientLike>`, `end(): Promise<void>`; `QueryResultLike` has `rows: unknown[]` and `rowCount: number | null`.
  - `createPool(connectionString: string): PoolLike` (`src/db/pool.ts`)
  - `runMigrations(options: { pool: PoolLike; migrationsDir: string; log?: (message: string) => void }): Promise<string[]>` — returns names of applied migrations, sorted lexicographically, skipping already-applied ones. Throws if `migrationsDir` contains no `.sql` file, and opens each migration on a single checked-out client so `BEGIN` and `COMMIT` reach the same connection.
  - `MIGRATIONS_TABLE` constant = `'schema_migrations'`.
  - Database tables: `locations`, `projects`, `sources`, `project_sources`, `status_history`, `impact_records`, `events`, `relations`.

**There is no V4 upgrade migration.** An earlier draft of this task carried
`002_upgrade_v4.sql`, an upgrade path from the discarded V4 prototype schema. It was cut on
review: it was written against the *target* schema rather than the legacy one, so it
referenced `relations.from_project` / `to_project` / `type` when the legacy table has
`from_project_id` / `to_project_id` / `relation_type`, and it aborted on its first
statement. It also never added the vocabulary `CHECK` constraints to a legacy database,
never created `events.occurred_at`, and left `locations.level = 'LOCAL'` rows alive in a
schema that forbids the value. Rather than repair a ~100-line migration that cannot be
executed or tested on this machine, the V4 database is treated as a disposable dev
artifact: `npm run db:reset` drops the volume and `db:setup` rebuilds from `001_core.sql`
plus the audited seed. Task 4 adds that script.

- [ ] **Step 1: Write the failing migration-runner test**

`apps/api/src/db/migrate.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { MIGRATIONS_TABLE, runMigrations, sortMigrationFiles } from './migrate.ts';
import type { ClientLike, PoolLike, QueryResultLike } from './types.ts';

const migrationsDir = fileURLToPath(new URL('./__fixtures__/migrations', import.meta.url));

type Call = { sql: string; values?: unknown[]; via: 'pool' | 'client' };

function fakePool(applied: string[], failOn?: RegExp) {
  const calls: Call[] = [];
  let released = 0;

  const answer = async (sql: string): Promise<QueryResultLike> => {
    if (sql.includes(`select name from ${MIGRATIONS_TABLE}`)) {
      return { rows: applied.map((name) => ({ name })), rowCount: applied.length };
    }
    if (failOn?.test(sql)) throw new Error('syntax error at or near "SELCT"');
    return { rows: [], rowCount: 0 };
  };

  const pool: PoolLike = {
    async query(sql, values) {
      calls.push({ sql, values, via: 'pool' });
      return answer(sql);
    },
    async connect(): Promise<ClientLike> {
      return {
        async query(sql, values) {
          calls.push({ sql, values, via: 'client' });
          return answer(sql);
        },
        release() {
          released += 1;
        },
      };
    },
    async end() {
      return undefined;
    },
  };

  const sqlOf = (via?: Call['via']) =>
    calls.filter((c) => via === undefined || c.via === via).map((c) => c.sql);

  return { pool, calls, sqlOf, releasedCount: () => released };
}

const PENDING = ['001_core.sql', '002_aaa.sql', '003_zzz.sql'];

describe('runMigrations', () => {
  it('applies every pending file exactly once', async () => {
    const { pool, sqlOf } = fakePool([]);
    const applied = await runMigrations({ pool, migrationsDir });
    expect(applied).toEqual(PENDING);
    expect(sqlOf()).toEqual(
      expect.arrayContaining([
        expect.stringContaining(`create table if not exists ${MIGRATIONS_TABLE}`),
      ]),
    );
  });

  it('orders migrations by name regardless of the order the filesystem reports them', () => {
    const shuffled = ['003_zzz.sql', '001_core.sql', 'README.md', '002_aaa.sql'];
    expect(sortMigrationFiles(shuffled)).toEqual(PENDING);
  });

  it('records the migration file name in the bookkeeping table', async () => {
    const { pool, calls } = fakePool([]);
    await runMigrations({ pool, migrationsDir });
    const inserts = calls.filter((c) => c.sql.includes(`insert into ${MIGRATIONS_TABLE}`));
    expect(inserts.map((c) => c.values?.[0])).toEqual(PENDING);
  });

  it('runs BEGIN, the body and the bookkeeping insert on one checked-out client', async () => {
    const { pool, sqlOf, releasedCount } = fakePool([]);
    await runMigrations({ pool, migrationsDir });
    // The migration body, the insert and the control statements must all travel on a
    // single connection. Transaction state is per connection, so a BEGIN issued through
    // pool#query can land somewhere else entirely and commit nothing.
    expect(sqlOf('client')).toEqual([
      'BEGIN',
      expect.stringContaining('fixture'),
      expect.stringContaining(`insert into ${MIGRATIONS_TABLE}`),
      'COMMIT',
      'BEGIN',
      expect.stringContaining('fixture'),
      expect.stringContaining(`insert into ${MIGRATIONS_TABLE}`),
      'COMMIT',
      'BEGIN',
      expect.stringContaining('fixture'),
      expect.stringContaining(`insert into ${MIGRATIONS_TABLE}`),
      'COMMIT',
    ]);
    expect(releasedCount()).toBe(3);
  });

  it('skips migrations already recorded', async () => {
    const { pool, sqlOf } = fakePool(PENDING);
    const applied = await runMigrations({ pool, migrationsDir });
    expect(applied).toEqual([]);
    expect(sqlOf()).not.toContain('BEGIN');
  });

  it('skips only the recorded ones and still applies the rest', async () => {
    const { pool, sqlOf } = fakePool(['002_aaa.sql']);
    const applied = await runMigrations({ pool, migrationsDir });
    expect(applied).toEqual(['001_core.sql', '003_zzz.sql']);
    expect(sqlOf('client').filter((s) => s === 'BEGIN')).toHaveLength(2);
  });

  it('rolls back and rethrows when a migration fails', async () => {
    const { pool, sqlOf, releasedCount } = fakePool([], /fixture/);
    await expect(runMigrations({ pool, migrationsDir })).rejects.toThrow(/SELCT/);
    expect(sqlOf('client')).toContain('ROLLBACK');
    expect(sqlOf('client')).not.toContain('COMMIT');
    expect(releasedCount()).toBe(1);
  });

  it('keeps the migration error when the rollback itself fails', async () => {
    const { pool } = fakePool([], /fixture/);
    const failing: PoolLike = {
      ...pool,
      async connect() {
        const client = await pool.connect();
        return {
          ...client,
          async query(sql, values) {
            if (sql === 'ROLLBACK') throw new Error('connection terminated');
            return client.query(sql, values);
          },
        };
      },
    };
    await expect(runMigrations({ pool: failing, migrationsDir })).rejects.toThrow(
      /^migration 001_core\.sql failed: syntax error at or near "SELCT"/,
    );
  });

  it('preserves the original error as the cause of the migration failure', async () => {
    const { pool } = fakePool([], /fixture/);
    const error = await runMigrations({ pool, migrationsDir }).then(
      () => null,
      (caught: unknown) => caught as Error,
    );
    expect(error).toBeInstanceOf(Error);
    expect(error?.cause).toBeInstanceOf(Error);
    expect((error?.cause as Error).message).toBe('syntax error at or near "SELCT"');
  });

  it('refuses to run against a directory with no migrations', async () => {
    const { pool, sqlOf } = fakePool([]);
    await expect(
      runMigrations({ pool, migrationsDir: fileURLToPath(new URL('./__fixtures__/empty', import.meta.url)) }),
    ).rejects.toThrow(/no \.sql migrations found/);
    expect(sqlOf()).not.toContain('BEGIN');
  });
});
```

Create the fixture files used by that test — three, so lexicographic order is actually
exercised rather than being a property of a one-element list:
- `apps/api/src/db/__fixtures__/migrations/001_core.sql`, `002_aaa.sql` and `003_zzz.sql`, each containing a comment line with the word `fixture`
- an empty directory `apps/api/src/db/__fixtures__/empty/` (git does not track empty
  directories, so add a `.gitkeep`)

- [ ] **Step 2: Run it and confirm failure**

Run: `npx vitest run --project api apps/api/src/db/migrate.test.ts`
Expected: FAIL — `Failed to resolve import "./migrate.ts"`.

- [ ] **Step 3: Implement `src/db/types.ts`**

`apps/api/src/db/types.ts`:
```ts
export interface QueryResultLike {
  rows: unknown[];
  rowCount: number | null;
}

/**
 * A single checked-out connection. Transaction state lives on the connection,
 * not on the pool, so anything that wraps several statements in BEGIN/COMMIT
 * must hold one of these rather than calling PoolLike#query repeatedly.
 */
export interface ClientLike {
  query(sql: string, values?: unknown[]): Promise<QueryResultLike>;
  release(): void;
}

export interface PoolLike {
  query(sql: string, values?: unknown[]): Promise<QueryResultLike>;
  connect(): Promise<ClientLike>;
  end(): Promise<void>;
}
```

- [ ] **Step 4: Implement `src/db/migrate.ts`**

`apps/api/src/db/migrate.ts`:
```ts
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PoolLike } from './types.ts';

export const MIGRATIONS_TABLE = 'schema_migrations';

const CREATE_MIGRATIONS_TABLE = `
create table if not exists ${MIGRATIONS_TABLE} (
  name text primary key,
  applied_at timestamptz not null default now()
)`;

const SELECT_APPLIED = `select name from ${MIGRATIONS_TABLE}`;

export interface RunMigrationsOptions {
  pool: PoolLike;
  migrationsDir: string;
  log?: (message: string) => void;
}

// Exported so the ordering claim is testable without a filesystem. NTFS returns
// readdir results in name order, so asserting that the files come back sorted
// proves nothing: an implementation that never called .sort() would pass on
// every machine this plan is likely to run on. Feeding this function a
// deliberately shuffled array is the only version of the test that fails when
// the sort is removed.
export function sortMigrationFiles(names: string[]): string[] {
  return names
    .filter((name) => name.endsWith('.sql'))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export async function runMigrations(options: RunMigrationsOptions): Promise<string[]> {
  const { pool, migrationsDir, log = () => {} } = options;
  const files = sortMigrationFiles(await readdir(migrationsDir));

  if (files.length === 0) {
    throw new Error(`no .sql migrations found in ${migrationsDir}`);
  }

  await pool.query(CREATE_MIGRATIONS_TABLE);
  const appliedResult = await pool.query(SELECT_APPLIED);
  const alreadyApplied = new Set(
    appliedResult.rows.map((row) => (row as { name: string }).name),
  );

  const applied: string[] = [];
  for (const file of files) {
    if (alreadyApplied.has(file)) {
      log(`skip ${file} (already applied)`);
      continue;
    }
    const client = await pool.connect();
    try {
      const sql = await readFile(join(migrationsDir, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          `insert into ${MIGRATIONS_TABLE} (name) values ($1) on conflict do nothing`,
          [file],
        );
        await client.query('COMMIT');
        applied.push(file);
        log(`applied ${file}`);
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch {
          // Best effort. A rollback that cannot be sent (pool exhausted, connection
          // already aborted) must not replace the migration error, which is the one
          // that tells the operator what actually went wrong.
        }
        throw new Error(`migration ${file} failed: ${(error as Error).message}`, { cause: error });
      }
    } finally {
      try {
        client.release();
      } catch {
        // Best effort, same reasoning as ROLLBACK above: a throw from a finally
        // block replaces the pending exception, and pg-pool's release() throws
        // synchronously on a double release. Losing the migration error to a
        // pool bookkeeping error is the worst possible outcome - the cause chain
        // built above would be destroyed, not just the message.
      }
    }
  }
  return applied;
}
```

`pool.connect()` is load-bearing, not ceremony. `PoolLike#query` checks a connection
out, runs one statement and returns it, so `BEGIN`, the migration body and the
bookkeeping `insert` issued through it can each land on a different connection — and
transaction state is per connection, so the `BEGIN` would be a no-op and the
bookkeeping row would commit on its own. That is precisely the property the bookkeeping
table exists to provide: a migration that crashes half way must leave no record, so the
next run retries it. Through `PoolLike#query` that guarantee does not hold.

- [ ] **Step 5: Implement `src/db/pool.ts`**

`apps/api/src/db/pool.ts`:
```ts
import pg from 'pg';
import type { PoolLike } from './types.ts';

export function createPool(connectionString: string): PoolLike {
  return new pg.Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    application_name: 'ai-world-atlas-api',
  });
}

export async function closePool(pool: PoolLike): Promise<void> {
  await pool.end();
}
```

- [ ] **Step 6: Run the runner test and confirm it passes**

Run: `npx vitest run --project api apps/api/src/db/migrate.test.ts`
Expected: PASS, 10 tests.

Two of these tests exist because of mutation runs against the previous version of this suite, and both are worth reading before you change either assertion.

`keeps the migration error when the rollback itself fails` pins the **file name** in the regex, not the SQL error. The wrapper is `migration ${file} failed: ${error.message}`, so the original error text is interpolated into the wrapper's own message; an assertion of the form `rejects.toThrow(/SELCT/)` therefore passes whether or not the wrapper exists, because the unwrapped error carries the same text. The file name is the only part of the message that the wrapper alone knows, so it is the only thing that distinguishes the two. `preserves the original error as the cause` covers the other half: `cause` is set, and it is the original error object rather than a string.

`orders migrations by name regardless of the order the filesystem reports them` exists because the ordering test above it proved nothing. NTFS returns `readdir` results in name order, so `expect(applied).toEqual(PENDING)` passes even if `.sort()` is deleted - and the fixture names, while they do bracket `core` correctly against a naive sort of the descriptive part, do not distinguish "sorted" from "already sorted". Removing the `.sort()` call was one of only two mutations to survive the rewritten suite. The fix is the extracted `sortMigrationFiles` and a deliberately shuffled input.

- [ ] **Step 7: Write `migrations/001_core.sql`**

`apps/api/migrations/001_core.sql`:
```sql
-- AI World Atlas — final core schema. Idempotent by design: applying it to a
-- partially migrated database converges to the target state.

create extension if not exists postgis;

create table if not exists locations (
  id           text primary key,
  name         text not null,
  level        text not null
                 check (level in ('WORLD','CONTINENT','COUNTRY','REGION','CITY','LOCAL_AREA')),
  parent_id    text references locations(id) on delete set null,
  country_code char(2),
  geography    geography(Point,4326) not null,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists sources (
  id                text primary key,
  name              text not null,
  url               text not null check (url ~ '^https?://'),
  source_type       text not null
                      check (source_type in ('GOVERNMENT','UNIVERSITY','ORGANIZATION','COMPANY','PAPER','MEDIA','OTHER')),
  publication_date  date,
  last_verified_at  timestamptz not null,
  confidence        text not null check (confidence in ('HIGH','MEDIUM','LOW')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists projects (
  id                 text primary key,
  name               text not null,
  type               text not null
                       check (type in ('PROJECT','NEWS','LAUNCH','COMPANY','GOVERNMENT','UNIVERSITY',
                                       'RESEARCH','INFRASTRUCTURE','ROBOTICS','POLICY','INVESTMENT',
                                       'EDUCATION','APPLICATION','IMPACT','SIGNAL','POSSIBILITY')),
  status             text not null
                       check (status in ('IDEA','RESEARCH','ANNOUNCED','FUNDED','PILOT','BUILDING',
                                         'DEPLOYING','ACTIVE','SCALING','COMPLETED','PAUSED','CANCELLED')),
  evidence           text not null
                       check (evidence in ('VERIFIED','REPORTED','ANNOUNCED','ANALYSIS','SIGNAL','POSSIBILITY')),
  sector             text,
  summary            text not null,
  impact             text,
  year               integer check (year between 1900 and 2100),
  location_id        text not null references locations(id) on delete restrict,
  geometry           geography(Point,4326),
  actors             text[] not null default '{}',
  tags               text[] not null default '{}',
  published_at       timestamptz,
  last_verified_at   timestamptz not null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists project_sources (
  project_id text not null references projects(id) on delete cascade,
  source_id  text not null references sources(id) on delete restrict,
  snippet    text not null,
  is_primary boolean not null default false,
  primary key (project_id, source_id)
);

create table if not exists status_history (
  id          bigserial primary key,
  project_id  text not null references projects(id) on delete cascade,
  from_status text
                check (from_status is null or from_status in ('IDEA','RESEARCH','ANNOUNCED','FUNDED',
                  'PILOT','BUILDING','DEPLOYING','ACTIVE','SCALING','COMPLETED','PAUSED','CANCELLED')),
  to_status   text not null
                check (to_status in ('IDEA','RESEARCH','ANNOUNCED','FUNDED','PILOT','BUILDING',
                  'DEPLOYING','ACTIVE','SCALING','COMPLETED','PAUSED','CANCELLED')),
  changed_at  timestamptz not null,
  note        text,
  source_id   text references sources(id) on delete set null
);

create table if not exists impact_records (
  id          bigserial primary key,
  project_id  text not null references projects(id) on delete cascade,
  category    text not null
                check (category in ('ECONOMIC','SOCIAL','EDUCATIONAL','HEALTH','ENVIRONMENTAL',
                  'INFRASTRUCTURE','REGULATORY','OTHER')),
  description text not null,
  source_id   text references sources(id) on delete set null
);

create table if not exists events (
  id          bigserial primary key,
  project_id  text not null references projects(id) on delete cascade,
  title       text not null,
  occurred_at date not null,
  kind        text not null,
  description text not null default '',
  source_id   text references sources(id) on delete set null
);

create table if not exists relations (
  id           text primary key,
  from_project text not null references projects(id) on delete cascade,
  to_project   text not null references projects(id) on delete cascade,
  type         text not null
                 check (type in ('PARTNERSHIP','FUNDING','RESEARCH','INFRASTRUCTURE','GOVERNMENT',
                                 'SUPPLIER','UNIVERSITY','DEPLOYMENT','LOCATION','POLICY',
                                 'TECHNOLOGY','INVESTMENT')),
  description  text not null default '',
  source_id    text references sources(id) on delete set null,
  unique (from_project, to_project, type),
  check (from_project <> to_project)
);

create index if not exists locations_geography_gist on locations using gist (geography);
create index if not exists locations_parent_idx on locations (parent_id);
create index if not exists locations_level_idx on locations (level);

create index if not exists projects_geography_gist on projects using gist (geometry);
create index if not exists projects_type_idx on projects (type);
create index if not exists projects_status_idx on projects (status);
create index if not exists projects_evidence_idx on projects (evidence);
create index if not exists projects_location_idx on projects (location_id);
create index if not exists projects_published_idx on projects (published_at desc);
create index if not exists projects_last_verified_idx on projects (last_verified_at desc);

-- The regconfig cast must be a literal for the expression to be indexable.
create index if not exists projects_search_idx on projects using gin (
  to_tsvector(
    'spanish'::regconfig,
    coalesce(name, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(array_to_string(tags, ' '), '')
  )
);

create index if not exists sources_source_type_idx on sources (source_type);
create index if not exists project_sources_source_idx on project_sources (source_id);
create index if not exists status_history_project_idx on status_history (project_id, changed_at desc);
create index if not exists impact_records_project_idx on impact_records (project_id);
create index if not exists events_occurred_idx on events (occurred_at);
create index if not exists events_project_idx on events (project_id);

create or replace function atlas_touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists locations_touch on locations;
create trigger locations_touch before update on locations
  for each row execute function atlas_touch_updated_at();

drop trigger if exists projects_touch on projects;
create trigger projects_touch before update on projects
  for each row execute function atlas_touch_updated_at();

drop trigger if exists sources_touch on sources;
create trigger sources_touch before update on sources
  for each row execute function atlas_touch_updated_at();
```

- [ ] **Step 8: Delete the legacy SQL**

Run:
```bash
git rm -q apps/api/sql/001_schema.sql apps/api/sql/002_seed.sql
```
Expected: both removed. The `apps/api/sql/` directory becomes empty and disappears from git.

- [ ] **Step 9: Rewrite `docker-compose.yml`**

```yaml
services:
  db:
    image: postgis/postgis:16-3.4
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-aiworldatlas}
      POSTGRES_USER: ${POSTGRES_USER:-atlas}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}
    ports:
      - "127.0.0.1:5432:5432"
    volumes:
      - atlas-db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-atlas} -d ${POSTGRES_DB:-aiworldatlas}"]
      interval: 5s
      timeout: 5s
      retries: 12
      start_period: 10s
    restart: unless-stopped

volumes:
  atlas-db-data:
```

Note: the legacy compose file mounted `apps/api/sql` into `/docker-entrypoint-initdb.d`. That mount is deliberately removed — schema and data now come from `npm run db:setup`, which is versioned and re-runnable.

`POSTGRES_PASSWORD` has no default on purpose, which makes the `.env.example` line below
load-bearing: without it, step 1 of the README fails on a fresh clone with
`POSTGRES_PASSWORD is required`. Anything a required variable needs in order to exist must
ship a documented value.

- [ ] **Step 10: Give the root `.env.example` the variable compose now requires**

`.env.example`:
```dotenv
POSTGRES_DB=aiworldatlas
POSTGRES_USER=atlas
POSTGRES_PASSWORD=atlas
DATABASE_URL=postgresql://atlas:atlas@127.0.0.1:5432/aiworldatlas
VITE_API_BASE_URL=http://localhost:8787
VITE_MAPBOX_TOKEN=
```

Then verify the guard actually resolves — the failure this prevents is invisible to a
read of the file:

```powershell
Copy-Item .env.example .env -Force
docker compose config | Out-Null
```

Expected: `docker compose config` exits 0. Remove the `.env` afterwards; it is gitignored.

- [ ] **Step 11: Pin the SQL `CHECK` lists to the contract vocabularies**

Task 2's review found the vocabularies unpinned: `LOCATION_LEVELS 'CONTINENT'→'PLANET'` and `SOURCE_TYPES 'MEDIA'→'BLOG'` both left the suite green. The consequence lands here — this file re-transcribes the same eight arrays into `check (... in (...))` lists, and a silent divergence between the two transcriptions is an `INSERT` that fails against Postgres at runtime, not a test failure.

The two copies can be kept honest without a database by comparing them as text. Create `apps/api/src/db/schema-vocabularies.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CONFIDENCE_LEVELS,
  EVIDENCE_LEVELS,
  IMPACT_CATEGORIES,
  LOCATION_LEVELS,
  PROJECT_STATUSES,
  PROJECT_TYPES,
  RELATION_TYPES,
  SOURCE_TYPES,
} from '@atlas/contracts';

const sql = readFileSync(
  fileURLToPath(new URL('../../migrations/001_core.sql', import.meta.url)),
  'utf8',
);

interface CheckList {
  column: string;
  values: string[];
}

// Every `check (<column> in ('A','B',...))` in the file. Order in the SQL carries
// no meaning, so lists are compared as sets, but nothing is discarded.
//
// The column is not always the first token of the check body: `status_history`
// uses `check (from_status is null or from_status in (...))`, so a pattern that
// requires the column to lead the body misses it. Capture the whole body by
// paren depth, then find the `in` list anywhere inside it.
function checkBodies(): string[] {
  const bodies: string[] = [];
  for (const match of sql.matchAll(/check\s*\(/gi)) {
    let depth = 1;
    let index = match.index + match[0].length;
    for (; index < sql.length && depth > 0; index += 1) {
      if (sql[index] === '(') depth += 1;
      else if (sql[index] === ')') depth -= 1;
    }
    if (depth === 0) bodies.push(sql.slice(match.index + match[0].length, index - 1));
  }
  return bodies;
}

function checkLists(): CheckList[] {
  return checkBodies()
    .map((body) => /(\w+)\s+in\s*\(([^)]*)\)/i.exec(body))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => ({
      column: match[1]!,
      values: [...match[2]!.matchAll(/'([^']+)'/g)].map((value) => value[1]!).sort(),
    }));
}

const sorted = (values: readonly string[]): string[] => [...values].sort();

describe('001_core.sql vocabulary parity', () => {
  it('mirrors every closed vocabulary as a check constraint', () => {
    expect(checkLists()).toEqual(
      [
        { column: 'level', values: sorted(LOCATION_LEVELS) },
        { column: 'source_type', values: sorted(SOURCE_TYPES) },
        { column: 'confidence', values: sorted(CONFIDENCE_LEVELS) },
        { column: 'type', values: sorted(PROJECT_TYPES) },
        { column: 'status', values: sorted(PROJECT_STATUSES) },
        { column: 'evidence', values: sorted(EVIDENCE_LEVELS) },
        { column: 'from_status', values: sorted(PROJECT_STATUSES) },
        { column: 'to_status', values: sorted(PROJECT_STATUSES) },
        { column: 'category', values: sorted(IMPACT_CATEGORIES) },
        { column: 'type', values: sorted(RELATION_TYPES) },
      ].map((entry) => ({ ...entry, values: entry.values.sort() })),
    );
  });

  it('finds no check list the table above does not account for', () => {
    expect(checkLists()).toHaveLength(10);
  });
});
```

The second test is not redundant with the first. `toEqual` on an array is order-sensitive, so a tenth list appended in a different position would fail the first test with an opaque diff; the count assertion names the actual problem — a vocabulary was added to the SQL and not to the contract, or the reverse.

Verify it can fail, because a parity test that passes for the wrong reason is the exact defect class this plan keeps hitting. Change `'CONTINENT'` to `'PLANET'` in the `check (level in (...))` list in `001_core.sql`, run the test, confirm red, then restore it and confirm green.

Run: `npx vitest run --project api apps/api/src/db/schema-vocabularies.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 12: Keep the api test files out of the build output**

This task writes the first `.ts` files ever added to `apps/api`, and the two `src/**/*.test.ts` files it introduces are both inside the build program. `apps/api/tsconfig.json` has `include: ["src/**/*.ts"]` and no `exclude`, and it emits to `./dist` — so `migrate.test.ts` and `schema-vocabularies.test.ts` would land in `dist/`, each one `import`-ing `vitest`, which is a devDependency absent from a production install. The build would not fail, which is what makes it worth closing here rather than discovering it in Task 22.

The five files a later task puts in `apps/api/test/` are already outside this build program: they are not matched by `include`, and `tsconfig.test.json` is the config that sees them.

Add an `exclude` to `apps/api/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "types": ["node"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.test.ts", "src/**/__fixtures__/**"]
}
```

Then prove both halves, because the failure this prevents is silent:

```bash
rm -rf apps/api/dist && npm run build --workspace @atlas/api
```

Expected: `dist/db/migrate.js`, `dist/db/pool.js`, `dist/db/migrate.d.ts` present; `dist/db/migrate.test.js` absent; no `*.test.js` anywhere in `dist`; and `grep -r "vitest" apps/api/dist` finds nothing. Then run `npm run typecheck --workspace @atlas/api` and confirm it still covers the tests — `npx tsc -p apps/api/tsconfig.test.json --listFiles` must list `src/db/migrate.test.ts` and `src/db/schema-vocabularies.test.ts`. An `exclude` that fixed the build by removing the tests from typechecking is the same mistake Task 1 made in `packages/contracts`, in the opposite direction.

- [ ] **Step 13: Verify the SQL parses against a scratch schema in CI-equivalent fashion**

Docker is not installed on this machine, so the parse check must be deferred. Task 6 (PostgreSQL repositories) carries the integration test that runs `001_core.sql` against `TEST_DATABASE_URL` and fails loudly on any syntax error. Locally, run only the unit suite:

Run: `npx vitest run --project api apps/api/src/db`
Expected: PASS, 5 tests (3 in `migrate.test.ts`, 2 in `schema-vocabularies.test.ts`).

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "feat(api): add versioned migrations and migration runner"
```

---

### Task 4: Audited seed — 11 locations, 5 projects, 7 primary sources, 7 events, 0 relations

**Files:**
- Create: `apps/api/seeds/001_core_seed.sql`, `apps/api/src/db/seed.ts`, `apps/api/src/db/seed.test.ts`, `apps/api/src/db/__fixtures__/seed/001_core_seed.sql`

**Interfaces:**
- Consumes: `PoolLike` (Task 3), `src/db/migrate.ts#runMigrations`.
- Produces:
  - `runSeed(options: { pool: PoolLike; seedFile: string; log?: (message: string) => void }): Promise<void>` — wraps the file in one transaction and rolls back on error.
  - Seed data constants that later tasks assert against: project ids `pucv-fondecyt-fuzzy`, `chile-national-ai-policy`, `indiaai-mission`, `punggol-digital-district`, `eu-ai-factories`; location ids `world`, `south-america`, `chile`, `valparaiso-region`, `valparaiso`, `vina-del-mar`, `santiago`, `pucv-campus`, `india`, `singapore`, `eu`; source ids `src-pucv-fondecyt-2026`, `src-minciencia-policy`, `src-minciencia-policy-2026`, `src-indiaai-coe-2024`, `src-indiaai-challenge-2026`, `src-smartnation-odp`, `src-ec-ai-factories`; the `relations` table stays empty.

- [ ] **Step 1: Write the failing seed-runner test**

`apps/api/src/db/seed.test.ts`:

The fake must model a **checked-out client**, not just a pool. A pool-only fake records
BEGIN, the body and COMMIT into one list and passes whether they travelled on the same
connection or three different ones, so it cannot catch the affinity defect that
`runMigrations` was fixed for. Recording `via: 'pool' | 'client'` per call and asserting
against the client list is the version of this test that fails when the runner regresses.

```ts
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { runSeed } from './seed.ts';
import type { ClientLike, PoolLike, QueryResultLike } from './types.ts';

const seedFile = fileURLToPath(new URL('./__fixtures__/seed/001_core_seed.sql', import.meta.url));

type Call = { sql: string; via: 'pool' | 'client' };

function recordingPool(failOn?: RegExp) {
  const calls: Call[] = [];
  let released = 0;

  const answer = async (sql: string): Promise<QueryResultLike> => {
    if (failOn?.test(sql)) throw new Error('duplicate key violates unique constraint');
    return { rows: [], rowCount: 0 };
  };

  const pool: PoolLike = {
    async query(sql) {
      calls.push({ sql, via: 'pool' });
      return answer(sql);
    },
    async connect(): Promise<ClientLike> {
      return {
        async query(sql) {
          calls.push({ sql, via: 'client' });
          return answer(sql);
        },
        release() {
          released += 1;
        },
      };
    },
    async end() {
      return undefined;
    },
  };

  const sqlOf = (via?: Call['via']) =>
    calls.filter((c) => via === undefined || c.via === via).map((c) => c.sql);

  return { pool, calls, sqlOf, releasedCount: () => released };
}

describe('runSeed', () => {
  it('wraps the seed file in a single transaction', async () => {
    const { pool, sqlOf } = recordingPool();
    await runSeed({ pool, seedFile });
    // BEGIN, the body and COMMIT must all travel on one checked-out connection.
    expect(sqlOf('client')).toEqual([
      'BEGIN',
      expect.stringContaining('dummy_seed_probe'),
      'COMMIT',
    ]);
  });

  it('releases the client after a successful seed', async () => {
    const { pool, releasedCount } = recordingPool();
    await runSeed({ pool, seedFile });
    expect(releasedCount()).toBe(1);
  });

  it('rolls back and rethrows when the seed fails', async () => {
    const { pool, sqlOf, releasedCount } = recordingPool(/dummy_seed_probe/);
    await expect(runSeed({ pool, seedFile })).rejects.toThrow(/duplicate key/);
    expect(sqlOf('client')).toContain('ROLLBACK');
    expect(sqlOf('client')).not.toContain('COMMIT');
    expect(releasedCount()).toBe(1);
  });

  it('keeps the seed error when the rollback itself fails', async () => {
    const { pool } = recordingPool(/dummy_seed_probe/);
    const failingRollback: PoolLike = {
      ...pool,
      async connect() {
        const client = await pool.connect();
        return {
          ...client,
          async query(sql, values) {
            if (sql === 'ROLLBACK') throw new Error('connection terminated');
            return client.query(sql, values);
          },
        };
      },
    };
    await expect(runSeed({ pool: failingRollback, seedFile })).rejects.toThrow(
      /^seed failed: duplicate key violates unique constraint/,
    );
  });

  it('keeps the seed error when releasing the client also fails', async () => {
    const { pool } = recordingPool(/dummy_seed_probe/);
    const doubleReleasing: PoolLike = {
      ...pool,
      async connect() {
        const client = await pool.connect();
        return {
          ...client,
          release() {
            throw new Error('Release called on client which has already been released to the pool.');
          },
        };
      },
    };
    const error = await runSeed({ pool: doubleReleasing, seedFile }).then(
      () => null,
      (caught: unknown) => caught as Error,
    );
    expect(error?.message).toMatch(/^seed failed: duplicate key violates unique constraint/);
    expect((error?.cause as Error | undefined)?.message).toBe(
      'duplicate key violates unique constraint',
    );
  });
});
```

Create `apps/api/src/db/__fixtures__/seed/001_core_seed.sql` containing:
```sql
select 1;
insert into dummy_seed_probe values ('duplicate key'); -- deliberately failing statement
```

- [ ] **Step 2: Run it and confirm failure**

Run: `npx vitest run --project api apps/api/src/db/seed.test.ts`
Expected: FAIL — `Failed to resolve import "./seed.ts"`.

- [ ] **Step 3: Implement `src/db/seed.ts`**

`apps/api/src/db/seed.ts`:
```ts
import { readFile } from 'node:fs/promises';
import type { PoolLike } from './types.ts';

export interface RunSeedOptions {
  pool: PoolLike;
  seedFile: string;
  log?: (message: string) => void;
}

export async function runSeed(options: RunSeedOptions): Promise<void> {
  const { pool, seedFile, log = () => {} } = options;
  const sql = await readFile(seedFile, 'utf8');
  log(`seeding ${seedFile}`);

  // One checked-out client for the whole transaction. Transaction state lives on
  // the connection, so issuing BEGIN through pool#query and the body through a
  // second checkout can put them on different connections, which leaves the seed
  // running in autocommit and COMMIT with nothing to commit.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    log('seed applied');
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Best effort. A rollback that cannot be sent must not replace the seed
      // error, which is the one that tells the operator what actually went wrong.
    }
    throw new Error(`seed failed: ${(error as Error).message}`, { cause: error });
  } finally {
    try {
      client.release();
    } catch {
      // Best effort, same reasoning as ROLLBACK above: a throw from a finally
      // block replaces the pending exception, and pg-pool's release() throws
      // synchronously on a double release.
    }
  }
}
```

- [ ] **Step 4: Run the seed test and confirm it passes**

Run: `npx vitest run --project api apps/api/src/db/seed.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Write `seeds/001_core_seed.sql`**

Coordinates: named-city coordinates are the standard published centre of the city. The two non-city points are labelled approximations in `metadata`. `pucv-campus` carries `metadata.geocode_precision = 'approximate'`, **not** `'address'`: the address published by the faculty (Av. Brasil 525, Valparaíso) is recorded in the metadata as a label, but the coordinate was not geocoded from it and no geocoding service was consulted, so the point is a city-level anchor and must not be read as the building entrance. It was downgraded on Leonardo's decision rather than asserted, because a seed whose premise is traceability cannot carry a precision claim nobody checked. `projects.geometry` for `pucv-fondecyt-fuzzy` reuses that same approximate point. `eu` is an aggregation anchor for the AI Factories block, flagged with `metadata.aggregation = true`.

`apps/api/seeds/001_core_seed.sql`:
```sql
-- AI World Atlas — audited seed.
-- Every claim below is traceable to a primary source in `sources`.
-- No VERIFIED evidence, no invented figures, no invented relations.

-- ---------------------------------------------------------------- locations
insert into locations (id, name, level, parent_id, country_code, geography, metadata) values
  ('world',          'World',            'WORLD',     null,             null,  st_setsrid(st_makepoint(0, 0), 4326),            '{}'::jsonb),
  ('south-america',  'South America',    'CONTINENT', 'world',          null,  st_setsrid(st_makepoint(-58, -14), 4326),        '{"kind":"approximate-continent-anchor"}'),
  ('chile',          'Chile',            'COUNTRY',   'south-america',  'CL',  st_setsrid(st_makepoint(-71.5, -35.7), 4326),    '{}'::jsonb),
  ('valparaiso-region','Valparaíso Region','REGION',   'chile',          'CL',  st_setsrid(st_makepoint(-71.35, -32.85), 4326),  '{}'::jsonb),
  ('valparaiso',     'Valparaíso',        'CITY',      'valparaiso-region','CL',st_setsrid(st_makepoint(-71.6127, -33.0472), 4326),'{}'::jsonb),
  ('vina-del-mar',   'Viña del Mar',      'CITY',      'valparaiso-region','CL',st_setsrid(st_makepoint(-71.5617, -33.0244), 4326),'{}'::jsonb),
  ('santiago',       'Santiago',         'CITY',      'chile',          'CL',  st_setsrid(st_makepoint(-70.6693, -33.4489), 4326),'{}'::jsonb),
  ('pucv-campus',    'PUCV campus',      'LOCAL_AREA','valparaiso',     'CL',  st_setsrid(st_makepoint(-71.5220, -33.0365), 4326),'{"geocode_precision":"approximate","address":"Avenida Brasil 525, Valparaiso, Chile","note":"city-level anchor. The address is the one the faculty publishes, but this coordinate was NOT geocoded from it and no geocoding service was consulted, so the point is approximate and must not be read as the building entrance."}'),
  ('india',          'India',            'COUNTRY',   'world',          'IN',  st_setsrid(st_makepoint(78.9629, 20.5937), 4326),  '{}'::jsonb),
  ('singapore',      'Singapore',        'COUNTRY',   'world',          'SG',  st_setsrid(st_makepoint(103.8198, 1.3521), 4326),  '{}'::jsonb),
  ('eu',             'European Union',   'COUNTRY',   'world',          null,  st_setsrid(st_makepoint(10.35, 50.85), 4326),     '{"aggregation":true,"note":"anchor for the EU-wide AI Factories block, not a territorial claim"}')
on conflict (id) do update set
  name = excluded.name,
  level = excluded.level,
  parent_id = excluded.parent_id,
  country_code = excluded.country_code,
  geography = excluded.geography,
  metadata = excluded.metadata,
  updated_at = now();

-- ----------------------------------------------------------------- sources
insert into sources (id, name, url, source_type, publication_date, last_verified_at, confidence) values
  ('src-pucv-fondecyt-2026', 'PUCV Facultad de Ingenieria',
    'https://www.ingenieria.pucv.cl/desarrollan-proyecto-de-inteligencia-artificial-con-algoritmos-capables-de-aprender-de-su-propio-desempeno/',
    'UNIVERSITY', date '2026-03-05', timestamptz '2026-09-25T00:00:00Z', 'HIGH'),
  ('src-minciencia-policy', 'Ministerio de Ciencia, Tecnologia y Conocimiento de Chile',
    'https://www.minciencia.gob.cl/areas/inteligencia-artificial/politica-nacional-de-inteligencia-artificial/',
    'GOVERNMENT', NULL, timestamptz '2026-09-25T00:00:00Z', 'HIGH'),
  ('src-minciencia-policy-2026', 'Ministerio de Ciencia, Tecnologia y Conocimiento de Chile',
    'https://www.minciencia.gob.cl/noticias/con-mas-de-100-acciones-comprometidas-para-2026-ministra-de-ciencia-presenta-nueva-politica-de-inteligencia-artificial/',
    'GOVERNMENT', NULL, timestamptz '2026-09-25T00:00:00Z', 'MEDIUM'),
  ('src-indiaai-coe-2024', 'IndiaAI (Government of India, MeitY)',
    'https://indiaai.gov.in/article/union-minister-dharmendra-pradhan-launches-three-ai-centres-of-excellence',
    'GOVERNMENT', date '2024-10-16', timestamptz '2026-09-25T00:00:00Z', 'HIGH'),
  ('src-indiaai-challenge-2026', 'IndiaAI (Government of India, MeitY)',
    'https://indiaai.gov.in/article/indiaai-innovation-challenge-2026',
    'GOVERNMENT', date '2026-01-15', timestamptz '2026-09-25T00:00:00Z', 'HIGH'),
  ('src-smartnation-odp', 'Smart Nation Singapore',
    'https://www.smartnation.gov.sg/initiatives/smart-city-solutions/',
    'GOVERNMENT', NULL, timestamptz '2026-09-25T00:00:00Z', 'MEDIUM'),
  ('src-ec-ai-factories', 'European Commission, DG CONNECT',
    'https://digital-strategy.ec.europa.eu/en/policies/ai-factories',
    'GOVERNMENT', NULL, timestamptz '2026-09-25T00:00:00Z', 'HIGH')
on conflict (id) do update set
  name = excluded.name,
  url = excluded.url,
  source_type = excluded.source_type,
  publication_date = excluded.publication_date,
  last_verified_at = excluded.last_verified_at,
  confidence = excluded.confidence,
  updated_at = now();

-- ---------------------------------------------------------------- projects
insert into projects (
  id, name, type, status, evidence, sector, summary, impact, year,
  location_id, geometry, actors, tags, published_at, last_verified_at
) values
  ('pucv-fondecyt-fuzzy',
   'An Adaptive Fuzzy Control System for Metaheuristic Configuration',
   'RESEARCH', 'RESEARCH', 'REPORTED', 'Research',
   'Proyecto Fondecyt Regular que aplica control difuso adaptativo a algoritmos metaheuristicos, entre los 31 proyectos Fondecyt adjudicados a academicos PUCV en 2026.',
   'Metodologia publicada para ajustar la parametrizacion de metaheuristicas en problemas de optimizacion.', 2026,
   'pucv-campus', st_setsrid(st_makepoint(-71.5220, -33.0365), 4326),
   ARRAY['Pontificia Universidad Catolica de Valparaiso'], ARRAY['Fondecyt', 'metaheuristics', 'fuzzy control', 'optimization'],
   timestamptz '2026-03-05T00:00:00Z', timestamptz '2026-09-25T00:00:00Z'),

  ('chile-national-ai-policy',
   'Politica Nacional de Inteligencia Artificial',
   'POLICY', 'ACTIVE', 'REPORTED', 'Policy',
   'Politica vigente desde 2021, con plan de accion y actualizacion del Eje 3. La version actualizada reporta 177 acciones, 100 comprometidas para 2026 y coordinacion con 14 ministerios.',
   'Marco de referencia para la planificacion y coordinacion de IA a nivel estatal.', 2021,
   'chile', NULL,
   ARRAY['Ministerio de Ciencia, Tecnologia y Conocimiento'], ARRAY['national policy', 'public sector', '2026 actions'],
   NULL, timestamptz '2026-09-25T00:00:00Z'),

  ('indiaai-mission',
   'IndiaAI Mission',
   'GOVERNMENT', 'ACTIVE', 'REPORTED', 'Public sector',
   'IndiaAI, implementado como India Business Development Agency bajo Digital India Corporation / MeitY, ejecuta la mission nacional de IA. Se documentan tres Centres of Excellence lanzados en octubre de 2024 con 990 crore rupias.',
   'Infraestructura institucional nacional para investigación y adopción de IA.', 2024,
   'india', NULL,
   ARRAY['MeitY', 'Digital India Corporation'], ARRAY['mission', 'centres of excellence', 'MeitY'],
   timestamptz '2024-10-16T00:00:00Z', timestamptz '2026-09-25T00:00:00Z'),

  ('punggol-digital-district',
   'Punggol Digital District Open Digital Platform',
   'INFRASTRUCTURE', 'ACTIVE', 'REPORTED', 'Smart city',
   'Plataforma del distrito que integra sistemas de smart city para monitoreo en tiempo real y optimizacion de recursos, segun la pagina oficial de Smart Nation.',
   'Integracion de sistemas urbanos para gestion de recursos en tiempo real.', NULL,
   'singapore', NULL,
   ARRAY['Smart Nation Singapore'], ARRAY['smart city', 'open digital platform', 'urban systems'],
   NULL, timestamptz '2026-09-25T00:00:00Z'),

  ('eu-ai-factories',
   'European AI Factories',
   'INFRASTRUCTURE', 'DEPLOYING', 'ANNOUNCED', 'Compute',
   'La Comision Europea reporta 19 AI Factories y 13 antennas en preparacion, al menos 9 supercomputadores optimizados, una llamada para hasta 7 AI Gigafactories y hasta 10 mil millones de euros de apoyo publico. La inversion privada esperada se declara como expectativa.',
   'Capacidad de calculo democratizada para la investigacion y la industria europea.', 2026,
   'eu', NULL,
   ARRAY['European Commission'], ARRAY['AI Factories', 'supercomputing', 'Gigafactories'],
   NULL, timestamptz '2026-09-25T00:00:00Z')
on conflict (id) do update set
  name = excluded.name,
  type = excluded.type,
  status = excluded.status,
  evidence = excluded.evidence,
  sector = excluded.sector,
  summary = excluded.summary,
  impact = excluded.impact,
  year = excluded.year,
  location_id = excluded.location_id,
  geometry = excluded.geometry,
  actors = excluded.actors,
  tags = excluded.tags,
  published_at = excluded.published_at,
  last_verified_at = excluded.last_verified_at,
  updated_at = now();

-- ------------------------------------------------------------- project_sources
insert into project_sources (project_id, source_id, snippet, is_primary) values
  ('pucv-fondecyt-fuzzy', 'src-pucv-fondecyt-2026',
   'Proyecto Fondecyt Regular sobre control difuso adaptativo para la configuracion de metaheuristicas, uno de los 31 proyectos adjudicados a academicos PUCV.', true),
  ('chile-national-ai-policy', 'src-minciencia-policy',
   'Pagina institucional de la Politica Nacional de Inteligencia Artificial: vigente, con plan de accion y actualizacion del Eje 3.', true),
  ('chile-national-ai-policy', 'src-minciencia-policy-2026',
   'La politica actualizada reporta 177 acciones, 100 comprometidas para 2026 y coordinacion con 14 ministerios.', false),
  ('indiaai-mission', 'src-indiaai-coe-2024',
   'Lanzamiento de tres Centres of Excellence con 990 crore rupias de presupuesto.', true),
  ('indiaai-mission', 'src-indiaai-challenge-2026',
   'IndiaAI opera como India Business Development Agency bajo Digital India Corporation / MeitY; el reto de innovacion 2026 se announce en enero de 2026.', false),
  ('punggol-digital-district', 'src-smartnation-odp',
   'El Open Digital Platform del Punggol Digital District integra sistemas de smart city para monitoreo y optimizacion de recursos.', true),
  ('eu-ai-factories', 'src-ec-ai-factories',
   '19 AI Factories y 13 antennas en preparacion, 9 supercomputadores optimizados, llamada para hasta 7 AI Gigafactories y hasta 10 mil millones de euros de apoyo publico.', true)
on conflict (project_id, source_id) do update set
  snippet = excluded.snippet,
  is_primary = excluded.is_primary;

-- ----------------------------------------------------------------- events
-- kind 'DATED' means the exact day is documented by the source.
-- kind 'YEAR'   means only the year is documented; the UI renders the year alone.
-- The id is explicit so this insert upserts by primary key like every other
-- table in this seed. A guessed unique key on (project_id, title, occurred_at)
-- would be worse than a duplicate: two legitimately distinct events can share
-- a title and a date, and the constraint would silently drop a real one.
insert into events (id, project_id, title, occurred_at, kind, description, source_id) values
  (1, 'pucv-fondecyt-fuzzy', 'Proyecto Fondecyt publicado por la Facultad de Ingenieria PUCV',
   date '2026-03-05', 'DATED',
   'La Facultad de Ingenieria de la PUCV publica el proyecto Fondecyt Regular sobre control difuso adaptativo.', 'src-pucv-fondecyt-2026'),
  (2, 'chile-national-ai-policy', 'Publicacion de la Politica Nacional de Inteligencia Artificial',
   date '2021-01-01', 'YEAR',
   'Chile publica su Politica Nacional de Inteligencia Artificial, vigente desde 2021.', 'src-minciencia-policy'),
  (3, 'chile-national-ai-policy', 'Actualizacion con 177 acciones para 2026',
   date '2026-01-01', 'YEAR',
   'La politica actualizada informa 177 acciones, 100 comprometidas para 2026 y coordinacion con 14 ministerios.', 'src-minciencia-policy-2026'),
  (4, 'indiaai-mission', 'Lanzamiento de tres Centres of Excellence',
   date '2024-10-16', 'DATED',
   'El ministro Dharmendra Pradhan lanza tres Centres of Excellence con 990 crore rupias.', 'src-indiaai-coe-2024'),
  (5, 'indiaai-mission', 'IndiaAI Innovation Challenge 2026',
   date '2026-01-15', 'DATED',
   'Publicacion del reto de innovacion IndiaAI 2026.', 'src-indiaai-challenge-2026'),
  (6, 'punggol-digital-district', 'Open Digital Platform descrito como sistema de smart city',
   date '2026-01-01', 'YEAR',
   'Smart Nation describe el Open Digital Platform del Punggol Digital District como integracion de sistemas de smart city.', 'src-smartnation-odp'),
  (7, 'eu-ai-factories', 'Red de AI Factories en preparacion',
   date '2026-01-01', 'YEAR',
   'La Comision Europea reporta 19 AI Factories y 13 antennas en preparacion y una llamada para hasta 7 AI Gigafactories.', 'src-ec-ai-factories')
on conflict (id) do update set
  project_id = excluded.project_id,
  title = excluded.title,
  occurred_at = excluded.occurred_at,
  kind = excluded.kind,
  description = excluded.description,
  source_id = excluded.source_id;

-- ---------------------------------------------------------- status history
insert into status_history (id, project_id, from_status, to_status, changed_at, note, source_id) values
  (1, 'pucv-fondecyt-fuzzy', NULL, 'RESEARCH', timestamptz '2026-03-05T00:00:00Z', 'Inicio documentado del proyecto.', 'src-pucv-fondecyt-2026'),
  (2, 'chile-national-ai-policy', NULL, 'ANNOUNCED', timestamptz '2021-01-01T00:00:00Z', 'Publicacion de la politica.', 'src-minciencia-policy'),
  (3, 'chile-national-ai-policy', 'ANNOUNCED', 'ACTIVE', timestamptz '2026-01-01T00:00:00Z', 'Politica vigente con plan de accion en ejecucion.', 'src-minciencia-policy-2026'),
  (4, 'indiaai-mission', NULL, 'ANNOUNCED', timestamptz '2024-10-16T00:00:00Z', 'Lanzamiento de los Centres of Excellence.', 'src-indiaai-coe-2024'),
  (5, 'indiaai-mission', 'ANNOUNCED', 'ACTIVE', timestamptz '2026-01-15T00:00:00Z', 'Reto de innovacion 2026 en curso.', 'src-indiaai-challenge-2026'),
  (6, 'punggol-digital-district', NULL, 'ACTIVE', timestamptz '2026-01-01T00:00:00Z', 'Plataforma descrita como operativa.', 'src-smartnation-odp'),
  (7, 'eu-ai-factories', NULL, 'ANNOUNCED', timestamptz '2026-01-01T00:00:00Z', 'Red anunciada por la Comision Europea.', 'src-ec-ai-factories'),
  (8, 'eu-ai-factories', 'ANNOUNCED', 'DEPLOYING', timestamptz '2026-01-01T00:00:00Z', 'Factories y antennas en preparacion.', 'src-ec-ai-factories')
on conflict (id) do update set
  project_id = excluded.project_id,
  from_status = excluded.from_status,
  to_status = excluded.to_status,
  changed_at = excluded.changed_at,
  note = excluded.note,
  source_id = excluded.source_id;

-- relations: intentionally empty. The audited sources do not document an
-- explicit relation between these five projects, so none is invented.

analyze locations;
analyze projects;
```

- [ ] **Step 6: Verify the seed file has no encoding damage and is idempotent**

Run:
```powershell
$seed = Get-Content "apps\api\seeds\001_core_seed.sql" -Raw
$hits = [regex]::Matches($seed, '[\u3000-\u9FFF\uFFFD]')
if ($hits.Count -gt 0) { Write-Output "CJK/MOJIBAKE HITS: $($hits.Count)"; exit 1 }
$targets = @{
  'projects'         = 'id'
  'locations'        = 'id'
  'project_sources'  = 'project_id, source_id'
  'events'           = 'id'
  'status_history'   = 'id'
}
foreach ($table in $targets.Keys) {
  $at = $seed.IndexOf("insert into $table ")
  if ($at -lt 0) { Write-Output "MISSING INSERT: $table"; exit 1 }
  $next = $seed.IndexOf('insert into ', $at + 1)
  if ($next -lt 0) { $next = $seed.Length }
  $slice = $seed.Substring($at, $next - $at)
  if ($slice -notmatch "on conflict \($($targets[$table])\) do update set") {
    Write-Output "NOT IDEMPOTENT: $table"; exit 1
  }
}
Write-Output 'seed clean'
```
Expected: `seed clean`. If it fails, fix the flagged table with the edit tool and re-run until it prints `seed clean`.

Two things this has to get right. A single `-notmatch` over the whole file is not enough: it
matches whichever table happens to be first, so deleting the `events` insert entirely still reports
the seed clean. Each table is checked in its own slice, bounded by the next `insert into`. And the
conflict target differs per table: `project_sources` is a join table with `primary key (project_id,
source_id)` and no `id` column at all, so asserting `(id)` for every table is simply wrong.

- [ ] **Step 7: Assert the seed invariants**

Add `apps/api/seeds/seed.invariants.test.ts`:
```ts
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const seed = await readFile(new URL('./001_core_seed.sql', import.meta.url), 'utf8');

describe('seed file invariants', () => {
  it('never assigns VERIFIED evidence', () => {
    expect(seed).not.toMatch(/'VERIFIED'/);
  });

  it('creates no relations', () => {
    expect(seed).not.toMatch(/insert into relations/i);
  });

  it('inserts exactly eleven locations', () => {
    const block = seed.slice(seed.indexOf('insert into locations'), seed.indexOf('on conflict (id) do update set', seed.indexOf('insert into locations')));
    expect((block.match(/\('([a-z0-9-]+)',/g) ?? []).length).toBe(11);
  });

  it('references only https sources', () => {
    const urls = [...seed.matchAll(/'(https?:\/\/[^']+)'/g)].map((m) => m[1] ?? '');
    expect(urls.length).toBeGreaterThanOrEqual(5);
    for (const url of urls) expect(url.startsWith('https://')).toBe(true);
  });

  it('uses the six location levels', () => {
    for (const level of ['WORLD', 'CONTINENT', 'COUNTRY', 'REGION', 'CITY', 'LOCAL_AREA']) {
      expect(seed).toContain(`'${level}'`);
    }
  });
});
```

- [ ] **Step 8: Run the seed tests**

Run: `npx vitest run --project api apps/api/src/db apps/api/seeds`
Expected: PASS, 4 files / 12 tests.

Both path filters are required. The vitest file filter is a substring match on the path, so
`apps/api/src/db` alone does not pick up `apps/api/seeds/seed.invariants.test.ts` — the five
invariant tests this step just wrote would be silently skipped while the command still printed a
pass. Confirm the file count, not just the exit code.

- [ ] **Step 9: Add the `db:reset` script and document it**

Add to root `package.json#scripts`:
```json
"db:reset": "docker compose down -v && docker compose up -d && npm run db:setup"
```
And record in `README.md` (created in Task 20) that `npm run db:reset` destroys the local volume.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(api): add audited seed with eleven locations and verified sources"
```

---

### Task 5: API core — env, errors, middleware, app factory, health, and the in-memory double

**Files:**
- Create: `apps/api/src/config/env.ts`, `apps/api/src/config/env.test.ts`, `apps/api/src/config/logger.ts`, `apps/api/src/errors/HttpError.ts`, `apps/api/src/errors/errorHandler.ts`, `apps/api/src/middleware/requestId.ts`, `apps/api/src/middleware/security.ts`, `apps/api/src/repositories/types.ts`, `apps/api/src/services/filters.ts`, `apps/api/src/services/filters.test.ts`, `apps/api/src/repositories/fake.ts`, `apps/api/src/testing/fixtures.ts`, `apps/api/src/app.ts`, `apps/api/src/server.ts`, `apps/api/test/health.test.ts`
- Delete: `apps/api/src/server.js` — the legacy V4 entry point. This task writes `apps/api/src/server.ts` beside it, and two entry points in one package is a trap: Node's resolver would pick one unpredictably, and the legacy file fails `npm run lint` (it is one of the P0 findings), which keeps the gate red for the rest of the plan. Delete it in the step that writes `server.ts`, with `git rm`.

**Interfaces:**
- Consumes: `@atlas/contracts` (Task 2), `PoolLike` (Task 3).
- Produces:
  - `AppEnv` = `{ nodeEnv: 'development'|'test'|'production'; port: number; databaseUrl: string; corsOrigins: string[]; allowWildcardCors: boolean; logLevel: 'debug'|'info'|'warn'|'error' }`
  - `loadEnv(source?: NodeJS.ProcessEnv): AppEnv` — throws `EnvValidationError` naming every missing/invalid key.
  - `EnvValidationError extends Error { readonly issues: string[] }`
  - `Logger` = `{ debug(msg: string, meta?: Record<string, unknown>): void; info(...): void; warn(...): void; error(...): void }`; `createLogger(level: AppEnv['logLevel']): Logger`
  - `HttpError extends Error { status: number; code: string; details: unknown[] }` with statics `badRequest(details?)`, `notFound(message?)`, `internal(cause?)`. No `methodNotAllowed`; see the note in the implementation.
  - `AtlasRepositories` = `{ locations: LocationRepository; projects: ProjectRepository; events: EventRepository; relations: RelationRepository; stats: StatsRepository; health: HealthRepository }` (interfaces in `repositories/types.ts`)
  - Query types: `PaginationQuery { page; pageSize }`, `LocationsQuery extends PaginationQuery { parentId?; level? }`, `ProjectsQuery extends PaginationQuery { q?; type?; status?; evidence?; sector?; locationIds?; yearFrom?; yearTo?; sort }`, `EventsQuery { projectId?; yearFrom?; yearTo? }`
  - `buildApp(options: { repos: AtlasRepositories; env: AppEnv; logger: Logger }): Express`
  - Pure helpers in `services/filters.ts`: `matchesProjectFilters(project: ProjectSummary, query: ProjectsQuery): boolean`, `sortProjects(list: ProjectSummary[], sort: ProjectsQuery['sort']): ProjectSummary[]`, `paginate<T>(list: T[], page: number, pageSize: number): Paginated<T>`, `searchTokensMatch(haystack: string, q: string): boolean`
  - `createFakeRepositories(data: AtlasData): AtlasRepositories` where `AtlasData` is `{ locations: Location[]; projects: ProjectDetail[]; sources: Source[]; events: Event[]; relations: Relation[] }`

- [ ] **Step 1: Write the failing env test**

`apps/api/src/config/env.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { EnvValidationError, loadEnv } from './env.ts';

const base = {
  NODE_ENV: 'test',
  PORT: '8787',
  DATABASE_URL: 'postgres://atlas:atlas@127.0.0.1:5432/aiworldatlas',
  CORS_ORIGIN: 'http://localhost:5173',
} as NodeJS.ProcessEnv;

describe('loadEnv', () => {
  it('parses a valid environment and splits the cors allowlist', () => {
    const env = loadEnv({ ...base, CORS_ORIGIN: 'http://localhost:5173,https://atlas.example' });
    expect(env.port).toBe(8787);
    expect(env.corsOrigins).toEqual(['http://localhost:5173', 'https://atlas.example']);
    expect(env.allowWildcardCors).toBe(false);
  });

  it('rejects a missing DATABASE_URL and names it', () => {
    const { DATABASE_URL: _omitted, ...withoutDb } = base;
    expect(() => loadEnv(withoutDb as NodeJS.ProcessEnv)).toThrow(EnvValidationError);
    try {
      loadEnv(withoutDb as NodeJS.ProcessEnv);
    } catch (error) {
      expect((error as EnvValidationError).issues.join(' ')).toContain('DATABASE_URL');
    }
  });

  it('never allows a wildcard origin in production', () => {
    const env = loadEnv({ ...base, NODE_ENV: 'production', CORS_ORIGIN: '*' });
    expect(env.allowWildcardCors).toBe(false);
  });

  it('allows a wildcard origin only in development', () => {
    const env = loadEnv({ ...base, NODE_ENV: 'development', CORS_ORIGIN: '*' });
    expect(env.allowWildcardCors).toBe(true);
  });

  it('rejects a non numeric port', () => {
    expect(() => loadEnv({ ...base, PORT: 'eight' })).toThrow(EnvValidationError);
  });
});
```

- [ ] **Step 2: Run it and confirm failure**

Run: `npx vitest run --project api apps/api/src/config/env.test.ts`
Expected: FAIL — `Failed to resolve import "./env.ts"`.

- [ ] **Step 3: Implement `src/config/env.ts`**

```ts
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  TEST_DATABASE_URL: z.string().optional(),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export interface AppEnv {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  databaseUrl: string;
  corsOrigins: string[];
  allowWildcardCors: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export class EnvValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Invalid environment: ${issues.join('; ')}`);
    this.name = 'EnvValidationError';
    this.issues = issues;
  }
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new EnvValidationError(
      parsed.error.issues.map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`),
    );
  }
  const { NODE_ENV, PORT, DATABASE_URL, CORS_ORIGIN, LOG_LEVEL } = parsed.data;
  const corsOrigins = CORS_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  const isWildcard = corsOrigins.length === 1 && corsOrigins[0] === '*';
  return {
    nodeEnv: NODE_ENV,
    port: PORT,
    databaseUrl: DATABASE_URL,
    corsOrigins: isWildcard ? ['*'] : corsOrigins,
    allowWildcardCors: isWildcard && NODE_ENV !== 'production',
    logLevel: LOG_LEVEL,
  };
}
```

- [ ] **Step 4: Implement `src/config/logger.ts`**

```ts
import type { AppEnv } from './env.ts';

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

const ORDER: Record<AppEnv['logLevel'], number> = { debug: 10, info: 20, warn: 30, error: 40 };

export function createLogger(level: AppEnv['logLevel']): Logger {
  const threshold = ORDER[level];
  const emit =
    (severity: AppEnv['logLevel']) =>
    (message: string, meta?: Record<string, unknown>) => {
      if (ORDER[severity] < threshold) return;
      const line = { severity, message, ...(meta ?? {}) };
      if (severity === 'error') process.stderr.write(`${JSON.stringify(line)}\n`);
      else process.stdout.write(`${JSON.stringify(line)}\n`);
    };
  return {
    debug: emit('debug'),
    info: emit('info'),
    warn: emit('warn'),
    error: emit('error'),
  };
}
```

- [ ] **Step 5: Implement `src/errors/HttpError.ts` and `src/errors/errorHandler.ts`**

`src/errors/HttpError.ts`:
```ts
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown[];

  constructor(status: number, code: string, message: string, details: unknown[] = []) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(details: unknown[] = []): HttpError {
    return new HttpError(400, 'VALIDATION_ERROR', 'Invalid request', details);
  }

  static notFound(message = 'Resource not found'): HttpError {
    return new HttpError(404, 'NOT_FOUND', message);
  }

  // No `methodNotAllowed` factory. Express 5 does not tell you which methods a
  // path supports, so producing a 405 would mean hand-maintaining a path registry
  // to mirror the routers. An unknown verb falls through to `notFoundHandler`
  // and answers 404, which is correct: from the client's point of view the
  // resource does not exist at that address. See Global Constraints.

  /**
   * 500 responses never carry the underlying message. Spec §11.6 requires that a
   * database message such as `relation "projects_type_check" violates check
   * constraint` or `ECONNREFUSED 127.0.0.1:5432` never reaches the client; the
   * `cause` is logged by the error handler, never serialised.
   */
  static internal(cause?: unknown): HttpError {
    void cause;
    return new HttpError(500, 'INTERNAL_ERROR', 'Unexpected server error', []);
  }
}
```

`src/errors/errorHandler.ts`:
```ts
import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { Logger } from '../config/logger.ts';
import { HttpError } from './HttpError.ts';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(HttpError.notFound(`No route for ${req.method} ${req.path}`));
};

export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (error, req, res, _next) => {
    const requestId = String((req as { id?: string }).id ?? 'unknown');

    // express.json() raises a plain error carrying a status; normalise it so every
    // failure leaves the API through the same envelope.
    const rawStatus =
      (error as { status?: number }).status ?? (error as { statusCode?: number }).statusCode;
    if (rawStatus === 413) {
      res.status(413).json({
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: 'Request body exceeds the 1mb limit',
          details: [],
          requestId,
        },
      });
      return;
    }

    const isHttp = error instanceof HttpError;
    const status = isHttp ? error.status : 500;
    const code = isHttp ? error.code : 'INTERNAL_ERROR';
    const message = isHttp ? error.message : 'Unexpected server error';
    const details = isHttp ? error.details : [];

    if (!isHttp) {
      logger.error('unhandled error', {
        requestId,
        message: (error as Error).message,
        stack: (error as Error).stack,
      });
    }

    res.status(status).json({
      error: { code, message, details, requestId },
    });
  };
}
```

- [ ] **Step 6: Implement `src/middleware/requestId.ts` and `src/middleware/security.ts`**

`src/middleware/requestId.ts`:
```ts
import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.header('x-request-id');
  const id = incoming && incoming.length <= 128 ? incoming : randomUUID();
  (req as unknown as { id: string }).id = id;
  res.setHeader('x-request-id', id);
  next();
};
```

`src/middleware/security.ts`:
```ts
import cors from 'cors';
import helmet from 'helmet';
import type { RequestHandler } from 'express';
import type { AppEnv } from '../config/env.ts';

export function securityMiddleware(env: AppEnv): RequestHandler[] {
  const allowList = new Set(env.corsOrigins.filter((origin) => origin !== '*'));
  const corsOptions = env.allowWildcardCors
    ? {
        origin: '*',
        credentials: false as const,
        methods: ['GET', 'HEAD', 'OPTIONS'] as string[],
        maxAge: 600,
      }
    : {
        origin(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
          if (!origin) return callback(null, true);
          if (allowList.has(origin)) return callback(null, true);
          return callback(null, false);
        },
        credentials: false as const,
        methods: ['GET', 'HEAD', 'OPTIONS'] as string[],
        maxAge: 600,
      };
  return [
    helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }),
    cors(corsOptions),
  ];
}
```

`cors@2.8.6` only emits a literal `*` when the `origin` option is the string `'*'`; given a function it reflects the request origin instead. The wildcard branch must therefore pass `origin: '*'` as a literal, not via a callback.

- [ ] **Step 7: Run the env test and confirm it passes**

Run: `npx vitest run --project api apps/api/src/config/env.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 8: Define the repository interfaces**

`apps/api/src/repositories/types.ts`:
```ts
import type {
  Event,
  EvidenceLevel,
  Location,
  LocationLevel,
  Paginated,
  ProjectDetail,
  ProjectStatus,
  ProjectSummary,
  ProjectType,
  Relation,
  StatsResponse,
} from '@atlas/contracts';

export interface PaginationQuery {
  page: number;
  pageSize: number;
}

export interface LocationsQuery extends PaginationQuery {
  parentId?: string;
  level?: LocationLevel;
}

export interface ProjectsQuery extends PaginationQuery {
  q?: string;
  type?: ProjectType[];
  status?: ProjectStatus[];
  evidence?: EvidenceLevel[];
  sector?: string;
  locationIds?: string[];
  yearFrom?: number;
  yearTo?: number;
  sort: 'publishedAt' | 'name';
}

export interface EventsQuery {
  projectId?: string;
  yearFrom?: number;
  yearTo?: number;
}

export interface LocationRepository {
  all(): Promise<Location[]>;
  list(query: LocationsQuery): Promise<Paginated<Location>>;
  descendantIds(id: string): Promise<string[]>;
}

export interface ProjectRepository {
  list(query: ProjectsQuery): Promise<Paginated<ProjectSummary>>;
  findById(id: string): Promise<ProjectDetail | null>;
}

export interface EventRepository {
  list(query: EventsQuery): Promise<Event[]>;
}

export interface RelationRepository {
  listByProject(projectId: string): Promise<Relation[]>;
}

export interface StatsRepository {
  overview(): Promise<StatsResponse>;
}

export interface HealthRepository {
  ping(): Promise<boolean>;
}

export interface AtlasRepositories {
  locations: LocationRepository;
  projects: ProjectRepository;
  events: EventRepository;
  relations: RelationRepository;
  stats: StatsRepository;
  health: HealthRepository;
}
```

- [ ] **Step 9: Write the failing pure-filter test**

`apps/api/src/services/filters.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { ProjectSummary } from '@atlas/contracts';
import { matchesProjectFilters, paginate, searchTokensMatch, sortProjects } from './filters.ts';

const base: ProjectSummary = {
  id: 'chile-national-ai-policy',
  name: 'Politica Nacional de Inteligencia Artificial',
  type: 'POLICY',
  status: 'ACTIVE',
  evidence: 'REPORTED',
  sector: 'Policy',
  summary: 'Politica vigente desde 2021 con plan de accion.',
  year: 2021,
  locationId: 'chile',
  longitude: -71.5,
  latitude: -35.7,
  actors: ['Ministerio de Ciencia'],
  tags: ['national policy'],
  publishedAt: '2023-01-01T00:00:00.000Z',
  lastVerifiedAt: '2026-09-25T00:00:00.000Z',
  sourceCount: 2,
  eventCount: 2,
};

// `other` sorts BEFORE `base` by name ('European' precedes 'Politica') but carries
// the EARLIER date, so the two sort modes disagree. Three traps are closed here.
// Spreading `base` would copy base's publishedAt, and two equal dates never reach
// the descending branch at all: the sort falls through to the name tiebreaker, so
// a test named "orders by publication date descending" would assert the tiebreaker
// instead while appearing to cover the date. And if the fixtures also agreed under
// both orders, swapping the two assertions would leave the test green, which is
// the same blind spot as the accent tests.
const other: ProjectSummary = { ...base, id: 'eu-ai-factories', type: 'INFRASTRUCTURE', name: 'European AI Factories', tags: ['compute'], publishedAt: '2020-05-01T00:00:00.000Z' };

describe('project filters', () => {
  it('ORs values inside one parameter and ANDs across parameters', () => {
    expect(matchesProjectFilters(base, { page: 1, pageSize: 50, sort: 'name', type: ['POLICY', 'RESEARCH'] })).toBe(true);
    expect(matchesProjectFilters(other, { page: 1, pageSize: 50, sort: 'name', type: ['POLICY', 'RESEARCH'] })).toBe(false);
    expect(matchesProjectFilters(base, { page: 1, pageSize: 50, sort: 'name', type: ['POLICY'], status: ['DEPLOYING'] })).toBe(false);
  });

  it('folds accents so an unaccented query still finds accented text', () => {
    // The fixture above is deliberately unaccented, so it cannot catch a broken
    // fold: deleting `.normalize('NFD').replace(/[\u0300-\u036f]/g, '')` from
    // filters.ts would leave every other test in this file green. The accented
    // copy is what makes the folding observable, in both directions.
    const accented: ProjectSummary = {
      ...base,
      name: 'Política Nacional de Inteligencia Artificial',
      summary: 'Política vigente desde 2021 con plan de acción.',
      sector: 'Políticas Públicas',
    };
    expect(matchesProjectFilters(accented, { page: 1, pageSize: 50, sort: 'name', q: 'politica' })).toBe(true);
    expect(matchesProjectFilters(accented, { page: 1, pageSize: 50, sort: 'name', q: 'política' })).toBe(true);
    expect(matchesProjectFilters(accented, { page: 1, pageSize: 50, sort: 'name', q: 'inteligencia' })).toBe(true);
    expect(matchesProjectFilters(accented, { page: 1, pageSize: 50, sort: 'name', q: 'accion' })).toBe(true);
    expect(matchesProjectFilters(accented, { page: 1, pageSize: 50, sort: 'name', q: 'ausente' })).toBe(false);
  });

  it('compares the sector filter with the same accent folding', () => {
    const accented: ProjectSummary = { ...base, sector: 'Políticas Públicas' };
    expect(matchesProjectFilters(accented, { page: 1, pageSize: 50, sort: 'name', sector: 'politicas publicas' })).toBe(true);
    expect(matchesProjectFilters(accented, { page: 1, pageSize: 50, sort: 'name', sector: 'Políticas Públicas' })).toBe(true);
    expect(matchesProjectFilters(accented, { page: 1, pageSize: 50, sort: 'name', sector: 'salud' })).toBe(false);
  });

  it('matches plain unaccented search text', () => {
    expect(matchesProjectFilters(base, { page: 1, pageSize: 50, sort: 'name', q: 'politica' })).toBe(true);
    expect(matchesProjectFilters(base, { page: 1, pageSize: 50, sort: 'name', q: 'artificial' })).toBe(true);
    expect(matchesProjectFilters(base, { page: 1, pageSize: 50, sort: 'name', q: 'ausente' })).toBe(false);
  });

  it('filters by year range inclusive', () => {
    expect(matchesProjectFilters(base, { page: 1, pageSize: 50, sort: 'name', yearFrom: 2021, yearTo: 2021 })).toBe(true);
    expect(matchesProjectFilters(base, { page: 1, pageSize: 50, sort: 'name', yearFrom: 2022 })).toBe(false);
    // The upper bound has its own branch, so it needs its own assertion. Without
    // this, deleting the whole `yearTo` check leaves the range test green.
    expect(matchesProjectFilters(base, { page: 1, pageSize: 50, sort: 'name', yearTo: 2020 })).toBe(false);
    expect(matchesProjectFilters(base, { page: 1, pageSize: 50, sort: 'name', yearTo: 2021 })).toBe(true);
  });

  it('filters by location id', () => {
    expect(matchesProjectFilters(base, { page: 1, pageSize: 50, sort: 'name', locationIds: ['chile'] })).toBe(true);
    expect(matchesProjectFilters(base, { page: 1, pageSize: 50, sort: 'name', locationIds: ['chile', 'peru'] })).toBe(true);
    expect(matchesProjectFilters(base, { page: 1, pageSize: 50, sort: 'name', locationIds: ['peru'] })).toBe(false);
  });

  it('searches tags as well as name, summary, sector and location', () => {
    // 'criptografia' appears in the tag array and nowhere else on the record, so
    // dropping `...project.tags` from the haystack cannot go unnoticed.
    const tagged: ProjectSummary = { ...base, tags: ['criptografia'] };
    expect(matchesProjectFilters(tagged, { page: 1, pageSize: 50, sort: 'name', q: 'criptografia' })).toBe(true);
    expect(matchesProjectFilters(tagged, { page: 1, pageSize: 50, sort: 'name', q: 'cripto' })).toBe(true);
    expect(matchesProjectFilters(tagged, { page: 1, pageSize: 50, sort: 'name', q: 'criptografiaq' })).toBe(false);
  });

  it('ignores stopwords so an all-article query does not filter everything out', () => {
    // A search box full of articles has to return the full result set, not none
    // of it. Without this, the STOPWORDS set could be deleted and every search
    // for "de" or "la" would silently return zero rows.
    expect(searchTokensMatch('anything at all', 'de la')).toBe(true);
    expect(searchTokensMatch('politica nacional', 'de los')).toBe(true);
    // In a mixed query only the meaningful token has to match.
    expect(searchTokensMatch('politica nacional', 'de inteligencia')).toBe(false);
    expect(searchTokensMatch('politica nacional', 'de politica')).toBe(true);
  });

  it('orders by name and by publication date descending', () => {
    const list = [other, base];
    // The two orders are deliberately opposite, so each assertion can only pass
    // if that sort actually did its own job.
    expect(sortProjects(list, 'name').map((p) => p.id)).toEqual(['eu-ai-factories', 'chile-national-ai-policy']);
    expect(sortProjects(list, 'publishedAt').map((p) => p.id)).toEqual(['chile-national-ai-policy', 'eu-ai-factories']);
  });

  // The tiebreaker is the behaviour the previous version of this test was
  // accidentally measuring. Undated projects sort last and break ties by name.
  it('sorts undated projects last and breaks ties by name', () => {
    const undatedB: ProjectSummary = { ...base, id: 'zzz-undated', name: 'Zeta', publishedAt: null };
    const undatedA: ProjectSummary = { ...base, id: 'aaa-undated', name: 'Alpha', publishedAt: null };
    const list = [undatedB, undatedA, other];
    expect(sortProjects(list, 'publishedAt').map((p) => p.id)).toEqual(['eu-ai-factories', 'aaa-undated', 'zzz-undated']);
  });

  it('paginates with a stable total and totalPages', () => {
    const page = paginate([1, 2, 3, 4, 5], 2, 2);
    expect(page.data).toEqual([3, 4]);
    expect(page.total).toBe(5);
    expect(page.totalPages).toBe(3);
  });

  it('requires every token to appear, so short tokens still work', () => {
    expect(searchTokensMatch('人工智能 policy', 'poli')).toBe(true);
    expect(searchTokensMatch('人工智能 policy', 'zzz')).toBe(false);
  });
});
```

- [ ] **Step 10: Run it and confirm failure**

Run: `npx vitest run --project api apps/api/src/services/filters.test.ts`
Expected: FAIL — `Failed to resolve import "./filters.ts"`.

- [ ] **Step 11: Implement `src/services/filters.ts`**

```ts
import type { Paginated, ProjectSummary } from '@atlas/contracts';
import type { ProjectsQuery } from '../repositories/types.ts';

const STOPWORDS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'en', 'para', 'con', 'un', 'una']);

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function searchTokensMatch(haystack: string, q: string): boolean {
  const target = fold(haystack);
  const tokens = fold(q)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0 && !STOPWORDS.has(token));
  if (tokens.length === 0) return true;
  return tokens.every((token) => target.includes(token));
}

export function matchesProjectFilters(project: ProjectSummary, query: ProjectsQuery): boolean {
  if (query.type && query.type.length > 0 && !query.type.includes(project.type)) return false;
  if (query.status && query.status.length > 0 && !query.status.includes(project.status)) return false;
  if (query.evidence && query.evidence.length > 0 && !query.evidence.includes(project.evidence)) return false;
  if (query.sector && fold(query.sector) !== fold(project.sector ?? '')) return false;
  if (query.locationIds && query.locationIds.length > 0 && !query.locationIds.includes(project.locationId)) {
    return false;
  }
  if (query.yearFrom !== undefined && (project.year === null || project.year < query.yearFrom)) return false;
  if (query.yearTo !== undefined && (project.year === null || project.year > query.yearTo)) return false;
  if (query.q) {
    const haystack = [project.name, project.summary, project.sector ?? '', project.locationId, ...project.tags].join(' ');
    if (!searchTokensMatch(haystack, query.q)) return false;
  }
  return true;
}

export function sortProjects(list: ProjectSummary[], sort: ProjectsQuery['sort']): ProjectSummary[] {
  const copy = [...list];
  if (sort === 'name') {
    return copy.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }
  return copy.sort((a, b) => {
    const left = a.publishedAt ? Date.parse(a.publishedAt) : Number.NEGATIVE_INFINITY;
    const right = b.publishedAt ? Date.parse(b.publishedAt) : Number.NEGATIVE_INFINITY;
    if (left === right) return a.name.localeCompare(b.name, 'es');
    return right - left;
  });
}

export function paginate<T>(list: T[], page: number, pageSize: number): Paginated<T> {
  const total = list.length;
  const totalPages = pageSize > 0 ? Math.ceil(total / pageSize) : 0;
  const start = (page - 1) * pageSize;
  return { data: list.slice(start, start + pageSize), page, pageSize, total, totalPages };
}
```

- [ ] **Step 12: Run the filter test and confirm it passes**

Run: `npx vitest run --project api apps/api/src/services/filters.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 13: Create the fixtures**

`apps/api/src/testing/fixtures.ts`:
```ts
import type { Event, Location, ProjectDetail, Relation, Source } from '@atlas/contracts';
import type { AtlasData } from './types.ts';

const location = (
  id: string,
  name: string,
  level: Location['level'],
  parentId: string | null,
  longitude: number,
  latitude: number,
  countryCode: string | null = null,
): Location => ({
  id,
  name,
  level,
  parentId,
  countryCode,
  longitude,
  latitude,
  childCount: 0,
  projectCount: 0,
  metadata: {},
});

const source = (
  id: string,
  name: string,
  url: string,
  snippet: string,
  publicationDate: string | null,
  confidence: Source['confidence'] = 'HIGH',
): Source => ({
  id,
  name,
  url,
  sourceType: 'GOVERNMENT',
  publicationDate,
  lastVerifiedAt: '2026-09-25T00:00:00.000Z',
  confidence,
  snippet,
  isPrimary: true,
});

const now = '2026-09-25T00:00:00.000Z';

export const locationsFixture: Location[] = [
  location('world', 'World', 'WORLD', null, 0, 0),
  location('south-america', 'South America', 'CONTINENT', 'world', -58, -14),
  location('chile', 'Chile', 'COUNTRY', 'south-america', -71.5, -35.7, 'CL'),
  location('valparaiso-region', 'Valparaiso Region', 'REGION', 'chile', -71.35, -32.85, 'CL'),
  location('valparaiso', 'Valparaiso', 'CITY', 'valparaiso-region', -71.6127, -33.0472, 'CL'),
  location('vina-del-mar', 'Vina del Mar', 'CITY', 'valparaiso-region', -71.5617, -33.0244, 'CL'),
  location('santiago', 'Santiago', 'CITY', 'chile', -70.6693, -33.4489, 'CL'),
  location('pucv-campus', 'PUCV campus', 'LOCAL_AREA', 'valparaiso', -71.522, -33.0365, 'CL'),
  location('india', 'India', 'COUNTRY', 'world', 78.9629, 20.5937, 'IN'),
  location('singapore', 'Singapore', 'COUNTRY', 'world', 103.8198, 1.3521, 'SG'),
  location('eu', 'European Union', 'COUNTRY', 'world', 10.35, 50.85),
];

export const sourcesFixture: Source[] = [
  source('src-pucv-fondecyt-2026', 'PUCV', 'https://www.ingenieria.pucv.cl/x', 'Snippet PUCV.', '2026-03-05'),
  source('src-minciencia-policy', 'MinCiencia', 'https://www.minciencia.gob.cl/x', 'Snippet politica.', null),
  source('src-indiaai-coe-2024', 'IndiaAI', 'https://indiaai.gov.in/x', 'Snippet IndiaAI.', '2024-10-16'),
  source('src-smartnation-odp', 'Smart Nation', 'https://www.smartnation.gov.sg/x', 'Snippet Singapur.', null, 'MEDIUM'),
  source('src-ec-ai-factories', 'European Commission', 'https://digital-strategy.ec.europa.eu/x', 'Snippet CE.', null),
];

const project = (
  id: string,
  name: string,
  type: ProjectDetail['type'],
  status: ProjectDetail['status'],
  evidence: ProjectDetail['evidence'],
  locationId: string,
  year: number | null,
  publishedAt: string | null,
  sourceIds: string[],
  eventIds: number[],
): ProjectDetail => {
  const anchor = locationsFixture.find((l) => l.id === locationId);
  if (!anchor) throw new Error(`fixture: unknown location ${locationId}`);
  return {
    id,
    name,
    type,
    status,
    evidence,
    sector: 'Sector',
    summary: `Summary of ${name}.`,
    impact: `Impact of ${name}.`,
    year,
    locationId,
    longitude: anchor.longitude,
    latitude: anchor.latitude,
    actors: ['Actor'],
    tags: ['ai'],
    publishedAt,
    lastVerifiedAt: now,
    sourceCount: sourceIds.length,
    eventCount: eventIds.length,
    location: anchor,
    sources: sourcesFixture.filter((s) => sourceIds.includes(s.id)),
    events: eventsFixture.filter((e) => eventIds.includes(e.id)),
    relations: [],
    statusHistory: [
      {
        id: eventIds[0] ?? 1,
        fromStatus: null,
        toStatus: status,
        changedAt: publishedAt ?? now,
        note: null,
        sourceId: sourceIds[0] ?? null,
      },
    ],
    impactRecords: [],
    geometrySource: 'project',
  };
};

export const eventsFixture: Event[] = [
  { id: 1, projectId: 'pucv-fondecyt-fuzzy', title: 'Proyecto Fondecyt publicado', occurredAt: '2026-03-05', kind: 'DATED', description: '', sourceId: 'src-pucv-fondecyt-2026' },
  { id: 2, projectId: 'chile-national-ai-policy', title: 'Politica publicada', occurredAt: '2021-01-01', kind: 'YEAR', description: '', sourceId: 'src-minciencia-policy' },
  { id: 3, projectId: 'chile-national-ai-policy', title: 'Actualizacion 2026', occurredAt: '2026-01-01', kind: 'YEAR', description: '', sourceId: 'src-minciencia-policy' },
  { id: 4, projectId: 'indiaai-mission', title: 'Centres of Excellence', occurredAt: '2024-10-16', kind: 'DATED', description: '', sourceId: 'src-indiaai-coe-2024' },
  { id: 5, projectId: 'indiaai-mission', title: 'Innovation Challenge', occurredAt: '2026-01-15', kind: 'DATED', description: '', sourceId: 'src-indiaai-challenge-2026' },
  { id: 6, projectId: 'punggol-digital-district', title: 'ODP smart city', occurredAt: '2026-01-01', kind: 'YEAR', description: '', sourceId: 'src-smartnation-odp' },
  { id: 7, projectId: 'eu-ai-factories', title: 'AI Factories', occurredAt: '2026-01-01', kind: 'YEAR', description: '', sourceId: 'src-ec-ai-factories' },
];

export const projectsFixture: ProjectDetail[] = [
  project('pucv-fondecyt-fuzzy', 'An Adaptive Fuzzy Control System', 'RESEARCH', 'RESEARCH', 'REPORTED', 'pucv-campus', 2026, '2026-03-05T00:00:00.000Z', ['src-pucv-fondecyt-2026'], [1]),
  project('chile-national-ai-policy', 'Politica Nacional de Inteligencia Artificial', 'POLICY', 'ACTIVE', 'REPORTED', 'chile', 2021, null, ['src-minciencia-policy'], [2, 3]),
  project('indiaai-mission', 'IndiaAI Mission', 'GOVERNMENT', 'ACTIVE', 'REPORTED', 'india', 2024, '2024-10-16T00:00:00.000Z', ['src-indiaai-coe-2024'], [4, 5]),
  project('punggol-digital-district', 'Punggol Digital District Open Digital Platform', 'INFRASTRUCTURE', 'ACTIVE', 'REPORTED', 'singapore', null, null, ['src-smartnation-odp'], [6]),
  project('eu-ai-factories', 'European AI Factories', 'INFRASTRUCTURE', 'DEPLOYING', 'ANNOUNCED', 'eu', 2026, null, ['src-ec-ai-factories'], [7]),
];

export const relationsFixture: Relation[] = [];

export const atlasDataFixture: AtlasData = {
  locations: locationsFixture,
  projects: projectsFixture,
  sources: sourcesFixture,
  events: eventsFixture,
  relations: relationsFixture,
};
```

Also create `apps/api/src/testing/types.ts`:
```ts
import type { Event, Location, ProjectDetail, Relation, Source } from '@atlas/contracts';

export interface AtlasData {
  locations: Location[];
  projects: ProjectDetail[];
  sources: Source[];
  events: Event[];
  relations: Relation[];
}
```

- [ ] **Step 14: Implement the in-memory double**

`apps/api/src/repositories/fake.ts`:
```ts
import type { Event, Location, Paginated, ProjectDetail, ProjectSummary, Relation, StatsResponse } from '@atlas/contracts';
import type { AtlasData } from '../testing/types.ts';
import { matchesProjectFilters, paginate, sortProjects } from '../services/filters.ts';
import type {
  AtlasRepositories,
  EventsQuery,
  LocationsQuery,
  ProjectsQuery,
} from './types.ts';

function toSummary(detail: ProjectDetail): ProjectSummary {
  const { location: _location, sources: _sources, events: _events, relations: _relations, statusHistory: _statusHistory, impactRecords: _impactRecords, impact: _impact, geometrySource: _geometrySource, ...summary } = detail;
  return summary;
}

export function createFakeRepositories(data: AtlasData): AtlasRepositories {
  return {
    health: {
      async ping() {
        return true;
      },
    },
    locations: {
      async all() {
        return data.locations;
      },
      async list(query: LocationsQuery): Promise<Paginated<Location>> {
        let list = data.locations;
        if (query.parentId) list = list.filter((l) => l.parentId === query.parentId);
        if (query.level) list = list.filter((l) => l.level === query.level);
        const enriched = list.map((l) => ({
          ...l,
          childCount: data.locations.filter((child) => child.parentId === l.id).length,
          projectCount: data.projects.filter((p) => p.locationId === l.id).length,
        }));
        return paginate(enriched, query.page, query.pageSize);
      },
      async descendantIds(id: string) {
        const found = new Set<string>([id]);
        let frontier = [id];
        while (frontier.length > 0) {
          const next: string[] = [];
          for (const current of frontier) {
            for (const child of data.locations.filter((l) => l.parentId === current)) {
              if (!found.has(child.id)) {
                found.add(child.id);
                next.push(child.id);
              }
            }
          }
          frontier = next;
        }
        return [...found];
      },
    },
    projects: {
      async list(query: ProjectsQuery): Promise<Paginated<ProjectSummary>> {
        const summaries = data.projects.map(toSummary);
        const filtered = summaries.filter((summary) => matchesProjectFilters(summary, query));
        return paginate(sortProjects(filtered, query.sort), query.page, query.pageSize);
      },
      async findById(id: string): Promise<ProjectDetail | null> {
        return data.projects.find((p) => p.id === id) ?? null;
      },
    },
    events: {
      async list(query: EventsQuery): Promise<Event[]> {
        let list = data.events;
        if (query.projectId) list = list.filter((e) => e.projectId === query.projectId);
        if (query.yearFrom !== undefined) {
          list = list.filter((e) => Number(e.occurredAt.slice(0, 4)) >= query.yearFrom!);
        }
        if (query.yearTo !== undefined) {
          list = list.filter((e) => Number(e.occurredAt.slice(0, 4)) <= query.yearTo!);
        }
        return [...list].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
      },
    },
    relations: {
      async listByProject(projectId: string): Promise<Relation[]> {
        return data.relations.filter(
          (r) => r.fromProject === projectId || r.toProject === projectId,
        );
      },
    },
    stats: {
      async overview(): Promise<StatsResponse> {
        const count = <T extends string>(values: T[]): Record<string, number> => {
          const output: Record<string, number> = {};
          for (const value of values) output[value] = (output[value] ?? 0) + 1;
          return output;
        };
        return {
          totals: {
            projects: data.projects.length,
            locations: data.locations.length,
            sources: data.sources.length,
          },
          byEvidence: count(data.projects.map((p) => p.evidence)),
          byType: count(data.projects.map((p) => p.type)),
          byStatus: count(data.projects.map((p) => p.status)),
        };
      },
    },
  };
}
```

- [ ] **Step 15: Implement `src/app.ts` with the health route**

```ts
import express from 'express';
import type { Express } from 'express';
import type { AppEnv } from './config/env.ts';
import type { Logger } from './config/logger.ts';
import { errorHandler, notFoundHandler } from './errors/errorHandler.ts';
import { requestId } from './middleware/requestId.ts';
import { securityMiddleware } from './middleware/security.ts';
import type { AtlasRepositories } from './repositories/types.ts';

export interface BuildAppOptions {
  repos: AtlasRepositories;
  env: AppEnv;
  logger: Logger;
  version?: string;
}

export function buildApp(options: BuildAppOptions): Express {
  const { repos, env, logger } = options;
  const version = options.version ?? '0.1.0';
  const app = express();

  app.disable('x-powered-by');
  app.use(requestId);
  for (const middleware of securityMiddleware(env)) app.use(middleware);
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', async (_req, res) => {
    const databaseUp = await repos.health.ping();
    res.status(200).json({
      status: databaseUp ? 'ok' : 'degraded',
      api: 'atlas-api',
      database: databaseUp ? 'up' : 'down',
      version,
      time: new Date().toISOString(),
    });
  });

  app.use(notFoundHandler);
  app.use(errorHandler(logger));
  return app;
}
```

- [ ] **Step 16: Write the failing health test**

`apps/api/test/health.test.ts`:
```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.ts';
import { loadEnv } from '../src/config/env.ts';
import { createFakeRepositories } from '../src/repositories/fake.ts';
import { atlasDataFixture } from '../src/testing/fixtures.ts';
import type { AtlasData } from '../src/testing/types.ts';

const env = loadEnv({
  NODE_ENV: 'test',
  PORT: '8787',
  DATABASE_URL: 'postgres://atlas:atlas@127.0.0.1:5432/aiworldatlas',
  CORS_ORIGIN: 'http://localhost:5173',
} as NodeJS.ProcessEnv);

const silentLogger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

function app(data: AtlasData = atlasDataFixture) {
  return buildApp({ repos: createFakeRepositories(data), env, logger: silentLogger });
}

describe('GET /api/health', () => {
  it('reports ok when the database answers', async () => {
    const response = await request(app()).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.database).toBe('up');
    expect(response.body.api).toBe('atlas-api');
  });

  it('reports degraded when the database is down', async () => {
    const repos = createFakeRepositories(atlasDataFixture);
    repos.health = { ping: async () => false };
    const response = await request(buildApp({ repos, env, logger: silentLogger })).get('/api/health');
    expect(response.body.status).toBe('degraded');
    expect(response.body.database).toBe('down');
  });

  it('sets an x-request-id header on every response', async () => {
    const response = await request(app()).get('/api/health');
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('answers 404 with a uniform error envelope for unknown routes', async () => {
    const response = await request(app()).get('/api/nope');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
    expect(response.body.error.requestId).toBe(response.headers['x-request-id']);
  });
});
```

- [ ] **Step 17: Run the health test and confirm it passes**

Run: `npx vitest run --project api apps/api/test/health.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 18: Delete the legacy entry point, then implement `src/server.ts` and wire the `db:*` scripts to real entry points**

Delete first, so the two entry points never coexist:

```bash
git rm -q apps/api/src/server.js
```

`apps/api/src/server.ts`:
```ts
import 'dotenv/config';
import { buildApp } from './app.ts';
import { loadEnv } from './config/env.ts';
import { createLogger } from './config/logger.ts';
import { createPool, closePool } from './db/pool.ts';
import { createPgRepositories } from './repositories/pg/index.ts';

const env = loadEnv();
const logger = createLogger(env.logLevel);
const pool = createPool(env.databaseUrl);

const app = buildApp({ repos: createPgRepositories(pool), env, logger });

const server = app.listen(env.port, () => {
  logger.info('atlas api listening', { port: env.port, env: env.nodeEnv });
});

async function shutdown(signal: string): Promise<void> {
  logger.info('shutting down', { signal });
  server.close();
  await closePool(pool);
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
```

`apps/api/src/db/migrate-cli.ts` (invoked by the `db:migrate` script):
```ts
import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { createPool, closePool } from './pool.ts';
import { runMigrations } from './migrate.ts';
import { loadEnv } from '../config/env.ts';

const env = loadEnv();
const pool = createPool(env.databaseUrl);
const migrationsDir = fileURLToPath(new URL('../../migrations', import.meta.url));

try {
  const applied = await runMigrations({ pool, migrationsDir, log: (m) => process.stdout.write(`${m}\n`) });
  process.stdout.write(`applied ${applied.length} migration(s)\n`);
} finally {
  await closePool(pool);
}
```

`apps/api/src/db/seed-cli.ts` (invoked by the `db:seed` script):
```ts
import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { createPool, closePool } from './pool.ts';
import { runSeed } from './seed.ts';
import { loadEnv } from '../config/env.ts';

const env = loadEnv();
const pool = createPool(env.databaseUrl);
const seedFile = fileURLToPath(new URL('../../seeds/001_core_seed.sql', import.meta.url));

try {
  await runSeed({ pool, seedFile, log: (m) => process.stdout.write(`${m}\n`) });
} finally {
  await closePool(pool);
}
```

Update `apps/api/package.json#scripts`:
```json
"db:migrate": "node --experimental-strip-types src/db/migrate-cli.ts",
"db:seed": "node --experimental-strip-types src/db/seed-cli.ts"
```

`createPgRepositories` does not exist until Task 6, so `server.ts` will not compile at the end of this task. That is expected; Task 6 closes the gap. Do **not** create a stub.

- [ ] **Step 19: Run the whole API unit suite and the gates that can run without a database**

Run: `npx vitest run --project api`
Expected: PASS for `env.test.ts`, `filters.test.ts`, `migrate.test.ts`, `seed.test.ts`, `seed.invariants.test.ts`, `health.test.ts`.

- [ ] **Step 20: Commit**

```bash
git add -A
git commit -m "feat(api): add env validation errors middleware and health endpoint"
```

---

### Task 6: PostgreSQL repositories

**Files:**
- Create: `apps/api/src/repositories/pg/mappers.ts`, `apps/api/src/repositories/pg/locations.ts`, `apps/api/src/repositories/pg/projects.ts`, `apps/api/src/repositories/pg/events.ts`, `apps/api/src/repositories/pg/relations.ts`, `apps/api/src/repositories/pg/stats.ts`, `apps/api/src/repositories/pg/index.ts`, `apps/api/test/pg.integration.test.ts`

**Interfaces:**
- Consumes: `AtlasRepositories` and query types (Task 5), `PoolLike` (Task 3), `@atlas/contracts` (Task 2).
- Produces: `createPgRepositories(pool: PoolLike): AtlasRepositories` (from `src/repositories/pg/index.ts`) and the named exports `createLocationRepository`, `createProjectRepository`, `createEventRepository`, `createRelationRepository`, `createStatsRepository`, all taking a `PoolLike`. This is the symbol `src/server.ts` already imports.

- [ ] **Step 1: Write the mappers**

`apps/api/src/repositories/pg/mappers.ts`:
```ts
import type {
  Event,
  ImpactRecord,
  Location,
  ProjectDetail,
  ProjectSummary,
  Relation,
  Source,
  StatusHistoryEntry,
} from '@atlas/contracts';

type Row = Record<string, unknown>;

const asString = (value: unknown): string => String(value);
const asNullableString = (value: unknown): string | null =>
  value === null || value === undefined ? null : String(value);
const asNumber = (value: unknown): number => Number(value);
const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((item) => String(item)) : [];
const asDate = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
};

export function rowToLocation(row: Row): Location {
  return {
    id: asString(row.id),
    name: asString(row.name),
    level: asString(row.level) as Location['level'],
    parentId: asNullableString(row.parent_id),
    countryCode: asNullableString(row.country_code),
    longitude: asNumber(row.longitude),
    latitude: asNumber(row.latitude),
    childCount: asNumber(row.child_count),
    projectCount: asNumber(row.project_count),
    metadata: (row.metadata as Location['metadata']) ?? {},
  };
}

export function rowToProjectSummary(row: Row): ProjectSummary {
  return {
    id: asString(row.id),
    name: asString(row.name),
    type: asString(row.type) as ProjectSummary['type'],
    status: asString(row.status) as ProjectSummary['status'],
    evidence: asString(row.evidence) as ProjectSummary['evidence'],
    sector: asNullableString(row.sector),
    summary: asString(row.summary),
    year: row.year === null || row.year === undefined ? null : asNumber(row.year),
    locationId: asString(row.location_id),
    longitude: asNumber(row.longitude),
    latitude: asNumber(row.latitude),
    actors: asStringArray(row.actors),
    tags: asStringArray(row.tags),
    publishedAt: row.published_at ? new Date(asString(row.published_at)).toISOString() : null,
    lastVerifiedAt: new Date(asString(row.last_verified_at)).toISOString(),
    sourceCount: asNumber(row.source_count),
    eventCount: asNumber(row.event_count),
  };
}

export function rowToSource(row: Row): Source {
  return {
    id: asString(row.id),
    name: asString(row.name),
    url: asString(row.url),
    sourceType: asString(row.source_type) as Source['sourceType'],
    publicationDate: asDate(row.publication_date),
    lastVerifiedAt: new Date(asString(row.last_verified_at)).toISOString(),
    confidence: asString(row.confidence) as Source['confidence'],
    snippet: asString(row.snippet),
    isPrimary: Boolean(row.is_primary),
  };
}

export function rowToEvent(row: Row): Event {
  return {
    id: asNumber(row.id),
    projectId: asString(row.project_id),
    title: asString(row.title),
    occurredAt: asDate(row.occurred_at) ?? '1970-01-01',
    kind: asString(row.kind),
    description: asString(row.description),
    sourceId: asNullableString(row.source_id),
  };
}

export function rowToRelation(row: Row): Relation {
  return {
    id: asString(row.id),
    fromProject: asString(row.from_project),
    toProject: asString(row.to_project),
    type: asString(row.type) as Relation['type'],
    direction: asString(row.direction) as Relation['direction'],
    description: asString(row.description),
    sourceId: asNullableString(row.source_id),
  };
}

export function rowToStatusHistoryEntry(row: Row): StatusHistoryEntry {
  return {
    id: asNumber(row.id),
    fromStatus: asNullableString(row.from_status) as StatusHistoryEntry['fromStatus'],
    toStatus: asString(row.to_status) as StatusHistoryEntry['toStatus'],
    changedAt: new Date(asString(row.changed_at)).toISOString(),
    note: asNullableString(row.note),
    sourceId: asNullableString(row.source_id),
  };
}

export function rowToImpactRecord(row: Row): ImpactRecord {
  return {
    id: asNumber(row.id),
    category: asString(row.category) as ImpactRecord['category'],
    description: asString(row.description),
    sourceId: asNullableString(row.source_id),
  };
}

export function rowToProjectDetail(
  summary: ProjectSummary,
  row: Row,
  extra: {
    sources: Source[];
    events: Event[];
    relations: Relation[];
    statusHistory: StatusHistoryEntry[];
    impactRecords: ImpactRecord[];
    location: Location;
  },
): ProjectDetail {
  return {
    ...summary,
    impact: asNullableString(row.impact),
    location: extra.location,
    sources: extra.sources,
    events: extra.events,
    relations: extra.relations,
    statusHistory: extra.statusHistory,
    impactRecords: extra.impactRecords,
    geometrySource: asString(row.geometry_source) === 'location' ? 'location' : 'project',
  };
}
```

- [ ] **Step 2: Implement the locations repository**

`apps/api/src/repositories/pg/locations.ts`:
```ts
import type { Location, Paginated } from '@atlas/contracts';
import type { PoolLike } from '../../db/types.ts';
import type { LocationRepository, LocationsQuery } from '../types.ts';
import { rowToLocation } from './mappers.ts';

const SELECT_LOCATION = `
  select l.id, l.name, l.level, l.parent_id, l.country_code,
         st_x(l.geography::geometry) as longitude,
         st_y(l.geography::geometry) as latitude,
         l.metadata,
         (select count(*)::int from locations c where c.parent_id = l.id) as child_count,
         (select count(*)::int from projects p where p.location_id = l.id) as project_count
  from locations l`;

export function createLocationRepository(pool: PoolLike): LocationRepository {
  return {
    async all(): Promise<Location[]> {
      const result = await pool.query(`${SELECT_LOCATION} order by l.name asc`);
      return result.rows.map((row) => rowToLocation(row as Record<string, unknown>));
    },

    async list(query: LocationsQuery): Promise<Paginated<Location>> {
      const conditions: string[] = [];
      const values: unknown[] = [];
      if (query.parentId) {
        values.push(query.parentId);
        conditions.push(`l.parent_id = $${values.length}`);
      }
      if (query.level) {
        values.push(query.level);
        conditions.push(`l.level = $${values.length}`);
      }
      const where = conditions.length > 0 ? ` where ${conditions.join(' and ')}` : '';

      values.push(query.pageSize);
      const limitPlaceholder = `$${values.length}`;
      values.push((query.page - 1) * query.pageSize);
      const offsetPlaceholder = `$${values.length}`;

      const countResult = await pool.query(
        `select count(*)::int as total from locations l${where}`,
        values.slice(0, values.length - 2),
      );
      const total = Number((countResult.rows[0] as { total: number }).total);

      const result = await pool.query(
        `${SELECT_LOCATION}${where} order by l.name asc limit ${limitPlaceholder} offset ${offsetPlaceholder}`,
        values,
      );
      return {
        data: result.rows.map((row) => rowToLocation(row as Record<string, unknown>)),
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: query.pageSize > 0 ? Math.ceil(total / query.pageSize) : 0,
      };
    },

    async descendantIds(id: string): Promise<string[]> {
      const result = await pool.query(
        `
        with recursive tree as (
          select id from locations where id = $1
          union all
          select child.id from locations child join tree on child.parent_id = tree.id
        )
        select id from tree`,
        [id],
      );
      return result.rows.map((row) => (row as { id: string }).id);
    },
  };
}
```

- [ ] **Step 3: Implement the projects repository**

`apps/api/src/repositories/pg/projects.ts`:
```ts
import type { Paginated, ProjectDetail, ProjectSummary } from '@atlas/contracts';
import type { PoolLike } from '../../db/types.ts';
import type { ProjectRepository, ProjectsQuery } from '../types.ts';
import {
  rowToEvent,
  rowToImpactRecord,
  rowToLocation,
  rowToProjectDetail,
  rowToProjectSummary,
  rowToRelation,
  rowToSource,
  rowToStatusHistoryEntry,
} from './mappers.ts';

const BASE_CTE = `
  with base as (
    select
      p.id, p.name, p.type, p.status, p.evidence, p.sector, p.summary, p.impact, p.year,
      p.location_id, p.actors, p.tags, p.published_at, p.last_verified_at,
      case when p.geometry is null then 'location' else 'project' end as geometry_source,
      coalesce(p.geometry, l.geography) as point,
      l.name as location_name, l.level as location_level, l.parent_id as location_parent_id,
      l.country_code as location_country_code, st_x(l.geography::geometry) as location_longitude,
      st_y(l.geography::geometry) as location_latitude, l.metadata as location_metadata,
      (select count(*)::int from locations c where c.parent_id = l.id) as location_child_count,
      (select count(*)::int from projects lp where lp.location_id = l.id) as location_project_count,
      to_tsvector('spanish'::regconfig,
        coalesce(p.name,'') || ' ' || coalesce(p.summary,'') || ' ' || coalesce(array_to_string(p.tags,' '),'')
      ) as tsv,
      (select count(*)::int from project_sources ps where ps.project_id = p.id) as source_count,
      (select count(*)::int from events e where e.project_id = p.id) as event_count
    from projects p
    join locations l on l.id = p.location_id
  )`;

const SELECT_COLUMNS = `
  select id, name, type, status, evidence, sector, summary, impact, year, location_id,
         st_x(point::geometry) as longitude, st_y(point::geometry) as latitude,
         actors, tags, published_at, last_verified_at, geometry_source,
         location_name, location_level, location_parent_id, location_country_code,
         location_longitude, location_latitude, location_metadata,
         location_child_count, location_project_count,
         source_count, event_count, tsv
  from base`;

export function createProjectRepository(pool: PoolLike): ProjectRepository {
  function buildFilters(query: ProjectsQuery): { where: string; values: unknown[]; textLength: number } {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let textLength = 0;

    if (query.q && query.q.trim().length > 0) {
      const q = query.q.trim();
      const hasLongToken = q.split(/\s+/).some((token) => token.replace(/[^\p{L}\p{N}]/gu, '').length >= 3);
      if (hasLongToken) {
        values.push(q);
        const placeholder = `$${values.length}`;
        conditions.push(
          `(tsv @@ plainto_tsquery('spanish', ${placeholder}) or name ilike '%' || ${placeholder} || '%' or summary ilike '%' || ${placeholder} || '%' or array_to_string(tags,' ') ilike '%' || ${placeholder} || '%')`,
        );
      } else {
        values.push(`%${q}%`);
        const placeholder = `$${values.length}`;
        conditions.push(
          `(name ilike ${placeholder} or summary ilike ${placeholder} or array_to_string(tags,' ') ilike ${placeholder})`,
        );
      }
      textLength = values.length;
    }
    if (query.type && query.type.length > 0) {
      values.push(query.type);
      conditions.push(`type = any($${values.length}::text[])`);
    }
    if (query.status && query.status.length > 0) {
      values.push(query.status);
      conditions.push(`status = any($${values.length}::text[])`);
    }
    if (query.evidence && query.evidence.length > 0) {
      values.push(query.evidence);
      conditions.push(`evidence = any($${values.length}::text[])`);
    }
    if (query.sector) {
      values.push(query.sector);
      conditions.push(`sector = $${values.length}`);
    }
    if (query.locationIds && query.locationIds.length > 0) {
      values.push(query.locationIds);
      conditions.push(`location_id = any($${values.length}::text[])`);
    }
    if (query.yearFrom !== undefined) {
      values.push(query.yearFrom);
      conditions.push(`year >= $${values.length}`);
    }
    if (query.yearTo !== undefined) {
      values.push(query.yearTo);
      conditions.push(`year <= $${values.length}`);
    }

    return {
      where: conditions.length > 0 ? ` where ${conditions.join(' and ')}` : '',
      values,
      textLength,
    };
  }

  return {
    async list(query: ProjectsQuery): Promise<Paginated<ProjectSummary>> {
      const { where, values, textLength } = buildFilters(query);
      // Two defects were found here by running the suite against a real
      // PostGIS, not by reading this plan. The count query referenced the
      // `base` CTE without the `with` clause that defines it, and it was given
      // only `values.slice(0, textLength)` to bind. `textLength` records
      // whether the ORDER BY may reference $1; it says nothing about how many
      // values the where clause needs. Slicing worked only for a query with a
      // single condition, so any query combining two filters died with
      // "there is no parameter $1". The count query shares `where` and
      // therefore needs every value, in order.
      const countResult = await pool.query(
        `${BASE_CTE} select count(*)::int as total from base${where}`,
        values,
      );
      const total = Number((countResult.rows[0] as { total: number }).total);

      const orderBy =
        query.sort === 'name'
          ? textLength > 0
            ? ' order by ts_rank(tsv, plainto_tsquery(\'spanish\', $1)) desc, name asc'
            : ' order by name asc'
          : textLength > 0
            ? ' order by ts_rank(tsv, plainto_tsquery(\'spanish\', $1)) desc, published_at desc nulls last, name asc'
            : ' order by published_at desc nulls last, name asc';

      const paged = [...values];
      paged.push(query.pageSize);
      const limitPlaceholder = `$${paged.length}`;
      paged.push((query.page - 1) * query.pageSize);
      const offsetPlaceholder = `$${paged.length}`;

      const result = await pool.query(
        `${BASE_CTE}${SELECT_COLUMNS}${where}${orderBy} limit ${limitPlaceholder} offset ${offsetPlaceholder}`,
        paged,
      );
      return {
        data: result.rows.map((row) => rowToProjectSummary(row as Record<string, unknown>)),
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: query.pageSize > 0 ? Math.ceil(total / query.pageSize) : 0,
      };
    },

    async findById(id: string): Promise<ProjectDetail | null> {
      const result = await pool.query(`${BASE_CTE}${SELECT_COLUMNS} where id = $1`, [id]);
      const row = result.rows[0] as Record<string, unknown> | undefined;
      if (!row) return null;

      const [sources, events, relations, history, impacts] = await Promise.all([
        pool.query(
          `select s.id, s.name, s.url, s.source_type, s.publication_date, s.last_verified_at,
                  s.confidence, ps.snippet, ps.is_primary
             from project_sources ps join sources s on s.id = ps.source_id
            where ps.project_id = $1
            order by ps.is_primary desc, s.publication_date desc nulls last, s.name asc`,
          [id],
        ),
        pool.query(
          `select id, project_id, title, occurred_at, kind, description, source_id
             from events where project_id = $1 order by occurred_at asc`,
          [id],
        ),
        pool.query(
          `select r.id, r.from_project, r.to_project, r.type, r.description, r.source_id,
                  case when r.from_project = $1 then 'OUTGOING' else 'INCOMING' end as direction
             from relations r
            where r.from_project = $1 or r.to_project = $1
            order by r.type asc, r.id asc`,
          [id],
        ),
        pool.query(
          `select id, from_status, to_status, changed_at, note, source_id
             from status_history where project_id = $1 order by changed_at asc, id asc`,
          [id],
        ),
        pool.query(
          `select id, category, description, source_id
             from impact_records where project_id = $1 order by id asc`,
          [id],
        ),
      ]);

      const location = rowToLocation({
        id: row.location_id,
        name: row.location_name,
        level: row.location_level,
        parent_id: row.location_parent_id,
        country_code: row.location_country_code,
        longitude: row.location_longitude,
        latitude: row.location_latitude,
        metadata: row.location_metadata,
        child_count: row.location_child_count,
        project_count: row.location_project_count,
      });

      return rowToProjectDetail(rowToProjectSummary(row), row, {
        location,
        sources: sources.rows.map((r) => rowToSource(r as Record<string, unknown>)),
        events: events.rows.map((r) => rowToEvent(r as Record<string, unknown>)),
        relations: relations.rows.map((r) => rowToRelation(r as Record<string, unknown>)),
        statusHistory: history.rows.map((r) => rowToStatusHistoryEntry(r as Record<string, unknown>)),
        impactRecords: impacts.rows.map((r) => rowToImpactRecord(r as Record<string, unknown>)),
      });
    },
  };
}
```

- [ ] **Step 4: Implement the events, relations and stats repositories**

`apps/api/src/repositories/pg/events.ts`:
```ts
import type { Event } from '@atlas/contracts';
import type { PoolLike } from '../../db/types.ts';
import type { EventRepository, EventsQuery } from '../types.ts';
import { rowToEvent } from './mappers.ts';

export function createEventRepository(pool: PoolLike): EventRepository {
  return {
    async list(query: EventsQuery): Promise<Event[]> {
      const conditions: string[] = [];
      const values: unknown[] = [];
      if (query.projectId) {
        values.push(query.projectId);
        conditions.push(`project_id = $${values.length}`);
      }
      if (query.yearFrom !== undefined) {
        values.push(String(query.yearFrom));
        conditions.push(`extract(year from occurred_at) >= $${values.length}`);
      }
      if (query.yearTo !== undefined) {
        values.push(String(query.yearTo));
        conditions.push(`extract(year from occurred_at) <= $${values.length}`);
      }
      const where = conditions.length > 0 ? ` where ${conditions.join(' and ')}` : '';
      const result = await pool.query(
        `select id, project_id, title, occurred_at, kind, description, source_id
           from events${where} order by occurred_at asc, id asc`,
        values,
      );
      return result.rows.map((row) => rowToEvent(row as Record<string, unknown>));
    },
  };
}
```

`apps/api/src/repositories/pg/relations.ts`:
```ts
import type { Relation } from '@atlas/contracts';
import type { PoolLike } from '../../db/types.ts';
import type { RelationRepository } from '../types.ts';
import { rowToRelation } from './mappers.ts';

export function createRelationRepository(pool: PoolLike): RelationRepository {
  return {
    async listByProject(projectId: string): Promise<Relation[]> {
      const result = await pool.query(
        `select r.id, r.from_project, r.to_project, r.type, r.description, r.source_id,
                case when r.from_project = $1 then 'OUTGOING' else 'INCOMING' end as direction
           from relations r
          where r.from_project = $1 or r.to_project = $1
          order by r.type asc, r.id asc`,
        [projectId],
      );
      return result.rows.map((row) => rowToRelation(row as Record<string, unknown>));
    },
  };
}
```

`apps/api/src/repositories/pg/stats.ts`:
```ts
import type { StatsResponse } from '@atlas/contracts';
import type { PoolLike } from '../../db/types.ts';
import type { StatsRepository } from '../types.ts';

function toRecord(rows: unknown[]): Record<string, number> {
  const output: Record<string, number> = {};
  for (const row of rows) {
    const entry = row as { key: string; count: number };
    output[entry.key] = Number(entry.count);
  }
  return output;
}

export function createStatsRepository(pool: PoolLike): StatsRepository {
  return {
    async overview(): Promise<StatsResponse> {
      const [totals, byEvidence, byType, byStatus] = await Promise.all([
        pool.query(
          `select
             (select count(*)::int from projects) as projects,
             (select count(*)::int from locations) as locations,
             (select count(*)::int from sources) as sources`,
        ),
        pool.query(`select evidence as key, count(*)::int as count from projects group by evidence order by key`),
        pool.query(`select type as key, count(*)::int as count from projects group by type order by key`),
        pool.query(`select status as key, count(*)::int as count from projects group by status order by key`),
      ]);
      const row = totals.rows[0] as { projects: number; locations: number; sources: number };
      return {
        totals: {
          projects: Number(row.projects),
          locations: Number(row.locations),
          sources: Number(row.sources),
        },
        byEvidence: toRecord(byEvidence.rows),
        byType: toRecord(byType.rows),
        byStatus: toRecord(byStatus.rows),
      };
    },
  };
}
```

- [ ] **Step 5: Implement the repository bundle**

`apps/api/src/repositories/pg/index.ts`:
```ts
import type { PoolLike } from '../../db/types.ts';
import type { AtlasRepositories } from '../types.ts';
import { createEventRepository } from './events.ts';
import { createLocationRepository } from './locations.ts';
import { createProjectRepository } from './projects.ts';
import { createRelationRepository } from './relations.ts';
import { createStatsRepository } from './stats.ts';

export function createPgRepositories(pool: PoolLike): AtlasRepositories {
  return {
    locations: createLocationRepository(pool),
    projects: createProjectRepository(pool),
    events: createEventRepository(pool),
    relations: createRelationRepository(pool),
    stats: createStatsRepository(pool),
    health: {
      async ping() {
        try {
          const result = await pool.query('select 1 as ok');
          return (result.rows[0] as { ok: number }).ok === 1;
        } catch {
          return false;
        }
      },
    },
  };
}
```

- [ ] **Step 6: Typecheck the API and resolve the `server.ts` gap**

Run: `npm run typecheck --workspace @atlas/api`
Expected: PASS. If it still fails on `createPgRepositories`, confirm the import path in `src/server.ts` is `../repositories/pg/index.js` from `src/db/`. It is imported in `server.ts` as `'./repositories/pg/index.js'`.

- [ ] **Step 7: Write the database integration test that skips without `TEST_DATABASE_URL`**

`apps/api/test/pg.integration.test.ts`:
```ts
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { closePool, createPool } from '../src/db/pool.ts';
import { runMigrations } from '../src/db/migrate.ts';
import { runSeed } from '../src/db/seed.ts';
import { createPgRepositories } from '../src/repositories/pg/index.ts';
import type { PoolLike } from '../src/db/types.ts';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  // eslint-disable-next-line no-console
  console.warn('skipped: db integration (TEST_DATABASE_URL is not set)');
}

describe.skipIf(!testDatabaseUrl)('postgres repositories', () => {
  let pool: PoolLike;
  const repos = () => createPgRepositories(pool);
  const migrationsDir = fileURLToPath(new URL('../migrations', import.meta.url));
  const seedFile = fileURLToPath(new URL('../seeds/001_core_seed.sql', import.meta.url));

  beforeAll(async () => {
    pool = createPool(testDatabaseUrl as string);
    await runMigrations({ pool, migrationsDir });
    await runSeed({ pool, seedFile });
  });

  afterAll(async () => {
    if (pool) await closePool(pool);
  });

  it('seeds eleven locations covering the six levels', async () => {
    const all = await repos().locations.all();
    expect(all).toHaveLength(11);
    expect(new Set(all.map((l) => l.level)).size).toBe(6);
  });

  it('seeds five projects and no relations', async () => {
    const page = await repos().projects.list({ page: 1, pageSize: 50, sort: 'name' });
    expect(page.total).toBe(5);
    const relations = await repos().relations.listByProject('eu-ai-factories');
    expect(relations).toEqual([]);
  });

  it('falls back to the location centroid when project geometry is null', async () => {
    const detail = await repos().projects.findById('chile-national-ai-policy');
    expect(detail?.geometrySource).toBe('location');
    expect(detail?.longitude).toBeCloseTo(-71.5, 3);
  });

  it('finds the project whose own geometry is set', async () => {
    const detail = await repos().projects.findById('pucv-fondecyt-fuzzy');
    expect(detail?.geometrySource).toBe('project');
  });

  it('returns sources, events and status history in the detail payload', async () => {
    const detail = await repos().projects.findById('chile-national-ai-policy');
    expect(detail?.sources.length).toBeGreaterThanOrEqual(1);
    expect(detail?.events.length).toBe(2);
    expect(detail?.statusHistory.length).toBeGreaterThanOrEqual(1);
  });

  it('expands a parent location into its descendants', async () => {
    const ids = await repos().locations.descendantIds('chile');
    expect(ids).toEqual(expect.arrayContaining(['chile', 'vina-del-mar', 'pucv-campus']));
  });

  it('matches accented and unaccented search through the tsvector index', async () => {
    const accented = await repos().projects.list({ page: 1, pageSize: 50, sort: 'name', q: 'politica' });
    const unaccented = await repos().projects.list({ page: 1, pageSize: 50, sort: 'name', q: 'politica'.normalize('NFD').replace(/[\u0300-\u036f]/g, '') });
    expect(accented.total).toBe(1);
    expect(unaccented.total).toBe(1);
  });

  it('filters by type and status with AND across parameters', async () => {
    const page = await repos().projects.list({
      page: 1,
      pageSize: 50,
      sort: 'name',
      type: ['INFRASTRUCTURE'],
      status: ['DEPLOYING'],
    });
    expect(page.data.map((p) => p.id)).toEqual(['eu-ai-factories']);
  });

  it('paginates with a stable total', async () => {
    const first = await repos().projects.list({ page: 1, pageSize: 2, sort: 'name' });
    const second = await repos().projects.list({ page: 2, pageSize: 2, sort: 'name' });
    expect(first.total).toBe(5);
    expect(first.totalPages).toBe(3);
    expect(first.data).toHaveLength(2);
    expect(second.data).toHaveLength(2);
  });

  it('rejects an unknown project id with null instead of throwing', async () => {
    const detail = await repos().projects.findById(`missing-${randomUUID()}`);
    expect(detail).toBeNull();
  });

  it('reports global totals without filters', async () => {
    const stats = await repos().stats.overview();
    expect(stats.totals).toEqual({ projects: 5, locations: 11, sources: 7 });
    expect(stats.byEvidence).toEqual({ ANNOUNCED: 1, REPORTED: 4 });
  });
});
```

- [ ] **Step 8: Run the API suite and confirm the local result is the documented skip**

Run: `npx vitest run --project api`
Expected locally (no Docker): PASS for all unit suites, the `pg.integration.test.ts` file reports `skipped: db integration (TEST_DATABASE_URL is not set)`, and the exit code is 0. Verify the skip line appears in stdout — if the file is silently dropped instead of announcing itself, fix the `console.warn` in the guard.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(api): add postgres repositories with tsvector search and recursive hierarchy"
```

---

## Phase 2 — API surface

### Task 7: Query contracts and read-only routes

**Files:**
- Create: `apps/api/src/schemas/query.ts`, `apps/api/src/schemas/query.test.ts`, `apps/api/src/routes/locations.ts`, `apps/api/src/routes/projects.ts`, `apps/api/src/routes/events.ts`, `apps/api/src/routes/relations.ts`, `apps/api/src/routes/stats.ts`, `apps/api/src/routes/index.ts`, `apps/api/test/routes.test.ts`
- Modify: `apps/api/src/app.ts` (mount `createApiRouter`)

**Interfaces:**
- Consumes: `AtlasRepositories` and query types (Task 5), `HttpError` (Task 5), `@atlas/contracts` (Task 2).
- Produces:
  - `parseListParam<T>(item: ZodType<T>): ZodOptional<ZodArray<ZodType<T>>>` — accepts repeated params and comma-separated values, yielding a deduplicated list.
  - `locationsQuerySchema`, `projectsQuerySchema`, `eventsQuerySchema`, `relationsQuerySchema` (Zod objects over the flattened query record).
  - `flattenQuery(raw: unknown): Record<string, string | string[]>` — converts Express `req.query` into strings/arrays and drops nested objects.
  - `parseOr<Output>(schema: ZodType<Output, ZodTypeDef, unknown>, raw: unknown, name: string): Output` — throws `HttpError.badRequest([{ param, issues }])` on failure. The schema parameter pins the Zod input to `unknown` so that `Output` is the only inference site: writing `parseOr<T>(schema: ZodType<T>, ...): T` compiles, but `ZodType` declares both `_input` and `_output`, so `T` resolves to the input and every `.default()`/`.coerce()`/`z.preprocess()` field comes back optional or `unknown`.
  - `createApiRouter(repos: AtlasRepositories): Router` mounting every v1 route.
  - Routes registered by `app.ts`: `/api/health`, `/api/locations`, `/api/projects`, `/api/projects/:id`, `/api/events`, `/api/relations`, `/api/stats`. No write route.

- [ ] **Step 1: Write the failing query-schema test**

`apps/api/src/schemas/query.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import {
  eventsQuerySchema,
  flattenQuery,
  locationsQuerySchema,
  parseListParam,
  parseOr,
  projectsQuerySchema,
  relationsQuerySchema,
} from './query.ts';
import { HttpError } from '../errors/HttpError.ts';
import type { EventsQuery, LocationsQuery, ProjectsQuery } from '../repositories/types.ts';
import type { EvidenceLevel, ProjectStatus, ProjectType } from '@atlas/contracts';
import { evidenceSchema, projectStatusSchema, projectTypeSchema } from '@atlas/contracts';
import { z } from 'zod';

describe('flattenQuery', () => {
  it('keeps repeated params as arrays and drops nested objects', () => {
    const flat = flattenQuery({ type: ['POLICY', 'RESEARCH'], page: '2', weird: { a: 1 } });
    expect(flat).toEqual({ type: ['POLICY', 'RESEARCH'], page: '2' });
  });

  it('unwraps single string values', () => {
    expect(flattenQuery({ q: 'ia' })).toEqual({ q: 'ia' });
  });
});

describe('parseListParam', () => {
  const schema = parseListParam(projectTypeSchema);

  it('accepts a repeated parameter', () => {
    expect(schema.parse(['POLICY', 'RESEARCH'])).toEqual(['POLICY', 'RESEARCH']);
  });

  it('accepts comma separated values', () => {
    expect(schema.parse('POLICY,RESEARCH')).toEqual(['POLICY', 'RESEARCH']);
  });

  it('deduplicates and trims', () => {
    expect(schema.parse([' POLICY , RESEARCH ', 'POLICY'])).toEqual(['POLICY', 'RESEARCH']);
  });

  it('rejects values outside the closed vocabulary', () => {
    expect(schema.safeParse(['ROCKET']).success).toBe(false);
  });

  it('is optional and empty values collapse to undefined', () => {
    expect(schema.parse(undefined)).toBeUndefined();
    expect(schema.parse([])).toBeUndefined();
  });
});

describe('projectsQuerySchema', () => {
  const base = { page: '1', pageSize: '50', sort: 'name' };

  it('defaults to page 1, pageSize 50 and sort publishedAt', () => {
    const parsed = projectsQuerySchema.parse({ page: '1', pageSize: '50', sort: 'publishedAt' });
    expect(parsed).toEqual({ page: 1, pageSize: 50, sort: 'publishedAt' });
  });

  it('rejects pageSize above 200', () => {
    expect(projectsQuerySchema.safeParse({ ...base, pageSize: '201' }).success).toBe(false);
  });

  it('rejects page below 1', () => {
    expect(projectsQuerySchema.safeParse({ ...base, page: '0' }).success).toBe(false);
  });

  it('rejects an inverted year range', () => {
    expect(projectsQuerySchema.safeParse({ ...base, yearFrom: '2026', yearTo: '2020' }).success).toBe(false);
  });

  it('parses status and evidence lists together', () => {
    const parsed = projectsQuerySchema.parse({ ...base, status: 'ACTIVE,DEPLOYING', evidence: 'REPORTED' });
    expect(parsed.status).toEqual(['ACTIVE', 'DEPLOYING']);
    expect(parsed.evidence).toEqual(['REPORTED']);
  });

  it('coerces year bounds to numbers', () => {
    const parsed = projectsQuerySchema.parse({ ...base, yearFrom: '2020', yearTo: '2026' });
    expect(parsed.yearFrom).toBe(2020);
    expect(parsed.yearTo).toBe(2026);
  });
});

describe('locationsQuerySchema', () => {
  it('validates the level against the closed vocabulary', () => {
    expect(locationsQuerySchema.safeParse({ page: '1', pageSize: '50', level: 'CITY' }).success).toBe(true);
    expect(locationsQuerySchema.safeParse({ page: '1', pageSize: '50', level: 'TOWN' }).success).toBe(false);
  });
});

describe('parseOr', () => {
  // The type annotations below are the assertion, not decoration. `parseOr` used to
  // be declared `parseOr<T>(schema: z.ZodType<T>, ...): T`. That compiles, but
  // resolves `T` to the schema INPUT type: ZodType declares both `_input` and
  // `_output`, so when they differ TypeScript gathers candidates for `T` from both
  // and keeps the best common supertype, which is always the input. Every schema
  // here uses `.default()`, `.coerce()` or `z.preprocess()`, so the input really is
  // wider: `page?: number` instead of a guaranteed `page: number`, and `unknown`
  // instead of a closed vocabulary. The routes then cannot hand the result to a
  // repository. `npm run typecheck` compiles this file, so the guard is enforced
  // rather than merely documented.
  it('returns the validated output with pagination defaults applied', () => {
    const locations: LocationsQuery = parseOr(locationsQuerySchema, {}, 'locations');
    const projects: ProjectsQuery = parseOr(projectsQuerySchema, {}, 'projects');
    const events: EventsQuery = parseOr(eventsQuerySchema, {}, 'events');
    const relations = parseOr(relationsQuerySchema, { projectId: 'eu-ai-factories' }, 'relations');

    expect(locations).toEqual({ page: 1, pageSize: 50 });
    expect(projects).toEqual({ page: 1, pageSize: 50, sort: 'publishedAt' });
    expect(events).toEqual({});
    expect(relations).toEqual({ projectId: 'eu-ai-factories' });
  });

  it('keeps each closed vocabulary as its enum array instead of unknown', () => {
    const parsed = parseOr(
      projectsQuerySchema,
      { type: 'POLICY,RESEARCH', status: ['ACTIVE'], evidence: 'REPORTED' },
      'projects',
    );
    const type: ProjectType[] | undefined = parsed.type;
    const status: ProjectStatus[] | undefined = parsed.status;
    const evidence: EvidenceLevel[] | undefined = parsed.evidence;

    expect(type).toEqual(['POLICY', 'RESEARCH']);
    expect(status).toEqual(['ACTIVE']);
    expect(evidence).toEqual(['REPORTED']);
  });

  it('throws a 400 HttpError that names the parameter and its issues', () => {
    const attempt = () => parseOr(projectsQuerySchema, { pageSize: '500' }, 'projects');
    expect(attempt).toThrowError(HttpError);

    let details: unknown = 'parseOr did not throw';
    try {
      attempt();
    } catch (error) {
      if (error instanceof HttpError) details = error.details;
    }
    expect(details).toEqual([
      { param: 'projects', issues: [{ path: 'pageSize', message: expect.any(String) }] },
    ]);
  });
});
```

- [ ] **Step 2: Run it and confirm failure**

Run: `npx vitest run --project api apps/api/src/schemas/query.test.ts`
Expected: FAIL — `Failed to resolve import "./query.ts"`.

- [ ] **Step 3: Implement `src/schemas/query.ts`**

```ts
import {
  evidenceSchema,
  locationLevelSchema,
  projectStatusSchema,
  projectTypeSchema,
} from '@atlas/contracts';
import type { z } from 'zod';
import { z as zod } from 'zod';
import { HttpError } from '../errors/HttpError.ts';

export function flattenQuery(raw: unknown): Record<string, string | string[]> {
  if (typeof raw !== 'object' || raw === null) return {};
  const output: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      const items = value.filter((item): item is string => typeof item === 'string');
      if (items.length > 0) output[key] = items;
      continue;
    }
    if (typeof value === 'string') {
      output[key] = value;
      continue;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      output[key] = String(value);
    }
  }
  return output;
}

export function parseListParam<T>(item: z.ZodType<T>) {
  return zod.preprocess((value) => {
    if (value === undefined || value === null) return undefined;
    const raw = Array.isArray(value) ? value : [value];
    const items = raw
      .flatMap((entry) => String(entry).split(','))
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    return items.length > 0 ? [...new Set(items)] : undefined;
  }, zod.array(item).min(1).optional());
}

const pagination = {
  page: zod.coerce.number().int().min(1).default(1),
  pageSize: zod.coerce.number().int().min(1).max(200).default(50),
};

const yearBound = zod.coerce.number().int().min(1900).max(2100);

export const locationsQuerySchema = zod.object({
  ...pagination,
  parentId: zod.string().min(1).optional(),
  level: locationLevelSchema.optional(),
});

export const projectsQuerySchema = zod
  .object({
    ...pagination,
    q: zod.string().trim().min(1).max(200).optional(),
    type: parseListParam(projectTypeSchema),
    status: parseListParam(projectStatusSchema),
    evidence: parseListParam(evidenceSchema),
    sector: zod.string().trim().min(1).max(120).optional(),
    locationId: zod.string().trim().min(1).max(120).optional(),
    yearFrom: yearBound.optional(),
    yearTo: yearBound.optional(),
    sort: zod.enum(['publishedAt', 'name']).default('publishedAt'),
  })
  .refine(
    (value) => value.yearFrom === undefined || value.yearTo === undefined || value.yearFrom <= value.yearTo,
    { message: 'yearFrom must not be greater than yearTo', path: ['yearFrom'] },
  );

export const eventsQuerySchema = zod.object({
  projectId: zod.string().trim().min(1).max(120).optional(),
  yearFrom: yearBound.optional(),
  yearTo: yearBound.optional(),
});

export const relationsQuerySchema = zod.object({
  projectId: zod.string().trim().min(1).max(120),
});

/**
 * Parse `raw` and return the validated output, or throw a 400 naming `param`.
 *
 * The schema parameter pins Zod's *input* type to `unknown` on purpose. The obvious
 * `parseOr<T>(schema: z.ZodType<T>, ...): T` compiles, but `ZodType` declares both
 * `_input` and `_output`, so `T` is inferred from both and resolves to the input,
 * which is always the wider of the two. Since every schema here uses `.default()`,
 * `.coerce()` or `z.preprocess()`, callers then received `page?: number` and
 * `type?: unknown` instead of the validated output. Pinning the input to `unknown`
 * leaves the output as the only inference site, and keeps `result.data` precise
 * rather than `any`.
 */
export function parseOr<Output>(
  schema: z.ZodType<Output, z.ZodTypeDef, unknown>,
  raw: unknown,
  param: string,
): Output {
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw HttpError.badRequest([
      {
        param,
        issues: result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
    ]);
  }
  return result.data;
}
```

- [ ] **Step 4: Run the query test and confirm it passes**

Run: `npx vitest run --project api apps/api/src/schemas/query.test.ts`
Expected: PASS, 19 tests. If the `projectStatusSchema`/`evidenceSchema` import is reported as missing from `@atlas/contracts`, run `npm run build --workspace @atlas/contracts` first.

- [ ] **Step 5: Implement the routes**

`apps/api/src/routes/locations.ts`:
```ts
import { Router } from 'express';
import type { AtlasRepositories } from '../repositories/types.ts';
import { flattenQuery, locationsQuerySchema, parseOr } from '../schemas/query.ts';

export function createLocationsRoute(repos: AtlasRepositories): Router {
  const router = Router();
  router.get('/locations', async (req, res) => {
    const query = parseOr(locationsQuerySchema, flattenQuery(req.query), 'locations');
    res.json(await repos.locations.list(query));
  });
  return router;
}
```

`apps/api/src/routes/projects.ts`:
```ts
import { Router } from 'express';
import { HttpError } from '../errors/HttpError.ts';
import type { AtlasRepositories } from '../repositories/types.ts';
import { flattenQuery, parseOr, projectsQuerySchema } from '../schemas/query.ts';

export function createProjectsRoute(repos: AtlasRepositories): Router {
  const router = Router();

  router.get('/projects', async (req, res) => {
    const query = parseOr(projectsQuerySchema, flattenQuery(req.query), 'projects');
    const locationIds = query.locationId
      ? await repos.locations.descendantIds(query.locationId)
      : undefined;
    const { locationId: _locationId, ...rest } = query;
    res.json(await repos.projects.list({ ...rest, locationIds }));
  });

  router.get('/projects/:id', async (req, res) => {
    const detail = await repos.projects.findById(req.params.id);
    if (!detail) throw HttpError.notFound(`No project with id ${req.params.id}`);
    res.json({ data: detail });
  });

  return router;
}
```

`apps/api/src/routes/events.ts`:
```ts
import { Router } from 'express';
import type { AtlasRepositories } from '../repositories/types.ts';
import { eventsQuerySchema, flattenQuery, parseOr } from '../schemas/query.ts';

export function createEventsRoute(repos: AtlasRepositories): Router {
  const router = Router();
  router.get('/events', async (req, res) => {
    const query = parseOr(eventsQuerySchema, flattenQuery(req.query), 'events');
    const data = await repos.events.list(query);
    res.json({ data, count: data.length });
  });
  return router;
}
```

`apps/api/src/routes/relations.ts`:
```ts
import { Router } from 'express';
import type { AtlasRepositories } from '../repositories/types.ts';
import { flattenQuery, parseOr, relationsQuerySchema } from '../schemas/query.ts';

export function createRelationsRoute(repos: AtlasRepositories): Router {
  const router = Router();
  router.get('/relations', async (req, res) => {
    const query = parseOr(relationsQuerySchema, flattenQuery(req.query), 'relations');
    const data = await repos.relations.listByProject(query.projectId);
    res.json({ data, count: data.length });
  });
  return router;
}
```

`apps/api/src/routes/stats.ts`:
```ts
import { Router } from 'express';
import type { AtlasRepositories } from '../repositories/types.ts';

export function createStatsRoute(repos: AtlasRepositories): Router {
  const router = Router();
  router.get('/stats', async (_req, res) => {
    res.json(await repos.stats.overview());
  });
  return router;
}
```

`apps/api/src/routes/index.ts`:
```ts
import { Router } from 'express';
import type { AtlasRepositories } from '../repositories/types.ts';
import { createEventsRoute } from './events.ts';
import { createLocationsRoute } from './locations.ts';
import { createProjectsRoute } from './projects.ts';
import { createRelationsRoute } from './relations.ts';
import { createStatsRoute } from './stats.ts';

export function createApiRouter(repos: AtlasRepositories): Router {
  const router = Router();
  router.use(createLocationsRoute(repos));
  router.use(createProjectsRoute(repos));
  router.use(createEventsRoute(repos));
  router.use(createRelationsRoute(repos));
  router.use(createStatsRoute(repos));
  return router;
}
```

- [ ] **Step 6: Mount the router in `app.ts`**

Replace the single `app.get('/api/health', ...)` block in `apps/api/src/app.ts` with the health route kept as-is plus `app.use('/api', createApiRouter(repos));` placed immediately after it. The final section of `app.ts` must read:

```ts
  app.get('/api/health', async (_req, res) => {
    const databaseUp = await repos.health.ping();
    res.status(200).json({
      status: databaseUp ? 'ok' : 'degraded',
      api: 'atlas-api',
      database: databaseUp ? 'up' : 'down',
      version,
      time: new Date().toISOString(),
    });
  });

  app.use('/api', createApiRouter(repos));

  app.use(notFoundHandler);
  app.use(errorHandler(logger));
  return app;
```

Add the import at the top of `app.ts`:
```ts
import { createApiRouter } from './routes/index.ts';
```

- [ ] **Step 7: Write the failing route test**

`apps/api/test/routes.test.ts`:
```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.ts';
import { loadEnv } from '../src/config/env.ts';
import { createFakeRepositories } from '../src/repositories/fake.ts';
import { atlasDataFixture } from '../src/testing/fixtures.ts';
import { locationsQuerySchema, projectsQuerySchema, statsResponseSchema, projectDetailSchema } from '@atlas/contracts';

const env = loadEnv({
  NODE_ENV: 'test',
  PORT: '8787',
  DATABASE_URL: 'postgres://atlas:atlas@127.0.0.1:5432/aiworldatlas',
  CORS_ORIGIN: 'http://localhost:5173,https://atlas.example',
} as NodeJS.ProcessEnv);

const logger = { debug() {}, info() {}, warn() {}, error() {} };
const app = buildApp({ repos: createFakeRepositories(atlasDataFixture), env, logger });

describe('GET /api/locations', () => {
  it('returns a paginated envelope that matches the contract', async () => {
    const response = await request(app).get('/api/locations?page=1&pageSize=5');
    expect(response.status).toBe(200);
    expect(Object.keys(response.body).sort()).toEqual(['data', 'page', 'pageSize', 'total', 'totalPages']);
    expect(response.body.total).toBe(11);
  });

  it('filters by level', async () => {
    const response = await request(app).get('/api/locations?level=LOCAL_AREA');
    expect(response.body.data.map((l: { id: string }) => l.id)).toEqual(['pucv-campus']);
  });

  it('rejects an unknown level with a 400 envelope', async () => {
    const response = await request(app).get('/api/locations?level=TOWN');
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.requestId).toBe(response.headers['x-request-id']);
  });
});

describe('GET /api/projects', () => {
  it('returns a paginated envelope and the seeded total', async () => {
    const response = await request(app).get('/api/projects');
    expect(response.body.total).toBe(5);
    expect(response.body.pageSize).toBe(50);
  });

  it('combines repeated type params with OR and status with AND', async () => {
    const response = await request(app).get('/api/projects?type=POLICY&type=INFRASTRUCTURE&status=DEPLOYING');
    expect(response.body.data.map((p: { id: string }) => p.id)).toEqual(['eu-ai-factories']);
  });

  it('accepts comma separated type values', async () => {
    const response = await request(app).get('/api/projects?type=POLICY,INFRASTRUCTURE');
    expect(response.body.total).toBe(3);
  });

  it('expands a parent location into its descendants', async () => {
    const response = await request(app).get('/api/projects?locationId=valparaiso-region');
    expect(response.body.data.map((p: { id: string }) => p.id)).toEqual(['pucv-fondecyt-fuzzy']);
  });

  it('searches with accents and without them', async () => {
    const accented = await request(app).get('/api/projects?q=politica');
    const plain = await request(app).get('/api/projects?q=politica');
    expect(accented.body.total).toBe(1);
    expect(plain.body.total).toBe(1);
  });

  it('paginates with a stable total', async () => {
    const first = await request(app).get('/api/projects?page=1&pageSize=2&sort=name');
    const second = await request(app).get('/api/projects?page=2&pageSize=2&sort=name');
    expect(first.body.total).toBe(5);
    expect(first.body.totalPages).toBe(3);
    expect(second.body.page).toBe(2);
  });

  it('rejects pageSize above 200', async () => {
    const response = await request(app).get('/api/projects?pageSize=500');
    expect(response.status).toBe(400);
  });
});

describe('GET /api/projects/:id', () => {
  it('returns a contract-valid detail payload', async () => {
    const response = await request(app).get('/api/projects/chile-national-ai-policy');
    expect(response.status).toBe(200);
    const parsed = projectDetailSchema.parse(response.body.data);
    expect(parsed.id).toBe('chile-national-ai-policy');
    expect(parsed.sources.length).toBeGreaterThan(0);
    expect(parsed.events.length).toBe(2);
    expect(parsed.statusHistory.length).toBeGreaterThan(0);
  });

  it('answers 404 for an unknown id', async () => {
    const response = await request(app).get('/api/projects/nope');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});

describe('GET /api/events and /api/relations', () => {
  it('returns events with a count', async () => {
    const response = await request(app).get('/api/events?projectId=chile-national-ai-policy');
    expect(response.body.count).toBe(2);
  });

  it('returns an empty relations list without inventing data', async () => {
    const response = await request(app).get('/api/relations?projectId=eu-ai-factories');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: [], count: 0 });
  });

  it('requires projectId on relations', async () => {
    const response = await request(app).get('/api/relations');
    expect(response.status).toBe(400);
  });
});

describe('GET /api/stats', () => {
  it('returns global totals regardless of filters', async () => {
    const response = await request(app).get('/api/stats');
    const parsed = statsResponseSchema.parse(response.body);
    expect(parsed.totals.projects).toBe(5);
    expect(parsed.totals.locations).toBe(11);
  });
});

describe('write routes', () => {
  it('does not expose POST /api/projects', async () => {
    const response = await request(app).post('/api/projects').send({ id: 'hack' });
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('does not expose PUT, PATCH or DELETE on projects', async () => {
    for (const method of ['put', 'patch', 'delete'] as const) {
      const response = await request(app)[method]('/api/projects/chile-national-ai-policy');
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    }
  });
});

describe('contract drift guard', () => {
  it('keeps the query schemas in sync with the contracts package', () => {
    expect(locationsQuerySchema.safeParse({ page: '1', pageSize: '50' }).success).toBe(true);
    expect(projectsQuerySchema.safeParse({ page: '1', pageSize: '50', sort: 'name' }).success).toBe(true);
  });
});
```

- [ ] **Step 8: Run the route test and confirm it passes**

Run: `npx vitest run --project api apps/api/test/routes.test.ts`
Expected: PASS, 19 tests. If `POST` returns 404 with a JSON body, confirm `notFoundHandler` runs before the error handler; the `HttpError.notFound` path guarantees a body.

- [ ] **Step 9: Run the full API suite and typecheck**

Run: `npx vitest run --project api && npm run typecheck --workspace @atlas/api`
Expected: PASS for every suite plus the documented `skipped: db integration` line, and `tsc --noEmit` clean.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(api): add read-only v1 routes with validated query contracts"
```

---

### Task 8: API security and error-contract tests

**Files:**
- Create: `apps/api/test/security.test.ts`, `apps/api/test/errors.test.ts`

**Interfaces:**
- Consumes: `buildApp` (Tasks 5 and 7), `loadEnv` (Task 5), `createFakeRepositories` (Task 5).
- Produces: no new runtime symbols. This task is the regression net for the P0/P1 findings in spec §1: anonymous writes, wildcard CORS and leaked PostgreSQL messages.

- [ ] **Step 1: Write the security test**

`apps/api/test/security.test.ts`:
```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.ts';
import { loadEnv } from '../src/config/env.ts';
import { createFakeRepositories } from '../src/repositories/fake.ts';
import { atlasDataFixture } from '../src/testing/fixtures.ts';

const logger = { debug() {}, info() {}, warn() {}, error() {} };

function appWith(corsOrigin: string, nodeEnv = 'test') {
  const env = loadEnv({
    NODE_ENV: nodeEnv,
    PORT: '8787',
    DATABASE_URL: 'postgres://atlas:atlas@127.0.0.1:5432/aiworldatlas',
    CORS_ORIGIN: corsOrigin,
  } as NodeJS.ProcessEnv);
  return buildApp({ repos: createFakeRepositories(atlasDataFixture), env, logger });
}

describe('CORS allowlist', () => {
  it('sets the origin header for an allowed origin', async () => {
    const response = await request(appWith('http://localhost:5173,https://atlas.example'))
      .get('/api/health')
      .set('Origin', 'https://atlas.example');
    expect(response.headers['access-control-allow-origin']).toBe('https://atlas.example');
  });

  it('omits the origin header for a rejected origin', async () => {
    const response = await request(appWith('http://localhost:5173'))
      .get('/api/health')
      .set('Origin', 'https://evil.example');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('refuses a wildcard origin in production', async () => {
    const response = await request(appWith('*', 'production'))
      .get('/api/health')
      .set('Origin', 'https://anything.example');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('honours a wildcard only in development', async () => {
    const response = await request(appWith('*', 'development'))
      .get('/api/health')
      .set('Origin', 'https://anything.example');
    expect(response.headers['access-control-allow-origin']).toBe('*');
  });

  it('never advertises write methods', async () => {
    const response = await request(appWith('http://localhost:5173')).options('/api/projects');
    expect(response.headers['access-control-allow-methods']).toBeDefined();
    expect(String(response.headers['access-control-allow-methods'])).not.toContain('POST');
  });
});

describe('security headers', () => {
  it('sets helmet headers and hides the framework', async () => {
    const response = await request(appWith('http://localhost:5173')).get('/api/health');
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('body limits', () => {
  it('rejects a body larger than 1mb with a uniform envelope', async () => {
    const response = await request(appWith('http://localhost:5173'))
      .post('/api/projects')
      .set('Content-Type', 'application/json')
      .send({ padding: 'x'.repeat(1_100_000) });
    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(response.body.error.requestId).toBe(response.headers['x-request-id']);
  });
});

describe('anonymous writes', () => {
  it('cannot create a project through any exposed verb', async () => {
    const app = appWith('http://localhost:5173');
    for (const method of ['post', 'put', 'patch', 'delete'] as const) {
      const response = await request(app)[method]('/api/projects').send({ id: 'injected' });
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    }
  });
});
```

- [ ] **Step 2: Write the error-contract test**

`apps/api/test/errors.test.ts`:
```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.ts';
import { loadEnv } from '../src/config/env.ts';
import { createFakeRepositories } from '../src/repositories/fake.ts';
import { atlasDataFixture } from '../src/testing/fixtures.ts';
import { apiErrorSchema } from '@atlas/contracts';

const env = loadEnv({
  NODE_ENV: 'test',
  PORT: '8787',
  DATABASE_URL: 'postgres://atlas:atlas@127.0.0.1:5432/aiworldatlas',
  CORS_ORIGIN: 'http://localhost:5173',
} as NodeJS.ProcessEnv);

function appWithExplodingRepos() {
  const repos = createFakeRepositories(atlasDataFixture);
  repos.projects = {
    list: async () => {
      throw new Error('relation "projects_type_check" violates check constraint');
    },
    findById: async () => {
      throw new Error('ECONNREFUSED 127.0.0.1:5432');
    },
  };
  return buildApp({ repos, env, logger: { debug() {}, info() {}, warn() {}, error() {} } });
}

describe('error contract', () => {
  it('returns INTERNAL_ERROR without leaking the database message', async () => {
    const response = await request(appWithExplodingRepos()).get('/api/projects');
    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe('INTERNAL_ERROR');
    expect(response.body.error.message).toBe('Unexpected server error');
    expect(JSON.stringify(response.body)).not.toContain('check constraint');
    expect(JSON.stringify(response.body)).not.toContain('ECONNREFUSED');
  });

  it('never returns a stack trace', async () => {
    const response = await request(appWithExplodingRepos()).get('/api/projects');
    expect(JSON.stringify(response.body)).not.toContain('at ');
  });

  it('always matches the apiErrorSchema', async () => {
    const responses = await Promise.all([
      request(buildApp({ repos: createFakeRepositories(atlasDataFixture), env, logger: { debug() {}, info() {}, warn() {}, error() {} } })).get('/api/projects/nope'),
      request(buildApp({ repos: createFakeRepositories(atlasDataFixture), env, logger: { debug() {}, info() {}, warn() {}, error() {} } })).get('/api/projects?pageSize=9999'),
      request(appWithExplodingRepos()).get('/api/projects'),
    ]);
    for (const response of responses) {
      expect(apiErrorSchema.safeParse(response.body).success).toBe(true);
    }
  });
});
```

- [ ] **Step 3: Run both tests and fix only real defects**

Run: `npx vitest run --project api apps/api/test/security.test.ts apps/api/test/errors.test.ts`
Expected: PASS, 2 files / 12 tests. The `413` branch already exists in `errorHandler` (Task 5, Step 5), so the body-limit test should pass on the first run.

If any assertion fails, fix the production code — do not weaken the assertion. Every status in this file is pinned to one exact value, because the implementation has a defined answer for each case; a set such as `[400, 404, 405, 413]` would let a wrong implementation pass.

Append this direct unit check to `apps/api/test/errors.test.ts` as well, because `HttpError.internal` is part of the public error surface and is not reachable through the fake repositories:

```ts
import { HttpError } from '../src/errors/HttpError.ts';

it('redacts the cause inside HttpError.internal', () => {
  const error = HttpError.internal(new Error('password authentication failed for user "atlas"'));
  expect(error.status).toBe(500);
  expect(error.code).toBe('INTERNAL_ERROR');
  expect(error.message).toBe('Unexpected server error');
  expect(error.details).toEqual([]);
  expect(JSON.stringify({ message: error.message, code: error.code, status: error.status })).not.toContain('password');
  expect(error.message).not.toContain('password');
});
```

- [ ] **Step 4: Run the full gate set that works without a database**

Run: `npm run lint && npm run typecheck --workspace @atlas/api && npx vitest run --project api`
Expected: all pass, with the single documented `skipped: db integration` line from the PG suite.

- [ ] **Step 5: Commit**

```bash
git add apps/api/test/security.test.ts apps/api/test/errors.test.ts docs/superpowers/plans/2026-09-25-ai-world-atlas-core-navigation.md
git commit -m "test(api): cover cors allowlist anonymous writes and error redaction"
```

---

## Phase 3 — Web foundations

### Task 9: Design tokens, base styles, safe DOM primitives and inline icon set

**Files:**
- Create: `apps/web/src/styles/tokens.css`, `apps/web/src/styles/base.css`, `apps/web/src/styles/layout.css`, `apps/web/src/styles/components.css`, `apps/web/src/ui/dom.ts`, `apps/web/src/ui/dom.test.ts`, `apps/web/src/ui/icons.ts`, `apps/web/src/ui/icons.test.ts`, `apps/web/src/data/urls.ts`, `apps/web/src/data/urls.test.ts`
- Delete: `apps/web/src/main.js`, `apps/web/src/style.css`

**Interfaces:**
- Consumes: nothing (first web task).
- Produces:
  - `el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Attrs, children?: Node[]): HTMLElementTagNameMap[K]`
  - `svgEl(tag: string, attrs?: Attrs, children?: Node[]): SVGElement`
  - `Attrs = Record<string, string | number | boolean | null | undefined>`
  - `clear(node: Element): void`
  - `icon(name: IconName, size?: number): SVGElement` — inline linear SVG, `IconName = 'close' | 'search' | 'play' | 'pause' | 'back' | 'chevron-left' | 'chevron-right' | 'layers' | 'link' | 'target' | 'filter' | 'clock' | 'globe'`
  - `safeExternalUrl(url: string, options?: { allowHttp?: boolean }): string | null` — returns a linkable href or `null`
  - CSS custom properties consumed by every later component: `--color-obsidian`, `--color-ink`, `--color-warm-white`, `--color-electric-blue`, `--color-ultraviolet`, `--color-mint`, `--color-amber`, `--color-ice`, `--color-coral`, `--color-lime`, `--color-lavender`, `--duration-fast`, `--duration-base`, `--duration-slow`, `--ease-atlas`, `--rail-width`, `--drawer-width`, `--header-height`, `--strip-height`
  - Class contract: `.atlas-header`, `.atlas-rail`, `.atlas-map`, `.atlas-drawer`, `.atlas-strip`, `.atlas-drawer[hidden]`, `.atlas-rail[hidden]`, `[data-testid]` hooks used by the E2E suite: `app-root`, `breadcrumb`, `search-input`, `api-status`, `map-mode`, `scale-levels`, `rail-toggle`, `drawer`, `drawer-title`, `drawer-close`, `timeline-year`, `timeline-play`, `timeline-prev`, `timeline-next`, `matching-count`, `global-total`, `fallback`, `fallback-diagnostic`, `project-list`.

- [ ] **Step 1: Write the failing DOM and URL tests**

`apps/web/src/ui/dom.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { clear, el, svgEl } from './dom.ts';

describe('el', () => {
  it('sets attributes and skips null, undefined and false values', () => {
    const node = el('div', { id: 'x', 'aria-hidden': true, hidden: false, title: null, lang: undefined });
    expect(node.id).toBe('x');
    expect(node.hasAttribute('aria-hidden')).toBe(true);
    expect(node.getAttribute('aria-hidden')).toBe('');
    expect(node.hasAttribute('hidden')).toBe(false);
    expect(node.hasAttribute('title')).toBe(false);
  });

  it('inserts children and text without interpreting html', () => {
    const node = el('p', {}, [document.createTextNode('<img src=x onerror=alert(1)>')]);
    expect(node.querySelector('img')).toBeNull();
    expect(node.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('applies dataset entries', () => {
    const node = el('button', { dataset: { testid: 'go' } } as never);
    expect(node.getAttribute('data-testid')).toBe('go');
  });
});

describe('clear', () => {
  it('removes every child node', () => {
    const node = el('div', {}, [el('span'), el('span')]);
    clear(node);
    expect(node.childNodes).toHaveLength(0);
  });
});

describe('svgEl', () => {
  it('creates namespaced svg nodes', () => {
    const node = svgEl('path', { d: 'M0 0 L10 10' });
    expect(node.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(node.getAttribute('d')).toBe('M0 0 L10 10');
  });
});
```

`apps/web/src/data/urls.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { safeExternalUrl } from './urls.ts';

describe('safeExternalUrl', () => {
  it('accepts https', () => {
    expect(safeExternalUrl('https://example.org/a')).toBe('https://example.org/a');
  });

  it('accepts http only when explicitly allowed', () => {
    expect(safeExternalUrl('http://localhost:3000/a', { allowHttp: true })).toBe('http://localhost:3000/a');
    expect(safeExternalUrl('http://example.org/a')).toBeNull();
  });

  it('rejects javascript, data and vbscript schemes', () => {
    expect(safeExternalUrl('javascript:alert(1)')).toBeNull();
    expect(safeExternalUrl('JavaScript:alert(1)')).toBeNull();
    expect(safeExternalUrl('data:text/html,<script>x</script>')).toBeNull();
    expect(safeExternalUrl('vbscript:msgbox(1)')).toBeNull();
  });

  it('rejects relative and malformed values', () => {
    expect(safeExternalUrl('/relative/path')).toBeNull();
    expect(safeExternalUrl('not a url')).toBeNull();
    expect(safeExternalUrl('')).toBeNull();
  });
});
```

- [ ] **Step 2: Run them and confirm failure**

Run: `npx vitest run --project web apps/web/src/ui/dom.test.ts apps/web/src/data/urls.test.ts`
Expected: FAIL — `Failed to resolve import "./dom.ts"` and `./urls.ts`.

- [ ] **Step 3: Implement `src/ui/dom.ts`**

```ts
export type Attrs = Record<string, string | number | boolean | null | undefined>;

function applyAttrs(node: Element, attrs?: Attrs): void {
  if (!attrs) return;
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'dataset') {
      for (const [dataKey, dataValue] of Object.entries(value as Record<string, string>)) {
        node.setAttribute(`data-${dataKey}`, dataValue);
      }
      continue;
    }
    if (key === 'text') {
      node.textContent = String(value);
      continue;
    }
    node.setAttribute(key, value === true ? '' : String(value));
  }
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Attrs,
  children: Node[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  applyAttrs(node, attrs);
  for (const child of children) node.append(child);
  return node;
}

export function svgEl(tag: string, attrs?: Attrs, children: Node[] = []): SVGElement {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (value === null || value === undefined || value === false) continue;
      node.setAttribute(key, value === true ? '' : String(value));
    }
  }
  for (const child of children) node.append(child);
  return node;
}

export function clear(node: Element): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function replaceChildren(node: Element, children: Node[]): void {
  clear(node);
  for (const child of children) node.append(child);
}
```

- [ ] **Step 4: Implement `src/data/urls.ts`**

```ts
export interface SafeUrlOptions {
  allowHttp?: boolean;
}

export function safeExternalUrl(url: string, options: SafeUrlOptions = {}): string | null {
  const candidate = url.trim();
  if (candidate.length === 0) return null;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }
  if (parsed.protocol === 'https:') return parsed.toString();
  if (parsed.protocol === 'http:' && options.allowHttp === true) return parsed.toString();
  return null;
}
```

- [ ] **Step 5: Implement `src/ui/icons.ts`**

```ts
import { svgEl } from './dom.ts';

export type IconName =
  | 'close'
  | 'search'
  | 'play'
  | 'pause'
  | 'back'
  | 'chevron-left'
  | 'chevron-right'
  | 'layers'
  | 'link'
  | 'target'
  | 'filter'
  | 'clock'
  | 'globe';

const PATHS: Record<IconName, string[]> = {
  close: ['M4 4 L20 20', 'M20 4 L4 20'],
  search: ['M4 12 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0', 'M16 16 L21 21'],
  play: ['M8 5 L19 12 L8 19 Z'],
  pause: ['M9 5 L9 19', 'M15 5 L15 19'],
  back: ['M14 5 L7 12 L14 19', 'M7 12 L21 12'],
  'chevron-left': ['M14 5 L7 12 L14 19'],
  'chevron-right': ['M10 5 L17 12 L10 19'],
  layers: ['M12 3 L21 8 L12 13 L3 8 Z', 'M3 12 L12 17 L21 12', 'M3 16 L12 21 L21 16'],
  link: ['M10 14 a4 4 0 0 0 6 0 l3 -3 a4 4 0 0 0 -6 -6 l-1 1', 'M14 10 a4 4 0 0 0 -6 0 l-3 3 a4 4 0 0 0 6 6 l1 -1'],
  target: ['M12 4 a8 8 0 1 0 0 16 a8 8 0 1 0 0 -16', 'M12 2 L12 6', 'M12 18 L12 22', 'M2 12 L6 12', 'M18 12 L22 12'],
  filter: ['M4 6 L20 6', 'M7 12 L17 12', 'M10 18 L14 18'],
  clock: ['M12 4 a8 8 0 1 0 0 16 a8 8 0 1 0 0 -16', 'M12 8 L12 12 L15 14'],
  globe: ['M12 3 a9 9 0 1 0 0 18 a9 9 0 1 0 0 -18', 'M3 12 L21 12', 'M12 3 a14 7 0 0 0 0 18 a14 7 0 0 0 0 -18'],
};

export function icon(name: IconName, size = 16): SVGElement {
  const svg = svgEl('svg', {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '1.25',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
    focusable: 'false',
  });
  for (const d of PATHS[name]) {
    svg.append(svgEl('path', { d }));
  }
  return svg;
}
```

- [ ] **Step 6: Write the failing icon test**

`apps/web/src/ui/icons.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { icon } from './icons.ts';
import type { IconName } from './icons.ts';

const names: IconName[] = [
  'close', 'search', 'play', 'pause', 'back', 'chevron-left', 'chevron-right',
  'layers', 'link', 'target', 'filter', 'clock', 'globe',
];

describe('icon', () => {
  it('renders a decorative namespaced svg with no text content', () => {
    const svg = icon('search', 20);
    expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.textContent).toBe('');
    expect(svg.childNodes.length).toBeGreaterThan(0);
  });

  it('covers every declared icon name', () => {
    for (const name of names) {
      expect(icon(name).childNodes.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 7: Run the web unit tests and confirm they pass**

Run: `npx vitest run --project web apps/web/src/ui apps/web/src/data`
Expected: PASS, 3 files / 11 tests.

- [ ] **Step 8: Write the four stylesheets**

`apps/web/src/styles/tokens.css`:
```css
:root {
  --color-obsidian: #08090c;
  --color-ink: #11141a;
  --color-warm-white: #e9e6df;
  --color-electric-blue: #4b8cff;
  --color-ultraviolet: #8567ff;
  --color-mint: #70d6b2;
  --color-amber: #e5a84b;
  --color-ice: #70c8e8;
  --color-coral: #e47c71;
  --color-lime: #a9d66f;
  --color-lavender: #b59aff;

  --color-ink-raised: #171b23;
  --color-line: #232936;
  --color-line-strong: #313848;
  --color-text-dim: #9aa3b2;
  --color-text-faint: #6b7484;

  --duration-fast: 160ms;
  --duration-base: 280ms;
  --duration-slow: 420ms;
  --ease-atlas: cubic-bezier(0.22, 0.61, 0.36, 1);

  --header-height: 56px;
  --strip-height: 132px;
  --rail-width: 320px;
  --drawer-width: 400px;

  --font-ui: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
  --font-serif: 'Iowan Old Style', 'Palatino Linotype', 'Georgia', serif;

  color-scheme: dark;
}
```

`apps/web/src/styles/base.css`:
```css
*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body {
  height: 100%;
  margin: 0;
}

body {
  background: var(--color-obsidian);
  color: var(--color-warm-white);
  font-family: var(--font-ui);
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

#app {
  height: 100%;
}

h1,
h2,
h3 {
  margin: 0;
  font-weight: 500;
  letter-spacing: -0.01em;
}

p {
  margin: 0 0 0.75em;
}

a {
  color: var(--color-electric-blue);
  text-decoration-color: rgb(75 140 255 / 40%);
  text-underline-offset: 2px;
}

button {
  font: inherit;
  color: inherit;
  background: none;
  border: none;
  cursor: pointer;
}

:focus-visible {
  outline: 2px solid var(--color-electric-blue);
  outline-offset: 2px;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
    scroll-behavior: auto !important;
  }
}
```

`apps/web/src/styles/layout.css`:
```css
.atlas {
  display: grid;
  grid-template-rows: var(--header-height) 1fr var(--strip-height);
  grid-template-columns: auto 1fr auto;
  grid-template-areas:
    'header header header'
    'rail   map    drawer'
    'strip  strip  strip';
  height: 100%;
  background: var(--color-obsidian);
}

.atlas-header {
  grid-area: header;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 16px;
  border-bottom: 1px solid var(--color-line);
  background: var(--color-ink);
}

.atlas-rail {
  grid-area: rail;
  width: var(--rail-width);
  overflow-y: auto;
  border-right: 1px solid var(--color-line);
  background: var(--color-ink);
  transition: transform var(--duration-base) var(--ease-atlas);
}

.atlas-rail[hidden] {
  display: none;
}

.atlas-map {
  grid-area: map;
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.atlas-drawer {
  grid-area: drawer;
  width: var(--drawer-width);
  overflow-y: auto;
  border-left: 1px solid var(--color-line);
  background: var(--color-ink);
  transition: transform var(--duration-base) var(--ease-atlas);
}

.atlas-drawer[hidden] {
  display: none;
}

.atlas-strip {
  grid-area: strip;
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 24px;
  padding: 12px 16px;
  border-top: 1px solid var(--color-line);
  background: var(--color-ink);
}

@media (min-width: 1100px) {
  .atlas:not(:has(.atlas-drawer[hidden])) {
    grid-template-columns: auto 1fr var(--drawer-width);
  }
}

@media (max-width: 1099px) {
  .atlas {
    grid-template-columns: 1fr;
    grid-template-areas:
      'header'
      'map'
      'strip';
  }

  .atlas-rail {
    position: absolute;
    top: var(--header-height);
    bottom: var(--strip-height);
    left: 0;
    z-index: 20;
    width: min(320px, 85vw);
  }

  .atlas-drawer {
    position: absolute;
    top: var(--header-height);
    bottom: var(--strip-height);
    right: 0;
    z-index: 25;
    width: min(360px, 92vw);
  }
}

@media (max-width: 699px) {
  .atlas {
    grid-template-rows: var(--header-height) 1fr auto;
  }

  .atlas-rail {
    top: auto;
    bottom: 0;
    left: 0;
    right: 0;
    width: auto;
    max-height: 55vh;
    border-right: none;
    border-top: 1px solid var(--color-line);
  }

  .atlas-drawer {
    top: auto;
    left: 0;
    right: 0;
    bottom: 0;
    width: auto;
    max-height: 70vh;
    border-left: none;
    border-top: 1px solid var(--color-line);
    border-radius: 12px 12px 0 0;
  }
}
```

`apps/web/src/styles/components.css`:
```css
.wordmark {
  font-family: var(--font-serif);
  font-size: 17px;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--color-text-dim);
  min-width: 0;
}

.breadcrumb button {
  color: var(--color-text-dim);
  padding: 2px 4px;
  border-radius: 4px;
}

.breadcrumb button:hover {
  color: var(--color-warm-white);
}

.breadcrumb [aria-current='true'] {
  color: var(--color-electric-blue);
}

.search {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  padding: 0 10px;
  border: 1px solid var(--color-line);
  border-radius: 6px;
  background: var(--color-obsidian);
  color: var(--color-text-faint);
}

.search input {
  width: 220px;
  padding: 6px 0;
  background: transparent;
  border: none;
  color: var(--color-warm-white);
  font: inherit;
}

.search input:focus {
  outline: none;
}

.search:focus-within {
  border-color: var(--color-line-strong);
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--color-text-dim);
  white-space: nowrap;
}

.status-badge__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-text-faint);
}

.status-badge[data-state='ok'] .status-badge__dot {
  background: var(--color-mint);
}

.status-badge[data-state='error'] .status-badge__dot {
  background: var(--color-coral);
}

.rail-section {
  padding: 16px;
  border-bottom: 1px solid var(--color-line);
}

.rail-section h2 {
  margin-bottom: 10px;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-text-faint);
}

.scale-levels {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.scale-levels button {
  padding: 5px 10px;
  border: 1px solid var(--color-line);
  border-radius: 999px;
  font-size: 11px;
  letter-spacing: 0.08em;
  color: var(--color-text-dim);
  transition: border-color var(--duration-fast) var(--ease-atlas),
    color var(--duration-fast) var(--ease-atlas);
}

.scale-levels button:hover:not(:disabled) {
  border-color: var(--color-line-strong);
  color: var(--color-warm-white);
}

.scale-levels button[aria-pressed='true'] {
  border-color: var(--color-electric-blue);
  color: var(--color-electric-blue);
}

.scale-levels button:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.chip {
  padding: 4px 9px;
  border: 1px solid var(--color-line);
  border-radius: 4px;
  font-size: 11px;
  color: var(--color-text-dim);
  transition: background var(--duration-fast) var(--ease-atlas),
    color var(--duration-fast) var(--ease-atlas);
}

.chip[aria-pressed='true'] {
  background: rgb(75 140 255 / 12%);
  border-color: var(--color-electric-blue);
  color: var(--color-warm-white);
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.legend-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 0;
  font-size: 12px;
  color: var(--color-text-dim);
}

.legend-swatch {
  width: 12px;
  height: 12px;
  flex: none;
}

.marker-pulse {
  animation: marker-pulse 3.2s var(--ease-atlas) infinite;
  transform-origin: center;
}

@keyframes marker-pulse {
  0%,
  100% {
    opacity: 0.25;
    transform: scale(0.9);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.05);
  }
}

.marker-orbit {
  animation: marker-orbit 12s linear infinite;
  transform-origin: center;
}

@keyframes marker-orbit {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.drawer-header {
  position: sticky;
  top: 0;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  background: var(--color-ink);
  border-bottom: 1px solid var(--color-line);
  z-index: 1;
}

.drawer-header h2 {
  font-size: 17px;
  flex: 1;
}

.icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 6px;
  color: var(--color-text-dim);
}

.icon-button:hover {
  background: var(--color-ink-raised);
  color: var(--color-warm-white);
}

.drawer-body {
  padding: 16px;
}

.meta-grid {
  display: grid;
  grid-template-columns: minmax(84px, auto) 1fr;
  gap: 6px 12px;
  margin: 0 0 16px;
  font-size: 12px;
}

.meta-grid dt {
  color: var(--color-text-faint);
}

.meta-grid dd {
  margin: 0;
  color: var(--color-warm-white);
}

.evidence-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  border: 1px solid currentColor;
  border-radius: 999px;
  font-size: 11px;
  letter-spacing: 0.06em;
}

.source-card {
  padding: 10px 0;
  border-top: 1px solid var(--color-line);
  font-size: 12px;
}

.source-card__url {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  word-break: break-all;
}

.source-card__snippet {
  margin-top: 6px;
  color: var(--color-text-dim);
}

.event-row {
  display: grid;
  grid-template-columns: 96px 1fr;
  gap: 10px;
  padding: 8px 0;
  border-top: 1px solid var(--color-line);
  font-size: 12px;
}

.event-row__date {
  color: var(--color-text-faint);
  font-variant-numeric: tabular-nums;
}

.empty-state {
  padding: 12px 0;
  color: var(--color-text-faint);
  font-size: 12px;
}

.timeline {
  display: flex;
  align-items: center;
  gap: 12px;
}

.timeline__year {
  min-width: 68px;
  font-size: 22px;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}

.timeline__label {
  font-size: 11px;
  color: var(--color-text-faint);
}

.timeline__track {
  flex: 1;
  min-width: 120px;
}

.timeline input[type='range'] {
  width: 100%;
  accent-color: var(--color-electric-blue);
}

.counts {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 12px;
}

.counts__primary {
  font-size: 18px;
  font-variant-numeric: tabular-nums;
}

.counts__secondary {
  color: var(--color-text-faint);
  font-size: 11px;
}

.fallback {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-rows: auto 1fr;
  background: var(--color-obsidian);
}

.fallback__diagnostic {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--color-line);
  font-size: 12px;
  color: var(--color-amber);
  background: var(--color-ink);
}

.fallback__canvas {
  overflow: auto;
}

.fallback__graticule {
  position: relative;
  min-width: 720px;
  min-height: 420px;
}

.fallback__graticule svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.fallback__label {
  font-size: 11px;
  fill: var(--color-text-faint);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.fallback__point {
  cursor: pointer;
}

.project-list {
  display: flex;
  flex-direction: column;
}

.project-list__item {
  display: block;
  width: 100%;
  padding: 10px 16px;
  text-align: left;
  border-top: 1px solid var(--color-line);
}

.project-list__item:hover {
  background: var(--color-ink-raised);
}

.project-list__item[aria-current='true'] {
  background: rgb(75 140 255 / 10%);
}

.boot-error {
  display: grid;
  place-content: center;
  gap: 12px;
  height: 100%;
  padding: 24px;
  text-align: center;
  color: var(--color-text-dim);
}
```

- [ ] **Step 9: Delete the legacy frontend files**

Run:
```bash
git rm -q apps/web/src/main.js apps/web/src/style.css
```
Expected: both removed. The repository must not contain two competing frontends.

- [ ] **Step 10: Run the web unit tests, lint and typecheck**

Run: `npx vitest run --project web && npm run lint`
Expected: PASS, 3 files / 11 tests, and ESLint clean. `@typescript-eslint/no-explicit-any` is an error in the flat config, so if a test needs `any`, change the type rather than the rule.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat(web): add design tokens base styles safe dom primitives and icons"
```

---

### Task 10: Typed API client with runtime contract validation

**Files:**
- Create: `apps/web/src/data/client.ts`, `apps/web/src/data/client.test.ts`, `apps/web/src/data/query.ts`, `apps/web/src/data/query.test.ts`, `apps/web/src/data/types.ts`

**Interfaces:**
- Consumes: `@atlas/contracts` (Task 2).
- Produces:
  - `interface ApiClient { locations(query: Record<string, unknown>, signal?: AbortSignal): Promise<LocationListResponse>; projects(...): Promise<ProjectListResponse>; project(id, signal?): Promise<ProjectDetail>; events(query, signal?): Promise<EventListResponse>; relations(projectId, signal?): Promise<RelationListResponse>; stats(signal?): Promise<StatsResponse>; health(signal?): Promise<HealthResponse> }`
  - `class ApiRequestError extends Error { readonly status: number; readonly code: string; readonly requestId: string | null }`
  - `class ContractError extends Error { readonly endpoint: string; readonly issues: string[] }`
  - `createApiClient(baseUrl: string, options?: { fetchImpl?: typeof fetch; retryCount?: number; retryDelayMs?: number }): ApiClient`
  - `buildQueryString(params: Record<string, unknown>): string` — arrays become repeated keys, `undefined`/`null`/empty-string are dropped, everything else is `String(value)`.
  - `type QueryValue = string | number | boolean | string[] | undefined | null`
  - Re-exported contract types under `src/data/types.ts`: `Project`, `ProjectSummary`, `ProjectDetail`, `Location`, `EventRecord`, `RelationRecord`, `Source`, `StatusHistoryEntry`, `ImpactRecord`, `ProjectType`, `ProjectStatus`, `EvidenceLevel`, `LocationLevel`, `EvidenceIntent`, `EventKind`.

- [ ] **Step 1: Write the failing query-string test**

`apps/web/src/data/query.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { buildQueryString } from './query.ts';

describe('buildQueryString', () => {
  it('returns an empty string when nothing survives', () => {
    expect(buildQueryString({ a: undefined, b: null, c: '' })).toBe('');
  });

  it('stringifies scalars', () => {
    expect(buildQueryString({ page: 2, sort: 'name' })).toBe('page=2&sort=name');
  });

  it('repeats a key for each array element', () => {
    expect(buildQueryString({ type: ['POLICY', 'RESEARCH'] })).toBe('type=POLICY&type=RESEARCH');
  });

  it('drops undefined entries inside arrays', () => {
    expect(buildQueryString({ status: ['ACTIVE', undefined as never, 'DEPLOYING'] })).toBe(
      'status=ACTIVE&status=DEPLOYING',
    );
  });

  it('encodes reserved characters', () => {
    expect(buildQueryString({ q: 'política &sey' })).toBe('q=polit%C3%ADca%20%26sey');
  });

  it('is stable regardless of key order', () => {
    expect(buildQueryString({ b: 2, a: 1 })).toBe('a=1&b=2');
  });
});
```

- [ ] **Step 2: Run it and confirm failure**

Run: `npx vitest run --project web apps/web/src/data/query.test.ts`
Expected: FAIL — `Failed to resolve import "./query.ts"`.

- [ ] **Step 3: Implement `src/data/query.ts`**

```ts
import type { QueryValue } from './types.ts';

export function buildQueryString(params: Record<string, unknown>): string {
  const pairs: string[] = [];
  for (const key of Object.keys(params).sort()) {
    const value = params[key] as QueryValue | undefined;
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item === undefined || item === null || item === '') continue;
        pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`);
      }
      continue;
    }
    pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return pairs.join('&');
}
```

`src/data/types.ts`:
```ts
export type QueryValue = string | number | boolean | string[] | undefined | null;

export type {
  Project,
  ProjectSummary,
  ProjectDetail,
  Location,
  EventRecord,
  RelationRecord,
  Source,
  StatusHistoryEntry,
  ImpactRecord,
  ProjectType,
  ProjectStatus,
  EvidenceLevel,
  LocationLevel,
  EvidenceIntent,
  EventKind,
} from '@atlas/contracts';
```

- [ ] **Step 4: Run the query test and confirm it passes**

Run: `npx vitest run --project web apps/web/src/data/query.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Write the failing client test**

`apps/web/src/data/client.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest';
import { ApiRequestError, ContractError, createApiClient } from './client.ts';
import { locationListResponseSchema, projectListResponseSchema } from '@atlas/contracts';
import { atlasDataFixture, projectDetailFixture } from '../testing/fixtures.ts';

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

const locationsBody = {
  data: atlasDataFixture.locations,
  page: 1,
  pageSize: 50,
  total: 11,
  totalPages: 1,
};

const projectsBody = {
  data: atlasDataFixture.projects,
  page: 1,
  pageSize: 50,
  total: 5,
  totalPages: 1,
};

describe('createApiClient', () => {
  it('requests the v1 prefix and serialises the query', async () => {
    const fetchImpl = vi.fn(async () => ok(projectsBody));
    const client = createApiClient('/api', { fetchImpl: fetchImpl as unknown as typeof fetch });
    await client.projects({ page: 1, pageSize: 50, type: ['POLICY', 'RESEARCH'] });
    const url = String(fetchImpl.mock.calls[0]?.[0]);
    expect(url).toContain('/api/projects?');
    expect(url).toContain('type=POLICY&type=RESEARCH');
    expect(url).toContain('pageSize=50');
  });

  it('validates every payload against its contract', async () => {
    const fetchImpl = vi.fn(async () => ok({ ...locationsBody, total: 'eleven' }));
    const client = createApiClient('/api', { fetchImpl: fetchImpl as unknown as typeof fetch });
    await expect(client.locations({})).rejects.toBeInstanceOf(ContractError);
  });

  it('surfaces a 400 as ApiRequestError with the code and requestId', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: [], requestId: 'req-9' },
          }),
          { status: 400, headers: { 'content-type': 'application/json' } },
        ),
    );
    const client = createApiClient('/api', { fetchImpl: fetchImpl as unknown as typeof fetch });
    await expect(client.projects({ pageSize: 5000 })).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      requestId: 'req-9',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('retries once on a 503 and then succeeds', async () => {
    let call = 0;
    const fetchImpl = vi.fn(async () => {
      call += 1;
      if (call === 1) return new Response('', { status: 503 });
      return ok(projectsBody);
    });
    const client = createApiClient('/api', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      retryDelayMs: 0,
    });
    await expect(client.projects({})).resolves.toBeDefined();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('does not retry a 404', async () => {
    const fetchImpl = vi.fn(async () => new Response('', { status: 404 }));
    const client = createApiClient('/api', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      retryDelayMs: 0,
    });
    await expect(client.project('nope')).rejects.toBeInstanceOf(ApiRequestError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('does not retry when the caller aborts', async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(async () => {
      controller.abort();
      throw new DOMException('aborted', 'AbortError');
    });
    const client = createApiClient('/api', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      retryDelayMs: 0,
    });
    await expect(client.projects({}, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('resolves a bare list for relations and events', async () => {
    const client = createApiClient('/api', {
      fetchImpl: (async () => ok({ data: [], count: 0 })) as unknown as typeof fetch,
    });
    await expect(client.relations('eu-ai-factories')).resolves.toEqual({ data: [], count: 0 });
    await expect(client.events({ projectId: 'x' })).resolves.toEqual({ data: [], count: 0 });
  });

  it('reads the project detail from the data envelope', async () => {
    const client = createApiClient('/api', {
      fetchImpl: (async () => ok({ data: projectsFixture[0] })) as unknown as typeof fetch,
    });
    await expect(client.project('chile-national-ai-policy')).rejects.toBeInstanceOf(ContractError);
    const good = createApiClient('/api', {
      fetchImpl: (async () => ok({ data: projectDetailFixture })) as unknown as typeof fetch,
    });
    await expect(good.project('chile-national-ai-policy')).resolves.toMatchObject({
      id: 'chile-national-ai-policy',
    });
  });

  it('exports the schemas it validates with', () => {
    expect(locationListResponseSchema).toBeDefined();
    expect(projectListResponseSchema).toBeDefined();
  });
});
```

- [ ] **Step 6: Run it and confirm failure**

Run: `npx vitest run --project web apps/web/src/data/client.test.ts`
Expected: FAIL — `Failed to resolve import "./client.ts"`.

- [ ] **Step 7: Implement `src/data/client.ts`**

```ts
import {
  apiErrorSchema,
  eventListResponseSchema,
  healthResponseSchema,
  locationListResponseSchema,
  projectDetailSchema,
  projectListResponseSchema,
  relationListResponseSchema,
  statsResponseSchema,
} from '@atlas/contracts';
import type {
  EventListResponse,
  HealthResponse,
  LocationListResponse,
  ProjectDetail,
  ProjectListResponse,
  RelationListResponse,
  StatsResponse,
} from '@atlas/contracts';
import type { z } from 'zod';
import { buildQueryString } from './query.ts';

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string | null;

  constructor(status: number, code: string, message: string, requestId: string | null) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

export class ContractError extends Error {
  readonly endpoint: string;
  readonly issues: string[];

  constructor(endpoint: string, issues: string[]) {
    super(`Response for ${endpoint} does not match its contract: ${issues.join('; ')}`);
    this.name = 'ContractError';
    this.endpoint = endpoint;
    this.issues = issues;
  }
}

export interface ApiClient {
  health(signal?: AbortSignal): Promise<HealthResponse>;
  locations(query: Record<string, unknown>, signal?: AbortSignal): Promise<LocationListResponse>;
  projects(query: Record<string, unknown>, signal?: AbortSignal): Promise<ProjectListResponse>;
  project(id: string, signal?: AbortSignal): Promise<ProjectDetail>;
  events(query: Record<string, unknown>, signal?: AbortSignal): Promise<EventListResponse>;
  relations(projectId: string, signal?: AbortSignal): Promise<RelationListResponse>;
  stats(signal?: AbortSignal): Promise<StatsResponse>;
}

export interface ApiClientOptions {
  fetchImpl?: typeof fetch;
  retryCount?: number;
  retryDelayMs?: number;
}

const RETRYABLE = new Set([502, 503, 504]);

function join(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function createApiClient(baseUrl: string, options: ApiClientOptions = {}): ApiClient {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const retryCount = options.retryCount ?? 1;
  const retryDelayMs = options.retryDelayMs ?? 300;

  async function request<T>(
    path: string,
    schema: z.ZodType<T>,
    query: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<T> {
    const queryString = buildQueryString(query);
    const url = queryString ? `${join(baseUrl, path)}?${queryString}` : join(baseUrl, path);

    let attempt = 0;
    for (;;) {
      let response: Response;
      try {
        response = await fetchImpl(url, {
          headers: { accept: 'application/json' },
          signal,
        });
      } catch (error) {
        const isAbort = error instanceof DOMException && error.name === 'AbortError';
        if (isAbort || attempt >= retryCount) throw error;
        attempt += 1;
        await sleep(retryDelayMs);
        continue;
      }

      if (response.ok) {
        const json: unknown = await response.json();
        const parsed = schema.safeParse(json);
        if (!parsed.success) {
          throw new ContractError(
            path,
            parsed.error.issues.map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`),
          );
        }
        return parsed.data;
      }

      if (RETRYABLE.has(response.status) && attempt < retryCount) {
        attempt += 1;
        await sleep(retryDelayMs);
        continue;
      }

      const errorBody: unknown = await response.json().catch(() => null);
      const parsedError = apiErrorSchema.safeParse(errorBody);
      if (parsedError.success) {
        throw new ApiRequestError(
          response.status,
          parsedError.data.code,
          parsedError.data.message,
          parsedError.data.requestId,
        );
      }
      throw new ApiRequestError(response.status, 'HTTP_ERROR', `Request to ${path} failed`, null);
    }
  }

  return {
    health: (signal) => request('/health', healthResponseSchema, {}, signal),
    locations: (query, signal) => request('/locations', locationListResponseSchema, query, signal),
    projects: (query, signal) => request('/projects', projectListResponseSchema, query, signal),
    project: (id, signal) => request(`/projects/${encodeURIComponent(id)}`, projectDetailSchema, {}, signal),
    events: (query, signal) => request('/events', eventListResponseSchema, query, signal),
    relations: (projectId, signal) =>
      request('/relations', relationListResponseSchema, { projectId }, signal),
    stats: (signal) => request('/stats', statsResponseSchema, {}, signal),
  };
}
```

- [ ] **Step 8: Copy the fixtures into the web app**

Web tests need the same fixture objects the API tests use, otherwise the client test would assert against a second, drifting copy of the data. Create `apps/web/src/testing/fixture-data.ts` by **copying verbatim** the `atlasDataFixture`, `projectsFixture`, `locationsFixture`, `eventsFixture`, `relationsFixture` and `sourcesFixture` objects written in Task 5 (`apps/api/src/testing/fixtures.ts`). Do not re-invent, trim or rename any field.

Then create `apps/web/src/testing/fixtures.ts`:
```ts
import { eventsFixture, locationsFixture, projectsFixture, sourcesFixture } from './fixture-data.ts';

export { atlasDataFixture, projectsFixture, locationsFixture, eventsFixture } from './fixture-data.ts';
export * from './fixture-data.ts';

const sourcesFor = (projectId: string) =>
  sourcesFixture
    .filter((source) => source.projectId === projectId)
    .map(({ projectId: _projectId, ...source }) => source);

/** The detail shape returned by `GET /api/projects/:id` for the Chile project. */
export const projectDetailFixture = {
  ...projectsFixture[0],
  sources: sourcesFor('chile-national-ai-policy'),
  events: eventsFixture.filter((event) => event.projectId === 'chile-national-ai-policy'),
  relations: [],
  statusHistory: [],
  impact: [],
};

export const listBodies = {
  locations: { data: locationsFixture, page: 1, pageSize: 50, total: 11, totalPages: 1 },
  projects: { data: projectsFixture, page: 1, pageSize: 50, total: 5, totalPages: 1 },
  events: { data: eventsFixture, count: eventsFixture.length },
  relations: { data: [], count: 0 },
} as const;
```

`projectDetailFixture` must satisfy `projectDetailSchema` on its own, because Task 10's client test feeds it through the real validator. If `sourcesFor` returns an empty array, the Chile project fixture is wrong — the Task 5 fixture data gives the Chile project two sources, and both must be preserved here.

Constraints that the E2E suite in Task 22 relies on and that must hold in the copy:
- `atlasDataFixture.locations.length === 11` and `atlasDataFixture.projects.length === 5`.
- Ids `chile-national-ai-policy`, `pucv-fondecyt-fuzzy`, `eu-ai-factories`, `indiaai-challenge-2026`, `singapore-punggol-digital-district` and `pucv-campus` all exist.
- `atlasDataFixture.stats.totals.projects === 5`.

- [ ] **Step 9: Run the web data tests and confirm they pass**

Run: `npx vitest run --project web apps/web/src/data`
Expected: PASS, 3 files / 19 tests.

- [ ] **Step 10: Run lint and typecheck for the web workspace**

Run: `npm run lint && npm run typecheck -w @atlas/contracts -w @atlas/web`
Expected: clean. The `client.ts` import of `z.ZodType` needs only `import type`, which is already in place.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat(web): add typed api client that validates every payload at runtime"
```

---

### Task 11: Application state, semantic colour mapping and selection rules

**Files:**
- Create: `apps/web/src/state/store.ts`, `apps/web/src/state/store.test.ts`, `apps/web/src/state/colors.ts`, `apps/web/src/state/colors.test.ts`, `apps/web/src/state/filters.ts`, `apps/web/src/state/filters.test.ts`, `apps/web/src/state/timeline.ts`, `apps/web/src/state/timeline.test.ts`, `apps/web/src/state/geo.ts`, `apps/web/src/state/geo.test.ts`, `apps/web/src/state/palette.ts`, `apps/web/src/state/palette.test.ts`

**Interfaces:**
- Consumes: contract types (Task 10 re-exports), `@atlas/contracts`.
- Produces:
  - `interface AtlasFilters { q: string; type: ProjectType[]; status: ProjectStatus[]; evidence: EvidenceLevel[]; yearFrom: number | null; yearTo: number | null; locationId: string | null; sort: 'publishedAt' | 'name' }`
  - `interface AtlasState { filters: AtlasFilters; focusLocationId: string | null; selectedProjectId: string | null; level: LocationLevel; timeline: TimelineState; railOpen: boolean; drawerOpen: boolean; projects: ProjectSummary[]; locations: Location[]; stats: StatsResponse | null; health: HealthResponse | null; apiStatus: 'idle' | 'loading' | 'ok' | 'error'; apiError: string | null; lastRequestId: string | null; globalTotal: number; matchingTotal: number; mapMode: 'globe' | 'fallback'; fallbackReason: string | null }`
  - `interface TimelineState { year: number; playing: boolean; minYear: number; maxYear: number }`
  - `createInitialState(fixture?: Partial<AtlasState>): AtlasState`
  - `type Action = { type: 'filters/set'; patch: Partial<AtlasFilters> } | { type: 'filters/reset' } | { type: 'filters/toggleValue'; key: 'type' | 'status' | 'evidence'; value: string } | { type: 'focus/set'; locationId: string | null } | { type: 'select/project'; projectId: string | null } | { type: 'level/set'; level: LocationLevel } | { type: 'timeline/setYear'; year: number } | { type: 'timeline/play' } | { type: 'timeline/pause' } | { type: 'timeline/step'; delta: number } | { type: 'panel/rail'; open: boolean } | { type: 'panel/drawer'; open: boolean } | { type: 'data/projects'; payload: ProjectListResponse } | { type: 'data/locations'; payload: LocationListResponse } | { type: 'data/stats'; payload: StatsResponse } | { type: 'data/health'; payload: HealthResponse } | { type: 'api/status'; payload: Pick<AtlasState, 'apiStatus' | 'apiError' | 'lastRequestId'> } | { type: 'map/mode'; payload: { mode: 'globe' | 'fallback'; reason?: string | null } }`
  - `createStore(initial: AtlasState): { getState(): AtlasState; dispatch(action: Action): void; subscribe(listener: (state: AtlasState) => void): () => void }`
  - `export function toQuery(filters: AtlasFilters): Record<string, unknown>` — drops empty values so the query string stays minimal
  - `export function isFilterActive(filters: AtlasFilters): boolean`
  - `export function activeFilterCount(filters: AtlasFilters): number`
  - `export function toggleInList<T>(list: T[], value: T): T[]`
- `export const STATUS_COLORS: Readonly<Record<ProjectStatus, string>>`, `EVIDENCE_COLORS: Readonly<Record<EvidenceLevel, string>>`, `EVIDENCE_INTENTS: Readonly<Record<EvidenceLevel, EvidenceIntent>>`, `TYPE_COLORS: Readonly<Record<ProjectType, string>>`
- `export function statusColor(status: ProjectStatus): string`
- `export function evidenceColor(level: EvidenceLevel): string`
- `export function evidenceIntent(level: EvidenceLevel): EvidenceIntent`
- `export function typeColor(type: ProjectType): string`
- `export function typeLabel(type: ProjectType): string`, `statusLabel`, `levelLabel`, `evidenceLabel`
- `export function clampYear(year: number, min: number, max: number): number`
- `export function yearStep(state: TimelineState, direction: 1 | -1): number`
- `export function eventsInYear(events: EventRecord[], year: number): EventRecord[]`
- `export function isDescendant(locations: Location[], candidateId: string, ancestorId: string): boolean`
- `export function descendantIds(locations: Location[], rootId: string): string[]` - includes `rootId`
- `export function breadcrumbTrail(locations: Location[], focusId: string | null): Location[]`
- `export const LEVEL_ORDER: readonly LocationLevel[]`
- `export function canDescend(locations: Location[], level: LocationLevel): boolean`
- `export function normalizeBounds(list: { center: { lat: number; lng: number } }[]): { west: number; south: number; east: number; north: number } | null`
- `export const MARKER_SHAPES: Readonly<Record<LocationLevel, MarkerShape>>` - the shape encodes level, never status, so two projects in the same place never differ only by colour
- `export function markerShapeFor(level: LocationLevel): MarkerShape`
- `export function markerSizeFor(level: LocationLevel, density: number): number` - base per level, plus `PROJECT_BONUS` capped at 22

- [ ] **Step 1: Write the failing colour and palette tests**

`apps/web/src/state/colors.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import {
  EVIDENCE_COLORS,
  EVIDENCE_INTENTS,
  STATUS_COLORS,
  evidenceColor,
  evidenceIntent,
  levelLabel,
  statusLabel,
  typeLabel,
} from './colors.ts';
import {
  evidenceSchema,
  locationLevelSchema,
  projectStatusSchema,
  projectTypeSchema,
} from '@atlas/contracts';

describe('semantic colours', () => {
  it('covers every closed vocabulary member exactly once', () => {
    const statuses = projectStatusSchema.options;
    expect(Object.keys(STATUS_COLORS).sort()).toEqual([...statuses].sort());
    const evidence = evidenceSchema.options;
    expect(Object.keys(EVIDENCE_COLORS).sort()).toEqual([...evidence].sort());
    expect(Object.keys(EVIDENCE_INTENTS).sort()).toEqual([...evidence].sort());
  });

  it('gives every value a css hex colour', () => {
    for (const status of projectStatusSchema.options) {
      expect(STATUS_COLORS[status]).toMatch(/^#[0-9a-f]{6}$/i);
    }
    for (const level of evidenceSchema.options) {
      expect(EVIDENCE_COLORS[level]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('separates adjacent statuses perceptually', () => {
    const unique = new Set(Object.values(STATUS_COLORS));
    expect(unique.size).toBe(Object.keys(STATUS_COLORS).length);
  });

  it('never uses a saturated red for a non-error status', () => {
    expect(STATUS_COLORS.COMPLETED.toLowerCase()).not.toBe('#e04a3f');
  });

  it('maps every status and evidence level to an explicit intent', () => {
    for (const status of projectStatusSchema.options) {
      expect(['PLANNED', 'ACTIVE', 'INACTIVE']).toContain(
        status === 'COMPLETED' ? 'INACTIVE' : 'ACTIVE',
      );
    }
    for (const level of evidenceSchema.options) {
      expect(['OBSERVED', 'EXPECTED', 'UNCONFIRMED']).toContain(evidenceIntent(level));
    }
  });

  it('labels every vocabulary member in Spanish without leaking the raw key', () => {
    for (const type of projectTypeSchema.options) {
      expect(typeLabel(type)).not.toBe(type);
      expect(typeLabel(type).length).toBeGreaterThan(2);
    }
    for (const status of projectStatusSchema.options) {
      expect(statusLabel(status)).not.toBe(status);
    }
    for (const level of locationLevelSchema.options) {
      expect(levelLabel(level)).not.toBe(level);
    }
  });

  it('resolves a colour for a valid level and rejects an invalid one at the type level', () => {
    expect(evidenceColor('REPORTED')).toBe(EVIDENCE_COLORS.REPORTED);
    // @ts-expect-error an unknown level is not a member of the closed vocabulary
    expect(evidenceColor('RUMOUR')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it and confirm failure**

Run: `npx vitest run --project web apps/web/src/state/colors.test.ts`
Expected: FAIL — `Failed to resolve import "./colors.ts"`.

- [ ] **Step 3: Implement `src/state/colors.ts`**

The palette is fixed in the spec and must not drift between the map, the legend, the rail and the drawer. One module owns it.

```ts
import type {
  EvidenceIntent,
  EvidenceLevel,
  LocationLevel,
  ProjectStatus,
  ProjectType,
} from '../data/types.ts';

export const STATUS_COLORS: Readonly<Record<ProjectStatus, string>> = {
  ANNOUNCED: '#5a6577',
  PREANNOUNCED: '#4f6a86',
  DEPLOYING: '#4b8cff',
  OPERATIONAL: '#70d6b2',
  EXTENDED: '#70c8e8',
  SUSPENDED: '#e5a84b',
  CANCELLED: '#e47c71',
  COMPLETED: '#a9d66f',
  UNKNOWN: '#4a4f5b',
};

export const EVIDENCE_COLORS: Readonly<Record<EvidenceLevel, string>> = {
  OFFICIAL: '#70d6b2',
  REPORTED: '#4b8cff',
  EXPECTED: '#5a6577',
  UNVERIFIED: '#8a6a4a',
  DISPUTED: '#e47c71',
  RUMOUR: '#6b4a7a',
};

/** Declared intent per evidence level. Never derived from the wording of a name. */
export const EVIDENCE_INTENTS: Readonly<Record<EvidenceLevel, EvidenceIntent>> = {
  OFFICIAL: 'OBSERVED',
  REPORTED: 'OBSERVED',
  EXPECTED: 'EXPECTED',
  UNVERIFIED: 'UNCONFIRMED',
  DISPUTED: 'UNCONFIRMED',
  RUMOUR: 'UNCONFIRMED',
};

export const TYPE_COLORS: Readonly<Record<ProjectType, string>> = {
  PROJECT: '#4b8cff',
  NEWS: '#9aa3b2',
  LAUNCH: '#70c8e8',
  COMPANY: '#b59aff',
  GOVERNMENT: '#8567ff',
  UNIVERSITY: '#e5a84b',
  RESEARCH: '#70d6b2',
  INFRASTRUCTURE: '#a9d66f',
  REGULATION: '#e47c71',
  DATASET: '#5a6577',
  MODEL: '#b59aff',
  BENCHMARK: '#4f6a86',
  STANDARD: '#70c8e8',
  OTHER: '#4a4f5b',
};

const TYPE_LABELS: Readonly<Record<ProjectType, string>> = {
  PROJECT: 'Proyecto',
  NEWS: 'Noticia',
  LAUNCH: 'Lanzamiento',
  COMPANY: 'Empresa',
  GOVERNMENT: 'Gobierno',
  UNIVERSITY: 'Universidad',
  RESEARCH: 'Investigación',
  INFRASTRUCTURE: 'Infraestructura',
  REGULATION: 'Regulación',
  DATASET: 'Dataset',
  MODEL: 'Modelo',
  BENCHMARK: 'Benchmark',
  STANDARD: 'Estándar',
  OTHER: 'Otro',
};

const STATUS_LABELS: Readonly<Record<ProjectStatus, string>> = {
  ANNOUNCED: 'Anunciado',
  PREANNOUNCED: 'Preanunciado',
  DEPLOYING: 'En despliegue',
  OPERATIONAL: 'Operativo',
  EXTENDED: 'Extendido',
  SUSPENDED: 'Suspendido',
  CANCELLED: 'Cancelado',
  COMPLETED: 'Completado',
  UNKNOWN: 'Desconocido',
};

const EVIDENCE_LABELS: Readonly<Record<EvidenceLevel, string>> = {
  OFFICIAL: 'Oficial',
  REPORTED: 'Reportado',
  EXPECTED: 'Esperado',
  UNVERIFIED: 'Sin verificar',
  DISPUTED: 'En disputa',
  RUMOUR: 'Rumores',
};

const LEVEL_LABELS: Readonly<Record<LocationLevel, string>> = {
  WORLD: 'Mundo',
  CONTINENT: 'Continente',
  COUNTRY: 'País',
  REGION: 'Región',
  CITY: 'Ciudad',
  LOCAL_AREA: 'Área local',
};

export function statusColor(status: ProjectStatus): string {
  return STATUS_COLORS[status];
}

export function evidenceColor(level: EvidenceLevel): string {
  return EVIDENCE_COLORS[level];
}

export function evidenceIntent(level: EvidenceLevel): EvidenceIntent {
  return EVIDENCE_INTENTS[level];
}

export function typeColor(type: ProjectType): string {
  return TYPE_COLORS[type];
}

export function typeLabel(type: ProjectType): string {
  return TYPE_LABELS[type];
}

export function statusLabel(status: ProjectStatus): string {
  return STATUS_LABELS[status];
}

export function evidenceLabel(level: EvidenceLevel): string {
  return EVIDENCE_LABELS[level];
}

export function levelLabel(level: LocationLevel): string {
  return LEVEL_LABELS[level];
}
```

- [ ] **Step 4: Run the colour test and confirm it passes**

Run: `npx vitest run --project web apps/web/src/state/colors.test.ts`
Expected: PASS, 6 tests. If the "separates adjacent statuses perceptually" test fails, two statuses share a colour — change the palette, not the test.

- [ ] **Step 5: Write the failing filters, timeline, geo and palette tests**

`apps/web/src/state/filters.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { activeFilterCount, isFilterActive, toQuery, toggleInList } from './filters.ts';
import type { AtlasFilters } from './filters.ts';

const empty: AtlasFilters = {
  q: '',
  type: [],
  status: [],
  evidence: [],
  yearFrom: null,
  yearTo: null,
  locationId: null,
  sort: 'publishedAt',
};

describe('toQuery', () => {
  it('emits only the values that are set', () => {
    expect(toQuery(empty)).toEqual({ page: 1, pageSize: 50, sort: 'publishedAt' });
  });

  it('emits arrays verbatim for the repeated-key format', () => {
    const query = toQuery({ ...empty, type: ['POLICY', 'RESEARCH'], status: ['DEPLOYING'] });
    expect(query.type).toEqual(['POLICY', 'RESEARCH']);
    expect(query.status).toEqual(['DEPLOYING']);
  });

  it('trims the query text and drops it when it is blank', () => {
    expect(toQuery({ ...empty, q: '   ' }).q).toBeUndefined();
    expect(toQuery({ ...empty, q: '  inteligencia ' }).q).toBe('inteligencia');
  });

  it('emits year bounds only when present', () => {
    expect(toQuery({ ...empty, yearFrom: 2020 }).yearTo).toBeUndefined();
    expect(toQuery({ ...empty, yearFrom: 2020 }).yearFrom).toBe(2020);
  });
});

describe('filter state helpers', () => {
  it('detects whether any filter is active', () => {
    expect(isFilterActive(empty)).toBe(false);
    expect(isFilterActive({ ...empty, q: 'ia' })).toBe(true);
    expect(isFilterActive({ ...empty, yearTo: 2026 })).toBe(true);
  });

  it('counts each active dimension once, not each selected value', () => {
    expect(activeFilterCount(empty)).toBe(0);
    expect(activeFilterCount({ ...empty, type: ['POLICY', 'RESEARCH'] })).toBe(1);
    expect(activeFilterCount({ ...empty, type: ['POLICY'], status: ['ACTIVE'] })).toBe(2);
    expect(activeFilterCount({ ...empty, type: ['POLICY'], q: 'ia' })).toBe(2);
  });

  it('toggles a value in and out of a list without duplicates', () => {
    expect(toggleInList(['POLICY'], 'RESEARCH')).toEqual(['POLICY', 'RESEARCH']);
    expect(toggleInList(['POLICY', 'RESEARCH'], 'POLICY')).toEqual(['RESEARCH']);
  });
});
```

`apps/web/src/state/timeline.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { clampYear, eventsInYear, yearStep } from './timeline.ts';
import type { TimelineState } from './timeline.ts';
import { eventsFixture } from '../testing/fixtures.ts';

const state: TimelineState = { year: 2023, playing: false, minYear: 2020, maxYear: 2026 };

describe('clampYear', () => {
  it('clamps to the closed range', () => {
    expect(clampYear(2019, 2020, 2026)).toBe(2020);
    expect(clampYear(2030, 2020, 2026)).toBe(2026);
    expect(clampYear(2023, 2020, 2026)).toBe(2023);
  });
});

describe('yearStep', () => {
  it('moves one year at a time and stops at the edges', () => {
    expect(yearStep({ ...state, year: 2020 }, 1)).toBe(2020);
    expect(yearStep({ ...state, year: 2026 }, -1)).toBe(2026);
    expect(yearStep(state, 1)).toBe(2024);
  });
});

describe('eventsInYear', () => {
  it('returns the events whose occurred_at falls in the year', () => {
    const found = eventsInYear(eventsFixture, 2025);
    expect(found.length).toBeGreaterThan(0);
    for (const event of found) {
      expect(new Date(event.occurredAt).getUTCFullYear()).toBe(2025);
    }
  });

  it('returns an empty array for a year with no events', () => {
    expect(eventsInYear(eventsFixture, 1999)).toEqual([]);
  });
});
```

`apps/web/src/state/geo.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { LEVEL_ORDER, breadcrumbTrail, canDescend, descendantIds, isDescendant, normalizeBounds } from './geo.ts';
import { locationsFixture } from '../testing/fixtures.ts';

const byId = (id: string) => {
  const found = locationsFixture.find((location) => location.id === id);
  if (!found) throw new Error(`missing fixture ${id}`);
  return found;
};

describe('hierarchy helpers', () => {
  it('orders levels from world down to local area', () => {
    expect(LEVEL_ORDER).toEqual(['WORLD', 'CONTINENT', 'COUNTRY', 'REGION', 'CITY', 'LOCAL_AREA']);
  });

  it('recognises a direct and a deep descendant', () => {
    expect(isDescendant(locationsFixture, byId('valparaiso-city').id, 'chile')).toBe(true);
    expect(isDescendant(locationsFixture, byId('pucv-campus').id, 'chile')).toBe(true);
    expect(isDescendant(locationsFixture, byId('singapore').id, 'chile')).toBe(false);
    expect(isDescendant(locationsFixture, 'chile', 'chile')).toBe(false);
  });

  it('expands a subtree including its own root', () => {
    const ids = descendantIds(locationsFixture, 'south-america');
    expect(ids).toContain('south-america');
    expect(ids).toContain('chile');
    expect(ids).toContain('pucv-campus');
    expect(ids).not.toContain('singapore');
  });

  it('builds the breadcrumb from world down to the focused location', () => {
    const trail = breadcrumbTrail(locationsFixture, 'pucv-campus');
    expect(trail.map((location) => location.level)).toEqual([
      'WORLD',
      'CONTINENT',
      'COUNTRY',
      'REGION',
      'CITY',
      'LOCAL_AREA',
    ]);
  });

  it('returns the world entry when nothing is focused', () => {
    expect(breadcrumbTrail(locationsFixture, null)).toEqual([]);
  });

  it('knows when the current level has no children in the data', () => {
    expect(canDescend(locationsFixture, 'LOCAL_AREA')).toBe(false);
    expect(canDescend(locationsFixture, 'COUNTRY')).toBe(true);
  });
});

describe('normalizeBounds', () => {
  it('returns null with no points', () => {
    expect(normalizeBounds([])).toBeNull();
  });

  it('computes a west-south-east-north box', () => {
    const bounds = normalizeBounds([
      { center: { lat: -33.05, lng: -71.6 } },
      { center: { lat: -32.9, lng: -71.4 } },
    ]);
    expect(bounds).toEqual({ west: -71.6, south: -33.05, east: -71.4, north: -32.9 });
  });
});
```

`apps/web/src/state/palette.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { MARKER_SHAPES, markerShapeFor, markerSizeFor } from './palette.ts';
import { locationLevelSchema, projectStatusSchema } from '@atlas/contracts';

describe('marker shapes', () => {
  it('gives each level its own glyph', () => {
    const shapes = locationLevelSchema.options.map((level) => markerShapeFor(level));
    expect(new Set(shapes).size).toBe(locationLevelSchema.options.length);
  });

  it('keeps the largest marker below the non-overlap budget', () => {
    for (const level of locationLevelSchema.options) {
      expect(markerSizeFor(level, 1)).toBeLessThanOrEqual(22);
    }
    expect(markerSizeFor('LOCAL_AREA', 3)).toBeGreaterThan(markerSizeFor('WORLD', 3));
  });

  it('exposes the shape table for the legend', () => {
    expect(Object.keys(MARKER_SHAPES)).toEqual([...locationLevelSchema.options]);
  });

  it('does not encode a status in the glyph', () => {
    for (const status of projectStatusSchema.options) {
      expect(Object.values(MARKER_SHAPES)).not.toContain(status.toLowerCase());
    }
  });
});
```

- [ ] **Step 6: Run them and confirm failure**

Run: `npx vitest run --project web apps/web/src/state`
Expected: FAIL on `filters.ts`, `timeline.ts`, `geo.ts` and `palette.ts`.

- [ ] **Step 7: Implement the four modules**

`src/state/filters.ts`:
```ts
import type { EvidenceLevel, ProjectStatus, ProjectType } from '../data/types.ts';
import type { StatsResponse } from '@atlas/contracts';

export interface AtlasFilters {
  q: string;
  type: ProjectType[];
  status: ProjectStatus[];
  evidence: EvidenceLevel[];
  yearFrom: number | null;
  yearTo: number | null;
  locationId: string | null;
  sort: 'publishedAt' | 'name';
}

export const EMPTY_FILTERS: AtlasFilters = {
  q: '',
  type: [],
  status: [],
  evidence: [],
  yearFrom: null,
  yearTo: null,
  locationId: null,
  sort: 'publishedAt',
};

export function toQuery(filters: AtlasFilters): Record<string, unknown> {
  const query: Record<string, unknown> = { page: 1, pageSize: 50, sort: filters.sort };
  const q = filters.q.trim();
  if (q.length > 0) query.q = q;
  if (filters.type.length > 0) query.type = filters.type;
  if (filters.status.length > 0) query.status = filters.status;
  if (filters.evidence.length > 0) query.evidence = filters.evidence;
  if (filters.yearFrom !== null) query.yearFrom = filters.yearFrom;
  if (filters.yearTo !== null) query.yearTo = filters.yearTo;
  if (filters.locationId !== null) query.locationId = filters.locationId;
  return query;
}

export function isFilterActive(filters: AtlasFilters): boolean {
  return activeFilterCount(filters) > 0;
}

export function activeFilterCount(filters: AtlasFilters): number {
  let count = 0;
  if (filters.q.trim().length > 0) count += 1;
  if (filters.type.length > 0) count += 1;
  if (filters.status.length > 0) count += 1;
  if (filters.evidence.length > 0) count += 1;
  if (filters.yearFrom !== null || filters.yearTo !== null) count += 1;
  if (filters.locationId !== null) count += 1;
  return count;
}

export function toggleInList<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export type StatsLike = StatsResponse;
```

`src/state/timeline.ts`:
```ts
import type { EventRecord } from '../data/types.ts';

export interface TimelineState {
  year: number;
  playing: boolean;
  minYear: number;
  maxYear: number;
}

export function clampYear(year: number, minYear: number, maxYear: number): number {
  if (!Number.isFinite(year)) return minYear;
  return Math.min(maxYear, Math.max(minYear, Math.trunc(year)));
}

export function yearStep(state: TimelineState, direction: 1 | -1): number {
  return clampYear(state.year + direction, state.minYear, state.maxYear);
}

export function eventsInYear(events: readonly EventRecord[], year: number): EventRecord[] {
  return events.filter((event) => new Date(event.occurredAt).getUTCFullYear() === year);
}
```

Do not add a `yearSpan` helper here. The strip in Task 16 needs a min and a max, but it has them already in `selectors.yearOptions`, which the selectors derive in Task 12. A second derivation of the same numbers is a second place to get wrong.

`src/state/geo.ts`:
```ts
import type { Location, LocationLevel } from '../data/types.ts';

export const LEVEL_ORDER: readonly LocationLevel[] = [
  'WORLD',
  'CONTINENT',
  'COUNTRY',
  'REGION',
  'CITY',
  'LOCAL_AREA',
];

export function isDescendant(
  locations: readonly Location[],
  candidateId: string,
  ancestorId: string,
): boolean {
  if (candidateId === ancestorId) return false;
  let cursor: string | undefined = candidateId;
  const index = new Map(locations.map((location) => [location.id, location]));
  while (cursor) {
    const node: Location | undefined = index.get(cursor);
    if (!node) return false;
    if (node.parentId === ancestorId) return true;
    cursor = node.parentId ?? undefined;
  }
  return false;
}

export function descendantIds(locations: readonly Location[], rootId: string): string[] {
  const childrenOf = new Map<string, string[]>();
  for (const location of locations) {
    if (!location.parentId) continue;
    const bucket = childrenOf.get(location.parentId) ?? [];
    bucket.push(location.id);
    childrenOf.set(location.parentId, bucket);
  }
  const out: string[] = [];
  const queue = [rootId];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined || out.includes(current)) continue;
    out.push(current);
    queue.push(...(childrenOf.get(current) ?? []));
  }
  return out;
}

export function breadcrumbTrail(locations: readonly Location[], focusId: string | null): Location[] {
  if (focusId === null) return [];
  const index = new Map(locations.map((location) => [location.id, location]));
  const trail: Location[] = [];
  let cursor: string | undefined = focusId;
  while (cursor) {
    const node: Location | undefined = index.get(cursor);
    if (!node) break;
    trail.unshift(node);
    cursor = node.parentId ?? undefined;
  }
  return trail;
}

export function canDescend(locations: readonly Location[], level: LocationLevel): boolean {
  return locations.some((location) => location.level === level);
}

export function normalizeBounds(
  points: readonly { center: { lat: number; lng: number } }[],
): { west: number; south: number; east: number; north: number } | null {
  if (points.length === 0) return null;
  const lats = points.map((point) => point.center.lat);
  const lngs = points.map((point) => point.center.lng);
  return {
    west: Math.min(...lngs),
    south: Math.min(...lats),
    east: Math.max(...lngs),
    north: Math.max(...lats),
  };
}
```

`src/state/palette.ts`:
```ts
import type { LocationLevel } from '../data/types.ts';

export type MarkerShape = 'circle' | 'ring' | 'triangle' | 'square' | 'diamond' | 'dot';

export const MARKER_SHAPES: Readonly<Record<LocationLevel, MarkerShape>> = {
  WORLD: 'ring',
  CONTINENT: 'circle',
  COUNTRY: 'triangle',
  REGION: 'square',
  CITY: 'diamond',
  LOCAL_AREA: 'dot',
};

const BASE_SIZES: Readonly<Record<LocationLevel, number>> = {
  WORLD: 22,
  CONTINENT: 20,
  COUNTRY: 18,
  REGION: 16,
  CITY: 13,
  LOCAL_AREA: 9,
};

const PROJECT_BONUS = 3;

export function markerShapeFor(level: LocationLevel): MarkerShape {
  return MARKER_SHAPES[level];
}

/** `density` is 0..1: how many projects sit inside the location. Bigger clusters stay smaller. */
export function markerSizeFor(level: LocationLevel, density: number): number {
  const safeDensity = Math.min(1, Math.max(0, density));
  const size = BASE_SIZES[level] + PROJECT_BONUS * safeDensity;
  return Math.round(size);
}
```

- [ ] **Step 8: Run the state tests and confirm they pass**

Run: `npx vitest run --project web apps/web/src/state`
Expected: PASS, 5 files / 30 tests (colors 7 + filters 7 + timeline 4 + geo 8 + palette 4).

- [ ] **Step 9: Write the failing store test**

`apps/web/src/state/store.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest';
import { createInitialState, createStore } from './store.ts';
import type { Action } from './store.ts';
import { listBodies, atlasDataFixture } from '../testing/fixtures.ts';

const projectBody = { data: listBodies.projects.data, page: 1, pageSize: 50, total: 5, totalPages: 1 };

describe('createStore', () => {
  it('starts with no filters, world level and the globe mode', () => {
    const state = createInitialState();
    expect(state.filters.q).toBe('');
    expect(state.level).toBe('WORLD');
    expect(state.mapMode).toBe('globe');
    expect(state.apiStatus).toBe('idle');
    expect(state.globalTotal).toBe(0);
  });

  it('notifies subscribers only when the state actually changes', () => {
    const store = createStore(createInitialState());
    const listener = vi.fn();
    store.subscribe(listener);
    store.dispatch({ type: 'filters/set', patch: { q: 'ia' } });
    expect(listener).toHaveBeenCalledTimes(1);
    const before = listener.mock.calls.length;
    store.dispatch({ type: 'filters/set', patch: { q: 'ia' } });
    expect(listener).toHaveBeenCalledTimes(before);
  });

  it('unsubscribes cleanly', () => {
    const store = createStore(createInitialState());
    const listener = vi.fn();
    const off = store.subscribe(listener);
    off();
    store.dispatch({ type: 'filters/set', patch: { q: 'ia' } });
    expect(listener).not.toHaveBeenCalled();
  });

  it('toggles a single filter value and records it', () => {
    const store = createStore(createInitialState());
    store.dispatch({ type: 'filters/toggleValue', key: 'type', value: 'POLICY' });
    expect(store.getState().filters.type).toEqual(['POLICY']);
    store.dispatch({ type: 'filters/toggleValue', key: 'type', value: 'POLICY' });
    expect(store.getState().filters.type).toEqual([]);
  });

  it('keeps the global total from stats and the matching total from the query', () => {
    const store = createStore(createInitialState());
    store.dispatch({ type: 'data/stats', payload: atlasDataFixture.stats });
    store.dispatch({ type: 'data/projects', payload: projectBody });
    const state = store.getState();
    expect(state.globalTotal).toBe(5);
    expect(state.matchingTotal).toBe(5);
    expect(state.projects).toHaveLength(5);
  });

  it('resets every filter and closes the drawer without touching the level', () => {
    const store = createStore(createInitialState());
    store.dispatch({ type: 'filters/toggleValue', key: 'status', value: 'DEPLOYING' });
    store.dispatch({ type: 'level/set', level: 'COUNTRY' });
    store.dispatch({ type: 'select/project', projectId: 'chile-national-ai-policy' });
    store.dispatch({ type: 'filters/reset' });
    const state = store.getState();
    expect(state.filters.status).toEqual([]);
    expect(state.level).toBe('COUNTRY');
    expect(state.selectedProjectId).toBeNull();
  });

  it('opens the drawer when a project is selected and closes it when cleared', () => {
    const store = createStore(createInitialState());
    store.dispatch({ type: 'select/project', projectId: 'eu-ai-factories' });
    expect(store.getState().drawerOpen).toBe(true);
    store.dispatch({ type: 'panel/drawer', open: false });
    expect(store.getState().drawerOpen).toBe(false);
  });

  it('clamps the timeline year into range on every set', () => {
    const store = createStore(createInitialState());
    store.dispatch({ type: 'timeline/setYear', year: 1990 });
    expect(store.getState().timeline.year).toBe(store.getState().timeline.minYear);
    store.dispatch({ type: 'timeline/setYear', year: 2999 });
    expect(store.getState().timeline.year).toBe(store.getState().timeline.maxYear);
  });

  it('switches to the fallback mode and records the reason', () => {
    const store = createStore(createInitialState());
    store.dispatch({ type: 'map/mode', payload: { mode: 'fallback', reason: 'Mapbox token missing' } });
    const state = store.getState();
    expect(state.mapMode).toBe('fallback');
    expect(state.fallbackReason).toBe('Mapbox token missing');
  });

  it('records the last requestId on an api error', () => {
    const store = createStore(createInitialState());
    store.dispatch({
      type: 'api/status',
      payload: { apiStatus: 'error', apiError: 'Invalid request', lastRequestId: 'req-1' },
    });
    expect(store.getState().apiStatus).toBe('error');
    expect(store.getState().lastRequestId).toBe('req-1');
  });

  it('rejects an unknown action type at compile time', () => {
    const store = createStore(createInitialState());
    const bogus: Action = { type: 'nope' } as never;
    store.dispatch(bogus);
    expect(store.getState().apiStatus).toBe('idle');
  });
});
```

- [ ] **Step 10: Implement `src/state/store.ts`**

```ts
import type {
  EventListResponse,
  LocationListResponse,
  ProjectListResponse,
  StatsResponse,
} from '@atlas/contracts';
import type { HealthResponse, Location, LocationLevel, ProjectSummary } from '../data/types.ts';
import type { AtlasFilters } from './filters.ts';
import { EMPTY_FILTERS, toggleInList } from './filters.ts';
import type { TimelineState } from './timeline.ts';
import { clampYear } from './timeline.ts';

export interface AtlasState {
  filters: AtlasFilters;
  focusLocationId: string | null;
  selectedProjectId: string | null;
  level: LocationLevel;
  timeline: TimelineState;
  railOpen: boolean;
  drawerOpen: boolean;
  projects: ProjectSummary[];
  locations: Location[];
  stats: StatsResponse | null;
  health: HealthResponse | null;
  apiStatus: 'idle' | 'loading' | 'ok' | 'error';
  apiError: string | null;
  lastRequestId: string | null;
  globalTotal: number;
  matchingTotal: number;
  mapMode: 'globe' | 'fallback';
  fallbackReason: string | null;
}

export type Action =
  | { type: 'filters/set'; patch: Partial<AtlasFilters> }
  | { type: 'filters/reset' }
  | { type: 'filters/toggleValue'; key: 'type' | 'status' | 'evidence'; value: string }
  | { type: 'focus/set'; locationId: string | null }
  | { type: 'select/project'; projectId: string | null }
  | { type: 'level/set'; level: LocationLevel }
  | { type: 'timeline/setYear'; year: number }
  | { type: 'timeline/play' }
  | { type: 'timeline/pause' }
  | { type: 'timeline/step'; delta: number }
  | { type: 'panel/rail'; open: boolean }
  | { type: 'panel/drawer'; open: boolean }
  | { type: 'data/projects'; payload: ProjectListResponse }
  | { type: 'data/locations'; payload: LocationListResponse }
  | { type: 'data/events'; payload: EventListResponse }
  | { type: 'data/stats'; payload: StatsResponse }
  | { type: 'data/health'; payload: HealthResponse }
  | { type: 'api/status'; payload: Pick<AtlasState, 'apiStatus' | 'apiError' | 'lastRequestId'> }
  | { type: 'map/mode'; payload: { mode: 'globe' | 'fallback'; reason?: string | null } };

export function createInitialState(patch: Partial<AtlasState> = {}): AtlasState {
  return {
    filters: { ...EMPTY_FILTERS },
    focusLocationId: null,
    selectedProjectId: null,
    level: 'WORLD',
    timeline: { year: 2026, playing: false, minYear: 2020, maxYear: 2026 },
    railOpen: true,
    drawerOpen: false,
    projects: [],
    locations: [],
    stats: null,
    health: null,
    apiStatus: 'idle',
    apiError: null,
    lastRequestId: null,
    globalTotal: 0,
    matchingTotal: 0,
    mapMode: 'globe',
    fallbackReason: null,
    ...patch,
  };
}

function toggleFilterValue(state: AtlasState, key: 'type' | 'status' | 'evidence', value: string): AtlasState {
  const current = state.filters[key] as readonly string[];
  return { ...state, filters: { ...state.filters, [key]: toggleInList(current, value) } };
}

export function reduce(state: AtlasState, action: Action): AtlasState {
  switch (action.type) {
    case 'filters/set': {
      const next = { ...state.filters, ...action.patch };
      if (next.yearFrom !== null && next.yearTo !== null && next.yearFrom > next.yearTo) {
        return { ...state, filters: { ...next, yearTo: next.yearFrom } };
      }
      return { ...state, filters: next };
    }
    case 'filters/reset':
      return { ...state, filters: { ...EMPTY_FILTERS }, selectedProjectId: null, drawerOpen: false };
    case 'filters/toggleValue':
      return toggleFilterValue(state, action.key, action.value);
    case 'focus/set':
      return { ...state, focusLocationId: action.locationId };
    case 'select/project':
      return action.projectId === null
        ? { ...state, selectedProjectId: null, drawerOpen: false }
        : { ...state, selectedProjectId: action.projectId, drawerOpen: true };
    case 'level/set':
      return { ...state, level: action.level };
    case 'timeline/setYear':
      return { ...state, timeline: { ...state.timeline, year: clampYear(action.year, state.timeline.minYear, state.timeline.maxYear) } };
    case 'timeline/play':
      return { ...state, timeline: { ...state.timeline, playing: true } };
    case 'timeline/pause':
      return { ...state, timeline: { ...state.timeline, playing: false } };
    case 'timeline/step':
      return {
        ...state,
        timeline: {
          ...state.timeline,
          playing: false,
          year: clampYear(state.timeline.year + action.delta, state.timeline.minYear, state.timeline.maxYear),
        },
      };
    case 'panel/rail':
      return { ...state, railOpen: action.open };
    case 'panel/drawer':
      return { ...state, drawerOpen: action.open };
    case 'data/projects':
      return { ...state, projects: action.payload.data, matchingTotal: action.payload.total };
    case 'data/locations':
      return { ...state, locations: action.payload.data };
    case 'data/events':
      return state;
    case 'data/stats':
      return { ...state, stats: action.payload, globalTotal: action.payload.totals.projects };
    case 'data/health':
      return { ...state, health: action.payload };
    case 'api/status':
      return { ...state, ...action.payload };
    case 'map/mode':
      return {
        ...state,
        mapMode: action.payload.mode,
        fallbackReason: action.payload.mode === 'fallback' ? (action.payload.reason ?? 'unknown') : null,
      };
    default:
      return state;
  }
}

export interface Store {
  getState(): AtlasState;
  dispatch(action: Action): void;
  subscribe(listener: (state: AtlasState) => void): () => void;
}

export function createStore(initial: AtlasState): Store {
  let state = initial;
  const listeners = new Set<(state: AtlasState) => void>();
  return {
    getState: () => state,
    dispatch(action) {
      const next = reduce(state, action);
      if (next === state) return;
      state = next;
      for (const listener of listeners) listener(state);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
```

- [ ] **Step 11: Run the whole web unit suite and typecheck**

Run: `npx vitest run --project web && npm run typecheck -w @atlas/web`
Expected: PASS, 11 files / 67 tests; `tsc --noEmit` clean. The `data/events` branch keeps the switch exhaustive; if `@typescript-eslint` reports the unused action, destructure it as `_action` rather than adding a rule exception.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat(web): add immutable store semantic palette and hierarchy selectors"
```

---

### Task 12: Derived view state and accent normalisation

**Files:**
- Create: `apps/web/src/state/selectors.ts`, `apps/web/src/state/selectors.test.ts`, `apps/web/src/data/normalize.ts`, `apps/web/src/data/normalize.test.ts`

**Interfaces:**
- Consumes: `AtlasState` and `createStore` (Task 11), contract types (Task 10), `safeExternalUrl` (Task 9), `STATUS_COLORS` / `EVIDENCE_COLORS` (Task 11).
- Produces:
  - `interface Cluster { id: string; locationId: string; level: LocationLevel; lat: number; lng: number; count: number; shape: MarkerShape; size: number; color: string }`
  - `interface Selectors { breadcrumb: Location[]; visibleLocations: Location[]; clusters: Cluster[]; accent: string; levelEnabled: Record<LocationLevel, boolean>; visibleYears: number[]; yearOptions: number[]; evidenceSummary: Array<{ level: EvidenceLevel; color: string; count: number }>; statusSummary: Array<{ status: ProjectStatus; color: string; count: number }>; hasSelection: boolean; scaleLabel: string }`
  - `buildSelectors(state: AtlasState): Selectors`
  - `export function pickAccent(project: ProjectSummary): string` — deterministic single accent, never a gradient
  - `export function sortSources(sources: Source[]): Source[]` — primary source first, then publication date descending
  - `export function sortTimelineEvents(events: EventRecord[]): EventRecord[]`
  - `export function visibleProjectsInYear(projects: ProjectSummary[], year: number): ProjectSummary[]`

- [ ] **Step 1: Write the failing normalisation test**

`apps/web/src/data/normalize.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { pickAccent, sortSources, sortTimelineEvents, visibleProjectsInYear } from './normalize.ts';
import { EVIDENCE_COLORS, STATUS_COLORS } from '../state/colors.ts';
import { eventsFixture, projectsFixture, sourcesFixture } from '../testing/fixtures.ts';

describe('pickAccent', () => {
  it('is deterministic for the same project', () => {
    const project = projectsFixture[0];
    expect(pickAccent(project)).toBe(pickAccent({ ...project }));
  });

  it('returns a colour from the fixed palette only', () => {
    const allowed = new Set([...Object.values(STATUS_COLORS), ...Object.values(EVIDENCE_COLORS)]);
    for (const project of projectsFixture) {
      expect(allowed.has(pickAccent(project))).toBe(true);
    }
  });

  it('prefers the status colour when the project has one', () => {
    const deploying = projectsFixture.find((project) => project.status === 'DEPLOYING');
    if (!deploying) throw new Error('fixture must include a DEPLOYING project');
    expect(pickAccent(deploying)).toBe(STATUS_COLORS.DEPLOYING);
  });
});

describe('sortSources', () => {
  it('puts the primary source first', () => {
    const sorted = sortSources(sourcesFixture.map((source, index) => ({ ...source, isPrimary: index === 2 })));
    expect(sorted[0]?.isPrimary).toBe(true);
  });

  it('does not mutate the input', () => {
    const input = [...sourcesFixture];
    sortSources(input);
    expect(input).toEqual([...sourcesFixture]);
  });
});

describe('sortTimelineEvents', () => {
  it('orders by date ascending with no ties left in a random order', () => {
    const sorted = sortTimelineEvents([...eventsFixture].reverse());
    const dates = sorted.map((event) => new Date(event.occurredAt).getTime());
    expect(dates).toEqual([...dates].sort((a, b) => a - b));
  });
});

describe('visibleProjectsInYear', () => {
  it('keeps a project when its window overlaps the year', () => {
    const project = { ...projectsFixture[0], publishedAt: '2020-06-01', endedAt: '2026-06-01' };
    expect(visibleProjectsInYear([project], 2023)).toHaveLength(1);
  });

  it('drops a project whose window ended before the year', () => {
    const project = { ...projectsFixture[0], publishedAt: '2018-01-01', endedAt: '2019-01-01' };
    expect(visibleProjectsInYear([project], 2023)).toHaveLength(0);
  });

  it('keeps a project with no end date', () => {
    const project = { ...projectsFixture[0], publishedAt: '2022-01-01', endedAt: null };
    expect(visibleProjectsInYear([project], 2030)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run it and confirm failure**

Run: `npx vitest run --project web apps/web/src/data/normalize.test.ts`
Expected: FAIL — `Failed to resolve import "./normalize.ts"`.

- [ ] **Step 3: Implement `src/data/normalize.ts`**

```ts
import type {
  EventRecord,
  EvidenceLevel,
  ProjectStatus,
  ProjectSummary,
  Source,
} from './types.ts';
import { EVIDENCE_COLORS, STATUS_COLORS } from '../state/colors.ts';

const STATUS_ORDER: Readonly<Record<ProjectStatus, number>> = {
  OPERATIONAL: 0,
  DEPLOYING: 1,
  EXTENDED: 2,
  ANNOUNCED: 3,
  PREANNOUNCED: 4,
  SUSPENDED: 5,
  COMPLETED: 6,
  CANCELLED: 7,
  UNKNOWN: 8,
};

const EVIDENCE_ORDER: Readonly<Record<EvidenceLevel, number>> = {
  OFFICIAL: 0,
  REPORTED: 1,
  EXPECTED: 2,
  UNVERIFIED: 3,
  DISPUTED: 4,
  RUMOUR: 5,
};

export function pickAccent(project: ProjectSummary): string {
  return STATUS_COLORS[project.status];
}

export function sortSources(sources: readonly Source[]): Source[] {
  return [...sources].sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    return new Date(b.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime();
  });
}

export function sortTimelineEvents(events: readonly EventRecord[]): EventRecord[] {
  return [...events].sort(
    (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
  );
}

export function visibleProjectsInYear(
  projects: readonly ProjectSummary[],
  year: number,
): ProjectSummary[] {
  return projects.filter((project) => {
    const start = project.publishedAt ? new Date(project.publishedAt).getUTCFullYear() : Number.NEGATIVE_INFINITY;
    const end = project.endedAt ? new Date(project.endedAt).getUTCFullYear() : Number.POSITIVE_INFINITY;
    return year >= start && year <= end;
  });
}

export function accentRank(project: ProjectSummary): number {
  return Math.min(STATUS_ORDER[project.status] ?? 9, EVIDENCE_ORDER[project.evidenceLevel] ?? 9);
}

export const ACCENT_FALLBACK = STATUS_COLORS.UNKNOWN;
export const ACCENT_BY_EVIDENCE = EVIDENCE_COLORS;
```

- [ ] **Step 4: Run the normalisation test and confirm it passes**

Run: `npx vitest run --project web apps/web/src/data/normalize.test.ts`
Expected: PASS, 9 tests. If `pickAccent` returns a gradient stop or an HSL string, the "fixed palette only" test fails — a single hex is the contract.

- [ ] **Step 5: Write the failing selectors test**

`apps/web/src/state/selectors.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { buildSelectors } from './selectors.ts';
import { createInitialState, createStore } from './store.ts';
import { listBodies } from '../testing/fixtures.ts';
import type { StatsResponse } from '@atlas/contracts';

function loadedState() {
  const store = createStore(createInitialState());
  store.dispatch({ type: 'data/locations', payload: { ...listBodies.locations } });
  store.dispatch({
    type: 'data/projects',
    payload: { data: listBodies.projects.data, page: 1, pageSize: 50, total: 5, totalPages: 1 },
  });
  // atlasDataFixture.stats doesn't exist; create inline StatsResponse
  const stats: StatsResponse = {
    totals: { projects: 5, locations: 11, sources: 6 },
    byEvidence: { VERIFIED: 0, REPORTED: 4, ANNOUNCED: 1, ANALYSIS: 0, SIGNAL: 0, POSSIBILITY: 0 },
    byType: { PROJECT: 0, NEWS: 0, LAUNCH: 0, COMPANY: 0, GOVERNMENT: 0, UNIVERSITY: 1, RESEARCH: 1, INFRASTRUCTURE: 3, ROBOTICS: 0, POLICY: 1, INVESTMENT: 0, EDUCATION: 0, APPLICATION: 0, IMPACT: 0, SIGNAL: 0, POSSIBILITY: 0 },
    byStatus: { IDEA: 0, RESEARCH: 1, ANNOUNCED: 1, FUNDED: 0, PILOT: 0, BUILDING: 0, DEPLOYING: 1, ACTIVE: 2, SCALING: 0, COMPLETED: 0, PAUSED: 0, CANCELLED: 0 },
  };
  store.dispatch({ type: 'data/stats', payload: stats });
  return store.getState();
}

describe('buildSelectors', () => {
  it('produces one cluster per location, in focus order', () => {
    const selectors = buildSelectors(loadedState());
    expect(selectors.clusters).toHaveLength(11);
    const levels = selectors.clusters.map((cluster) => cluster.level);
    expect(levels[0]).toBe('WORLD');
  });

  it('marks only the levels present in the data as enabled', () => {
    const selectors = buildSelectors(loadedState());
    expect(selectors.levelEnabled.LOCAL_AREA).toBe(true);
    expect(selectors.levelEnabled.REGION).toBe(true);
  });

  it('builds the breadcrumb down to the focused location', () => {
    const store = createStore(createInitialState());
    store.dispatch({ type: 'data/locations', payload: { ...listBodies.locations } });
    store.dispatch({ type: 'focus/set', locationId: 'pucv-campus' });
    const selectors = buildSelectors(store.getState());
    // Fixture has 'valparaiso' not 'valparaiso-city'
    expect(selectors.breadcrumb.map((location) => location.id)).toEqual([
      'world',
      'south-america',
      'chile',
      'valparaiso-region',
      'valparaiso',
      'pucv-campus',
    ]);
  });

  it('counts projects per evidence level and per status for the legend', () => {
    const selectors = buildSelectors(loadedState());
    const total = selectors.evidenceSummary.reduce((sum, entry) => sum + entry.count, 0);
    expect(total).toBe(5);
    const statusTotal = selectors.statusSummary.reduce((sum, entry) => sum + entry.count, 0);
    expect(statusTotal).toBe(5);
  });

  it('derives the year axis from the project windows', () => {
    const selectors = buildSelectors(loadedState());
    expect(selectors.yearOptions.length).toBeGreaterThan(0);
    expect(selectors.yearOptions[0]).toBeLessThanOrEqual(selectors.yearOptions.at(-1) ?? 0);
  });

  it('exposes a single accent, never a list', () => {
    const selectors = buildSelectors(loadedState());
    expect(selectors.accent).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('reports hasSelection from the store', () => {
    const store = createStore(createInitialState());
    expect(buildSelectors(store.getState()).hasSelection).toBe(false);
    store.dispatch({ type: 'select/project', projectId: 'eu-ai-factories' });
    expect(buildSelectors(store.getState()).hasSelection).toBe(true);
  });

  it('is safe on an empty state', () => {
    const selectors = buildSelectors(createInitialState());
    expect(selectors.clusters).toEqual([]);
    expect(selectors.breadcrumb).toEqual([]);
    expect(selectors.accent).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
```

- [ ] **Step 6: Run it and confirm failure**

Run: `npx vitest run --project web apps/web/src/state/selectors.test.ts`
Expected: FAIL — `Failed to resolve import "./selectors.ts"`.

- [ ] **Step 7: Implement `src/state/selectors.ts`**

```ts
import type {
  AtlasState,
} from './store.ts';
import { STATUS_COLORS, EVIDENCE_COLORS, EVIDENCE_INTENTS, evidenceColor, levelLabel, statusColor } from './colors.ts';
import { breadcrumbTrail, descendantIds } from './geo.ts';
import { markerShapeFor, markerSizeFor } from './palette.ts';
import { pickAccent, visibleProjectsInYear } from '../data/normalize.ts';
import { evidenceSchema, locationLevelSchema, projectStatusSchema } from '@atlas/contracts';
import type {
  EvidenceLevel,
  Location,
  LocationLevel,
  ProjectStatus,
  ProjectSummary,
} from '../data/types.ts';
import type { MarkerShape } from './palette.ts';

export interface Cluster {
  id: string;
  locationId: string;
  level: LocationLevel;
  lat: number;
  lng: number;
  count: number;
  shape: MarkerShape;
  size: number;
  color: string;
}

export interface Selectors {
  breadcrumb: Location[];
  visibleLocations: Location[];
  clusters: Cluster[];
  accent: string;
  levelEnabled: Record<LocationLevel, boolean>;
  visibleYears: number[];
  yearOptions: number[];
  evidenceSummary: Array<{ level: EvidenceLevel; color: string; count: number }>;
  statusSummary: Array<{ status: ProjectStatus; color: string; count: number }>;
  hasSelection: boolean;
  scaleLabel: string;
}

const MAX_DENSITY = 4;

function projectsByLocation(projects: readonly ProjectSummary[], locationId: string): ProjectSummary[] {
  return projects.filter((project) => project.locationId === locationId);
}

function locationCenter(location: Location): { lat: number; lng: number } {
  return location.center;
}

export function buildSelectors(state: AtlasState): Selectors {
  const { projects, locations, filters, focusLocationId, timeline } = state;

  const scoped = focusLocationId ? descendantIds(locations, focusLocationId) : locations.map((l) => l.id);
  const scopedSet = new Set(scoped);
  const visibleLocations = locations.filter((location) => scopedSet.has(location.id));

  const yearProjects = visibleProjectsInYear(projects, timeline.year);
  const scopedProjects = focusLocationId
    ? yearProjects.filter((project) => project.locationId && scopedSet.has(project.locationId))
    : yearProjects;

  const maxCount = visibleLocations.reduce((max, location) => {
    const count = projectsByLocation(scopedProjects, location.id).length;
    return Math.max(max, count);
  }, 0);

  const clusters: Cluster[] = visibleLocations.map((location) => {
    const count = projectsByLocation(scopedProjects, location.id).length;
    const density = maxCount === 0 ? 0 : count / maxCount;
    const leading = scopedProjects.find((project) => project.locationId === location.id);
    return {
      id: `${location.id}::${timeline.year}`,
      locationId: location.id,
      level: location.level,
      lat: locationCenter(location).lat,
      lng: locationCenter(location).lng,
      count,
      shape: markerShapeFor(location.level),
      size: markerSizeFor(location.level, density),
      color: leading ? pickAccent(leading) : statusColor('UNKNOWN'),
    };
  });

  const levelEnabled = Object.fromEntries(
    locationLevelSchema.options.map((level) => [level, locations.some((l) => l.level === level)]),
  ) as Record<LocationLevel, boolean>;

  const years = projects
    .flatMap((project) => {
      const start = project.publishedAt ? new Date(project.publishedAt).getUTCFullYear() : null;
      const end = project.endedAt ? new Date(project.endedAt).getUTCFullYear() : null;
      return [start, end].filter((value): value is number => value !== null && Number.isFinite(value));
    })
    .filter((value) => value > 1900 && value < 2100);
  const yearOptions = years.length > 0 ? years : [timeline.year];
  const visibleYears = yearOptions.filter((year) => year <= timeline.year);

  const evidenceSummary = evidenceSchema.options.map((level) => ({
    level,
    color: evidenceColor(level),
    count: projects.filter((project) => project.evidenceLevel === level).length,
  }));

  const statusSummary = projectStatusSchema.options.map((status) => ({
    status,
    color: statusColor(status),
    count: projects.filter((project) => project.status === status).length,
  }));

  const selected = projects.find((project) => project.id === state.selectedProjectId);

  return {
    breadcrumb: breadcrumbTrail(locations, focusLocationId),
    visibleLocations,
    clusters,
    accent: selected ? pickAccent(selected) : STATUS_COLORS.ANNOUNCED,
    levelEnabled,
    visibleYears,
    yearOptions: [...new Set(yearOptions)].sort((a, b) => a - b),
    evidenceSummary,
    statusSummary,
    hasSelection: state.selectedProjectId !== null,
    scaleLabel: levelLabel(state.level),
  };
}

export const SELECTOR_EVIDENCE_COLORS = EVIDENCE_COLORS;
export const SELECTOR_INTENTS = EVIDENCE_INTENTS;
export const SELECTOR_MAX_DENSITY = MAX_DENSITY;
```

Two invariants are enforced by the tests above and must not be relaxed:

- `accent` is always a single six-digit hex from the fixed palette. The default when nothing is selected is `STATUS_COLORS.ANNOUNCED`.
- `scaleLabel` is the Spanish label of the current level, produced by `levelLabel` from `colors.ts` (Task 11). It is never an empty placeholder string, because the E2E suite reads it to assert the scale navigation worked.

- [ ] **Step 8: Run the selectors test and confirm it passes**

Run: `npx vitest run --project web apps/web/src/state/selectors.test.ts apps/web/src/data`
Expected: PASS, 2 files / 17 tests (9 normalize + 8 selectors). If the breadcrumb test fails, the fixture parent chain is wrong — fix the fixture, not the selector.

- [ ] **Step 9: Run the full web unit suite and typecheck**

Run: `npx vitest run --project web && npm run typecheck -w @atlas/web`
Expected: PASS, 13 files / 84 tests; `tsc --noEmit` clean.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(web): derive clusters legend summaries and a single accent"
```

---

### Task 13: Mapbox globe adapter, marker layer and clustering

**Files:**
- Create: `apps/web/src/map/diagnostics.ts`, `apps/web/src/map/diagnostics.test.ts`, `apps/web/src/map/cluster.ts`, `apps/web/src/map/cluster.test.ts`, `apps/web/src/map/markers.ts`, `apps/web/src/map/markers.test.ts`, `apps/web/src/map/globe.ts`, `apps/web/src/map/globe.test.ts`

**Interfaces:**
- Consumes: `Cluster` and `Selectors` (Task 12), `icon` (Task 9), `el` / `svgEl` (Task 9).
- Produces:
  - `interface MapDiagnostics { tokenPresent: boolean; webglAvailable: boolean; constructorError: string | null; styleLoadError: string | null; mode: 'globe' | 'fallback'; reason: string | null }`
  - `interface MapAdapter { mount(container: HTMLElement): void; destroy(): void; setClusters(clusters: Cluster[]): void; focus(cluster: Cluster): void; resize(): void; readonly mode: 'globe' | 'fallback' }`
  - `diagnoseMapEnvironment(options: { token: string | undefined; documentRef?: Document; windowRef?: Window }): MapDiagnostics`
  - `clusterAt(clusters: Cluster[], lat: number, lng: number, radiusPx: number, projection: (cluster: Cluster) => [number, number]): Cluster | null`
  - `createMarkerElement(cluster: Cluster, options: { selected: boolean; reducedMotion: boolean }): HTMLElement`
  - `createGlobeAdapter(options: { token: string; center: [number, number]; zoom: number; onSelect: (cluster: Cluster) => void; onDiagnostics: (diagnostics: MapDiagnostics) => void }): MapAdapter`
  - `INITIAL_CENTER: [number, number]` = `[-71.5430, -33.0472]` (Viña del Mar)
  - `INITIAL_ZOOM = 2.6`, `MIN_ZOOM = 1.4`, `MAX_ZOOM = 11`

- [ ] **Step 1: Write the failing diagnostics test**

`apps/web/src/map/diagnostics.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { diagnoseMapEnvironment } from './diagnostics.ts';

function fakeWindow(webgl: boolean) {
  return {
    devicePixelRatio: 1,
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
  } as unknown as Window & typeof globalThis;
}

function fakeDocumentWithWebgl() {
  return {
    createElement: () => ({
      getContext: (kind: string) => (kind === 'webgl2' || kind === 'webgl' ? (webglAvailable ? {} : null) : null),
    }),
  } as unknown as Document;
}

const webglAvailable = true;

describe('diagnoseMapEnvironment', () => {
  it('reports globe when a token exists and webgl works', () => {
    const result = diagnoseMapEnvironment({
      token: 'pk.test',
      documentRef: fakeDocumentWithWebgl(),
      windowRef: fakeWindow(true),
    });
    expect(result.tokenPresent).toBe(true);
    expect(result.webglAvailable).toBe(true);
    expect(result.mode).toBe('globe');
    expect(result.reason).toBeNull();
  });

  it('falls back with a readable reason when the token is missing', () => {
    const result = diagnoseMapEnvironment({
      token: undefined,
      documentRef: fakeDocumentWithWebgl(),
      windowRef: fakeWindow(true),
    });
    expect(result.tokenPresent).toBe(false);
    expect(result.mode).toBe('fallback');
    expect(result.reason).toBeTruthy();
  });

  it('falls back when webgl is unavailable', () => {
    const result = diagnoseMapEnvironment({
      token: 'pk.test',
      documentRef: {
        createElement: () => ({ getContext: () => null }),
      } as unknown as Document,
      windowRef: fakeWindow(false),
    });
    expect(result.webglAvailable).toBe(false);
    expect(result.mode).toBe('fallback');
  });

  it('never throws, whatever the environment', () => {
    const result = diagnoseMapEnvironment({
      token: '',
      documentRef: {
        createElement: () => {
          throw new Error('no dom');
        },
      } as unknown as Document,
      windowRef: fakeWindow(true),
    });
    expect(result.mode).toBe('fallback');
  });
});
```

- [ ] **Step 2: Run it and confirm failure**

Run: `npx vitest run --project web apps/web/src/map/diagnostics.test.ts`
Expected: FAIL — `Failed to resolve import "./diagnostics.ts"`.

- [ ] **Step 3: Implement `src/map/diagnostics.ts`**

```ts
export interface MapDiagnostics {
  tokenPresent: boolean;
  webglAvailable: boolean;
  constructorError: string | null;
  styleLoadError: string | null;
  mode: 'globe' | 'fallback';
  reason: string | null;
}

function hasWebgl(documentRef: Document): boolean {
  try {
    const canvas = documentRef.createElement('canvas');
    return (
      canvas.getContext('webgl2') !== null ||
      canvas.getContext('webgl') !== null
    );
  } catch {
    return false;
  }
}

export function diagnoseMapEnvironment(options: {
  token: string | undefined;
  documentRef?: Document;
  windowRef?: Window;
}): MapDiagnostics {
  const documentRef = options.documentRef ?? globalThis.document;
  const tokenPresent = typeof options.token === 'string' && options.token.trim().length > 0;
  const webglAvailable = hasWebgl(documentRef);

  if (!tokenPresent) {
    return {
      tokenPresent: false,
      webglAvailable,
      constructorError: null,
      styleLoadError: null,
      mode: 'fallback',
      reason: 'Mapbox token missing (VITE_MAPBOX_TOKEN)',
    };
  }
  if (!webglAvailable) {
    return {
      tokenPresent: true,
      webglAvailable: false,
      constructorError: null,
      styleLoadError: null,
      mode: 'fallback',
      reason: 'WebGL unavailable in this browser',
    };
  }
  return {
    tokenPresent: true,
    webglAvailable: true,
    constructorError: null,
    styleLoadError: null,
    mode: 'globe',
    reason: null,
  };
}
```

- [ ] **Step 4: Run the diagnostics test and confirm it passes**

Run: `npx vitest run --project web apps/web/src/map/diagnostics.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Write the failing cluster and marker tests**

`apps/web/src/map/cluster.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { clusterAt } from './cluster.ts';
import type { Cluster } from '../state/selectors.ts';

function cluster(id: string, x: number, y: number, count = 1): Cluster {
  return {
    id,
    locationId: id,
    level: 'CITY',
    lat: 0,
    lng: 0,
    count,
    shape: 'diamond',
    size: 10,
    color: '#4b8cff',
  };
}

const identity = (c: Cluster): [number, number] => [Number(c.id.replace('c', '')), 0];

describe('clusterAt', () => {
  it('returns the cluster under the pointer', () => {
    const clusters = [cluster('c1', 10, 0), cluster('c2', 200, 0)];
    expect(clusterAt(clusters, 0, 0, 12, identity)?.id).toBe('c1');
  });

  it('returns null when the pointer is outside every radius', () => {
    const clusters = [cluster('c1', 10, 0), cluster('c2', 200, 0)];
    // Pointer at (100, 0) - both clusters at x=1 and x=2 are far outside radius 12
    expect(clusterAt(clusters, 100, 0, 12, identity)).toBeNull();
  });

  it('prefers the densest cluster when two overlap at same distance', () => {
    const clusters = [cluster('c1', 10, 0, 1), cluster('c2', 11, 0, 9)];
    // Both clusters at distance 0.5 from pointer at x=1.5
    expect(clusterAt(clusters, 1.5, 0, 20, identity)?.id).toBe('c2');
  });

  it('is safe with no clusters', () => {
    expect(clusterAt([], 0, 0, 10, identity)).toBeNull();
  });
});
```

`apps/web/src/map/markers.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { createMarkerElement } from './markers.ts';
import type { Cluster } from '../state/selectors.ts';
import { MARKER_SHAPES } from '../state/palette.ts';

const base: Cluster = {
  id: 'valparaiso::2026',
  locationId: 'valparaiso',
  level: 'CITY',
  lat: -33.0472,
  lng: -71.543,
  count: 2,
  shape: 'diamond',
  size: 14,
  color: '#4b8cff',
};

describe('createMarkerElement', () => {
  it('is a button with an accessible name and a data hook', () => {
    const node = createMarkerElement(base, { selected: false, reducedMotion: false });
    expect(node.tagName).toBe('BUTTON');
    expect(node.getAttribute('type')).toBe('button');
    expect(node.getAttribute('aria-label')).toBeTruthy();
    expect(node.getAttribute('data-cluster-id')).toBe(base.locationId);
  });

  it('never renders a solid circle fill', () => {
    const node = createMarkerElement(base, { selected: false, reducedMotion: false });
    expect(node.querySelectorAll('circle[fill]').length).toBe(0);
    expect(node.innerHTML).not.toContain('fill:#');
  });

  it('draws a different glyph per level', () => {
    const shapes = (['WORLD', 'CONTINENT', 'COUNTRY', 'REGION', 'CITY', 'LOCAL_AREA'] as const).map(
      (level) =>
        createMarkerElement(
          { ...base, level, shape: MARKER_SHAPES[level] },
          { selected: false, reducedMotion: false },
        ).querySelector('svg')?.firstElementChild?.tagName.toLowerCase(),
    );
    expect(new Set(shapes).size).toBeGreaterThan(2);
  });

  it('adds a counter only when the count is above one', () => {
    expect(createMarkerElement(base, { selected: false, reducedMotion: false }).textContent).toBe('2');
    const single = createMarkerElement({ ...base, count: 1 }, { selected: false, reducedMotion: false });
    expect(single.textContent).toBe('');
  });

  it('drops every animation class when motion is reduced', () => {
    const reduced = createMarkerElement(base, { selected: true, reducedMotion: true });
    expect(reduced.className).not.toContain('marker-pulse');
    expect(reduced.className).not.toContain('marker-orbit');
    const full = createMarkerElement(base, { selected: true, reducedMotion: false });
    expect(full.className).toContain('marker-orbit');
  });

  it('marks the selected cluster for the camera', () => {
    const selected = createMarkerElement(base, { selected: true, reducedMotion: false });
    expect(selected.getAttribute('aria-pressed')).toBe('true');
    expect(createMarkerElement(base, { selected: false, reducedMotion: false }).getAttribute('aria-pressed')).toBe('false');
  });
});
```

- [ ] **Step 6: Run them and confirm failure**

Run: `npx vitest run --project web apps/web/src/map/cluster.test.ts apps/web/src/map/markers.test.ts`
Expected: FAIL — `Failed to resolve import "./cluster.ts"` and `"./markers.ts"`.

- [ ] **Step 7: Implement `src/map/cluster.ts` and `src/map/markers.ts`**

`src/map/cluster.ts`:
```ts
import type { Cluster } from '../state/selectors.ts';

export function clusterAt(
  clusters: readonly Cluster[],
  x: number,
  y: number,
  radiusPx: number,
  projection: (cluster: Cluster) => [number, number],
): Cluster | null {
  let best: Cluster | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const cluster of clusters) {
    const [px, py] = projection(cluster);
    const distance = Math.hypot(px - x, py - y);
    if (distance > radiusPx) continue;
    if (distance < bestDistance || (distance === bestDistance && cluster.count > (best?.count ?? 0))) {
      best = cluster;
      bestDistance = distance;
    }
  }
  return best;
}
```

`src/map/markers.ts`:
```ts
import { el, svgEl } from '../ui/dom.ts';
import { levelLabel, statusLabel } from '../state/colors.ts';
import type { Cluster } from '../state/selectors.ts';
import type { MarkerShape } from '../state/palette.ts';

const GLYPH: Readonly<Record<MarkerShape, () => SVGElement>> = {
  ring: () => svgEl('circle', { cx: 10, cy: 10, r: 8, fill: 'none', 'stroke-width': 1.25 }),
  circle: () =>
    svgEl('path', {
      d: 'M10 1 a9 9 0 1 0 0.01 0',
      fill: 'none',
      'stroke-width': 1.25,
    }),
  triangle: () => svgEl('path', { d: 'M10 1 L19 17 L1 17 Z', fill: 'none', 'stroke-width': 1.25 }),
  square: () => svgEl('rect', { x: 2, y: 2, width: 16, height: 16, fill: 'none', 'stroke-width': 1.25 }),
  diamond: () => svgEl('path', { d: 'M10 1 L19 10 L10 19 L1 10 Z', fill: 'none', 'stroke-width': 1.25 }),
  dot: () => svgEl('circle', { cx: 10, cy: 10, r: 3.5, fill: 'currentColor' }),
};

export interface MarkerOptions {
  selected: boolean;
  reducedMotion: boolean;
}

export function createMarkerElement(cluster: Cluster, options: MarkerOptions): HTMLButtonElement {
  const classes = ['atlas-marker', `atlas-marker--${cluster.level.toLowerCase()}`];
  if (options.selected) classes.push('atlas-marker--selected');
  if (!options.reducedMotion && cluster.count > 0) {
    classes.push(cluster.level === 'LOCAL_AREA' ? 'marker-pulse' : 'marker-orbit');
  }

  const svg = svgEl('svg', {
    width: cluster.size,
    height: cluster.size,
    viewBox: '0 0 20 20',
    fill: 'none',
    stroke: cluster.color,
    'aria-hidden': 'true',
    focusable: 'false',
  });
  svg.append(GLYPH[cluster.shape]());

  const button = el('button', {
    type: 'button',
    class: classes.join(' '),
    style: `color: ${cluster.color};`,
    'aria-pressed': String(options.selected),
    'aria-label': `${levelLabel(cluster.level)} · ${cluster.count} ${cluster.count === 1 ? 'proyecto' : 'proyectos'}`,
    'data-cluster-id': cluster.locationId,
    'data-level': cluster.level,
  }) as HTMLButtonElement;

  button.append(svg);
  if (cluster.count > 1) {
    button.append(el('span', { class: 'atlas-marker__count', text: String(cluster.count) }));
  }
  return button;
}
```

- [ ] **Step 8: Run the cluster and marker tests and confirm they pass**

Run: `npx vitest run --project web apps/web/src/map`
Expected: PASS, 3 files / 14 tests. The "never renders a solid circle fill" test is the P0-shape guard: if it fails, a marker regressed to a filled disc.

- [ ] **Step 9: Write the failing globe test**

`apps/web/src/map/globe.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest';
import { INITIAL_CENTER, INITIAL_ZOOM, MAX_ZOOM, MIN_ZOOM, createGlobeAdapter } from './globe.ts';

function fakeMapClass() {
  const instances: Array<{
    options: Record<string, unknown>;
    fire: (event: string, payload: unknown) => void;
    on: (event: string, handler: (event: unknown) => void) => unknown;
    once: (event: string, handler: (event: unknown) => void) => unknown;
    off: (event: string) => unknown;
    rotateTo?: ReturnType<typeof vi.fn>;
    addSource: ReturnType<typeof vi.fn>;
    addLayer: ReturnType<typeof vi.fn>;
    removeLayer: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    resize: ReturnType<typeof vi.fn>;
    easeTo: ReturnType<typeof vi.fn>;
    flyTo: ReturnType<typeof vi.fn>;
    setProjection: ReturnType<typeof vi.fn>;
    querySourceFeatures: ReturnType<typeof vi.fn>;
    getCanvas: ReturnType<typeof vi.fn>;
  }> = [];
  class FakeMap {
    options: Record<string, unknown>;
    private handlers = new Map<string, (event: unknown) => void>();
    constructor(options: Record<string, unknown>) {
      this.options = options;
      instances.push(this as typeof instances[0]);
    }
    on(event: string, handler: (event: unknown) => void) {
      this.handlers.set(event, handler);
      return this;
    }
    once(event: string, handler: (event: unknown) => void) {
      this.handlers.set(event, handler);
      return this;
    }
    off(event: string) {
      this.handlers.delete(event);
      return this;
    }
    fire(event: string, payload: unknown) {
      this.handlers.get(event)?.(payload);
    }
    addSource = vi.fn();
    addLayer = vi.fn();
    removeLayer = vi.fn();
    remove = vi.fn();
    resize = vi.fn();
    easeTo = vi.fn();
    flyTo = vi.fn();
    setProjection = vi.fn();
    querySourceFeatures = vi.fn(() => []);
    getCanvas = vi.fn(() => ({ style: {} }));
  }
  return { FakeMap, instances };
}

describe('globe defaults', () => {
  it('pins the initial camera to Viña del Mar without rotation', () => {
    expect(INITIAL_CENTER).toEqual([-71.543, -33.0472]);
    expect(INITIAL_ZOOM).toBeLessThan(4);
    expect(MIN_ZOOM).toBeLessThan(INITIAL_ZOOM);
    expect(MAX_ZOOM).toBeGreaterThan(INITIAL_ZOOM);
  });
});

describe('createGlobeAdapter', () => {
  it('requests the globe projection and disables autorotate', async () => {
    const { FakeMap, instances } = fakeMapClass();
    const onDiagnostics = vi.fn();
    const adapter = createGlobeAdapter({
      token: 'pk.test',
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
      mapbox: FakeMap as never,
      onSelect: vi.fn(),
      onDiagnostics,
    });
    adapter.mount(document.createElement('div'));
    expect(instances).toHaveLength(1);
    const options = instances[0]?.options ?? {};
    expect(options.projection).toBe('globe');
    // projectionResolutions is not a standard Mapbox option; the test expectation was a plan defect
  });

  it('does not install a rotate or autoplay loop', async () => {
    const { FakeMap, instances } = fakeMapClass();
    const adapter = createGlobeAdapter({
      token: 'pk.test',
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
      mapbox: FakeMap as never,
      onSelect: vi.fn(),
      onDiagnostics: vi.fn(),
    });
    adapter.mount(document.createElement('div'));
    const map = instances[0];
    expect(map?.rotateTo).toBeUndefined();
    expect(map?.setProjection).toBeDefined();
  });

  it('reports diagnostics after mount', async () => {
    const { FakeMap, instances } = fakeMapClass();
    const onDiagnostics = vi.fn();
    const adapter = createGlobeAdapter({
      token: 'pk.test',
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
      mapbox: FakeMap as never,
      onSelect: vi.fn(),
      onDiagnostics,
    });
    adapter.mount(document.createElement('div'));
    // Fire the load event to trigger diagnostics callback (plan defect: test didn't fire load)
    const mapInstance = instances[0];
    if (mapInstance) {
      mapInstance.fire('load', {});
    }
    expect(onDiagnostics).toHaveBeenCalled();
    expect(onDiagnostics.mock.calls.at(-1)?.[0]).toMatchObject({ mode: 'globe' });
  });

  it('tears down cleanly', async () => {
    const { FakeMap, instances } = fakeMapClass();
    const adapter = createGlobeAdapter({
      token: 'pk.test',
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
      mapbox: FakeMap as never,
      onSelect: vi.fn(),
      onDiagnostics: vi.fn(),
    });
    adapter.mount(document.createElement('div'));
    adapter.destroy();
    expect(instances[0]?.remove).toHaveBeenCalled();
  });
});
```

- [ ] **Step 10: Run the globe test and confirm failure**

Run: `npx vitest run --project web apps/web/src/map/globe.test.ts`
Expected: FAIL — `Failed to resolve import "./globe.ts"`.

- [ ] **Step 11: Implement `src/map/globe.ts`**

```ts
import { createMarkerElement } from './markers.ts';
import { clusterAt } from './cluster.ts';
import type { MapDiagnostics } from './diagnostics.ts';
import type { Cluster } from '../state/selectors.ts';

export const INITIAL_CENTER: [number, number] = [-71.543, -33.0472];
export const INITIAL_ZOOM = 2.6;
export const MIN_ZOOM = 1.4;
export const MAX_ZOOM = 11;

export interface MapAdapter {
  mount(container: HTMLElement): void;
  destroy(): void;
  setClusters(clusters: Cluster[]): void;
  focus(cluster: Cluster): void;
  resize(): void;
  readonly mode: 'globe' | 'fallback';
}

export interface GlobeAdapterOptions {
  token: string;
  center: [number, number];
  zoom: number;
  onSelect: (cluster: Cluster) => void;
  onDiagnostics: (diagnostics: MapDiagnostics) => void;
  mapbox?: unknown;
}

interface MapLike {
  options: Record<string, unknown>;
  on(event: string, handler: (payload: never) => void): MapLike;
  once(event: string, handler: (payload: never) => void): MapLike;
  off(event: string): MapLike;
  remove(): void;
  resize(): void;
  easeTo(options: Record<string, unknown>): void;
  project(lngLat: [number, number]): { x: number; y: number };
  getCanvas(): { style: Record<string, string> };
}

export function createGlobeAdapter(options: GlobeAdapterOptions): MapAdapter {
  let map: MapLike | null = null;
  let markerLayer: HTMLElement | null = null;
  let clusters: Cluster[] = [];
  let selectedId: string | null = null;
  let reducedMotion = false;
  const markers = new Map<string, HTMLButtonElement>();
  let container: HTMLElement | null = null;

  const reducedMotionQuery =
    typeof globalThis.matchMedia === 'function'
      ? globalThis.matchMedia('(prefers-reduced-motion: reduce)')
      : null;
  reducedMotion = reducedMotionQuery?.matches ?? false;

  function renderMarkers(): void {
    if (!markerLayer) return;
    const seen = new Set<string>();
    for (const cluster of clusters) {
      seen.add(cluster.locationId);
      const existing = markers.get(cluster.locationId);
      const node =
        existing ??
        createMarkerElement(cluster, {
          selected: selectedId === cluster.locationId,
          reducedMotion,
        });
      if (!existing) {
        node.addEventListener('click', () => options.onSelect(cluster));
        markers.set(cluster.locationId, node);
      }
      node.setAttribute('aria-pressed', String(selectedId === cluster.locationId));
      if (!node.isConnected) markerLayer.append(node);
    }
    for (const [id, node] of markers) {
      if (!seen.has(id)) {
        node.remove();
        markers.delete(id);
      }
    }
  }

  function handleClick(event: never): void {
    if (!map) return;
    const payload = event as unknown as { point: { x: number; y: number } };
    const hit = clusterAt(
      clusters,
      payload.point.x,
      payload.point.y,
      18,
      (cluster) => {
        const projected = map?.project([cluster.lng, cluster.lat]);
        return projected ? [projected.x, projected.y] : [Number.NaN, Number.NaN];
      },
    );
    if (hit) options.onSelect(hit);
  }

  return {
    get mode() {
      return 'globe';
    },
    mount(target) {
      const MapCtor = (options.mapbox ?? (globalThis as { mapboxgl?: unknown }).mapboxgl) as
        | (new (options: Record<string, unknown>) => MapLike)
        | undefined;
      if (!MapCtor) {
        options.onDiagnostics({
          tokenPresent: true,
          webglAvailable: true,
          constructorError: 'mapboxgl is not loaded',
          styleLoadError: null,
          mode: 'fallback',
          reason: 'Mapbox GL failed to load',
        });
        return;
      }
      container = target;
      markerLayer = document.createElement('div');
      markerLayer.className = 'atlas-markers';
      markerLayer.setAttribute('data-testid', 'marker-layer');
      try {
        map = new MapCtor({
          container: target,
          accessToken: options.token,
          style: 'mapbox://styles/mapbox/dark-v11',
          projection: 'globe',
          center: options.center,
          zoom: options.zoom,
          minZoom: MIN_ZOOM,
          maxZoom: MAX_ZOOM,
          attributionControl: true,
          dragRotate: true,
          pitchWithRotate: false,
        });
      } catch (error) {
        options.onDiagnostics({
          tokenPresent: true,
          webglAvailable: true,
          constructorError: error instanceof Error ? error.message : String(error),
          styleLoadError: null,
          mode: 'fallback',
          reason: 'Mapbox GL constructor threw',
        });
        return;
      }
      map.on('load' as never, (() => {
        target.append(markerLayer as HTMLElement);
        renderMarkers();
        options.onDiagnostics({
          tokenPresent: true,
          webglAvailable: true,
          constructorError: null,
          styleLoadError: null,
          mode: 'globe',
          reason: null,
        });
      }) as never);
      map.on('click' as never, handleClick as never);
      map.on('error' as never, ((payload: { error?: Error }) => {
        options.onDiagnostics({
          tokenPresent: true,
          webglAvailable: true,
          constructorError: null,
          styleLoadError: payload.error?.message ?? 'style error',
          mode: 'globe',
          reason: null,
        });
      }) as never);
    },
    setClusters(next) {
      clusters = next;
      selectedId = next.length === 1 ? next[0]?.locationId ?? null : null;
      renderMarkers();
    },
    focus(cluster) {
      selectedId = cluster.locationId;
      map?.easeTo({ center: [cluster.lng, cluster.lat], zoom: Math.max(cluster.level === 'LOCAL_AREA' ? 11 : 6, 4), duration: reducedMotion ? 0 : 420 });
      renderMarkers();
    },
    resize() {
      map?.resize();
    },
    destroy() {
      for (const node of markers.values()) node.remove();
      markers.clear();
      markerLayer?.remove();
      markerLayer = null;
      map?.off('click' as never);
      map?.remove();
      map = null;
      void container;
    },
  };
}
```

The adapter is written against a structural `MapLike` type, not against Mapbox's own typings, so the unit test can inject a fake. Two constraints to hold while editing this file:

- **No `rotateTo` call anywhere, ever.** A direct `rotateTo` invocation, or a `setInterval`/`requestAnimationFrame` loop that eases the bearing, violates the spec and will fail review. The `dragRotate: true` option only allows the *user* to rotate.
- **`setProjection` must not be called on init.** Projection is chosen once via the `projection: 'globe'` constructor option.

- [ ] **Step 12: Run the whole map suite and typecheck**

Run: `npx vitest run --project web apps/web/src/map && npm run typecheck -w @atlas/web`
Expected: PASS, 4 files / 19 tests; `tsc --noEmit` clean.

- [ ] **Step 13: Add the marker-layer styles to `components.css`**

Append to `apps/web/src/styles/components.css`:
```css
.atlas-markers {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 5;
}

.atlas-marker {
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transform: translate(-50%, -50%);
  pointer-events: auto;
  background: none;
  border: none;
}

.atlas-marker svg {
  display: block;
  overflow: visible;
}

.atlas-marker__count {
  position: absolute;
  top: -6px;
  right: -10px;
  min-width: 15px;
  padding: 0 3px;
  border-radius: 999px;
  background: var(--color-obsidian);
  color: var(--color-warm-white);
  font-size: 10px;
  line-height: 15px;
  text-align: center;
}

.atlas-marker--selected {
  filter: drop-shadow(0 0 6px currentColor);
}

.atlas-marker--selected::after {
  content: '';
  position: absolute;
  inset: -6px;
  border: 1px solid currentColor;
  border-radius: 50%;
  opacity: 0.5;
}
```

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "feat(web): add map diagnostics clustering markers and the globe adapter"
```

---

### Task 14: Data-only fallback map and diagnostics banner

**Files:**
- Create: `apps/web/src/map/fallback.ts`, `apps/web/src/map/fallback.test.ts`

**Interfaces:**
- Consumes: `Cluster` (Task 12), `createMarkerElement` (Task 13), `safeExternalUrl` (Task 9), `MapDiagnostics` (Task 13).
- Produces:
  - `projectToEquirectangular(cluster: Cluster, width: number, height: number): { x: number; y: number }`
  - `createFallbackAdapter(options: { reason: string; onSelect: (cluster: Cluster) => void; width?: number; height?: number }): MapAdapter`
  - Fallback DOM contract: `[data-testid="fallback"]`, `[data-testid="fallback-diagnostic"]`, `[data-testid="project-list"]`
  - The fallback is a plain SVG graticule with a `WORLD` `REGION` `CITY` scale bar. It renders **no** tiles, **no** vendor basemap and **no** invented geometry.

- [ ] **Step 1: Write the failing fallback test**

`apps/web/src/map/fallback.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest';
import { createFallbackAdapter, projectToEquirectangular } from './fallback.ts';
import type { Cluster } from '../state/selectors.ts';
import { clustersFixture } from '../testing/fixtures.ts';

describe('projectToEquirectangular', () => {
  it('maps the equator to the vertical middle', () => {
    const point = projectToEquirectangular(clustersFixture.find((c) => c.lat === 0) ?? { ...clustersFixture[0], lat: 0, lng: 0 }, 800, 400);
    expect(point.y).toBeCloseTo(200, 5);
  });

  it('maps the prime meridian to the horizontal middle', () => {
    const point = projectToEquirectangular({ ...clustersFixture[0], lat: 0, lng: 0 }, 800, 400);
    expect(point.x).toBeCloseTo(400, 5);
  });

  it('puts the eastern hemisphere on the right', () => {
    const east = projectToEquirectangular({ ...clustersFixture[0], lat: 0, lng: 120 }, 800, 400);
    const west = projectToEquirectangular({ ...clustersFixture[0], lat: 0, lng: -120 }, 800, 400);
    expect(east.x).toBeGreaterThan(west.x);
  });

  it('keeps every point inside the viewport', () => {
    for (const cluster of clustersFixture) {
      const { x, y } = projectToEquirectangular(cluster, 800, 400);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(800);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(400);
    }
  });
});

describe('createFallbackAdapter', () => {
  function mountWith(clusters: Cluster[]) {
    const container = document.createElement('div');
    document.body.append(container);
    const onSelect = vi.fn();
    const adapter = createFallbackAdapter({ reason: 'Mapbox token missing', onSelect, width: 800, height: 400 });
    adapter.mount(container);
    adapter.setClusters(clusters);
    return { container, adapter, onSelect };
  }

  it('renders a visible diagnostic explaining the fallback', () => {
    const { container } = mountWith(clustersFixture);
    const diagnostic = container.querySelector('[data-testid="fallback-diagnostic"]');
    expect(diagnostic).not.toBeNull();
    expect(diagnostic?.textContent).toContain('Mapbox token missing');
  });

  it('renders a graticule and a list, and no vendor basemap', () => {
    const { container } = mountWith(clustersFixture);
    expect(container.querySelector('svg')).not.toBeNull();
    expect(container.querySelector('[data-testid="project-list"]')).not.toBeNull();
    expect(container.innerHTML).not.toContain('mapbox');
    expect(container.querySelectorAll('img')).toHaveLength(0);
  });

  it('renders one interactive marker per cluster', () => {
    const { container } = mountWith(clustersFixture);
    expect(container.querySelectorAll('[data-cluster-id]')).toHaveLength(clustersFixture.length);
  });

  it('reports the selection when a marker is activated', () => {
    const { container, onSelect } = mountWith(clustersFixture);
    const first = container.querySelector<HTMLButtonElement>('[data-cluster-id]');
    first?.click();
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]?.[0]).toMatchObject({ locationId: expect.any(String) });
  });

  it('exposes mode fallback and tears down', () => {
    const { container, adapter } = mountWith(clustersFixture);
    expect(adapter.mode).toBe('fallback');
    adapter.destroy();
    expect(container.children).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Add the shared cluster fixture**

Append to `apps/web/src/testing/fixtures.ts`:
```ts
import type { Cluster } from '../state/selectors.ts';
import { EVIDENCE_COLORS, STATUS_COLORS } from '../state/colors.ts';
import { markerShapeFor, markerSizeFor } from '../state/palette.ts';

/** One cluster per fixture location, derived the same way `buildSelectors` derives them. */
export const clustersFixture: Cluster[] = locationsFixture.map((location, index) => ({
  id: `${location.id}::2026`,
  locationId: location.id,
  level: location.level,
  lat: location.center.lat,
  lng: location.center.lng,
  count: projectsFixture.filter((project) => project.locationId === location.id).length,
  shape: markerShapeFor(location.level),
  size: markerSizeFor(location.level, index / locationsFixture.length),
  color: STATUS_COLORS.ANNOUNCED,
}));

export const fallbackAccents = EVIDENCE_COLORS;
```

- [ ] **Step 3: Run the fallback test and confirm failure**

Run: `npx vitest run --project web apps/web/src/map/fallback.test.ts`
Expected: FAIL — `Failed to resolve import "./fallback.ts"` and missing `clustersFixture`.

- [ ] **Step 4: Implement `src/map/fallback.ts`**

```ts
import { createMarkerElement } from './markers.ts';
import { el, svgEl } from '../ui/dom.ts';
import { icon } from '../ui/icons.ts';
import { levelLabel } from '../state/colors.ts';
import type { MapAdapter } from './globe.ts';
import type { Cluster } from '../state/selectors.ts';

const MERIDIANS = [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150];
const PARALLELS = [-60, -30, 0, 30, 60];

export function projectToEquirectangular(
  cluster: Pick<Cluster, 'lat' | 'lng'>,
  width: number,
  height: number,
): { x: number; y: number } {
  const x = ((cluster.lng + 180) / 360) * width;
  const y = ((90 - cluster.lat) / 180) * height;
  return { x, y };
}

export interface FallbackOptions {
  reason: string;
  onSelect: (cluster: Cluster) => void;
  width?: number;
  height?: number;
}

export function createFallbackAdapter(options: FallbackOptions): MapAdapter {
  let root: HTMLElement | null = null;
  let overlay: HTMLElement | null = null;
  let clusters: Cluster[] = [];

  function render(): void {
    if (!root || !overlay) return;
    const width = options.width ?? root.clientWidth ?? 960;
    const height = options.height ?? root.clientHeight ?? 540;

    const graticule = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, role: 'presentation' });
    for (const lng of MERIDIANS) {
      const { x } = projectToEquirectangular({ lat: 0, lng }, width, height);
      graticule.append(
        svgEl('line', { x1: x, y1: 0, x2: x, y2: height, stroke: '#232936', 'stroke-width': 1 }),
      );
    }
    for (const lat of PARALLELS) {
      const { y } = projectToEquirectangular({ lat, lng: 0 }, width, height);
      graticule.append(
        svgEl('line', { x1: 0, y1: y, x2: width, y2: height, stroke: '#232936', 'stroke-width': 1 }),
      );
    }

    for (const cluster of clusters) {
      const { x, y } = projectToEquirectangular(cluster, width, height);
      const marker = createMarkerElement(cluster, { selected: false, reducedMotion: true });
      marker.style.position = 'absolute';
      marker.style.left = `${x}px`;
      marker.style.top = `${y}px`;
      marker.addEventListener('click', () => options.onSelect(cluster));
      overlay.append(marker);
    }

    const list = el('div', { class: 'project-list', 'data-testid': 'project-list' });
    for (const cluster of clusters) {
      if (cluster.count === 0) continue;
      list.append(
        el(
          'button',
          {
            type: 'button',
            class: 'project-list__item',
            'data-cluster-id': cluster.locationId,
            onClick: () => options.onSelect(cluster),
          },
          [
            el('span', { class: 'project-list__level', text: levelLabel(cluster.level) }),
            el('span', { text: ` · ${cluster.count} ${cluster.count === 1 ? 'proyecto' : 'proyectos'}` }),
          ],
        ),
      );
    }
    if (list.childNodes.length === 0) {
      list.append(el('p', { class: 'empty-state', text: 'Sin proyectos para los filtros actuales.' }));
    }

    overlay.replaceChildren(graticule, list);
  }

  return {
    get mode() {
      return 'fallback';
    },
    mount(target) {
      root = el('div', { class: 'fallback', 'data-testid': 'fallback' });
      const banner = el('div', {
        class: 'fallback__diagnostic',
        'data-testid': 'fallback-diagnostic',
        role: 'status',
      });
      banner.append(icon('layers', 14), el('span', { text: `Vista de datos · ${options.reason}` }));
      overlay = el('div', { class: 'fallback__graticule' });
      root.append(banner, overlay);
      target.append(root);
    },
    setClusters(next) {
      clusters = next;
      render();
    },
    focus(cluster) {
      const { x, y } = projectToEquirectangular(cluster, options.width ?? 960, options.height ?? 540);
      overlay?.scrollTo?.({ left: Math.max(0, x - 120), top: Math.max(0, y - 120) });
    },
    resize() {
      render();
    },
    destroy() {
      root?.remove();
      root = null;
      overlay = null;
      clusters = [];
    },
  };
}
```

One correction to apply while writing this file: `el()` does not support an `onClick` prop — it only sets attributes, and `onClick` would become a literal `onclick="[object Function]"` attribute. Attach the listener after building the node:

```ts
      const item = el(
        'button',
        {
          type: 'button',
          class: 'project-list__item',
          'data-cluster-id': cluster.locationId,
        },
        [
          el('span', { class: 'project-list__level', text: levelLabel(cluster.level) }),
          el('span', { text: ` · ${cluster.count} ${cluster.count === 1 ? 'proyecto' : 'proyectos'}` }),
        ],
      );
      item.addEventListener('click', () => options.onSelect(cluster));
      list.append(item);
```

- [ ] **Step 5: Run the fallback test and confirm it passes**

Run: `npx vitest run --project web apps/web/src/map`
Expected: PASS, 5 files / 26 tests.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(web): add data-only fallback map with an honest diagnostic banner"
```

---

### Task 15: Shell, header, breadcrumb, status badge and legend

**Files:**
- Create: `apps/web/src/ui/shell.ts`, `apps/web/src/ui/shell.test.ts`, `apps/web/src/ui/header.ts`, `apps/web/src/ui/header.test.ts`, `apps/web/src/ui/breadcrumb.ts`, `apps/web/src/ui/breadcrumb.test.ts`, `apps/web/src/ui/statusBadge.ts`, `apps/web/src/ui/statusBadge.test.ts`, `apps/web/src/ui/legend.ts`, `apps/web/src/ui/legend.test.ts`

**Interfaces:**
- Consumes: `el` / `svgEl` (Task 9), `icon` (Task 9), `Selectors` (Task 12), `AtlasState` (Task 11).
- Produces:
  - `interface ShellRefs { root: HTMLElement; header: HTMLElement; rail: HTMLElement; map: HTMLElement; drawer: HTMLElement; strip: HTMLElement }`
  - `createShell(host: HTMLElement): ShellRefs` — builds the six grid areas with the `data-testid` hooks and the map host `data-testid="map-host"`.
  - `interface HeaderRefs { root: HTMLElement; breadcrumb: HTMLElement; search: HTMLInputElement; status: HTMLElement; railToggle: HTMLButtonElement }`
  - `createHeader(refs: ShellRefs, handlers: { onSearch: (value: string) => void; onRailToggle: () => void }): HeaderRefs`
  - `renderBreadcrumb(node: HTMLElement, trail: Location[], handlers: { onFocus: (locationId: string | null) => void }): void`
  - `renderStatusBadge(node: HTMLElement, state: Pick<AtlasState, 'apiStatus' | 'apiError' | 'globalTotal' | 'matchingTotal' | 'lastRequestId'>): void`
  - `renderLegend(node: HTMLElement, selectors: Selectors): void`
  - Rendered text: status badge shows `Conexión estable` / `Sin conexión` / `Cargando…`; the counters use `matching-count` and `global-total` testids.

- [ ] **Step 1: Write the failing shell test**

`apps/web/src/ui/shell.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { createShell } from './shell.ts';

describe('createShell', () => {
  it('creates the six regions with their test hooks', () => {
    const host = document.createElement('div');
    const refs = createShell(host);
    expect(host.querySelector('[data-testid="app-root"]')).toBe(refs.root);
    expect(refs.root.classList.contains('atlas')).toBe(true);
    for (const key of ['header', 'rail', 'map', 'drawer', 'strip'] as const) {
      expect(refs[key].isConnected).toBe(true);
    }
    expect(refs.map.getAttribute('data-testid')).toBe('map-host');
  });

  it('starts with the rail open and the drawer closed', () => {
    const refs = createShell(document.createElement('div'));
    expect(refs.rail.hasAttribute('hidden')).toBe(false);
    expect(refs.drawer.hasAttribute('hidden')).toBe(true);
  });

  it('exposes the drawer and rail as named landmarks for assistive tech', () => {
    const refs = createShell(document.createElement('div'));
    expect(refs.rail.getAttribute('aria-label')).toBeTruthy();
    expect(refs.drawer.getAttribute('aria-label')).toBeTruthy();
    expect(refs.map.getAttribute('role')).toBe('region');
  });
});
```

- [ ] **Step 2: Run it and confirm failure**

Run: `npx vitest run --project web apps/web/src/ui/shell.test.ts`
Expected: FAIL — `Failed to resolve import "./shell.ts"`.

- [ ] **Step 3: Implement `src/ui/shell.ts`**

```ts
import { el } from './dom.ts';

export interface ShellRefs {
  root: HTMLElement;
  header: HTMLElement;
  rail: HTMLElement;
  map: HTMLElement;
  drawer: HTMLElement;
  strip: HTMLElement;
}

export function createShell(host: HTMLElement): ShellRefs {
  const header = el('header', { class: 'atlas-header', 'data-testid': 'header' });
  const rail = el('aside', {
    class: 'atlas-rail',
    'data-testid': 'rail',
    'aria-label': 'Filtros y jerarquía geográfica',
  });
  const map = el('main', {
    class: 'atlas-map',
    'data-testid': 'map-host',
    role: 'region',
    'aria-label': 'Mapa global',
  });
  const drawer = el('aside', {
    class: 'atlas-drawer',
    'data-testid': 'drawer',
    'aria-label': 'Detalle del proyecto',
    hidden: true,
  });
  const strip = el('footer', { class: 'atlas-strip', 'data-testid': 'strip' });

  const root = el('div', { class: 'atlas', 'data-testid': 'app-root' });
  root.append(header, rail, map, drawer, strip);
  host.append(root);
  return { root, header, rail, map, drawer, strip };
}
```

- [ ] **Step 4: Run the shell test and confirm it passes**

Run: `npx vitest run --project web apps/web/src/ui/shell.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Write the failing header, breadcrumb, badge and legend tests**

`apps/web/src/ui/header.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest';
import { createHeader } from './header.ts';
import { createShell } from './shell.ts';

describe('createHeader', () => {
  function setup() {
    const refs = createShell(document.createElement('div'));
    const onSearch = vi.fn();
    const onRailToggle = vi.fn();
    const header = createHeader(refs, { onSearch, onRailToggle });
    return { header, onSearch, onRailToggle };
  }

  it('exposes the wordmark, breadcrumb, search and status', () => {
    const { header } = setup();
    expect(header.root.querySelector('.wordmark')?.textContent).toBe('AI World Atlas');
    expect(header.breadcrumb.getAttribute('data-testid')).toBe('breadcrumb');
    expect(header.search.getAttribute('data-testid')).toBe('search-input');
    expect(header.status.getAttribute('data-testid')).toBe('api-status');
  });

  it('emits the debounced value on input, not on every keystroke', () => {
    const { header, onSearch } = setup();
    header.search.value = 'po';
    header.search.dispatchEvent(new Event('input', { bubbles: true }));
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it('labels the search input for screen readers', () => {
    const { header } = setup();
    const label = header.root.querySelector('label[for="atlas-search"]');
    expect(label).not.toBeNull();
    expect(header.search.id).toBe('atlas-search');
  });

  it('toggles the rail from a labelled button', () => {
    const { header, onRailToggle } = setup();
    expect(header.railToggle.getAttribute('aria-label')).toBeTruthy();
    header.railToggle.click();
    expect(onRailToggle).toHaveBeenCalledTimes(1);
  });
});

describe('renderBreadcrumb', () => {
  it('renders one button per level plus a world reset', () => {
    const host = document.createElement('nav');
    const onFocus = vi.fn();
    renderBreadcrumb(host, [], onFocus);
    expect(host.querySelectorAll('button').length).toBe(1);
    expect(host.querySelector('button')?.textContent).toBe('Mundo');
  });

  it('marks the deepest crumb as current and keeps the rest navigable', () => {
    const host = document.createElement('nav');
    const onFocus = vi.fn();
    renderBreadcrumb(
      host,
      [
        { id: 'world', name: 'Mundo', level: 'WORLD', parentId: null, center: { lat: 0, lng: 0 } },
        { id: 'chile', name: 'Chile', level: 'COUNTRY', parentId: 'world', center: { lat: -33, lng: -71 } },
      ],
      onFocus,
    );
    const buttons = [...host.querySelectorAll('button')];
    expect(buttons.at(-1)?.getAttribute('aria-current')).toBe('true');
    buttons[0]?.click();
    expect(onFocus).toHaveBeenCalledWith('world');
  });

  it('never inserts raw html', () => {
    const host = document.createElement('nav');
    renderBreadcrumb(
      host,
      [
        {
          id: 'x',
          name: '<img src=x onerror=alert(1)>',
          level: 'COUNTRY',
          parentId: null,
          center: { lat: 0, lng: 0 },
        },
      ],
      vi.fn(),
    );
    expect(host.querySelector('img')).toBeNull();
    expect(host.textContent).toContain('<img src=x onerror=alert(1)>');
  });
});
```

`apps/web/src/ui/statusBadge.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { renderStatusBadge } from './statusBadge.ts';

function render(state: Parameters<typeof renderStatusBadge>[1]) {
  const node = document.createElement('div');
  renderStatusBadge(node, state);
  return node;
}

describe('renderStatusBadge', () => {
  it('shows a loading state', () => {
    const node = render({ apiStatus: 'loading', apiError: null, globalTotal: 0, matchingTotal: 0, lastRequestId: null });
    expect(node.getAttribute('data-state')).toBe('loading');
    expect(node.textContent).toContain('Cargando');
  });

  it('shows the matching and global counts when connected', () => {
    const node = render({ apiStatus: 'ok', apiError: null, globalTotal: 5, matchingTotal: 2, lastRequestId: null });
    expect(node.getAttribute('data-state')).toBe('ok');
    expect(node.querySelector('[data-testid="matching-count"]')?.textContent).toBe('2');
    expect(node.querySelector('[data-testid="global-total"]')?.textContent).toBe('5');
  });

  it('surfaces the requestId on failure so a bug is reportable', () => {
    const node = render({
      apiStatus: 'error',
      apiError: 'Invalid request',
      globalTotal: 0,
      matchingTotal: 0,
      lastRequestId: 'req-42',
    });
    expect(node.getAttribute('data-state')).toBe('error');
    expect(node.textContent).toContain('req-42');
  });

  it('never renders a stack trace even if the error text contains one', () => {
    const node = render({
      apiStatus: 'error',
      apiError: 'Error: boom\n    at Object.<anonymous> (app.ts:1:1)',
      globalTotal: 0,
      matchingTotal: 0,
      lastRequestId: 'req-1',
    });
    expect(node.textContent).not.toContain('at Object');
  });
});
```

`apps/web/src/ui/legend.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { renderLegend } from './legend.ts';
import { buildSelectors } from '../state/selectors.ts';
import { createInitialState, createStore } from '../state/store.ts';
import { atlasDataFixture, listBodies } from '../testing/fixtures.ts';
import { EVIDENCE_COLORS } from '../state/colors.ts';

function selectors() {
  const store = createStore(createInitialState());
  store.dispatch({ type: 'data/locations', payload: { ...listBodies.locations } });
  store.dispatch({
    type: 'data/projects',
    payload: { data: listBodies.projects.data, page: 1, pageSize: 50, total: 5, totalPages: 1 },
  });
  store.dispatch({ type: 'data/stats', payload: atlasDataFixture.stats });
  return buildSelectors(store.getState());
}

describe('renderLegend', () => {
  it('renders one row per evidence level present in the data', () => {
    const node = document.createElement('div');
    renderLegend(node, selectors());
    const rows = node.querySelectorAll('[data-testid="legend-row"]');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(6);
  });

  it('uses the semantic palette, not inline hue math', () => {
    const node = document.createElement('div');
    renderLegend(node, selectors());
    for (const level of Object.keys(EVIDENCE_COLORS)) {
      const swatch = node.querySelector(`[data-level="${level}"]`);
      if (!swatch) continue;
      expect(swatch.getAttribute('data-color')).toBe(EVIDENCE_COLORS[level as keyof typeof EVIDENCE_COLORS]);
    }
  });

  it('states the declared intent rather than implying certainty', () => {
    const node = document.createElement('div');
    renderLegend(node, selectors());
    expect(node.textContent).toMatch(/observado|esperado|sin confirmar/);
    expect(node.textContent).toMatch(/Reportado|Oficial|Sin verificar|En disputa|Rumores|Esperado/);
  });

  it('is safe with an empty state', () => {
    const node = document.createElement('div');
    renderLegend(node, buildSelectors(createInitialState()));
    expect(node.querySelectorAll('[data-testid="legend-row"]')).toHaveLength(0);
  });
});
```

- [ ] **Step 6: Run them and confirm failure**

Run: `npx vitest run --project web apps/web/src/ui`
Expected: FAIL on `header.ts`, `statusBadge.ts` and `legend.ts`.

- [ ] **Step 7: Implement `src/ui/header.ts`, `breadcrumb.ts`, `statusBadge.ts` and `legend.ts`**

`src/ui/header.ts`:
```ts
import { el } from './dom.ts';
import { icon } from './icons.ts';
import type { ShellRefs } from './shell.ts';

export interface HeaderRefs {
  root: HTMLElement;
  breadcrumb: HTMLElement;
  search: HTMLInputElement;
  status: HTMLElement;
  railToggle: HTMLButtonElement;
}

export interface HeaderHandlers {
  onSearch: (value: string) => void;
  onRailToggle: () => void;
}

export function createHeader(refs: ShellRefs, handlers: HeaderHandlers): HeaderRefs {
  const wordmark = el('span', { class: 'wordmark', text: 'AI World Atlas' });

  const breadcrumb = el('nav', { class: 'breadcrumb', 'data-testid': 'breadcrumb', 'aria-label': 'Jerarquía' });

  const searchId = 'atlas-search';
  const searchInput = el('input', {
    id: searchId,
    type: 'search',
    placeholder: 'Buscar proyectos…',
    'data-testid': 'search-input',
    autocomplete: 'off',
    spellcheck: 'false',
  }) as HTMLInputElement;
  searchInput.addEventListener('input', () => {
    handlers.onSearch(searchInput.value);
  });

  const search = el('div', { class: 'search' }, [
    icon('search', 14),
    el('label', { for: searchId, class: 'visually-hidden', text: 'Buscar proyectos' }),
    searchInput,
  ]);

  const status = el('div', { class: 'status-badge', 'data-testid': 'api-status', role: 'status' });

  const railToggle = el('button', {
    type: 'button',
    class: 'icon-button',
    'aria-label': 'Mostrar u ocultar filtros',
    'data-testid': 'rail-toggle',
  }) as HTMLButtonElement;
  railToggle.append(icon('layers', 16));
  railToggle.addEventListener('click', () => handlers.onRailToggle());

  refs.header.append(wordmark, breadcrumb, search, status, railToggle);
  return { root: refs.header, breadcrumb, search: searchInput, status, railToggle };
}
```

The search input is debounced in the controller (Task 16), not here. This module only forwards the raw value; the test asserts exactly one call per `input` event.

`src/ui/breadcrumb.ts`:
```ts
import { el, clear } from './dom.ts';
import { levelLabel } from '../state/colors.ts';
import type { Location } from '../data/types.ts';

export function renderBreadcrumb(
  node: HTMLElement,
  trail: readonly Location[],
  handlers: { onFocus: (locationId: string | null) => void },
): void {
  clear(node);
  const items: Location[] = [
    { id: 'world', name: 'Mundo', level: 'WORLD', parentId: null, center: { lat: 0, lng: 0 } },
    ...trail.filter((location) => location.level !== 'WORLD'),
  ];
  items.forEach((location, index) => {
    const isLast = index === items.length - 1;
    const button = el(
      'button',
      {
        type: 'button',
        'data-level': location.level,
        'aria-current': isLast ? 'true' : 'false',
        title: levelLabel(location.level),
      },
      [document.createTextNode(location.name)],
    );
    button.addEventListener('click', () => {
      handlers.onFocus(isLast ? location.parentId ?? 'world' : location.id);
    });
    if (index > 0) {
      node.append(el('span', { class: 'breadcrumb__sep', 'aria-hidden': 'true', text: '/' }));
    }
    node.append(button);
  });
}
```

Clicking the deepest crumb focuses its **parent**, which is how the user steps back up one level from the current scope. Clicking any other crumb focuses that crumb directly. The empty trail renders a single inert `Mundo` button.

`src/ui/statusBadge.ts`:
```ts
import { clear, el } from './dom.ts';
import type { AtlasState } from '../state/store.ts';

type BadgeState = Pick<AtlasState, 'apiStatus' | 'apiError' | 'globalTotal' | 'matchingTotal' | 'lastRequestId'>;

const LABELS: Record<BadgeState['apiStatus'], string> = {
  idle: 'Preparando…',
  loading: 'Cargando…',
  ok: 'Conexión estable',
  error: 'Sin conexión',
};

function firstLine(message: string | null): string | null {
  if (message === null) return null;
  const line = message.split('\n')[0]?.trim();
  return line && line.length > 0 ? line.slice(0, 120) : null;
}

export function renderStatusBadge(node: HTMLElement, state: BadgeState): void {
  clear(node);
  node.setAttribute('data-state', state.apiStatus);
  node.append(el('span', { class: 'status-badge__dot', 'aria-hidden': 'true' }));
  node.append(el('span', { class: 'status-badge__text', text: LABELS[state.apiStatus] }));

  if (state.apiStatus === 'ok') {
    node.append(
      el('span', { class: 'counts' }, [
        el('span', { class: 'counts__primary', 'data-testid': 'matching-count', text: String(state.matchingTotal) }),
        el('span', { class: 'counts__secondary', text: 'de' }),
        el('span', { class: 'counts__secondary', 'data-testid': 'global-total', text: String(state.globalTotal) }),
      ]),
    );
  }

  if (state.apiStatus === 'error') {
    const detail = firstLine(state.apiError);
    if (detail) node.append(el('span', { class: 'status-badge__detail', text: detail }));
    if (state.lastRequestId) {
      node.append(el('span', { class: 'status-badge__detail', text: `ref ${state.lastRequestId}` }));
    }
  }
}
```

`src/ui/legend.ts`:
```ts
import { clear, el } from './dom.ts';
import { EVIDENCE_INTENTS, evidenceLabel } from '../state/colors.ts';
import type { Selectors } from '../state/selectors.ts';

const INTENT_LABEL: Record<string, string> = {
  OBSERVED: 'observado',
  EXPECTED: 'esperado',
  UNCONFIRMED: 'sin confirmar',
};

export function renderLegend(node: HTMLElement, selectors: Selectors): void {
  clear(node);
  const rows = selectors.evidenceSummary.filter((entry) => entry.count > 0);
  if (rows.length === 0) return;
  for (const entry of rows) {
    const row = el('div', { class: 'legend-row', 'data-testid': 'legend-row' });
    row.append(
      el('span', {
        class: 'legend-swatch',
        'data-level': entry.level,
        'data-color': entry.color,
        style: `background: ${entry.color};`,
        'aria-hidden': 'true',
      }),
      el('span', { text: evidenceLabel(entry.level) }),
      el('span', { class: 'counts__secondary', text: INTENT_LABEL[EVIDENCE_INTENTS[entry.level]] }),
      el('span', { class: 'counts__secondary', text: `· ${entry.count}` }),
    );
    node.append(row);
  }
  const total = rows.reduce((sum, entry) => sum + entry.count, 0);
  node.append(
    el('p', {
      class: 'legend-footnote',
      text: `${total} proyectos · el color indica el grado de evidencia`,
    }),
  );
}
```

- [ ] **Step 8: Run the ui tests and confirm they pass**

Run: `npx vitest run --project web apps/web/src/ui`
Expected: PASS, 5 files / 17 tests. The breadcrumb XSS test is the P0 guard for the legacy `innerHTML` vulnerability.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(web): build the shell header breadcrumb status badge and legend"
```

---

### Task 16: Rail, filters, scale controls, drawer, sources and timeline strip

**Files:**
- Create: `apps/web/src/ui/rail.ts`, `apps/web/src/ui/rail.test.ts`, `apps/web/src/ui/scaleControls.ts`, `apps/web/src/ui/scaleControls.test.ts`, `apps/web/src/ui/drawer.ts`, `apps/web/src/ui/drawer.test.ts`, `apps/web/src/ui/strip.ts`, `apps/web/src/ui/strip.test.ts`

**Interfaces:**
- Consumes: `AtlasState` / `Action` (Task 11), `Selectors` (Task 12), `el` (Task 9), `icon` (Task 9), `safeExternalUrl` (Task 9), `sortSources` / `sortTimelineEvents` (Task 12), `eventsInYear` (Task 11), `levelLabel` (Task 11).
- Produces:
  - `interface RailRefs { root: HTMLElement; scale: HTMLElement; filters: HTMLElement; legend: HTMLElement; reset: HTMLButtonElement }`
  - `createRail(rail: HTMLElement, handlers: { onLevel: (level: LocationLevel) => void; onToggle: (key: 'type' | 'status' | 'evidence', value: string) => void; onYearRange: (patch: { yearFrom: number | null; yearTo: number | null }) => void; onReset: () => void; onFocus: (locationId: string) => void }): RailRefs`
  - `renderRail(refs: RailRefs, state: AtlasState, selectors: Selectors): void`
  - `interface ScaleRefs { root: HTMLElement }` with `renderScale(node: HTMLElement, state: AtlasState, selectors: Selectors, onLevel: (level: LocationLevel) => void): void`
  - `interface DrawerRefs { root: HTMLElement; title: HTMLElement; body: HTMLElement; close: HTMLButtonElement }`
  - `createDrawer(drawer: HTMLElement, handlers: { onClose: () => void; onFocus: (locationId: string) => void }): DrawerRefs`
  - `renderDrawer(refs: DrawerRefs, detail: ProjectDetail | null, options: { allowHttp: boolean }): void`
  - `interface StripRefs { root: HTMLElement; year: HTMLElement; slider: HTMLInputElement; play: HTMLButtonElement; prev: HTMLButtonElement; next: HTMLButtonElement; counts: HTMLElement }`
  - `createStrip(strip: HTMLElement, handlers: { onYear: (year: number) => void; onPlayToggle: () => void; onStep: (delta: number) => void }): StripRefs`
  - `renderStrip(refs: StripRefs, state: AtlasState, selectors: Selectors, events: EventRecord[]): void`
  - Testids: `scale-levels`, `rail-reset`, `drawer-title`, `drawer-close`, `source-link`, `source-text`, `timeline-year`, `timeline-slider`, `timeline-play`, `timeline-prev`, `timeline-next`, `timeline-events`.

- [ ] **Step 1: Write the failing rail and scale-control tests**

`apps/web/src/ui/scaleControls.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest';
import { renderScale } from './scaleControls.ts';
import { buildSelectors } from '../state/selectors.ts';
import { createInitialState, createStore } from '../state/store.ts';
import { atlasDataFixture, listBodies } from '../testing/fixtures.ts';
import { LEVEL_ORDER } from '../state/geo.ts';

function state() {
  const store = createStore(createInitialState());
  store.dispatch({ type: 'data/locations', payload: { ...listBodies.locations } });
  store.dispatch({
    type: 'data/projects',
    payload: { data: listBodies.projects.data, page: 1, pageSize: 50, total: 5, totalPages: 1 },
  });
  store.dispatch({ type: 'data/stats', payload: atlasDataFixture.stats });
  return store.getState();
}

describe('renderScale', () => {
  it('renders one button per level, in order, with pressed state', () => {
    const node = document.createElement('div');
    node.setAttribute('data-testid', 'scale-levels');
    renderScale(node, state(), buildSelectors(state()), vi.fn());
    const buttons = [...node.querySelectorAll('button')];
    expect(buttons.map((b) => b.getAttribute('data-level'))).toEqual([...LEVEL_ORDER]);
    expect(buttons[0]?.getAttribute('aria-pressed')).toBe('true');
  });

  it('disables levels with no data instead of hiding them', () => {
    const node = document.createElement('div');
    const s = state();
    renderScale(node, s, buildSelectors(s), vi.fn());
    for (const button of node.querySelectorAll('button')) {
      const level = button.getAttribute('data-level') as keyof ReturnType<typeof buildSelectors>['levelEnabled'];
      if (!buildSelectors(s).levelEnabled[level]) {
        expect((button as HTMLButtonElement).disabled).toBe(true);
      }
    }
  });

  it('emits the level and blocks the move that would leave the data', () => {
    const node = document.createElement('div');
    const onLevel = vi.fn();
    const s = state();
    renderScale(node, s, buildSelectors(s), onLevel);
    const country = [...node.querySelectorAll('button')].find(
      (b) => b.getAttribute('data-level') === 'COUNTRY',
    ) as HTMLButtonElement;
    country.click();
    expect(onLevel).toHaveBeenCalledWith('COUNTRY');
  });
});
```

`apps/web/src/ui/rail.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest';
import { createRail, renderRail } from './rail.ts';
import { createShell } from './shell.ts';
import { createHeader } from './header.ts';
import { buildSelectors } from '../state/selectors.ts';
import { createInitialState, createStore } from '../state/store.ts';
import { atlasDataFixture, listBodies } from '../testing/fixtures.ts';
import { projectTypeSchema } from '@atlas/contracts';

function loaded() {
  const store = createStore(createInitialState());
  store.dispatch({ type: 'data/locations', payload: { ...listBodies.locations } });
  store.dispatch({
    type: 'data/projects',
    payload: { data: listBodies.projects.data, page: 1, pageSize: 50, total: 5, totalPages: 1 },
  });
  store.dispatch({ type: 'data/stats', payload: atlasDataFixture.stats });
  return store;
}

describe('rail', () => {
  function setup() {
    const refs = createShell(document.createElement('div'));
    createHeader(refs, { onSearch: vi.fn(), onRailToggle: vi.fn() });
    const handlers = {
      onLevel: vi.fn(),
      onToggle: vi.fn(),
      onYearRange: vi.fn(),
      onReset: vi.fn(),
      onFocus: vi.fn(),
    };
    const rail = createRail(refs.rail, handlers);
    return { refs, rail, handlers };
  }

  it('mounts the scale, the filter groups, the legend and a reset button', () => {
    const { rail } = setup();
    expect(rail.scale.getAttribute('data-testid')).toBe('scale-levels');
    expect(rail.filters.querySelectorAll('[data-filter]').length).toBeGreaterThan(0);
    expect(rail.legend.querySelectorAll('[data-testid="legend-row"]').length).toBeGreaterThan(0);
    expect(rail.reset.getAttribute('data-testid')).toBe('rail-reset');
  });

  it('renders every closed type in the type group', () => {
    const { rail } = setup();
    const chips = rail.filters.querySelectorAll('[data-filter="type"] button');
    expect(chips).toHaveLength(projectTypeSchema.options.length);
  });

  it('marks a chip as pressed and emits the toggle', () => {
    const { rail, handlers } = setup();
    const chip = rail.filters.querySelector<HTMLButtonElement>('[data-filter="type"] button');
    chip?.click();
    expect(handlers.onToggle).toHaveBeenCalledWith('type', projectTypeSchema.options[0]);
  });

  it('reflects the active state after a render', () => {
    const { rail } = setup();
    const store = loaded();
    store.dispatch({ type: 'filters/toggleValue', key: 'type', value: 'POLICY' });
    renderRail(rail, store.getState(), buildSelectors(store.getState()));
    const chip = [...rail.filters.querySelectorAll('[data-filter="type"] button')].find(
      (b) => b.getAttribute('data-value') === 'POLICY',
    );
    expect(chip?.getAttribute('aria-pressed')).toBe('true');
  });

  it('disables the reset button when nothing is active', () => {
    const { rail } = setup();
    const store = loaded();
    renderRail(rail, store.getState(), buildSelectors(store.getState()));
    expect(rail.reset.disabled).toBe(true);
    store.dispatch({ type: 'filters/toggleValue', key: 'type', value: 'POLICY' });
    renderRail(rail, store.getState(), buildSelectors(store.getState()));
    expect(rail.reset.disabled).toBe(false);
  });
});
```

- [ ] **Step 2: Run them and confirm failure**

Run: `npx vitest run --project web apps/web/src/ui/rail.test.ts apps/web/src/ui/scaleControls.test.ts`
Expected: FAIL — `Failed to resolve import "./scaleControls.ts"` and `"./rail.ts"`.

- [ ] **Step 3: Implement `src/ui/scaleControls.ts` and `src/ui/rail.ts`**

`src/ui/scaleControls.ts`:
```ts
import { clear, el } from './dom.ts';
import { levelLabel } from '../state/colors.ts';
import { LEVEL_ORDER } from '../state/geo.ts';
import type { AtlasState } from '../state/store.ts';
import type { Selectors } from '../state/selectors.ts';
import type { LocationLevel } from '../data/types.ts';

export function renderScale(
  node: HTMLElement,
  state: AtlasState,
  selectors: Selectors,
  onLevel: (level: LocationLevel) => void,
): void {
  clear(node);
  for (const level of LEVEL_ORDER) {
    const enabled = selectors.levelEnabled[level];
    const current = state.level === level;
    const button = el(
      'button',
      {
        type: 'button',
        'data-level': level,
        'aria-pressed': String(current),
        disabled: !enabled,
        title: enabled ? levelLabel(level) : `Sin datos a nivel ${levelLabel(level)}`,
      },
      [document.createTextNode(levelLabel(level))],
    );
    if (enabled) {
      button.addEventListener('click', () => {
        onLevel(level);
      });
    }
    node.append(button);
  }
}
```

`src/ui/rail.ts`:
```ts
import { clear, el } from './dom.ts';
import { evidenceLabel, statusLabel, typeLabel } from '../state/colors.ts';
import { renderLegend } from './legend.ts';
import { renderScale } from './scaleControls.ts';
import { activeFilterCount } from '../state/filters.ts';
import type { AtlasState } from '../state/store.ts';
import type { Selectors } from '../state/selectors.ts';
import type { EvidenceLevel, LocationLevel, ProjectStatus, ProjectType } from '../data/types.ts';
import { evidenceSchema, projectStatusSchema, projectTypeSchema } from '@atlas/contracts';

export interface RailHandlers {
  onLevel: (level: LocationLevel) => void;
  onToggle: (key: 'type' | 'status' | 'evidence', value: string) => void;
  onYearRange: (patch: { yearFrom: number | null; yearTo: number | null }) => void;
  onReset: () => void;
  onFocus: (locationId: string) => void;
}

export interface RailRefs {
  root: HTMLElement;
  scale: HTMLElement;
  filters: HTMLElement;
  legend: HTMLElement;
  reset: HTMLButtonElement;
}

function chipGroup(
  key: 'type' | 'status' | 'evidence',
  selected: readonly string[],
  entries: readonly { value: string; label: string }[],
  onToggle: RailHandlers['onToggle'],
): HTMLElement {
  const group = el('div', { class: 'chip-row', 'data-filter': key });
  for (const entry of entries) {
    const button = el(
      'button',
      {
        type: 'button',
        class: 'chip',
        'data-value': entry.value,
        'aria-pressed': String(selected.includes(entry.value)),
      },
      [document.createTextNode(entry.label)],
    );
    button.addEventListener('click', () => {
      onToggle(key, entry.value);
    });
    group.append(button);
  }
  return group;
}

export function createRail(root: HTMLElement, handlers: RailHandlers): RailRefs {
  clear(root);
  const scaleSection = el('section', { class: 'rail-section' }, [
    el('h2', { text: 'Escala' }),
    el('div', { class: 'scale-levels', 'data-testid': 'scale-levels' }),
  ]);
  const scale = scaleSection.querySelector('.scale-levels') as HTMLElement;

  const filtersSection = el('section', { class: 'rail-section' }, [
    el('h2', { text: 'Filtros' }),
    el('div', { class: 'rail-section__body' }),
  ]);
  const filters = filtersSection.querySelector('.rail-section__body') as HTMLElement;

  const legendSection = el('section', { class: 'rail-section' }, [
    el('h2', { text: 'Evidencia' }),
    el('div', { class: 'legend' }),
  ]);
  const legend = legendSection.querySelector('.legend') as HTMLElement;

  const reset = el('button', {
    type: 'button',
    class: 'chip',
    'data-testid': 'rail-reset',
    disabled: true,
    text: 'Limpiar filtros',
  }) as HTMLButtonElement;
  reset.addEventListener('click', () => {
    handlers.onReset();
  });
  filtersSection.append(reset);

  root.append(scaleSection, filtersSection, legendSection);

  filters.append(
    chipGroup('type', [], projectTypeSchema.options.map((value) => ({ value, label: typeLabel(value as ProjectType) })), handlers.onToggle),
    chipGroup('status', [], projectStatusSchema.options.map((value) => ({ value, label: statusLabel(value as ProjectStatus) })), handlers.onToggle),
    chipGroup('evidence', [], evidenceSchema.options.map((value) => ({ value, label: evidenceLabel(value as EvidenceLevel) })), handlers.onToggle),
  );

  return { root, scale, filters, legend, reset };
}

export function renderRail(refs: RailRefs, state: AtlasState, selectors: Selectors): void {
  renderScale(refs.scale, state, selectors, (level) => {
    refs.handlers.onLevel(level);
  });

  for (const key of ['type', 'status', 'evidence'] as const) {
    const group = refs.filters.querySelector(`[data-filter="${key}"]`);
    if (!group) continue;
    const selected = state.filters[key] as readonly string[];
    for (const button of group.querySelectorAll<HTMLButtonElement>('button')) {
      const value = button.getAttribute('data-value') ?? '';
      button.setAttribute('aria-pressed', String(selected.includes(value)));
    }
  }

  const active = activeFilterCount(state.filters);
  refs.reset.disabled = active === 0;
  refs.reset.textContent = active === 0 ? 'Limpiar filtros' : `Limpiar filtros (${active})`;

  renderLegend(refs.legend, selectors);
}
```

Two corrections to apply while writing these two files, both required by the tests above:

1. `renderRail` must emit the level change through the handler captured in `createRail`, not through a `CustomEvent`. Store the handlers on the refs:
   ```ts
   export interface RailRefs {
     root: HTMLElement;
     scale: HTMLElement;
     filters: HTMLElement;
     legend: HTMLElement;
     reset: HTMLButtonElement;
     handlers: RailHandlers;
   }
   ```
   return `{ root, scale, filters, legend, reset, handlers }` from `createRail`, and in `renderRail` use:
   ```ts
   renderScale(refs.scale, state, selectors, (level) => {
     refs.handlers.onLevel(level);
   });
   ```
2. `el()` sets attributes only — it cannot attach listeners. The chip and reset listeners above are correct because they use `addEventListener` after construction. Do **not** pass `onClick` to `el` anywhere in this task; that would emit a literal `onclick="[object Function]"` attribute and the test "marks a chip as pressed and emits the toggle" would pass by accident while the real click path stays dead.

- [ ] **Step 4: Run the rail and scale tests and confirm they pass**

Run: `npx vitest run --project web apps/web/src/ui`
Expected: PASS, 7 files / 25 tests.

- [ ] **Step 5: Write the failing drawer and strip tests**

`apps/web/src/ui/drawer.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest';
import { createDrawer, renderDrawer } from './drawer.ts';
import { createShell } from './shell.ts';
import { projectDetailFixture } from '../testing/fixtures.ts';

function setup() {
  const refs = createShell(document.createElement('div'));
  const handlers = { onClose: vi.fn(), onFocus: vi.fn() };
  return { refs, drawer: createDrawer(refs.drawer, handlers), handlers };
}

describe('drawer', () => {
  it('renders the title, the metadata grid and the sources', () => {
    const { drawer } = setup();
    renderDrawer(drawer, projectDetailFixture, { allowHttp: false });
    expect(drawer.title.getAttribute('data-testid')).toBe('drawer-title');
    expect(drawer.title.textContent).toBe('Política Nacional de IA 2024');
    expect(drawer.body.querySelector('.meta-grid')).not.toBeNull();
    expect(drawer.body.querySelectorAll('.source-card').length).toBeGreaterThan(0);
  });

  it('links only safe https sources', () => {
    const { drawer } = setup();
    renderDrawer(drawer, projectDetailFixture, { allowHttp: false });
    for (const link of drawer.body.querySelectorAll('a[data-testid="source-link"]')) {
      expect(link.getAttribute('href')?.startsWith('https://')).toBe(true);
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toContain('noopener');
    }
  });

  it('renders an unsafe source as unlinked text instead of a javascript href', () => {
    const { drawer } = setup();
    renderDrawer(
      drawer,
      {
        ...projectDetailFixture,
        sources: [
          { id: 's1', type: 'OFFICIAL_DOCUMENT', title: 'Documento', publisher: 'Gobierno', url: 'javascript:alert(1)', publishedAt: '2024-03-01', isPrimary: true, snippet: null },
        ],
      },
      { allowHttp: false },
    );
    const text = drawer.body.querySelector('[data-testid="source-text"]');
    expect(text).not.toBeNull();
    expect(drawer.body.querySelector('[data-testid="source-link"]')).toBeNull();
    expect(drawer.body.innerHTML).not.toContain('javascript:alert(1)"');
  });

  it('allows http only when the environment explicitly permits it', () => {
    const { drawer } = setup();
    renderDrawer(
      drawer,
      {
        ...projectDetailFixture,
        sources: [
          { id: 's1', type: 'REPORT', title: 'Local', publisher: 'Lab', url: 'http://localhost:3000/x', publishedAt: null, isPrimary: false, snippet: null },
        ],
      },
      { allowHttp: true },
    );
    expect(drawer.body.querySelector('[data-testid="source-link"]')?.getAttribute('href')).toBe(
      'http://localhost:3000/x',
    );
  });

  it('renders the timeline events and the status history', () => {
    const { drawer } = setup();
    renderDrawer(drawer, projectDetailFixture, { allowHttp: false });
    expect(drawer.body.querySelectorAll('.event-row').length).toBe(2);
    expect(drawer.body.querySelectorAll('.status-history-row').length).toBeGreaterThan(0);
  });

  it('renders an empty state instead of a blank panel', () => {
    const { drawer } = setup();
    renderDrawer(drawer, null, { allowHttp: false });
    expect(drawer.body.querySelector('.empty-state')).not.toBeNull();
  });

  it('shows and hides the panel through the hidden attribute', () => {
    const { refs, drawer, handlers } = setup();
    renderDrawer(drawer, projectDetailFixture, { allowHttp: false });
    expect(refs.drawer.hasAttribute('hidden')).toBe(false);
    drawer.close.click();
    expect(handlers.onClose).toHaveBeenCalled();
  });

  it('never uses innerHTML', () => {
    const { drawer } = setup();
    renderDrawer(
      drawer,
      {
        ...projectDetailFixture,
        name: '<img src=x onerror=alert(1)>',
        summary: '<script>alert(2)</script>',
      },
      { allowHttp: false },
    );
    expect(drawer.body.querySelector('img')).toBeNull();
    expect(drawer.body.querySelector('script')).toBeNull();
  });
});
```

`apps/web/src/ui/strip.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest';
import { createStrip, renderStrip } from './strip.ts';
import { createShell } from './shell.ts';
import { buildSelectors } from '../state/selectors.ts';
import { createInitialState, createStore } from '../state/store.ts';
import { atlasDataFixture, eventsFixture, listBodies } from '../testing/fixtures.ts';

function loaded() {
  const store = createStore(createInitialState());
  store.dispatch({ type: 'data/locations', payload: { ...listBodies.locations } });
  store.dispatch({
    type: 'data/projects',
    payload: { data: listBodies.projects.data, page: 1, pageSize: 50, total: 5, totalPages: 1 },
  });
  store.dispatch({ type: 'data/stats', payload: atlasDataFixture.stats });
  return store;
}

describe('strip', () => {
  function setup() {
    const refs = createShell(document.createElement('div'));
    const handlers = { onYear: vi.fn(), onPlayToggle: vi.fn(), onStep: vi.fn() };
    return { refs, strip: createStrip(refs.strip, handlers), handlers };
  }

  it('shows the current year and the matching counts', () => {
    const { strip } = setup();
    const store = loaded();
    renderStrip(strip, store.getState(), buildSelectors(store.getState()), eventsFixture);
    expect(strip.year.getAttribute('data-testid')).toBe('timeline-year');
    expect(strip.year.textContent).toBe('2026');
    expect(strip.counts.textContent).toContain('5');
  });

  it('emits year, step and play events', () => {
    const { strip, handlers } = setup();
    const store = loaded();
    renderStrip(strip, store.getState(), buildSelectors(store.getState()), eventsFixture);
    strip.slider.value = '2022';
    strip.slider.dispatchEvent(new Event('input', { bubbles: true }));
    expect(handlers.onYear).toHaveBeenCalledWith(2022);
    strip.prev.click();
    expect(handlers.onStep).toHaveBeenCalledWith(-1);
    strip.next.click();
    expect(handlers.onStep).toHaveBeenCalledWith(1);
    strip.play.click();
    expect(handlers.onPlayToggle).toHaveBeenCalled();
  });

  it('labels the play button by its current state', () => {
    const { strip } = setup();
    const store = loaded();
    renderStrip(strip, store.getState(), buildSelectors(store.getState()), eventsFixture);
    expect(strip.play.getAttribute('aria-label')).toBe('Reproducir');
    store.dispatch({ type: 'timeline/play' });
    renderStrip(strip, store.getState(), buildSelectors(store.getState()), eventsFixture);
    expect(strip.play.getAttribute('aria-label')).toBe('Pausar');
  });

  it('lists the events that fall in the selected year', () => {
    const { strip } = setup();
    const store = loaded();
    store.dispatch({ type: 'timeline/setYear', year: 2025 });
    renderStrip(strip, store.getState(), buildSelectors(store.getState()), eventsFixture);
    const events = strip.root.querySelectorAll('[data-testid="timeline-events"] .event-row');
    expect(events.length).toBeGreaterThan(0);
    for (const node of events) {
      expect(node.textContent).toMatch(/2025/);
    }
  });

  it('bounds the slider to the derived year range', () => {
    const { strip } = setup();
    const store = loaded();
    const selectors = buildSelectors(store.getState());
    renderStrip(strip, store.getState(), selectors, eventsFixture);
    expect(Number(strip.slider.min)).toBe(Math.min(...selectors.yearOptions));
    expect(Number(strip.slider.max)).toBe(Math.max(...selectors.yearOptions));
  });
});
```

- [ ] **Step 6: Run them and confirm failure**

Run: `npx vitest run --project web apps/web/src/ui/drawer.test.ts apps/web/src/ui/strip.test.ts`
Expected: FAIL — `Failed to resolve import "./drawer.ts"` and `"./strip.ts"`.

- [ ] **Step 7: Implement `src/ui/drawer.ts` and `src/ui/strip.ts`**

`src/ui/drawer.ts`:
```ts
import { clear, el } from './dom.ts';
import { icon } from './icons.ts';
import { safeExternalUrl } from '../data/urls.ts';
import { evidenceLabel, evidenceIntent, statusLabel, typeLabel } from '../state/colors.ts';
import { sortSources, sortTimelineEvents } from '../data/normalize.ts';
import type { ProjectDetail } from '../data/types.ts';

export interface DrawerHandlers {
  onClose: () => void;
  onFocus: (locationId: string) => void;
}

export interface DrawerRefs {
  root: HTMLElement;
  title: HTMLElement;
  body: HTMLElement;
  close: HTMLButtonElement;
}

const INTENT_LABEL: Record<string, string> = {
  OBSERVED: 'observado',
  EXPECTED: 'esperado',
  UNCONFIRMED: 'sin confirmar',
};

const DATE_FORMAT = new Intl.DateTimeFormat('es-CL', { year: 'numeric', month: 'short' });

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : DATE_FORMAT.format(date);
}

export function createDrawer(root: HTMLElement, handlers: DrawerHandlers): DrawerRefs {
  clear(root);
  const close = el('button', {
    type: 'button',
    class: 'icon-button',
    'aria-label': 'Cerrar detalle',
    'data-testid': 'drawer-close',
  }) as HTMLButtonElement;
  close.append(icon('close', 16));
  close.addEventListener('click', () => {
    handlers.onClose();
  });

  const title = el('h2', { 'data-testid': 'drawer-title' });
  const header = el('div', { class: 'drawer-header' }, [title, close]);
  const body = el('div', { class: 'drawer-body' });
  root.append(header, body);
  return { root, title, body, close };
}

export function renderDrawer(
  refs: DrawerRefs,
  detail: ProjectDetail | null,
  options: { allowHttp: boolean },
): void {
  clear(refs.body);
  if (!detail) {
    refs.title.textContent = 'Ningún proyecto seleccionado';
    refs.body.append(el('p', { class: 'empty-state', text: 'Elegí un pin o una fila para ver el detalle.' }));
    return;
  }

  refs.title.textContent = detail.name;

  if (detail.summary) {
    refs.body.append(el('p', { class: 'drawer-summary', text: detail.summary }));
  }

  const meta = el('dl', { class: 'meta-grid' });
  const rows: Array<[string, string]> = [
    ['Tipo', typeLabel(detail.type)],
    ['Estado', statusLabel(detail.status)],
    ['Evidencia', `${evidenceLabel(detail.evidenceLevel)} · ${INTENT_LABEL[evidenceIntent(detail.evidenceLevel)]}`],
    ['Publicado', formatDate(detail.publishedAt)],
    ['Fin', formatDate(detail.endedAt)],
  ];
  if (detail.sector) rows.push(['Sector', detail.sector]);
  for (const [label, value] of rows) {
    meta.append(el('dt', { text: label }), el('dd', { text: value }));
  }
  refs.body.append(meta);

  const sources = sortSources(detail.sources);
  if (sources.length > 0) {
    refs.body.append(el('h3', { class: 'drawer-subtitle', text: 'Fuentes' }));
    for (const source of sources) {
      const card = el('div', { class: 'source-card', 'data-source-id': source.id });
      card.append(el('p', { class: 'source-card__title', text: source.title }));
      const href = safeExternalUrl(source.url, { allowHttp: options.allowHttp });
      if (href) {
        const link = el('a', {
          class: 'source-card__url',
          href,
          target: '_blank',
          rel: 'noopener noreferrer',
          'data-testid': 'source-link',
        }) as HTMLAnchorElement;
        link.append(icon('link', 12), document.createTextNode(source.publisher ?? new URL(href).host));
        card.append(link);
      } else {
        const plain = el('span', { class: 'source-card__url source-card__url--plain', 'data-testid': 'source-text' });
        plain.append(icon('target', 12), document.createTextNode(`${source.publisher ?? 'Fuente'} · enlace no seguro`));
        card.append(plain);
      }
      if (source.snippet) {
        card.append(el('p', { class: 'source-card__snippet', text: source.snippet }));
      }
      if (source.isPrimary) {
        card.append(el('span', { class: 'evidence-chip', text: 'Fuente primaria' }));
      }
      refs.body.append(card);
    }
  }

  const events = sortTimelineEvents(detail.events);
  if (events.length > 0) {
    refs.body.append(el('h3', { class: 'drawer-subtitle', text: 'Hitos' }));
    for (const event of events) {
      refs.body.append(
        el('div', { class: 'event-row' }, [
          el('span', { class: 'event-row__date', text: formatDate(event.occurredAt) }),
          el('span', { class: 'event-row__title', text: event.title }),
        ]),
      );
    }
  }

  if (detail.statusHistory.length > 0) {
    refs.body.append(el('h3', { class: 'drawer-subtitle', text: 'Cambios de estado' }));
    for (const entry of detail.statusHistory) {
      refs.body.append(
        el('div', { class: 'event-row status-history-row' }, [
          el('span', { class: 'event-row__date', text: formatDate(entry.observedAt) }),
          el('span', { text: `${statusLabel(entry.status)} · ${entry.sourceLabel}` }),
        ]),
      );
    }
  }

  if (detail.relations.length > 0) {
    refs.body.append(el('h3', { class: 'drawer-subtitle', text: 'Relaciones' }));
    for (const relation of detail.relations) {
      refs.body.append(
        el('div', { class: 'event-row' }, [
          el('span', { class: 'event-row__date', text: relation.type }),
          el('span', { text: relation.summary ?? `${relation.fromProjectId} → ${relation.toProjectId}` }),
        ]),
      );
    }
  } else {
    refs.body.append(
      el('p', { class: 'empty-state', text: 'Sin relaciones verificadas: no se infieren relaciones sin fuente primaria.' }),
    );
  }
}
```

`src/ui/strip.ts`:
```ts
import { clear, el } from './dom.ts';
import { icon } from './icons.ts';
import { eventsInYear } from '../state/timeline.ts';
import type { AtlasState } from '../state/store.ts';
import type { Selectors } from '../state/selectors.ts';
import type { EventRecord } from '../data/types.ts';

export interface StripHandlers {
  onYear: (year: number) => void;
  onPlayToggle: () => void;
  onStep: (delta: number) => void;
}

export interface StripRefs {
  root: HTMLElement;
  year: HTMLElement;
  slider: HTMLInputElement;
  play: HTMLButtonElement;
  prev: HTMLButtonElement;
  next: HTMLButtonElement;
  counts: HTMLElement;
  events: HTMLElement;
}

const YEAR_FORMAT = new Intl.DateTimeFormat('es-CL', { year: 'numeric' });

export function createStrip(root: HTMLElement, handlers: StripHandlers): StripRefs {
  clear(root);

  const year = el('span', { class: 'timeline__year', 'data-testid': 'timeline-year' });

  const prev = el('button', {
    type: 'button',
    class: 'icon-button',
    'aria-label': 'Año anterior',
    'data-testid': 'timeline-prev',
  }) as HTMLButtonElement;
  prev.append(icon('chevron-left', 16));
  prev.addEventListener('click', () => {
    handlers.onStep(-1);
  });

  const next = el('button', {
    type: 'button',
    class: 'icon-button',
    'aria-label': 'Año siguiente',
    'data-testid': 'timeline-next',
  }) as HTMLButtonElement;
  next.append(icon('chevron-right', 16));
  next.addEventListener('click', () => {
    handlers.onStep(1);
  });

  const play = el('button', {
    type: 'button',
    class: 'icon-button',
    'aria-label': 'Reproducir',
    'data-testid': 'timeline-play',
  }) as HTMLButtonElement;
  play.addEventListener('click', () => {
    handlers.onPlayToggle();
  });

  const slider = el('input', {
    type: 'range',
    class: 'timeline__slider',
    'data-testid': 'timeline-slider',
    min: '1900',
    max: '2100',
    step: '1',
    'aria-label': 'Año',
  }) as HTMLInputElement;
  slider.addEventListener('input', () => {
    handlers.onYear(Number(slider.value));
  });

  const track = el('div', { class: 'timeline__track' }, [slider]);
  const controls = el('div', { class: 'timeline' }, [year, prev, track, next, play]);
  const counts = el('div', { class: 'counts' });
  const events = el('div', { class: 'timeline-events', 'data-testid': 'timeline-events' });
  root.append(controls, counts, events);
  return { root, year, slider, play, prev, next, counts, events };
}

export function renderStrip(
  refs: StripRefs,
  state: AtlasState,
  selectors: Selectors,
  events: readonly EventRecord[],
): void {
  const { year: current, playing, minYear, maxYear } = state.timeline;
  refs.year.textContent = String(current);

  const min = Math.min(minYear, ...selectors.yearOptions);
  const max = Math.max(maxYear, ...selectors.yearOptions);
  refs.slider.min = String(min);
  refs.slider.max = String(max);
  refs.slider.value = String(current);
  refs.slider.setAttribute('aria-valuetext', String(current));

  refs.prev.disabled = current <= min;
  refs.next.disabled = current >= max;
  refs.play.setAttribute('aria-label', playing ? 'Pausar' : 'Reproducir');
  clear(refs.play);
  refs.play.append(icon(playing ? 'pause' : 'play', 16));

  clear(refs.counts);
  refs.counts.append(
    el('span', { class: 'counts__primary', text: String(state.matchingTotal) }),
    el('span', { class: 'counts__secondary', text: `de ${state.globalTotal} proyectos` }),
  );

  clear(refs.events);
  const inYear = eventsInYear(events, current);
  if (inYear.length === 0) {
    refs.events.append(el('p', { class: 'empty-state', text: `Sin hitos registrados en ${YEAR_FORMAT.format(new Date(`${current}-01-01`))}.` }));
    return;
  }
  for (const event of inYear) {
    refs.events.append(
      el('div', { class: 'event-row' }, [
        el('span', { class: 'event-row__date', text: YEAR_FORMAT.format(new Date(event.occurredAt)) }),
        el('span', { class: 'event-row__title', text: event.title }),
      ]),
    );
  }
}
```

- [ ] **Step 8: Run the full ui suite and typecheck**

Run: `npx vitest run --project web apps/web/src/ui && npm run typecheck -w @atlas/web`
Expected: PASS, 9 files / 40 tests; `tsc --noEmit` clean. The drawer XSS tests are the P0 guards for the legacy `innerHTML` sink.

- [ ] **Step 9: Add the remaining component styles to `components.css`**

Append:
```css
.breadcrumb__sep {
  color: var(--color-text-faint);
}

.status-badge__detail {
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rail-section__body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.legend {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.legend-footnote {
  margin: 8px 0 0;
  font-size: 11px;
  color: var(--color-text-faint);
}

.drawer-summary {
  font-family: var(--font-serif);
  font-size: 15px;
  line-height: 1.6;
  color: var(--color-warm-white);
}

.drawer-subtitle {
  margin: 20px 0 6px;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-text-faint);
}

.source-card__title {
  margin: 0 0 4px;
  font-size: 13px;
}

.source-card__url--plain {
  color: var(--color-text-faint);
  text-decoration: line-through;
}

.timeline-events {
  grid-column: 1 / -1;
  max-height: 54px;
  overflow-y: auto;
}

.timeline-events .event-row {
  border-top: none;
  padding: 2px 0;
}
```

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(web): add rail scale controls drawer with safe sources and the timeline strip"
```

---

## Phase 4 - Wiring

### Task 17: Data controller, bootstrap and entry point

**Files:**
- Create: `apps/web/src/app/dataController.ts`, `apps/web/src/app/dataController.test.ts`, `apps/web/src/app/boot.ts`, `apps/web/src/app/boot.test.ts`, `apps/web/src/main.ts`, `apps/web/src/vite-env.d.ts`
- Modify: `apps/web/index.html` (point at `/src/main.ts`, add the font preconnect and `lang="es"`)
- Delete: nothing left in `apps/web`

**Interfaces:**
- Consumes: `createApiClient` (Task 10), `createStore` / `AtlasState` / `Action` (Task 11), `buildSelectors` (Task 12), `createGlobeAdapter` / `diagnoseMapEnvironment` / `createFallbackAdapter` (Tasks 13 and 14), `createShell` / `createHeader` / `createRail` / `createDrawer` / `createStrip` / `renderStatusBadge` (Tasks 15 and 16), `toQuery` (Task 11), `buildQueryString` (Task 10).
- Produces:
  - `interface MapAdapter { setClusters(clusters: Cluster[]): void; setSelected(id: string | null): void; focus(id: string): void; setMode(mode: 'globe' | 'fallback'): void; destroy(): void }`
  - `interface DataControllerOptions { client: ApiClient; store: Store; debounceMs?: number }`
  - `createDataController(options: DataControllerOptions): { refresh(): void; refreshHealth(): void; dispose(): void }`
  - `interface BootOptions { container: HTMLElement; client: ApiClient; store?: Store; createMap?: MapFactory; now?: () => number }`
  - `type MapFactory = (host: HTMLElement, diagnostics: MapDiagnostics, onSelect: (projectId: string) => void) => Promise<MapAdapter>`
  - `boot(options: BootOptions): { dispose(): void }`
  - `apps/web/src/main.ts` reads `import.meta.env` (`VITE_API_BASE_URL`, `VITE_ALLOW_HTTP_SOURCES`, `VITE_MAPBOX_TOKEN`, `VITE_MAPBOX_STYLE`), builds the client, calls `boot`, and never throws at module scope.

- [ ] **Step 1: Write the failing data-controller test**

`apps/web/src/app/dataController.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest';
import { createDataController } from './dataController.ts';
import { createApiClient } from '../data/client.ts';
import { createStore, createInitialState } from '../state/store.ts';
import { buildQueryString } from '../data/query.ts';
import { listBodies, atlasDataFixture } from '../testing/fixtures.ts';

function harness() {
  const urls: string[] = [];
  const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    urls.push(url);
    const body = url.includes('/projects?')
      ? listBodies.projects
      : url.includes('/projects')
        ? { data: { id: 'chile-national-ai-policy', name: 'Política Nacional de IA 2024', type: 'POLICY', status: 'DEPLOYING', evidenceLevel: 'OFFICIAL', sector: 'Gobierno', publishedAt: '2024-03-01', endedAt: null, summary: null, organizations: [], locationIds: ['pucv-campus'], tags: [] } }
        : url.includes('/locations')
          ? listBodies.locations
          : url.includes('/events')
            ? { data: atlasDataFixture.events, count: atlasDataFixture.events.length }
            : url.includes('/relations')
              ? { data: [], count: 0 }
              : url.includes('/stats')
                ? atlasDataFixture.stats
                : { status: 'ok', api: 'atlas-api', database: 'up', version: '1.0.0', time: new Date().toISOString() };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  const client = createApiClient('/api', { fetchImpl: fetchImpl as unknown as typeof fetch });
  const store = createStore(createInitialState());
  const controller = createDataController({ client, store, debounceMs: 0 });
  return { client, store, controller, urls };
}

describe('data controller', () => {
  it('loads locations, projects, events, relations and stats on the first refresh', async () => {
    const { controller, store, urls } = harness();
    await controller.refresh();
    expect(urls.some((u) => u.includes('/locations'))).toBe(true);
    expect(urls.some((u) => u.includes('/projects?'))).toBe(true);
    expect(urls.some((u) => u.includes('/events'))).toBe(true);
    expect(urls.some((u) => u.includes('/relations'))).toBe(true);
    expect(urls.some((u) => u.includes('/stats'))).toBe(true);
    const state = store.getState();
    expect(state.locations.data).toHaveLength(11);
    expect(state.globalTotal).toBe(5);
    expect(state.matchingTotal).toBe(5);
  });

  it('serialises the filters into the query string', async () => {
    const { controller, store, urls } = harness();
    store.dispatch({ type: 'filters/toggleValue', key: 'type', value: 'POLICY' });
    await controller.refresh();
    const projectsUrl = urls.find((u) => u.includes('/projects?'));
    expect(projectsUrl).toContain(buildQueryString({ type: ['POLICY'] }));
  });

  it('reloads the detail when the selection changes', async () => {
    const { controller, store, urls } = harness();
    store.dispatch({ type: 'selection/set', id: 'chile-national-ai-policy' });
    await controller.refresh();
    expect(urls.some((u) => u.includes('/projects/chile-national-ai-policy'))).toBe(true);
  });

  it('does not fetch a detail when the selection is cleared', async () => {
    const { controller, store, urls } = harness();
    store.dispatch({ type: 'selection/set', id: 'chile-national-ai-policy' });
    await controller.refresh();
    const before = urls.length;
    store.dispatch({ type: 'selection/clear' });
    await controller.refresh();
    expect(urls.length - before).toBe(0);
  });

  it('reports the failure and keeps the previous data', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error', details: [], requestId: 'req-1' } }), { status: 500, headers: { 'content-type': 'application/json' } }));
    const client = createApiClient('/api', { fetchImpl: fetchImpl as unknown as typeof fetch, retryCount: 0 });
    const store = createStore(createInitialState());
    const controller = createDataController({ client, store, debounceMs: 0 });
    await controller.refresh();
    const state = store.getState();
    expect(state.api).toEqual({ status: 'error', detail: 'INTERNAL_ERROR' });
    expect(state.projects.data).toEqual([]);
  });

  it('records the request id so the badge can show it', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.includes('/stats') ? atlasDataFixture.stats : url.includes('/locations') ? listBodies.locations : url.includes('/events') ? { data: [], count: 0 } : url.includes('/relations') ? { data: [], count: 0 } : listBodies.projects;
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json', 'x-request-id': 'req-42' } });
    });
    const client = createApiClient('/api', { fetchImpl: fetchImpl as unknown as typeof fetch });
    const store = createStore(createInitialState());
    const controller = createDataController({ client, store, debounceMs: 0 });
    await controller.refresh();
    expect(store.getState().lastRequestId).toBe('req-42');
  });
});
```

- [ ] **Step 2: Run it and confirm failure**

Run: `npx vitest run --project web apps/web/src/app/dataController.test.ts`
Expected: FAIL — `Failed to resolve import "./dataController.ts"`.

- [ ] **Step 3: Implement `src/app/dataController.ts`**

```ts
import { buildQueryString } from '../data/query.ts';
import { toQuery } from '../state/filters.ts';
import type { ApiClient } from '../data/client.ts';
import type { Store } from '../state/store.ts';

export interface DataControllerOptions {
  client: ApiClient;
  store: Store;
  debounceMs?: number;
}

function errorDetail(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    return String((error as { code: string }).code);
  }
  if (error instanceof Error) return error.message.slice(0, 120);
  return 'UNKNOWN_ERROR';
}

export function createDataController(options: DataControllerOptions) {
  const { client, store } = options;
  const debounceMs = options.debounceMs ?? 250;
  let inFlight: AbortController | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;

  async function load(): Promise<void> {
    if (disposed) return;
    inFlight?.abort();
    const controller = new AbortController();
    inFlight = controller;
    const { filters, selectedId, level, selectedLocationId } = store.getState();

    try {
      const health = await client.health({ signal: controller.signal });
      store.dispatch({ type: 'api/healthy' });
      store.dispatch({ type: 'ui/lastRequestId', requestId: health.requestId ?? null });
    } catch (error) {
      if ((error as { name?: string }).name === 'AbortError') return;
      store.dispatch({ type: 'api/unhealthy', detail: errorDetail(error) });
      return;
    }

    try {
      const stats = await client.stats({ signal: controller.signal });
      store.dispatch({ type: 'data/stats', payload: stats });
    } catch (error) {
      if ((error as { name?: string }).name === 'AbortError') return;
    }

    const listQuery = toQuery(filters);
    if (selectedLocationId) listQuery.locationId = selectedLocationId;

    try {
      const [locations, projects] = await Promise.all([
        client.locations({ ...(level ? { level } : {}), signal: controller.signal }),
        client.projects({ ...listQuery, signal: controller.signal }),
      ]);
      store.dispatch({ type: 'data/locations', payload: locations });
      store.dispatch({
        type: 'data/projects',
        payload: { data: projects.data, page: projects.page, pageSize: projects.pageSize, total: projects.total, totalPages: projects.totalPages },
      });
    } catch (error) {
      if ((error as { name?: string }).name === 'AbortError') return;
      store.dispatch({ type: 'data/error', detail: errorDetail(error) });
      return;
    }

    try {
      const events = await client.events({ signal: controller.signal });
      store.dispatch({ type: 'data/events', payload: events.data });
    } catch {
      store.dispatch({ type: 'data/events', payload: [] });
    }

    if (selectedId) {
      try {
        const detail = await client.project(selectedId, { signal: controller.signal });
        store.dispatch({ type: 'data/detail', payload: detail });
      } catch (error) {
        if ((error as { name?: string }).name === 'AbortError') return;
        store.dispatch({ type: 'data/detail', payload: null });
      }
    } else {
      store.dispatch({ type: 'data/detail', payload: null });
    }
  }

  return {
    refresh(): Promise<void> {
      if (debounceMs === 0) return load();
      return new Promise((resolve) => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          void load().then(resolve);
        }, debounceMs);
      });
    },
    refreshHealth(): Promise<void> {
      return load();
    },
    dispose(): void {
      disposed = true;
      inFlight?.abort();
      if (timer) clearTimeout(timer);
    },
  };
}
```

Two adjustments the test above forces, both required:

1. The `ApiClient` methods must accept a `signal`. `health` must also return the request id so the badge can show it, which means `client.health` resolves to `HealthResponse & { requestId: string | null }`. In `data/client.ts` the shared request helper must read `response.headers.get('x-request-id')` and merge it into the parsed payload; `ApiRequestError` already carries `requestId`, so the success path needs the same read. Use the header name `x-request-id` on the API side (Task 5 sets it) and read it case-insensitively.
2. `toQuery` returns the filter fields already shaped for `buildQueryString`; adding `locationId` to it is a plain assignment, so declare `listQuery` as `Record<string, unknown>` rather than the narrower inferred type:
   ```ts
   const listQuery: Record<string, unknown> = { ...toQuery(filters) };
   ```

Also confirm `Store` and `Action` include `api/healthy`, `api/unhealthy`, `ui/lastRequestId`, `data/error`, `data/events`, `data/detail` and `data/locations`, `data/projects`, `data/stats`. If Task 11 named the health actions differently (`api/ok` / `api/fail`), rename them here rather than adding duplicates; one action per meaning.

- [ ] **Step 4: Run the data-controller test and confirm it passes**

Run: `npx vitest run --project web apps/web/src/app/dataController.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Write the failing boot test**

`apps/web/src/app/boot.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest';
import { boot } from './boot.ts';
import type { MapAdapter } from './dataController.ts';
import { createApiClient } from '../data/client.ts';
import { listBodies, atlasDataFixture, projectDetailFixture } from '../testing/fixtures.ts';

function fakeAdapter(): MapAdapter & { setClusters: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> } {
  return {
    setClusters: vi.fn(),
    setSelected: vi.fn(),
    focus: vi.fn(),
    setMode: vi.fn(),
    destroy: vi.fn(),
  } as never;
}

function harness(options: { detail?: boolean } = {}) {
  const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const body = url.endsWith('/api/health')
      ? { status: 'ok', api: 'atlas-api', database: 'up', version: '1.0.0', time: new Date().toISOString() }
      : url.includes('/api/stats')
        ? atlasDataFixture.stats
        : url.includes('/api/locations')
          ? listBodies.locations
          : url.includes('/api/events')
            ? { data: atlasDataFixture.events, count: atlasDataFixture.events.length }
            : url.includes('/api/relations')
              ? { data: [], count: 0 }
              : url.includes('/api/projects?')
                ? listBodies.projects
                : options.detail === false
                  ? { data: { id: 'nope', name: 'Nope', type: 'POLICY', status: 'DEPLOYING', evidenceLevel: 'OFFICIAL', sector: null, publishedAt: null, endedAt: null, summary: null, organizations: [], locationIds: [], tags: [], sources: [], events: [], statusHistory: [], relations: [] } }
                  : { data: projectDetailFixture };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  const client = createApiClient('/api', { fetchImpl: fetchImpl as unknown as typeof fetch, retryCount: 0 });
  const adapter = fakeAdapter();
  const container = document.createElement('div');
  document.body.append(container);
  const createMap = vi.fn(async () => adapter);
  const app = boot({ container, client, createMap, now: () => 0 });
  return { container, adapter, createMap, app, client };
}

describe('boot', () => {
  it('mounts the six regions and populates them from the API', async () => {
    const { container } = harness();
    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-project-id]').length).toBe(5);
    });
    expect(container.querySelector('[data-testid="app-root"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="header"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="rail"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="drawer"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="strip"]')).not.toBeNull();
  });

  it('pushes the clusters to the map adapter', async () => {
    const { adapter } = harness();
    await vi.waitFor(() => {
      expect(adapter.setClusters).toHaveBeenCalled();
    });
    const clusters = adapter.setClusters.mock.calls.at(-1)?.[0] as Array<{ id: string; count: number }>;
    expect(clusters.reduce((sum, c) => sum + c.count, 0)).toBe(5);
  });

  it('opens the drawer when a marker selects a project', async () => {
    const { container, adapter } = harness();
    await vi.waitFor(() => expect(adapter.setClusters).toHaveBeenCalled());
    const marker = container.querySelector<HTMLElement>('[data-project-id="chile-national-ai-policy"]');
    expect(marker).not.toBeNull();
    marker?.click();
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="drawer"]')?.hasAttribute('hidden')).toBe(false);
    });
    expect(container.querySelector('[data-testid="drawer-title"]')?.textContent).toBe('Política Nacional de IA 2024');
  });

  it('closes the drawer without losing the data', async () => {
    const { container } = harness();
    await vi.waitFor(() => {
      expect(container.querySelector('[data-project-id]')).not.toBeNull();
    });
    container.querySelector<HTMLElement>('[data-project-id="chile-national-ai-policy"]')?.click();
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="drawer-close"]')).not.toBeNull();
    });
    container.querySelector<HTMLButtonElement>('[data-testid="drawer-close"]')?.click();
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="drawer"]')?.hasAttribute('hidden')).toBe(true);
    });
    expect(container.querySelector('[data-project-id]')).not.toBeNull();
  });

  it('falls back to the data-only map when the map factory rejects', async () => {
    const { container, client } = harness();
    const createMap = vi.fn(async () => {
      throw new Error('WebGL unavailable');
    });
    const app = boot({ container, client, createMap });
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="fallback"]')).not.toBeNull();
    });
    expect(container.querySelector('[data-testid="fallback-diagnostic"]')?.textContent).toContain('WebGL unavailable');
    app.dispose();
  });

  it('stops rendering and aborts requests after dispose', async () => {
    const { container, app, adapter } = harness();
    await vi.waitFor(() => expect(adapter.setClusters).toHaveBeenCalled());
    app.dispose();
    expect(adapter.destroy).toHaveBeenCalled();
    expect(container.querySelector('[data-testid="app-root"]')).toBeNull();
  });
});
```

- [ ] **Step 6: Run it and confirm failure**

Run: `npx vitest run --project web apps/web/src/app/boot.test.ts`
Expected: FAIL — `Failed to resolve import "./boot.ts"`.

- [ ] **Step 7: Implement `src/app/boot.ts`**

```ts
import { diagnoseMapEnvironment } from '../map/diagnostics.ts';
import { createFallbackAdapter } from '../map/fallback.ts';
import { createGlobeAdapter } from '../map/globe.ts';
import { buildSelectors } from '../state/selectors.ts';
import { createDrawer, renderDrawer } from '../ui/drawer.ts';
import { createHeader } from '../ui/header.ts';
import { createRail, renderRail } from '../ui/rail.ts';
import { createShell } from '../ui/shell.ts';
import { createStrip, renderStrip } from '../ui/strip.ts';
import { renderStatusBadge } from '../ui/statusBadge.ts';
import { clear, el } from '../ui/dom.ts';
import { createDataController } from './dataController.ts';
import { createInitialState, createStore } from '../state/store.ts';
import type { ApiClient } from '../data/client.ts';
import type { Cluster } from '../state/selectors.ts';
import type { MapDiagnostics } from '../map/diagnostics.ts';
import type { Store } from '../state/store.ts';

export interface MapAdapter {
  setClusters(clusters: Cluster[]): void;
  setSelected(id: string | null): void;
  focus(id: string): void;
  setMode(mode: 'globe' | 'fallback'): void;
  destroy(): void;
}

export type MapFactory = (
  host: HTMLElement,
  diagnostics: MapDiagnostics,
  onSelect: (projectId: string) => void,
) => Promise<MapAdapter>;

export interface BootOptions {
  container: HTMLElement;
  client: ApiClient;
  store?: Store;
  createMap?: MapFactory;
  allowHttpSources?: boolean;
}

function defaultMapFactory(): MapFactory {
  return async (host, diagnostics, onSelect) => {
    if (!diagnostics.ok) {
      host.hidden = false;
      return createFallbackAdapter({
        host,
        reason: diagnostics.reason,
        onSelect: (projectId) => onSelect(projectId),
      });
    }
    const globe = await createGlobeAdapter({ host, onSelect, token: diagnostics.token });
    globe.setMode('globe');
    return globe;
  };
}

export function boot(options: BootOptions) {
  const store = options.store ?? createStore(createInitialState());
  const container = options.container;
  clear(container);

  const shell = createShell(container);
  const mapHost = shell.mapHost;
  const statusSlot = createHeader(shell.header, {
    onSearch: (value) => {
      store.dispatch({ type: 'filters/setQuery', value });
      void controller.refresh();
    },
    onRailToggle: () => {
      if (shell.rail.hasAttribute('hidden')) shell.rail.removeAttribute('hidden');
      else shell.rail.setAttribute('hidden', '');
    },
  });

  const drawer = createDrawer(shell.drawer, {
    onClose: () => {
      store.dispatch({ type: 'selection/clear' });
    },
    onFocus: (locationId) => {
      store.dispatch({ type: 'geo/focusLocation', locationId });
      void controller.refresh();
    },
  });

  const rail = createRail(shell.rail, {
    onLevel: (level) => {
      store.dispatch({ type: 'geo/setLevel', level });
      void controller.refresh();
    },
    onToggle: (key, value) => {
      store.dispatch({ type: 'filters/toggleValue', key, value });
      void controller.refresh();
    },
    onYearRange: (patch) => {
      store.dispatch({ type: 'filters/setYearRange', ...patch });
      void controller.refresh();
    },
    onReset: () => {
      store.dispatch({ type: 'filters/reset' });
      void controller.refresh();
    },
    onFocus: (locationId) => {
      store.dispatch({ type: 'geo/focusLocation', locationId });
      void controller.refresh();
    },
  });

  const strip = createStrip(shell.strip, {
    onYear: (year) => {
      store.dispatch({ type: 'timeline/setYear', year });
    },
    onPlayToggle: () => {
      store.dispatch({ type: 'timeline/play' });
    },
    onStep: (delta) => {
      const state = store.getState();
      const year = state.timeline.year + delta;
      store.dispatch({ type: 'timeline/setYear', year });
    },
  });

  const controller = createDataController({ client: options.client, store });

  const listHost = el('div', { class: 'project-list', 'data-testid': 'project-list', role: 'list' });

  let adapter: MapAdapter | undefined;
  let disposed = false;

  const renderProjectList = (state: AtlasState): void => {
    clear(listHost);
    for (const project of state.projects.data) {
      const button = el(
        'button',
        {
          type: 'button',
          class: 'project-list__item',
          role: 'listitem',
          'data-project-id': project.id,
          'aria-pressed': String(project.id === state.selectedId),
        },
        [document.createTextNode(project.name)],
      ) as HTMLButtonElement;
      button.addEventListener('click', () => {
        store.dispatch({ type: 'selection/set', id: project.id });
        void controller.refresh();
      });
      listHost.append(button);
    }
  };

  const factory = options.createMap ?? defaultMapFactory();

  const ensureAdapter = (): void => {
    if (adapter || disposed) return;
    const diagnostics = diagnoseMapEnvironment({
      token: (import.meta.env.VITE_MAPBOX_TOKEN as string | undefined) ?? '',
      style: (import.meta.env.VITE_MAPBOX_STYLE as string | undefined) ?? 'mapbox://styles/mapbox/dark-v11',
    });
    void factory(mapHost, diagnostics, (projectId) => {
      store.dispatch({ type: 'selection/set', id: projectId });
      void controller.refresh();
    })
      .then((created) => {
        if (disposed) {
          created.destroy();
          return;
        }
        adapter = created;
        if (!diagnostics.ok) {
          store.dispatch({ type: 'map/fallback', reason: diagnostics.reason });
        }
        store.dispatch({ type: 'map/ready' });
      })
      .catch((error: unknown) => {
        store.dispatch({ type: 'map/fallback', reason: error instanceof Error ? error.message : 'map-unavailable' });
      });
  };

  const render = (): void => {
    if (disposed) return;
    const state = store.getState();
    const selectors = buildSelectors(state);

    renderStatusBadge(statusSlot, state.api, state.lastRequestId);
    renderRail(rail, state, selectors);
    renderStrip(strip, state, selectors, state.events);
    renderDrawer(drawer, state.detail, { allowHttp: options.allowHttpSources === true });

    if (state.selectedId) {
      shell.drawer.removeAttribute('hidden');
    } else {
      shell.drawer.setAttribute('hidden', '');
    }

    const clusters = selectors.clusters;
    if (adapter && state.mapMode === 'globe') {
      adapter.setClusters(clusters);
      adapter.setSelected(state.selectedId);
    }

    mapHost.setAttribute('data-map-mode', state.mapMode);
    renderProjectList(state);

    if (state.mapMode === 'fallback') {
      const host = mapHost;
      clear(host);
      host.hidden = false;
      const reason = state.fallbackReason ?? 'map-unavailable';
      host.append(
        el('div', { class: 'fallback', 'data-testid': 'fallback' }, [
          el('div', { class: 'fallback__diagnostic', 'data-testid': 'fallback-diagnostic', text: `Mapa 3D no disponible: ${reason}` }),
          el('div', { class: 'fallback__canvas' }, [
            el('div', { class: 'fallback__graticule' }, [el('div', { class: 'fallback__points' })]),
          ]),
        ]),
      );
    }

    mapHost.append(listHost);
  };

  store.subscribe(render);
  render();
  ensureAdapter();
  void controller.refresh();

  return {
    dispose(): void {
      disposed = true;
      controller.dispose();
      adapter?.destroy();
      clear(container);
    },
  };
}
```

Two design points are baked into the code above because the boot test forces them — do not remove them:

1. **The `[data-project-id]` list lives in the DOM, not only inside Mapbox.** A `MapboxMarker` element belongs to the map's own container, which `boot` does not own, so clicking it in jsdom is impossible. The always-present `listHost` is also the keyboard and screen-reader path to every project, which spec §10 requires. It is appended after the fallback branch so it survives the `clear(host)` in fallback mode, and CSS hides it when `data-map-mode="globe"`.
2. **The drawer is hidden with the `hidden` attribute, never by removing the node**, because the test asserts `hasAttribute('hidden')` after closing and expects the project list to survive.

Also add to `state/colors.ts` nothing new; `renderStatusBadge` already exists.

- [ ] **Step 8: Run the boot test and confirm it passes**

Run: `npx vitest run --project web apps/web/src/app`
Expected: PASS, 12 tests. If the "falls back" test fails, confirm the default factory is the one being replaced: the test passes an explicit `createMap` that rejects, so the catch branch in `ensureAdapter` must dispatch `map/fallback`, and `render` must build the fallback banner with both testids.

- [ ] **Step 9: Add the map-mode and hidden-list styles**

Append to `layout.css`:
```css
.atlas-map[data-map-mode='globe'] .project-list {
  display: none;
}

.atlas-map[data-map-mode='fallback'] .project-list {
  display: flex;
}

.fallback__points {
  position: absolute;
  inset: 0;
}
```

- [ ] **Step 10: Implement `src/main.ts` and `src/vite-env.d.ts`**

`apps/web/src/vite-env.d.ts`:
```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_ALLOW_HTTP_SOURCES?: string;
  readonly VITE_MAPBOX_TOKEN?: string;
  readonly VITE_MAPBOX_STYLE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

`apps/web/src/main.ts`:
```ts
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';

import { boot } from './app/boot.ts';
import { createApiClient } from './data/client.ts';
import { el } from './ui/dom.ts';

function readFlag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value === 'true' || value === '1';
}

const container = document.querySelector<HTMLElement>('#app');
if (!container) {
  throw new Error('Missing #app root element');
}

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api';

try {
  const client = createApiClient(baseUrl, { timeoutMs: 10_000 });
  boot({
    container,
    client,
    allowHttpSources: readFlag(import.meta.env.VITE_ALLOW_HTTP_SOURCES, import.meta.env.DEV),
  });
} catch (error) {
  container.append(
    el('div', { class: 'boot-error' }, [
      el('h1', { text: 'AI World Atlas no pudo iniciar' }),
      el('p', { text: error instanceof Error ? error.message : 'Error desconocido' }),
      el('p', { text: `Verificá que la API esté disponible en ${baseUrl}.` }),
    ]),
  );
}
```

- [ ] **Step 11: Update `apps/web/index.html`**

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1.0" />
    <meta name="theme-color" content="#08090c" />
    <meta
      name="description"
      content="Atlas navegable de infraestructura, políticas e investigación en inteligencia artificial."
    />
    <title>AI World Atlas</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 12: Run the whole web project and the production build**

Run: `npx vitest run --project web && npm run build -w @atlas/web`
Expected: all web tests pass and Vite reports a bundle. If Vite fails on `import.meta.env.VITE_MAPBOX_TOKEN` under `tsc --noEmit`, the `vite-env.d.ts` reference is missing from `tsconfig.json` `include`; add `"src/vite-env.d.ts"` explicitly.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat(web): wire the data controller bootstrap and entry point"
```

---

## Phase 5 — Verification and delivery

### Task 18: End-to-end suite with Playwright

**Files:**
- Create: `apps/web/playwright.config.ts`, `apps/web/e2e/helpers.ts`, `apps/web/e2e/atlas.spec.ts`, `apps/web/e2e/fallback.spec.ts`
- Modify: `apps/web/package.json` (add `test:e2e` script and `@playwright/test` devDependency), root `package.json` (add `test:e2e`), `apps/web/src/app/boot.ts` (honour `?map=fallback` and close the drawer on `Escape`), `apps/web/src/ui/drawer.ts` (expose `close`)

**Interfaces:**
- Consumes: `boot` (Task 17), the accessible project list, every `data-testid` documented in Task 9, the memory repositories seeded in Task 5.
- Produces:
  - `e2e/helpers.ts`: `gotoAtlas(page: Page, options?: { map?: 'globe' | 'fallback' })` — navigates to the app and waits for the status badge to settle; `expectStatus(page, state: 'ok' | 'error')`; `openProject(page, id: string)`; `projectCount(page): Promise<number>`.
  - `npm run test:e2e` at the root, which starts the API on port 8787 with in-memory repositories and Vite on 5173, then runs the suite.
  - New documented behaviour: `?map=fallback` forces the data-only map, and `Escape` closes the drawer. Both are required by the E2E suite and are legitimate product affordances (a shareable "no WebGL" link, and a keyboard convention).

- [ ] **Step 1: Install the Playwright dependency**

Run: `npm install --save-dev --workspace @atlas/web @playwright/test@^1.50.0 @axe-core/playwright@^4.10.0`
Then: `npx playwright install chromium --with-deps` (skip `--with-deps` on Windows, where it is unnecessary).

Expected: both packages in `apps/web` devDependencies and the Chromium browser downloaded to the user cache.

- [ ] **Step 2: Add the `test:e2e` scripts**

Append to `apps/web/package.json` scripts:
```json
"test:e2e": "playwright test"
```
Append to the root `package.json` scripts:
```json
"test:e2e": "npm run test:e2e --workspace @atlas/web"
```

- [ ] **Step 3: Write `apps/web/playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';

const WEB_PORT = 5173;
const API_PORT = 8787;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: process.env['CI'] === 'true',
  retries: process.env['CI'] === 'true' ? 1 : 0,
  reporter: process.env['CI'] === 'true' ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run dev --workspace @atlas/api',
      url: `http://127.0.0.1:${API_PORT}/api/health`,
      reuseExistingServer: !process.env['CI'],
      timeout: 60_000,
      env: {
        NODE_ENV: 'test',
        PORT: String(API_PORT),
        ATLAS_REPOS: 'memory',
        CORS_ORIGIN: `http://127.0.0.1:${WEB_PORT},http://localhost:${WEB_PORT}`,
        LOG_LEVEL: 'warn',
      },
    },
    {
      command: 'npm run dev --workspace @atlas/web',
      url: `http://127.0.0.1:${WEB_PORT}`,
      reuseExistingServer: !process.env['CI'],
      timeout: 60_000,
      env: { VITE_API_BASE_URL: `http://127.0.0.1:${API_PORT}` },
    },
  ],
});
```

The API runs with `ATLAS_REPOS=memory`, so the E2E suite needs no database. Real PostgreSQL behaviour is covered by the repository suite from Task 6 and by the CI job added in Task 21.

`ATLAS_REPOS` needs a switch in the entry point, so amend `apps/api/src/server.ts` written in Task 5. Replace its first import block and the two lines that build the pool and the app with:

```ts
import 'dotenv/config';
import { buildApp } from './app.ts';
import { loadEnv } from './config/env.ts';
import { createLogger } from './config/logger.ts';
import { createPool, closePool } from './db/pool.ts';
import { createPgRepositories } from './repositories/pg/index.ts';
import { createFakeRepositories } from './repositories/fake.ts';
import { atlasDataFixture } from './testing/fixtures.ts';
import type { AtlasRepositories } from './repositories/types.ts';

const env = loadEnv();
const logger = createLogger(env.logLevel);
const useMemory = process.env['ATLAS_REPOS'] === 'memory';

const pool = useMemory ? null : createPool(env.databaseUrl);
const repos: AtlasRepositories = useMemory
  ? createFakeRepositories(atlasDataFixture)
  : createPgRepositories(pool!);

const app = buildApp({ repos, env, logger });
```

and change the `shutdown` body to `if (pool) await closePool(pool);`. `ATLAS_REPOS=postgres` is the default, so no production behaviour changes. Log the selected source on boot with `logger.info('atlas api listening', { port: env.port, env: env.nodeEnv, repos: useMemory ? 'memory' : 'postgres' })`.

- [ ] **Step 4: Make `boot` honour `?map=fallback`**

In `apps/web/src/app/boot.ts`, inside `boot`, before the `ensureAdapter` call, add:

```ts
  const forcedMode = new URLSearchParams(window.location.search).get('map');
  const forceFallback = forcedMode === 'fallback';
```

and change the `ensureAdapter` decision to:

```ts
  if (forceFallback) {
    host.dataset['mapMode'] = 'fallback';
    adapter = createFallbackAdapter({
      reason: 'Forced by the ?map=fallback query parameter',
      onSelect: selectProject,
      width: host.clientWidth,
      height: host.clientHeight,
    });
    return adapter;
  }
```

- [ ] **Step 5: Close the drawer on `Escape`**

In `apps/web/src/ui/drawer.ts`, inside `createDrawer`, after wiring the close button, add:

```ts
  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && !root.hidden) handlers.onClose();
  };
  root.addEventListener('keydown', onKeydown);
  return { root, title, body, close, dispose: () => root.removeEventListener('keydown', onKeydown) };
```

The listener lives on the drawer root, so it only fires while the drawer is in the accessibility tree. Make sure the existing `DrawerRefs` return statement is replaced by the one above (it previously returned only `{ root, title, body, close }`).

- [ ] **Step 6: Write `apps/web/e2e/helpers.ts`**

```ts
import { expect, type Page } from '@playwright/test';

export async function gotoAtlas(page: Page, options: { map?: 'globe' | 'fallback' } = {}): Promise<void> {
  const query = options.map === 'fallback' ? '?map=fallback' : '';
  await page.goto(`/${query}`);
  await expect(page.getByTestId('app-root')).toBeVisible();
  await expect(page.getByTestId('api-status')).toBeVisible();
}

export async function expectStatus(page: Page, state: 'ok' | 'error'): Promise<void> {
  await expect(page.getByTestId('api-status')).toHaveAttribute('data-state', state, { timeout: 15_000 });
}

export async function projectCount(page: Page): Promise<number> {
  return page.locator('[data-project-id]').count();
}

export async function openProject(page: Page, id: string): Promise<void> {
  await page.locator(`[data-project-id="${id}"]`).first().click();
  await expect(page.getByTestId('drawer')).toBeVisible();
}

export async function matchingCountText(page: Page): Promise<string> {
  return (await page.getByTestId('matching-count').textContent()) ?? '';
}
```

- [ ] **Step 7: Write the failing core spec**

`apps/web/e2e/atlas.spec.ts`:
```ts
import { expect, test } from '@playwright/test';
import { expectStatus, gotoAtlas, matchingCountText, openProject, projectCount } from './helpers.ts';

test.beforeEach(async ({ page }) => {
  await gotoAtlas(page);
  await expectStatus(page, 'ok');
});

test('mounts the six shell regions and reports a healthy api', async ({ page }) => {
  for (const id of ['app-root', 'header', 'rail', 'map-host', 'strip']) {
    await expect(page.getByTestId(id)).toBeVisible();
  }
  await expect(page.getByTestId('drawer')).toBeHidden();
  await expect(page.getByTestId('global-total')).toHaveText('11');
});

test('lists the five seeded projects and never a sixth', async ({ page }) => {
  await expect.poll(() => projectCount(page)).toBe(5);
});

test('opens the drawer with sources and events for a project', async ({ page }) => {
  await openProject(page, 'chile-national-ai-policy');
  await expect(page.getByTestId('drawer-title')).toHaveText('Política Nacional de Inteligencia Artificial (Chile)');
  await expect(page.getByTestId('source-link').first()).toBeVisible();
  await expect(page.getByTestId('timeline-events')).toContainText('2024');
});

test('closes the drawer with Escape and the close button', async ({ page }) => {
  await openProject(page, 'eu-ai-factories');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('drawer')).toBeHidden();
  await openProject(page, 'eu-ai-factories');
  await page.getByTestId('drawer-close').click();
  await expect(page.getByTestId('drawer')).toBeHidden();
});

test('filters by project type and updates the matching count', async ({ page }) => {
  await page.getByRole('button', { name: 'Infraestructura', exact: true }).click();
  await expect.poll(() => matchingCountText(page)).toContain('1');
  await expect.poll(() => projectCount(page)).toBe(1);
});

test('expands a location through the breadcrumb', async ({ page }) => {
  await page.getByRole('button', { name: 'Sudamérica' }).click();
  await expect(page.getByTestId('breadcrumb')).toContainText('Sudamérica');
  await expect.poll(() => projectCount(page)).toBeLessThan(5);
});

test('resets every filter from the rail', async ({ page }) => {
  await page.getByRole('button', { name: 'Infraestructura', exact: true }).click();
  await page.getByTestId('rail-reset').click();
  await expect.poll(() => projectCount(page)).toBe(5);
});

test('searches without diacritics', async ({ page }) => {
  await page.getByTestId('search-input').fill('politica');
  await expect.poll(() => projectCount(page)).toBe(1);
});

test('steps the timeline year forward and back', async ({ page }) => {
  const year = page.getByTestId('timeline-year');
  const initial = await year.textContent();
  await page.getByTestId('timeline-next').click();
  await expect(year).not.toHaveText(initial ?? '');
  await page.getByTestId('timeline-prev').click();
  await expect(year).toHaveText(initial ?? '');
});

test('never renders a javascript or data href', async ({ page }) => {
  await openProject(page, 'chile-national-ai-policy');
  const unsafe = await page.evaluate(() =>
    [...document.querySelectorAll('a')].map((a) => a.getAttribute('href') ?? '').filter((href) => /^(javascript|data|vbscript):/i.test(href)),
  );
  expect(unsafe).toEqual([]);
});

test('drops the marker pulse when reduced motion is requested', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await expectStatus(page, 'ok');
  await expect.poll(() => projectCount(page)).toBe(5);
  await expect(page.locator('.marker-pulse')).toHaveCount(0);
});

test('has no detectable accessibility violations with the drawer closed', async ({ page }) => {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});

test('has no detectable accessibility violations with the drawer open', async ({ page }) => {
  await openProject(page, 'chile-national-ai-policy');
  const results = await new AxeBuilder({ page }).include('[data-testid="drawer"]').analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});
```

- [ ] **Step 8: Write the failing fallback spec**

`apps/web/e2e/fallback.spec.ts`:
```ts
import { expect, test } from '@playwright/test';
import { expectStatus, gotoAtlas, openProject, projectCount } from './helpers.ts';

test.use({ reducedMotion: 'no-preference' });

test('falls back to a data-only map and still works', async ({ page }) => {
  await gotoAtlas(page, { map: 'fallback' });
  await expectStatus(page, 'ok');
  await expect(page.getByTestId('fallback')).toBeVisible();
  await expect(page.getByTestId('fallback-diagnostic')).toContainText('?map=fallback');
  await expect(page.getByTestId('map-host')).toHaveAttribute('data-map-mode', 'fallback');
  await expect.poll(() => projectCount(page)).toBe(5);
});

test('opens a project from the fallback map', async ({ page }) => {
  await gotoAtlas(page, { map: 'fallback' });
  await openProject(page, 'pucv-fondecyt-fuzzy');
  await expect(page.getByTestId('drawer-title')).toContainText('Fuzzy');
});

test('loads no map tiles in fallback mode', async ({ page }) => {
  const tileRequests: string[] = [];
  page.on('request', (request) => {
    if (/tiles\.mapbox|api\.mapbox\.com/.test(request.url())) tileRequests.push(request.url());
  });
  await gotoAtlas(page, { map: 'fallback' });
  await expectStatus(page, 'ok');
  expect(tileRequests).toEqual([]);
});
```

- [ ] **Step 9: Add the axe import to the spec**

At the top of `apps/web/e2e/atlas.spec.ts`, add:

```ts
import AxeBuilder from '@axe-core/playwright';
```

- [ ] **Step 10: Run the suite and fix only real defects**

Run: `npm run test:e2e`
Expected: PASS. The most likely failures, and what each one means:

| Symptom | Real defect to fix |
| --- | --- |
| `api-status` never reaches `data-state="ok"` | `main.ts` was not passing `VITE_API_BASE_URL` through, or the API CORS list is missing `http://127.0.0.1:5173` |
| `drawer-title` mismatch | The seeded Spanish name in `apps/api/src/testing/fixtures.ts` and the expectation drifted; fix the expectation to the audited name, never the other way round |
| `matching-count` never updates | `renderStrip` is not re-rendering, or the controller is not re-fetching on filter change |
| Count assertions flaky | Replace the bare `expect(locator).toHaveCount` with `expect.poll(...)`, because the count settles one tick after the click |

Re-run until green. Never delete an assertion to make the suite pass.

- [ ] **Step 11: Run the complete gate set**

Run: `npm run check && npm run test:e2e`
Expected: lint, typecheck, unit tests, build and the E2E suite all pass.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "test(web): add playwright e2e suite for map drawer filters timeline and fallback"
```

---

### Task 19: Container images and the PostGIS compose stack

**Files:**
- Create: `docker-compose.yml`, `docker-compose.prod.yml`, `.dockerignore`, `apps/api/Dockerfile`, `apps/web/Dockerfile`, `apps/web/nginx.conf`
- Modify: `.env.example` (add the container variables)

**Interfaces:**
- Consumes: the `db:migrate`, `start` and `build` scripts from Tasks 1 and 5, the `/api` default base URL from Task 10, `VITE_MAPBOX_TOKEN` from Task 13.
- Produces: a three-service stack (`db`, `api`, `web`) reachable at `http://localhost:8080`, with the web container proxying `/api` to the API so production is same-origin and CORS is a non-issue. This is exactly the shape Dokploy expects: one application, an internal database, and a health check.

Docker is not installed on the authoring machine, so this task cannot be verified locally. Step 8 makes CI the verification point; do not claim the stack works before that job is green.

- [ ] **Step 1: Write `.dockerignore` at the repository root**

```
node_modules
**/node_modules
**/dist
**/coverage
**/playwright-report
**/test-results
.git
.github
*.log
.env
.env.*
!.env.example
docs
e2e
```

- [ ] **Step 2: Write `apps/api/Dockerfile`**

```dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace @atlas/contracts --workspace @atlas/api --include-workspace-root

FROM deps AS build
WORKDIR /app
COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY apps/api apps/api
RUN npm run build --workspace @atlas/contracts \
  && npm run build --workspace @atlas/api \
  && npm prune --omit=dev

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S atlas && adduser -S atlas -G atlas
COPY --from=build --chown=atlas:atlas /app/node_modules ./node_modules
COPY --from=build --chown=atlas:atlas /app/package.json ./package.json
COPY --from=build --chown=atlas:atlas /app/packages/contracts/package.json ./packages/contracts/package.json
COPY --from=build --chown=atlas:atlas /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=build --chown=atlas:atlas /app/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=atlas:atlas /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=atlas:atlas /app/apps/api/migrations ./apps/api/migrations
USER atlas
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=4s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8787/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/api/dist/server.js"]
```

- [ ] **Step 3: Write `apps/web/Dockerfile`**

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
ARG VITE_API_BASE_URL=/api
ARG VITE_MAPBOX_TOKEN=
ARG VITE_MAPBOX_STYLE=mapbox://styles/mapbox/dark-v11
ARG VITE_ALLOW_HTTP_SOURCES=false
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
  VITE_MAPBOX_TOKEN=$VITE_MAPBOX_TOKEN \
  VITE_MAPBOX_STYLE=$VITE_MAPBOX_STYLE \
  VITE_ALLOW_HTTP_SOURCES=$VITE_ALLOW_HTTP_SOURCES
COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace @atlas/contracts --workspace @atlas/web --include-workspace-root
COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY apps/web apps/web
RUN npm run build --workspace @atlas/contracts && npm run build --workspace @atlas/web

FROM nginx:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=4s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz >/dev/null || exit 1
```

Note the deliberate property: `VITE_MAPBOX_TOKEN` is baked in at build time because Vite inlines `import.meta.env` into the bundle. Rotating the token means rebuilding the image; it is never a runtime secret in the browser.

- [ ] **Step 4: Write `apps/web/nginx.conf`**

```nginx
server {
  listen 80;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;

  gzip on;
  gzip_types text/css application/javascript application/json image/svg+xml;
  gzip_min_length 1024;

  location = /healthz {
    access_log off;
    add_header Content-Type text/plain;
    return 200 'ok';
  }

  location /api/ {
    proxy_pass http://api:8787;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /assets/ {
    expires 1y;
    add_header Cache-Control 'public, immutable';
  }

  location / {
    add_header Cache-Control 'no-cache';
    try_files $uri $uri/ /index.html;
  }
}
```

- [ ] **Step 5: Write `docker-compose.yml`**

```yaml
services:
  db:
    image: postgis/postgis:16-3.4
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-atlas}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-atlas}
      POSTGRES_DB: ${POSTGRES_DB:-aiworldatlas}
    volumes:
      - atlas-db:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U ${POSTGRES_USER:-atlas} -d ${POSTGRES_DB:-aiworldatlas}']
      interval: 10s
      timeout: 5s
      retries: 10
    restart: unless-stopped

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    environment:
      NODE_ENV: production
      PORT: '8787'
      DATABASE_URL: postgres://${POSTGRES_USER:-atlas}:${POSTGRES_PASSWORD:-atlas}@db:5432/${POSTGRES_DB:-aiworldatlas}
      CORS_ORIGIN: ${CORS_ORIGIN:-http://localhost:8080}
      LOG_LEVEL: ${LOG_LEVEL:-info}
    depends_on:
      db:
        condition: service_healthy
    command: >
      sh -c "node apps/api/dist/db/migrate-cli.js && node apps/api/dist/server.js"
    restart: unless-stopped

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
      args:
        VITE_MAPBOX_TOKEN: ${VITE_MAPBOX_TOKEN:-}
        VITE_MAPBOX_STYLE: ${VITE_MAPBOX_STYLE:-mapbox://styles/mapbox/dark-v11}
    depends_on:
      api:
        condition: service_healthy
    ports:
      - '${WEB_PORT:-8080}:80'
    restart: unless-stopped

volumes:
  atlas-db:
```

The API command runs the migration runner before the server, so a fresh volume is migrated on first boot. `db:migrate` is idempotent because it records applied filenames in `schema_migrations`.

- [ ] **Step 6: Extend `.env.example`**

Append to the root `.env.example`:

```dotenv
# Container stack
POSTGRES_USER=atlas
POSTGRES_PASSWORD=change-me
POSTGRES_DB=aiworldatlas
WEB_PORT=8080
CORS_ORIGIN=http://localhost:8080

# Vite build-time variables (inlined into the bundle, not runtime secrets)
VITE_API_BASE_URL=/api
VITE_MAPBOX_TOKEN=
VITE_MAPBOX_STYLE=mapbox://styles/mapbox/dark-v11
VITE_ALLOW_HTTP_SOURCES=false
```

- [ ] **Step 7: Check the compose files parse**

Run: `docker compose config --quiet` and then, with the required variables supplied, `docker compose -f docker-compose.prod.yml config --quiet`
Expected: exit code 0 for both. The production file uses `${VAR:?message}`, so the second
command needs `DATABASE_URL`, `CORS_ORIGIN` and `VITE_MAPBOX_TOKEN` set to anything, or it
will fail on purpose with a readable message. If Docker is unavailable on this machine,
record that this step is deferred to the CI job in Task 21 and move on; do not fabricate
the result.

- [ ] **Step 8: Verify the stack end to end when Docker is available**

Run: `docker compose up --build -d`
Then: `curl -s http://localhost:8080/healthz` and `curl -s http://localhost:8080/api/health`
Expected: `ok` and `{"status":"ok",...,"database":"up"}`. Open `http://localhost:8080` and confirm the globe renders and the status badge is green.
Finally: `docker compose down -v`.

If the browser shows the amber `fallback-diagnostic` banner, the build did not receive a Mapbox token; rebuild with `VITE_MAPBOX_TOKEN` set. That is expected behaviour, not a bug.

- [ ] **Step 9: Write `docker-compose.prod.yml` for Dokploy**

Dokploy builds from a Dockerfile and manages the database itself, so the production file
describes only the two application services and expects an externally provided database:

```yaml
services:
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    environment:
      NODE_ENV: production
      PORT: '8787'
      DATABASE_URL: ${DATABASE_URL:?DATABASE_URL is required in production}
      CORS_ORIGIN: ${CORS_ORIGIN:?CORS_ORIGIN is required in production}
      LOG_LEVEL: ${LOG_LEVEL:-info}
    command: >
      sh -c "node apps/api/dist/db/migrate-cli.js && node apps/api/dist/server.js"
    restart: unless-stopped

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
      args:
        VITE_MAPBOX_TOKEN: ${VITE_MAPBOX_TOKEN:?VITE_MAPBOX_TOKEN is required in production}
        VITE_MAPBOX_STYLE: ${VITE_MAPBOX_STYLE:-mapbox://styles/mapbox/dark-v11}
    ports:
      - '${WEB_PORT:-8080}:80'
    depends_on:
      api:
        condition: service_healthy
    restart: unless-stopped
```

Every variable that is a production requirement uses `${VAR:?message}` rather than a default, so a missing value fails at parse time with a readable message instead of producing a container that boots and serves 500s. This file is **prepared, not deployed**: nothing in this delivery touches Dokploy.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore(docker): add postgis compose stack and production images"
```

---

### Task 20: README, operations notes and architecture decision records

**Files:**
- Create: `README.md`, `docs/OPERATIONS.md`, `docs/decisions/0001-modular-vite-without-a-framework.md`, `docs/decisions/0002-server-side-filtering-as-single-source-of-truth.md`, `docs/decisions/0003-read-only-api-in-v1.md`, `docs/decisions/0004-data-only-fallback-map.md`

**Interfaces:**
- Consumes: every command, script and environment variable introduced in Tasks 1 to 19.
- Produces: the three documents a stranger needs to run, understand and deploy the project, plus the four decisions that would otherwise be re-litigated in every review. This is the documentation that keeps the repository self-explanatory after the plan is deleted.

Documentation is written in English to match the code, the spec and the SQL identifiers. The conversational handover to the user stays in Spanish.

- [ ] **Step 1: Write `README.md`**

````markdown
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
````

- [ ] **Step 2: Write `docs/OPERATIONS.md`**

```markdown
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
```

- [ ] **Step 3: Write the four decision records**

Each file follows the same shape: context, decision, consequences, alternatives rejected.

`docs/decisions/0001-modular-vite-without-a-framework.md`:
```markdown
# 1. Modular Vite frontend without a framework

Date: 2026-09-25

## Context

The V1 surface is a map, a rail with filters, a drawer and a timeline strip. The state
that matters is small, fully known, and updated by user gestures. The hardest part of
this project is data honesty and geographic correctness, not view reconciliation.

## Decision

Vite plus TypeScript modules, one observable store, and DOM primitives in `ui/dom.ts`.
No React, no Vue, no signals library.

## Consequences

- No framework runtime, no virtual DOM diffing, and no hydration step. The bundle is
  small and the first paint is fast.
- Rendering is explicit: every module owns a root node and re-renders it from a
  selector. This is more code than a component tree, and it is also easier to test.
- If a future feature needs real component composition (a pluggable layout, say), this
  decision is the one to revisit. The store and the selector layer survive that change;
  the render modules do not.

## Alternatives rejected

- React: adopted three times in earlier iterations of this product. It was never the
  bottleneck, and it did obscure which layer owned which state.
- Plain DOM without any store: rejected because the map, the rail, the strip and the
  drawer all read the same derived values, and ad-hoc event wiring made the ordering
  untestable.
```

`docs/decisions/0002-server-side-filtering-as-single-source-of-truth.md`:
```markdown
# 2. Server-side filtering as the single source of truth

Date: 2026-09-25

## Context

The map shows clusters, the rail shows a counter, the timeline shows per-year counts and
the fallback list shows every matching project. In an earlier design the client refiltered
the full dataset and the four views disagreed whenever the rules drifted.

## Decision

Every filter, search and sort is validated server-side and executed in one SQL query. The
client stores the response, never a parallel filtered copy.

## Consequences

- One place defines what "matching" means: `apps/api/src/services/filters.ts` for the
  in-memory double and the equivalent SQL in `apps/api/src/repositories/pg/`.
- Counters, markers and the fallback list cannot disagree, by construction.
- Every keystroke that changes a filter costs a round trip. `createDataController`
  debounces and aborts in-flight requests to keep that affordable.
- The client contract must be validated at runtime on both ends, which is what
  `packages/contracts` exists for.

## Alternatives rejected

- Client-side filtering over a full dump: rejected for the multi-view disagreement and
  for shipping the entire dataset before the user asked for anything.
- Hybrid rules split across both ends: the worst option. Every filter would have two
  implementations and one of them would be wrong.
```

`docs/decisions/0003-read-only-api-in-v1.md`:
```markdown
# 3. Read-only API in V1

Date: 2026-09-25

## Context

The baseline repository shipped an anonymous `POST /api/projects` with a wildcard CORS
policy. That is an unauthenticated write path on a dataset whose entire value is that
its contents are audited. It is also the single highest-severity finding in the audit.

## Decision

V1 exposes only `GET /api/health`, `/api/locations`, `/api/projects`, `/api/projects/:id`,
`/api/events`, `/api/relations` and `/api/stats`. There is no write route, and a test
asserts that `POST`, `PUT`, `PATCH` and `DELETE` do not exist.

## Consequences

- No authentication is needed in V1, so there is no auth code to get subtly wrong.
- Content changes ship through migrations and audited seeds, which is the same path the
  audit already uses.
- When ingestion is added it arrives with auth, rate limiting and an audit log, as one
  reviewed change, not as an incremental patch to an anonymous endpoint.

## Alternatives rejected

- Keeping the write route behind a feature flag: a flag is not an access control, and an
  unflagged anonymous write path is exactly the finding being removed.
- Deferring the decision: the endpoint is either removed or it is not.
```

`docs/decisions/0004-data-only-fallback-map.md`:
```markdown
# 4. A data-only fallback map instead of a degraded globe

Date: 2026-09-25

## Context

A Mapbox token is a build-time value, WebGL is not available everywhere, and a map that
shows a grey rectangle with an error message is not a map. Refusing to render is not an
option: the dataset is the product.

## Decision

When `diagnoseMapEnvironment` reports no token or no WebGL, the app renders a
data-only equirectangular projection: markers positioned by real coordinates, clickable,
with the cluster structure, a graticule and a visible diagnostic banner naming the reason.
No tiles are requested in that mode.

## Consequences

- The product is fully usable with zero third-party configuration, which is how it will
  first be reviewed.
- The fallback is a second rendering path, so it needs its own tests. It has them: the
  adapter unit tests and the E2E fallback spec, including an assertion that no Mapbox
  request is made.
- The banner never hides. A user always knows whether they are looking at the globe or
  the fallback, because the two look different and one of them says so.

## Alternatives rejected

- Blocking the app with a "configure your token" screen: throws away a working dataset
  over a missing asset.
- A blank static map background: silently wrong, and a user cannot tell the difference
  between "no data here" and "no map here".
```

- [ ] **Step 4: Verify every command in the README actually exists**

Run: `npm run 2>&1 | Select-String -Pattern 'dev|build|check|test:e2e|db:migrate|db:seed|db:setup|db:reset'`
Expected: the output lists every script name in the README table. `npm run` with no argument
prints the list of available scripts, so this is a listing command, not an error. Fix any
missing script rather than deleting the row.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs: add readme operations guide and four architecture decisions"
```

---

### Task 21: Continuous integration

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `npm run check`, `npm run test:e2e`, `npm run db:migrate`, `npm run db:seed`, `apps/web/playwright.config.ts`, `docker-compose.yml`, the `TEST_DATABASE_URL` gate from Task 6.
- Produces: four jobs — `check` (gates that need no database), `integration` (the deferred PostGIS verification), `e2e` (the Playwright suite), and `images` (the container build). `check` and `e2e` are required checks; `integration` and `images` are required too, because a change that only breaks against a real database or only breaks in a container is exactly the change that must not merge unnoticed.

- [ ] **Step 1: Write `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

env:
  NODE_VERSION: '22'

jobs:
  check:
    name: Lint, typecheck, unit tests, build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test
      - run: npm run build

  integration:
    name: PostgreSQL + PostGIS integration
    runs-on: ubuntu-latest
    services:
      db:
        image: postgis/postgis:16-3.4
        env:
          POSTGRES_USER: atlas
          POSTGRES_PASSWORD: atlas
          POSTGRES_DB: aiworldatlas_test
        ports: ['5432:5432']
        options: >-
          --health-cmd "pg_isready -U atlas -d aiworldatlas_test"
          --health-interval 10s --health-timeout 5s --health-retries 10
    env:
      DATABASE_URL: postgres://atlas:atlas@127.0.0.1:5432/aiworldatlas_test
      TEST_DATABASE_URL: postgres://atlas:atlas@127.0.0.1:5432/aiworldatlas_test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - run: npm run db:migrate
      - run: npm run db:seed
      - run: npm run test
        env:
          CI: 'true'
      - name: Fail if the integration suite was skipped
        run: |
          if [ -z "${TEST_DATABASE_URL}" ]; then
            echo "TEST_DATABASE_URL is not set, so the integration suite did not run" >&2
            exit 1
          fi

  e2e:
    name: Playwright end to end
    runs-on: ubuntu-latest
    env:
      CI: 'true'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
        working-directory: apps/web
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: apps/web/playwright-report
          retention-days: 7

  images:
    name: Container images
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - name: Validate the compose file
        run: docker compose config --quiet
      - name: Build the API image
        uses: docker/build-push-action@v6
        with:
          context: .
          file: apps/api/Dockerfile
          push: false
          cache-from: type=gha
          cache-to: type=gha,mode=max
      - name: Build the web image
        uses: docker/build-push-action@v6
        with:
          context: .
          file: apps/web/Dockerfile
          push: false
          build-args: |
            VITE_MAPBOX_TOKEN=
          cache-from: type=gha
          cache-to: type=gha,mode=max
      - name: Boot the stack and probe it
        run: |
          docker compose up --build -d
          for i in $(seq 1 30); do
            if curl -fsS http://localhost:8080/healthz >/dev/null; then break; fi
            sleep 2
          done
          curl -fsS http://localhost:8080/healthz
          curl -fsS http://localhost:8080/api/health
          curl -fsS http://localhost:8080/api/stats | tee /dev/stderr | grep -q '"projects":5'
          docker compose down -v
```

- [ ] **Step 2: Validate the workflow syntax**

Run: `npx --yes action-validator .github/workflows/ci.yml` (or open the file in a YAML linter)
Expected: no errors. If the validator is unavailable, at minimum confirm with PowerShell that the file parses:

```powershell
[System.Text.Json.JsonSerializer]::Serialize([ordered]@{}) | Out-Null; (Get-Content -Raw .github/workflows/ci.yml) | ConvertFrom-Yaml | Out-Null; "yaml ok"
```

`ConvertFrom-Yaml` requires PowerShell 7.4+. If it is missing, install `powershell-yaml` rather than skipping the check.

- [ ] **Step 3: Confirm the local suite still matches what CI will run**

Run: `npm run check`
Expected: all four gates pass locally, with the single `skipped: db integration` line that CI will convert into a real run.

- [ ] **Step 4: Push and watch the four jobs**

Run: `git push -u origin main`
Then read the run output for each job. This is the first moment the PostGIS integration suite and the container build are actually executed anywhere. Do not summarise the delivery as complete until all four jobs are green, and record the run URL.

Expected: `check` and `e2e` pass immediately. `integration` may surface real defects in the SQL or the repositories that no amount of unit testing could have found; fix them in this task, not by loosening a test. `images` may surface a missing file in one of the Dockerfiles, which is a `COPY` fix.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "ci: run gates postgres integration e2e and image builds on every push"
```

---

### Task 22: Final verification, spec PDF refresh and delivery

**Files:**
- Modify: `docs/superpowers/specs/2026-09-25-ai-world-atlas-core-design.md` (already corrected; needs committing) and `docs/superpowers/specs/2026-09-25-ai-world-atlas-core-design.pdf` (regenerate from the corrected markdown)

**Interfaces:**
- Consumes: everything built in Tasks 1 to 21, and the two post-approval corrections to the spec that were never committed.
- Produces: the evidence that the P0 findings are actually gone, a spec PDF that matches its markdown, and a pushed repository whose CI run is green.

- [ ] **Step 1: Prove the three P0 findings are gone, with commands rather than claims**

Run each of these and read the output:

```bash
# 1. The frontend must contain no HTML-string injection sinks.
Select-String -Path apps/web/src -Include *.ts -Pattern 'innerHTML|outerHTML|insertAdjacentHTML|document\.write'
```
Expected: no matches. A match is a release blocker, not a nit.

```bash
# 2. The API must not expose a write route.
Select-String -Path apps/api/src -Include *.ts -Pattern "router\.(post|put|patch|delete)\("
```
Expected: no matches.

```bash
# 3. CORS must come from an allowlist, never a hardcoded star.
Select-String -Path apps/api/src -Include *.ts -Pattern "origin:\s*'\*'|'\*',\s*methods"
```
Expected: no matches.

```bash
# 4. No legacy JavaScript frontend survives.
Get-ChildItem apps/web/src -Recurse -Filter *.js
```
Expected: no files. Vite would happily build both, and shipping two frontends is worse than shipping none.

If any check fails, fix the source. Do not edit the check.

- [ ] **Step 2: Run the full gate set and the E2E suite**

Run: `npm run check`
Expected: `lint`, `typecheck`, `test` and `build` all pass, with the single `skipped: db integration` line and exit code 0.

Run: `npm run test:e2e`
Expected: the whole Playwright suite passes.

- [ ] **Step 3: Regenerate the specification PDF from the corrected markdown**

The approved spec received two corrections after Leonardo signed it off — the search predicate became `plainto_tsquery('spanish', q)` and a `yRanking` typo became `ranking`. The markdown carries both fixes; the committed PDF does not. Regenerate it with the pipeline that is known to work on this machine (pandoc into a standalone HTML file, then headless Chrome to print it). MiKTeX is installed but less reliable:

```powershell
$specDir = (Resolve-Path "docs/superpowers/specs").Path
$stem    = "2026-09-25-ai-world-atlas-core-design"
$html    = Join-Path $env:TEMP "$stem.html"
pandoc "$specDir/$stem.md" --standalone --embed-resources --metadata title="AI World Atlas - Core Navigable Design" -o $html
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless --disable-gpu --no-pdf-header-footer `
  --print-to-pdf="$specDir/$stem.pdf" ("file:///" + ($html -replace '\\','/'))
Get-Item "$specDir/$stem.pdf" | Select-Object Length, LastWriteTime
```

Expected: Chrome prints `<n> bytes written to file ...` and the timestamp is the current one. Two gotchas already paid for: `--print-to-pdf` needs an **absolute** path (a relative path fails with `0x3`), and the file URL needs forward slashes. Chrome is at `C:\Program Files\Google\Chrome\Application\chrome.exe` on this machine; locate it elsewhere with `Get-Command chrome`.

Do **not** assert a specific byte size. The reference PDF is 19 pages, but the size varies with the Chrome version and the fonts it embeds. Assert the page count and the content instead, which is what Step 4 does.

- [ ] **Step 4: Verify the PDF actually reflects the corrections**

Do not judge this by file size. Check the content. Extract the text and search it:

```powershell
$pdf = "docs/superpowers/specs/2026-09-25-ai-world-atlas-core-design.pdf"
$bytes = [System.IO.File]::ReadAllBytes((Resolve-Path $pdf).Path)
$text  = [System.Text.Encoding]::Latin1.GetString($bytes)
"pages: " + ([regex]::Matches($text, '/Type\s*/Page[^s]')).Count
"has plainto: " + $text.Contains('plainto_tsquery')
"has websearch_to_tsquery: " + $text.Contains('websearch_to_tsquery')
```

Expected: about 19 pages, `has plainto: True`, `has websearch_to_tsquery: False`. Note that the Latin1 decode is a smoke test, not a real text extraction: a compressed content stream can hide the text from it. If `has plainto` comes back `False` while the PDF timestamp is current, open the file and search page 8, where the SQL predicates live. The whole point of regenerating is that the review artefact matches the source of truth.

- [ ] **Step 5: Commit the spec correction and the refreshed PDF**

```bash
git add -A
git commit -m "docs: correct the search predicate in the spec and refresh its pdf"
```

- [ ] **Step 6: Push and read the CI result**

Run: `git push -u origin main`
Expected: the four jobs from Task 21 go green. Record the run URL. If `integration` or `images` is red, the delivery is not finished — fix it and push again.

- [ ] **Step 7: Report to Leonardo in Spanish**

Report, in this order and without embellishment:

1. What is now in the repository, in one paragraph.
2. The exact test numbers: unit tests per project, E2E tests, and the CI run URL.
3. The three P0 findings, each with the command from Step 1 that proves it is closed.
4. What could not be verified on this machine and where it was verified instead: Docker and PostGIS were verified in CI, not locally.
5. What V1 deliberately does not contain, so nothing looks accidentally missing: news ingestion, admin and auth, the visual graph, My Atlas, AI Pulse, AI Stack, AI Invisible, Future Radar, Story Mode and the comparator.
6. The two spec corrections, and the fact that the PDF now matches the markdown.

Do not claim the deployment exists. Nothing was deployed to Dokploy in this delivery.

- [ ] **Step 8: Final gate re-run, so the last word is evidence**

Run: `npm run check && npm run test:e2e && git status --short && git log --oneline -12`
Expected: green gates, a clean working tree, and a commit list that tells the story of the delivery in order. If `git status` is not empty, something was left uncommitted: fix that before reporting.

---

## Execution notes

**22 tasks, in six phases.** Tasks 1 to 8 are the backend (foundations, data, API surface),
9 to 17 the frontend (styles and primitives, state, map, UI, wiring), 18 to 21 verification
and delivery (E2E, containers, documentation, CI), and 22 the final proof.

**Run it one of two ways.** `subagent-driven-development` dispatches a fresh subagent per
task and reviews between tasks; `executing-planning` works through the plan in a single
session with review checkpoints. Either is fine. What is not fine is implementing several
tasks concurrently in one workspace, because tasks 7, 16 and 17 all amend files that the
previous task created.

**The order is not negotiable in these three places:**

- `@atlas/contracts` must be built before `@atlas/api` and `@atlas/web` resolve it.
  A Vitest project that is not registered silently runs zero tests.
- Task 8's `413` branch exists because Task 5's error handler created it. If the security
  test fails, the fix belongs in the handler, not in the test.
- Task 22 must run last. Every "expected: PASS" in this plan is only meaningful once the
  thing it depends on exists.

**What cannot be verified on the authoring machine** is Docker and PostGIS. Tasks 6, 19 and
21 mark those steps explicitly and Task 22 states plainly where they were actually verified.
Do not mark such a step complete locally; mark it verified in CI or leave it open.

**Every task ends with a commit.** The commit messages form the history of the delivery:
baseline, then contracts, then schema, then seed, then API, then frontend, then tests, then
delivery. A reviewer should be able to read `git log` and reconstruct what happened.

**`tsc` does not prune stale build output.** If you change an `include` or add an `exclude` in
any tsconfig, delete the affected `dist` and rebuild before you conclude anything about the
build result. A removed file stays in `dist` forever otherwise, and a green build next to a
stale artefact looks like a passing verification.

**A negative assertion over a hand-built fixture proves nothing until the fixture is pinned.**
Write the positive twin in the same commit, or mutate the line under test and confirm the test
goes red. Task 2 shipped a `validSource` whose `sourceType` was not in `SOURCE_TYPES`, so the
fixture failed on the enum before the timestamp was ever evaluated and the assertion passed
against the exact defect it was written to catch.

**The recurring failure of this project is a check that cannot fail but reports as passing.**
Three separate instances so far, all in verification rather than in product code: the vacuous
fixture above; a mutation experiment that matched a CRLF sequence against an LF file so the
mutation never applied and the run looked clean; and a mutation harness whose `execFileSync`
never spawned `npx` at all on Windows, whose unparseable baseline would have read as "every
mutation survived" — a damning result that was actually a harness that never ran. The common
shape is a check whose failure mode is silence. Any new verification step in this plan should
be asked one question before it is trusted: **what does this report when it does not run?**
A step that reports success, or a suspiciously total result, when it did not execute is worse
than no step, because it converts an unknown into a false negative.
