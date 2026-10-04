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