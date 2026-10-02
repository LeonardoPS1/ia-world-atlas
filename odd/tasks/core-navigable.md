# Feature: core-navigable (V1 "Núcleo Navegable")

## Objective

Materialize the AI World Atlas V1 navigable core: a read-only typed API over
PostgreSQL/PostGIS plus a Vite + TypeScript (no framework) globe frontend, made
deployable to Dokploy.

## Normative artifact

The plan is the normative artifact. This file is the **progress ledger** for it;
it does not restate the plan.

- Plan: `docs/superpowers/plans/2026-09-25-ai-world-atlas-core-navigation.md` (12505 lines, 22 tasks, 6 phases)
- Spec: `docs/superpowers/specs/2026-09-25-ai-world-atlas-core-design.md`

Every plan checkbox in the plan file is still unticked — the plan was never used
as the tracker. This ledger is the source of truth for status.

## Problem / why

The repository came from a public ChatGPT conversation whose code is not
recoverable (outputs redacted). The prior state had: a legacy `main.js` frontend
that never built, an anonymous `POST /api/projects`, `db:migrate`/`db:seed` as
silent no-ops, no Dockerfile and no CI. The design was reconstructed from a local
audit plus primary-source web verification.

## Authorized scope

Implementation is explicitly authorized by Leonardo ("completa los task
pendientes"). Work happens on branch `core-navigable`.

Out of scope (V1 exclusions): news ingestion, admin/auth, graph, My Atlas,
AI Pulse, AI Stack, AI Invisible, Future Radar, Story Mode, comparator.

## Constraints

- Node 22 LTS is the declared engine (`>=22 <23`). Local Node is v26.8.2 →
  `EBADENGINE` warning. **Leave it alone**: no `.npmrc`, no `--force`, no edit to
  `engines`.
- Read-only API v1. No anonymous writes. Unknown verb → 404.
- Closed vocabularies (16 types, 12 states, 6 evidence, 6 location levels,
  7 source types, 3 confidence, 12 relation types, 8 impact categories) live in
  `packages/contracts` and are transcribed into SQL `CHECK` lists. A divergence
  between the two transcriptions is a runtime `INSERT` failure, not a test
  failure — pin them to each other.
- Data honesty: `VERIFIED` only with real audit; coordinates `approximate`
  unless really geocoded; metadata must state what was NOT done.
- Code, comments, docs and commit messages in **English**. Reports to Leonardo
  in Spanish.

## TDD

- Mode: **strict TDD**, source = the plan itself (every task opens with "write the
  failing test" / "run it and confirm failure").
- Runner: `npm test` (vitest 3, workspace projects: contracts / api / web).
- Order per task: RED (observed) → GREEN → REFACTOR. Never invent RED evidence.

## Gates

- `npm run lint` — eslint
- `npm run typecheck` — builds contracts, then tsc for contracts/api/web
- `npm test` — vitest
- `npm run build` — vite build for web
- `npm run check` — all four

### Known environmental failures (pre-existing, NOT caused by the current task)

| Failure | Cause | Fixed by |
| --- | --- | --- |
| `npm run lint`: 1 error `apps/web/src/main.js 14:2394 Parsing error: ',' expected` | legacy frontend entry, minified one-liner | Task 9 (deletes legacy frontend) |
| `npm run build` fails | `apps/web/index.html` requests `/src/main.ts`; only legacy `main.js` exists | Task 17 (creates `src/main.ts`) |
| `test/pg.integration.test.ts` 19 skipped | `TEST_DATABASE_URL` not set locally; no Docker installed | Expected locally. Real PostGIS runs on the VPS |
| `npm run format:check` red on 12+ files | not part of `npm run check` | informational only |

Until Task 9 lands, `npm run lint` and `npm run build` are red at baseline.
A task is green when it does not ADD failures beyond this table.

## Delivery

- Strategy: `ask-on-risk` (default).
- Forecast: Tasks 8–22 far exceed 400 authored changed lines (the whole frontend,
  E2E, Docker, CI and docs remain). PR slicing must be decided at the first PR
  boundary — **deferred**, not yet asked.
- Chain strategy: not yet chosen.
- Commits: one work-unit commit per task on `core-navigable`, Conventional
  Commits, no AI attribution / no `Co-Authored-By`.
- Push / PR / merge: separate human decisions. Remote is `origin`
  (github.com/LeonardoPS1/ia-world-atlas). Branch already pushed at `0149f65`.

## Review

Receipt-driven development is **on** (decided by global; clone-local unset).
After each work-unit commit, assess with:

```
gentle-ai review assess --cwd <repo> --agent opencode --base-ref <last reviewed boundary> --committed-only --json
```

Candidates are work-unit commits, NOT the accumulated branch: the reviewed
boundary advances to each acknowledged commit, so each assess passes the last
reviewed commit as `--base-ref`. Using the branch point made the candidate the
whole 12141-line branch, which the contract forbids and which risks the
`lens_context_budget_exceeded` stop. Record tier + outcome per task.

Parked transaction: lineage `review-e7bff2f50e4fbd80` for candidate `219c653`
is still bound in state `reviewing` with no capture admitted, no receipt and
unspent authority. It is inert until a `review.status` re-entry re-offers the
slot; nothing runs on its own.

## Task ledger

| # | Task | Phase | Status |
| --- | --- | --- | --- |
| 1 | Monorepo workspace, TS and lint tooling | 0 | done (`7823dd1` and earlier) |
| 2 | `packages/contracts` — vocabularies + Zod schemas | 0 | done |
| 3 | Final schema, migration runner, legacy SQL removal | 1 | done (`85bde78` fixed an unbuildable index) |
| 4 | Audited seed (11 locations, 5 projects, 7 sources, 7 events, 0 relations) | 1 | done (`6d4516b`, `16b751b`) |
| 5 | API core — env, errors, middleware, app factory, health, in-memory double | 1 | done (`1e24f20`, `9ebdd01`) |
| 6 | PostgreSQL repositories | 1 | done (`0149f65`) |
| 7 | Query contracts and read-only routes | 2 | done (`219c653`) |
| 8 | API security and error-contract tests | 2 | pending — next; plan lines 4921–5117 |
| 9 | Design tokens, base styles, safe DOM primitives, inline icons | 3 | pending |
| 10 | Typed API client with runtime contract validation | 3 | pending |
| 11 | Application state, semantic colour mapping, selection rules | 3 | pending |
| 12 | Derived view state and accent normalisation | 3 | pending |
| 13 | Mapbox globe adapter, marker layer, clustering | 3 | pending |
| 14 | Data-only fallback map and diagnostics banner | 3 | pending |
| 15 | Shell, header, breadcrumb, status badge, legend | 3 | pending |
| 16 | Rail, filters, scale controls, drawer, sources, timeline strip | 3 | pending |
| 17 | Data controller, bootstrap and entry point | 4 | pending |
| 18 | End-to-end suite with Playwright | 5 | pending |
| 19 | Container images and the PostGIS compose stack | 5 | pending |
| 20 | README, operations notes and ADRs | 5 | pending |
| 21 | Continuous integration | 5 | pending |
| 22 | Final verification, spec PDF refresh and delivery | 5 | pending |

## Progress log

### 2026-09-29 — session recovered

State found on recovery: branch `core-navigable` at `0149f65`, working tree dirty
with uncommitted Task 7 work (`apps/api/src/schemas/query.ts` + test,
`apps/api/src/routes/*.ts` (6 files), `apps/api/test/routes.test.ts`,
`app.ts` mounting `createApiRouter`).

Verified gates at recovery:

- `npm test` → **124 passed | 19 skipped** (13 files passed, 1 skipped). Includes
  `test/routes.test.ts` (19) and `src/schemas/query.test.ts` (16). Task 7 steps
  1–8 are effectively satisfied.
- `npm run typecheck` → **RED**, 2 errors, both Task 7 work:
  - `src/routes/locations.ts(9,41)` TS2345 — object with `page?: number` passed
    where `LocationsQuery` requires `page: number`.
  - `src/routes/projects.ts(18,40)` TS2345 — `type`/`status`/`evidence` arrive as
    `unknown`, not assignable to the closed-vocabulary arrays `ProjectsQuery`
    expects.
- `npm run lint` → 1 error, the known baseline `apps/web/src/main.js` parse error.

Next step: fix the 2 typecheck errors against the plan's Task 7 contract, re-run
gates, commit as the Task 7 work unit.

### 2026-09-30 — Task 7 closed as `219c653`

`feat(api): add read-only v1 routes with validated query contracts`, 11 files,
+608/−5, not pushed. No AI attribution.

**Root cause of both TS2345 errors was the plan, not the route code.** The plan
declared `parseOr<T>(schema: z.ZodType<T>, raw, param): T`. In Zod 3
`ZodType<Output, Def, Input = Output>` declares BOTH `_input` and `_output`, so
`T` resolves to the **input** type. Every schema in `query.ts` uses
`.default()` / `.coerce()` / `z.preprocess()`, whose input is the raw query
shape, so `parseOr` was statically typed as returning raw values while the
runtime was always correct. Fix:

```ts
export function parseOr<Output>(
  schema: z.ZodType<Output, z.ZodTypeDef, unknown>,
  raw: unknown,
  param: string,
): Output
```

No `as`, `any`, `@ts-expect-error`, eslint-disable or non-null assertion;
`ProjectsQuery` / `LocationsQuery` were not loosened. Rejected alternative
`z.output<T>`: it compiles but `safeParse` on a bare type parameter resolves
through `ZodType<any, any, any>`, so the function body stops being checked.

**Four plan corrections in the same commit** (standing repo rule): Step 3 code
block (line ~4581), the Interfaces list (line ~4399) which carried the same
defect, three missing `parseOr` guard tests added to the Step 1 block, and two
wrong expected counts (11→19, 17→19).

**Gates:** `npm run typecheck` exit 0. `npm test` **127 passed | 19 skipped**
(14 files) — baseline was 124, so +3 from the new guards, no regressions; the
19 skips are `pg.integration.test.ts` without `TEST_DATABASE_URL`. `npm run
lint` still exactly 1 error, the pre-existing `apps/web/src/main.js 14:2394`.
`npm run build` still fails on `apps/web/index.html` requesting `/src/main.ts`
(Task 17). Nothing was added to any gate.

**Mutation evidence:** reverting the signature reproduces the original 2 errors
plus 5 red assertions in `query.test.ts` (lines 117, 118, 134, 135, 136);
making `parseOr` return the raw record fails 8 tests. Both reverted.

**Carried risks:** `parseListParam<T>(item: z.ZodType<T>)` has the identical
latent trap — harmless today because all three callers pass plain `ZodEnum`s
whose input and output coincide; revisit in Task 8 if vocabulary handling
changes. `prettier` still flags the Task 7 files on the plan's own lines
(format:check is not part of `npm run check` and is red repo-wide). `app.ts` is
CRLF in the working tree while `.gitattributes` forces `eol=lf`. Engram reports
a split project identity (`ia-world-atlas` vs `ai-world-atlas`) — unresolved.
`runMigrations` still takes no advisory lock (Task 19).

**Review outcome — consent granted, capture blocked.** `gentle-ai review
assess --base-ref 0149f65 --committed-only` → `risk: medium`,
`review_due: slice_budget_reached` (613 lines). Consent was granted. START
froze lineage `review-e7bff2f50e4fbd80` with one lens (`review-reliability`,
not 4R). The lens subagent could not be dispatched, twice, with
`OpenCode's free tier can only be used from within OpenCode`. A probe without a
binding was rejected with `opencode_review_transport_binding_invalid`, which
proves the live Go transport hook IS active and validating — so this is a
client-runtime dispatch failure, not a Gentle AI defect. No report filed.
Diagnosis still unproven: all 23 agents in `opencode.json` lack `model`
(including `general`, which dispatches fine), and the five review agents are
marked `__managed_by: gentle-ai/sdd`, so a hand edit may be reverted by
`gentle-ai sync`. `gentle-ai sync --profile` covers SDD phases, not review
agents. `opencode-go/*` is unusable (requires an active Go subscription);
`opencode/big-pickle` does dispatch from a separate `opencode run` process.

Next step: Task 8, "API security and error-contract tests", plan file lines
4921–5117 (Task 9 begins at 5118).

### 2026-10-02 — Session resumed, Task 8 dispatched

Recovered state: branch `core-navigable` @ `219c653`, clean except untracked
`.atl/` and `odd/`. Tasks 1–7 closed, no regressions to the baseline gates.

**Runtime findings (carry forward, not task-specific):**
- `explore` subagent_type **cannot be dispatched** — fails with
  `OpenCode's free tier can only be used from within OpenCode`.
  `subagent_type: "general"` dispatches fine. Always use `general`. This
  generalizes the parked review-lens failure: the blocked agent is `explore`,
  not subagents in general.
- No bash on this host (`bash.exe` is the WSL stub, no distro installed).
  The SDD scripts were ported to
  `.superpowers/sdd/sdd.ps1` — `Get-SddWorkspace`, `Get-TaskBrief`,
  `Get-ReviewPackage`, logic-equivalent, dot-source to call.
- Progress is tracked in **this** ledger only, deliberately, to avoid
  dual-ledger drift against `.superpowers/sdd/progress.md`.

**Two plan defects found pre-flight** (both must be corrected in the plan
inside the Task 8 commit, per the standing rule):
1. The brief imports `../src/app.js`, `../src/config/env.js`,
   `../src/repositories/fake.js`, `../src/testing/fixtures.js` and
   `../src/errors/HttpError.js`. The repo convention and
   `tsconfig.test.json` (`allowImportingTsExtensions: true`) require the
   **`.ts`** specifier. The `.js` form does not typecheck.
2. `cors@2.8.6` with a **function** `origin` option never takes its
   `origin === '*'` branch (`node_modules/cors/lib/index.js:40-70`); it
   reflects the request origin instead. So `appWith('*','development')`
   today returns the caller's origin and the plan's
   `expect(allowOrigin).toBe('*')` **would fail**. Fix production code
   (`securityMiddleware` picks the literal `'*'` when
   `env.allowWildcardCors`, else the allowlist callback) — never weaken
   the assertion.

Base for the Task 8 review package: `219c653`.

## Acceptance criteria

- All 22 plan tasks implemented with their tests.
- `npm run check` fully green (lint, typecheck, test, build) once Tasks 9 and 17
  remove the baseline failures.
- Migration + seed verified against a real PostGIS instance, not only mocks.
- Dockerfile(s), compose stack and CI workflow exist so Dokploy can build.
- Spec PDF refreshed from the corrected markdown.
