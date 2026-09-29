import { projectTypeSchema } from '@atlas/contracts';
import type { EvidenceLevel, ProjectStatus, ProjectType } from '@atlas/contracts';
import { describe, expect, it } from 'vitest';
import { HttpError } from '../errors/HttpError.ts';
import type { EventsQuery, LocationsQuery, ProjectsQuery } from '../repositories/types.ts';
import {
  eventsQuerySchema,
  flattenQuery,
  locationsQuerySchema,
  parseListParam,
  parseOr,
  projectsQuerySchema,
  relationsQuerySchema,
} from './query.ts';

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

  // The test above is named "defaults to ..." but supplies every value it claims
  // to be the default of, so deleting a `.default()` would leave it green. This one
  // passes an empty query, so it is the only assertion that actually exercises them.
  it('applies every default when the caller supplies nothing', () => {
    expect(projectsQuerySchema.parse({})).toEqual({ page: 1, pageSize: 50, sort: 'publishedAt' });
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

  // Same reason as the projects default: a schema that ignored the level entirely
  // would pass the test above for the wrong reason.
  it('applies pagination defaults with no filters at all', () => {
    expect(locationsQuerySchema.parse({})).toEqual({ page: 1, pageSize: 50 });
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
