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