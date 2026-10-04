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

## Alternatives rejected

- React: adopted three times in earlier iterations of this product. It was never the
  bottleneck, and it did obscure which layer owned which state.
- Plain DOM without any store: rejected because the map, the rail, the strip and the
  drawer all read the same derived values, and ad-hoc event wiring made the ordering
  untestable.