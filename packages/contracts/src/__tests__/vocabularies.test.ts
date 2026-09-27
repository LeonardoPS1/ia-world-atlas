import { describe, expect, it } from 'vitest';
import {
  CONFIDENCE_LEVELS,
  EVIDENCE_LEVELS,
  IMPACT_CATEGORIES,
  LOCATION_LEVELS,
  PROJECT_STATUSES,
  PROJECT_TYPES,
  RELATION_TYPES,
  SOURCE_TYPES,
} from '../vocabularies.js';

describe('closed vocabularies', () => {
  it('exposes exactly the specified cardinalities', () => {
    expect(PROJECT_TYPES).toHaveLength(16);
    expect(PROJECT_STATUSES).toHaveLength(12);
    expect(EVIDENCE_LEVELS).toHaveLength(6);
    expect(LOCATION_LEVELS).toHaveLength(6);
    expect(SOURCE_TYPES).toHaveLength(7);
    expect(CONFIDENCE_LEVELS).toHaveLength(3);
    expect(RELATION_TYPES).toHaveLength(12);
    expect(IMPACT_CATEGORIES).toHaveLength(8);
  });

  it('contains no duplicates', () => {
    for (const vocabulary of [
      PROJECT_TYPES,
      PROJECT_STATUSES,
      EVIDENCE_LEVELS,
      LOCATION_LEVELS,
      SOURCE_TYPES,
      CONFIDENCE_LEVELS,
      RELATION_TYPES,
      IMPACT_CATEGORIES,
    ]) {
      expect(new Set(vocabulary).size).toBe(vocabulary.length);
    }
  });

  it('includes CITY and LOCAL_AREA as distinct location levels', () => {
    expect(LOCATION_LEVELS).toContain('CITY');
    expect(LOCATION_LEVELS).toContain('LOCAL_AREA');
  });
});
