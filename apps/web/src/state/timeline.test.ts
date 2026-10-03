import { describe, expect, it } from 'vitest';
import { clampYear, eventsInYear, yearStep } from './timeline.ts';
import type { TimelineState } from './timeline.ts';
import { eventsFixture } from '../testing/fixtures.ts';

const state: TimelineState = { year: 2023, playing: false, minYear: 2020, maxYear: 2026 };

describe('clampYear', () => {
  it('clamps to the closed range', () => {
    expect(clampYear(2019, 2020, 2026)).toBe(2020);
    expect(clampYear(2030, 2020, 2026)).toBe(2026);
    expect(clampYear(2023, 2020, 2026)).toBe(2023);
  });
});

describe('yearStep', () => {
  it('moves one year at a time and stops at the edges', () => {
    expect(yearStep({ ...state, year: 2020 }, 1)).toBe(2020);
    expect(yearStep({ ...state, year: 2026 }, -1)).toBe(2026);
    expect(yearStep(state, 1)).toBe(2024);
  });
});

describe('eventsInYear', () => {
  it('returns the events whose occurred_at falls in the year', () => {
    const found = eventsInYear(eventsFixture, 2026);
    expect(found.length).toBeGreaterThan(0);
    for (const event of found) {
      expect(new Date(event.occurredAt).getUTCFullYear()).toBe(2026);
    }
  });

  it('returns an empty array for a year with no events', () => {
    expect(eventsInYear(eventsFixture, 1999)).toEqual([]);
  });
});