import { describe, expect, it } from 'vitest';
import {
  projectSummarySchema,
  srcUrlSchema,
  statsResponseSchema,
  projectTypeSchema,
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
