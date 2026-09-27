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
  RELATION_DIRECTIONS,
  TIMELINE_SORTS,
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
    // The three tests in this file are not redundant with the pinning test below.
    // If the pin fails, this one tells you whether a member was corrupted or the list
    // merely reordered.
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

  it('pins every member, so a same-cardinality corruption is not silent', () => {
    expect(PROJECT_TYPES).toEqual([
      'PROJECT',
      'NEWS',
      'LAUNCH',
      'COMPANY',
      'GOVERNMENT',
      'UNIVERSITY',
      'RESEARCH',
      'INFRASTRUCTURE',
      'ROBOTICS',
      'POLICY',
      'INVESTMENT',
      'EDUCATION',
      'APPLICATION',
      'IMPACT',
      'SIGNAL',
      'POSSIBILITY',
    ]);
    expect(PROJECT_STATUSES).toEqual([
      'IDEA',
      'RESEARCH',
      'ANNOUNCED',
      'FUNDED',
      'PILOT',
      'BUILDING',
      'DEPLOYING',
      'ACTIVE',
      'SCALING',
      'COMPLETED',
      'PAUSED',
      'CANCELLED',
    ]);
    expect(EVIDENCE_LEVELS).toEqual([
      'VERIFIED',
      'REPORTED',
      'ANNOUNCED',
      'ANALYSIS',
      'SIGNAL',
      'POSSIBILITY',
    ]);
    expect(LOCATION_LEVELS).toEqual(['WORLD', 'CONTINENT', 'COUNTRY', 'REGION', 'CITY', 'LOCAL_AREA']);
    expect(SOURCE_TYPES).toEqual([
      'GOVERNMENT',
      'UNIVERSITY',
      'ORGANIZATION',
      'COMPANY',
      'PAPER',
      'MEDIA',
      'OTHER',
    ]);
    expect(CONFIDENCE_LEVELS).toEqual(['HIGH', 'MEDIUM', 'LOW']);
    expect(RELATION_TYPES).toEqual([
      'PARTNERSHIP',
      'FUNDING',
      'RESEARCH',
      'INFRASTRUCTURE',
      'GOVERNMENT',
      'SUPPLIER',
      'UNIVERSITY',
      'DEPLOYMENT',
      'LOCATION',
      'POLICY',
      'TECHNOLOGY',
      'INVESTMENT',
    ]);
    expect(IMPACT_CATEGORIES).toEqual([
      'ECONOMIC',
      'SOCIAL',
      'EDUCATIONAL',
      'HEALTH',
      'ENVIRONMENTAL',
      'INFRASTRUCTURE',
      'REGULATORY',
      'OTHER',
    ]);
    expect(RELATION_DIRECTIONS).toEqual(['OUTGOING', 'INCOMING']);
    expect(TIMELINE_SORTS).toEqual(['publishedAt', 'name']);
  });
});
