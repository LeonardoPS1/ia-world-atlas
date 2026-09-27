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
  sourceType: 'LAW',
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
    expect(projectSummarySchema.safeParse({ ...validSummary, lastVerifiedAt: 'someday' }).success).toBe(false);
  });

  it('accepts a null publishedAt, because the column is nullable', () => {
    expect(projectSummarySchema.safeParse({ ...validSummary, publishedAt: null }).success).toBe(true);
  });

  it('validates timestamps on every schema that carries one', () => {
    expect(sourceSchema.safeParse({ ...validSource, lastVerifiedAt: 'someday' }).success).toBe(false);
    expect(statusHistoryEntrySchema.safeParse({ ...validHistory, changedAt: 'someday' }).success).toBe(false);
    expect(healthResponseSchema.safeParse({ ...validHealth, time: 'someday' }).success).toBe(false);
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
    expect(Object.keys(stats.byEvidence)).toEqual(['REPORTED', 'ANNOUNCED']);
  });
});
