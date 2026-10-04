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