# Map marker positioning + re-enable the silenced adapter tests

## Objective
Make the deployed globe render each location marker at its real geographic
coordinate, and remove the two test files that were silently excluded from the
web suite so the adapter is covered again.

## Problem
The deployed map at `https://atlasia.aicorebots.com/` renders the Mapbox globe
and populates the project list, but **every marker is stacked at the top-left
corner of the canvas**. A Playwright probe measured all 11 markers at
`x≈311-320, y≈47-56`, which is the canvas origin (`x=320, y=56`), with inline
style `color: …` and no positioning transform.

Root cause: `renderMarkers()` in `apps/web/src/map/globe.ts` creates and appends
marker nodes but never positions them. `map.project()` is only called inside
`handleClick` for hit-testing. CSS `.atlas-marker` pins `top: 0; left: 0`, so
every marker resolves to (0,0) of `.atlas-markers`.

The same repo already contains the correct pattern: `apps/web/src/map/fallback.ts`
sets `marker.style.left`/`marker.style.top` from `projectToEquirectangular()`.

## Why it survived a green suite
`apps/web/vitest.config.ts` line 10 explicitly excludes
`src/map/globe.test.ts` and `src/map/fallback.test.ts`. Commit `9ab4d78`
(2026-10-03) added that exclusion instead of reconciling the tests with the
shipped adapter API. So `npm run check` reported green while never covering the
one file that renders markers. Verified: `npx vitest run --project web
apps/web/src/map` executes 4 of 6 map test files.

Both excluded files target an older synchronous `adapter.mount(host)` API and
pass `center`/`zoom`/`onDiagnostics`. The shipped API takes `host` in options;
the globe factory is async and returns `Promise<MapAdapter>`, the fallback
factory is sync.

## Scope
1. Position markers in `globe.ts` via `map.project()`, setting
   `style.left`/`style.top` exactly as `fallback.ts` does.
2. Reposition on map `move` and `zoom` so markers track the camera.
3. Clip off-canvas markers with `overflow: hidden` on `.atlas-markers`.
4. Rewrite `globe.test.ts` against the shipped async API, including an assertion
   that markers receive **distinct** pixel positions and that panning
   repositions them.
5. Reconcile `fallback.test.ts` with the shipped API (`host` in options, no
   `mount`).
6. Remove both entries from the `exclude` list in `apps/web/vitest.config.ts`.
7. Correct the plan's `renderMarkers()` snippet, which reproduces the defect
   verbatim (plan lines 8645-8670), and record the async/`host` divergence.

Out of scope: camera behaviour, marker shapes, clustering, the fallback
renderer, the Drawer/Rail/Strip.

## Acceptance criteria
- A marker for a cluster at a known `lng/lat` gets `style.left`/`style.top`
  equal to that cluster's `map.project()` result.
- Two clusters at different coordinates get two different positions.
- Firing map `move`/`zoom` recomputes positions.
- `npx vitest run --project web apps/web/src/map` runs **6** files, not 4.
- `npm run check` passes with the `exclude` list removed.
- Regression tests are mutation-checked: reverting the positioning line must
  fail them.

## Route
`delegated` — one bounded writer. Writer trigger fired: 6 non-trivial files.
Trigger evidence: `globe.ts`, `globe.test.ts`, `fallback.test.ts`,
`vitest.config.ts`, `components.css`, plus the normative plan.

## Progress
- [x] T1 — Confirm production defect with a browser probe
- [x] T2 — Locate the cause and the hidden test exclusion
- [ ] T3 — Position markers and track the camera (writer)
- [ ] T4 — Rewrite the two excluded test files and remove the exclusion (writer)
- [ ] T5 — Correct the plan (writer)
- [ ] T6 — `npm run check` green with 6 map test files
- [ ] T7 — Redeploy and re-probe: 11 markers at distinct coordinates

## Verification evidence
- `npx vitest run --project web apps/web/src/map` → 4 passed files
  (cluster, diagnostics, markers, mapbox); `globe.test.ts` and
  `fallback.test.ts` absent.
- `apps/web/vitest.config.ts:10` → `exclude: [..., 'src/map/globe.test.ts',
  'src/map/fallback.test.ts']`, added by `9ab4d78`.
- Playwright probe `atlas-globe-markers.mjs` → 11 markers, all at the canvas
  origin, `transform: "color: …"` with no `left`/`top`.

## Next step
T3–T5 via one delegated writer, then T6 gates, then T7 redeploy and re-probe.