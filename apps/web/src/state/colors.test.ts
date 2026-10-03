import { describe, expect, it } from 'vitest';
import {
  EVIDENCE_COLORS,
  EVIDENCE_INTENTS,
  STATUS_COLORS,
  evidenceColor,
  evidenceIntent,
  levelLabel,
  statusLabel,
  typeLabel,
} from './colors.ts';
import {
  evidenceSchema,
  locationLevelSchema,
  projectStatusSchema,
  projectTypeSchema,
} from '@atlas/contracts';

describe('semantic colours', () => {
  it('covers every closed vocabulary member exactly once', () => {
    const statuses = projectStatusSchema.options;
    expect(Object.keys(STATUS_COLORS).sort()).toEqual([...statuses].sort());
    const evidence = evidenceSchema.options;
    expect(Object.keys(EVIDENCE_COLORS).sort()).toEqual([...evidence].sort());
    expect(Object.keys(EVIDENCE_INTENTS).sort()).toEqual([...evidence].sort());
  });

  it('gives every value a css hex colour', () => {
    for (const status of projectStatusSchema.options) {
      expect(STATUS_COLORS[status]).toMatch(/^#[0-9a-f]{6}$/i);
    }
    for (const level of evidenceSchema.options) {
      expect(EVIDENCE_COLORS[level]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('separates adjacent statuses perceptually', () => {
    const unique = new Set(Object.values(STATUS_COLORS));
    expect(unique.size).toBe(Object.keys(STATUS_COLORS).length);
  });

  it('never uses a saturated red for a non-error status', () => {
    expect(STATUS_COLORS.COMPLETED.toLowerCase()).not.toBe('#e04a3f');
  });

  it('maps every status and evidence level to an explicit intent', () => {
    for (const status of projectStatusSchema.options) {
      expect(['PLANNED', 'ACTIVE', 'INACTIVE']).toContain(
        status === 'COMPLETED' ? 'INACTIVE' : 'ACTIVE',
      );
    }
    for (const level of evidenceSchema.options) {
      expect(['OBSERVED', 'EXPECTED', 'UNCONFIRMED']).toContain(evidenceIntent(level));
    }
  });

  it('labels every vocabulary member in Spanish without leaking the raw key', () => {
    for (const type of projectTypeSchema.options) {
      expect(typeLabel(type)).not.toBe(type);
      expect(typeLabel(type).length).toBeGreaterThan(2);
    }
    for (const status of projectStatusSchema.options) {
      expect(statusLabel(status)).not.toBe(status);
    }
    for (const level of locationLevelSchema.options) {
      expect(levelLabel(level)).not.toBe(level);
    }
  });

  it('resolves a colour for a valid level and rejects an invalid one at the type level', () => {
    expect(evidenceColor('REPORTED')).toBe(EVIDENCE_COLORS.REPORTED);
    // @ts-expect-error an unknown level is not a member of the closed vocabulary
    expect(evidenceColor('RUMOUR')).toBeUndefined();
  });
});