import { describe, expect, it } from 'vitest';
import { pickAccent, sortSources, sortTimelineEvents, visibleProjectsInYear } from './normalize.ts';
import { EVIDENCE_COLORS, STATUS_COLORS } from '../state/colors.ts';
import { eventsFixture, projectsFixture, sourcesFixture } from '../testing/fixtures.ts';
import type { ProjectSummary, Source } from './types.ts';

const projectFixtures = projectsFixture as unknown as ProjectSummary[];
const sourceFixtures = sourcesFixture as unknown as Source[];

function makeProject(overrides: Partial<ProjectSummary> = {}): ProjectSummary {
  return {
    id: 'test-project',
    name: 'Test Project',
    type: 'RESEARCH',
    status: 'RESEARCH',
    evidence: 'REPORTED',
    sector: 'Sector',
    summary: 'Summary',
    year: 2026,
    locationId: 'pucv-campus',
    longitude: -71.522,
    latitude: -33.0365,
    actors: ['Actor'],
    tags: ['ai'],
    publishedAt: '2026-03-05T00:00:00.000Z',
    lastVerifiedAt: '2026-09-25T00:00:00.000Z',
    sourceCount: 1,
    eventCount: 1,
    ...overrides,
  };
}

describe('pickAccent', () => {
  it('is deterministic for the same project', () => {
    const project = projectFixtures[0]!;
    expect(pickAccent(project)).toBe(pickAccent({ ...project }));
  });

  it('returns a colour from the fixed palette only', () => {
    const allowed = new Set([...Object.values(STATUS_COLORS), ...Object.values(EVIDENCE_COLORS)]);
    for (const project of projectFixtures) {
      expect(allowed.has(pickAccent(project))).toBe(true);
    }
  });

  it('prefers the status colour when the project has one', () => {
    const deploying = projectFixtures.find((project) => project.status === 'DEPLOYING')!;
    expect(pickAccent(deploying)).toBe(STATUS_COLORS.DEPLOYING);
  });
});

describe('sortSources', () => {
  it('puts the primary source first', () => {
    const sorted = sortSources(sourceFixtures.map((source, index) => ({ ...source, isPrimary: index === 2 })));
    expect(sorted[0]?.isPrimary).toBe(true);
  });

  it('does not mutate the input', () => {
    const input = [...sourceFixtures];
    sortSources(input);
    expect(input).toEqual([...sourceFixtures]);
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
  it('keeps a project when its start year is before or equal to the target year', () => {
    const project = makeProject({ publishedAt: '2020-06-01' });
    expect(visibleProjectsInYear([project], 2023)).toHaveLength(1);
  });

  it('drops a project whose start year is after the target year', () => {
    const project = makeProject({ publishedAt: '2025-01-01' });
    expect(visibleProjectsInYear([project], 2023)).toHaveLength(0);
  });

  it('keeps a project with no publishedAt (treated as -infinity)', () => {
    const project = makeProject({ publishedAt: null });
    expect(visibleProjectsInYear([project], 2030)).toHaveLength(1);
  });
});