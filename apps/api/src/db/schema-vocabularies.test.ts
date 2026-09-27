import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
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
} from '@atlas/contracts';

const sql = readFileSync(
  fileURLToPath(new URL('../../migrations/001_core.sql', import.meta.url)),
  'utf8',
);

interface CheckList {
  column: string;
  values: string[];
}

// Every `check (<column> in ('A','B',...))` in the file. Order in the SQL carries
// no meaning, so lists are compared as sets, but nothing is discarded.
//
// The check body is captured whole (one level of nested parentheses, so the `in`
// list is inside it) and then scanned for the list. A `check ( <column> in (`
// pattern cannot reach `from_status`, which is written
// `check (from_status is null or from_status in (...))`.
function checkLists(): CheckList[] {
  return [...sql.matchAll(/check\s*\(((?:[^()]|\([^()]*\))*)\)/gi)].flatMap((check) =>
    [...check[1]!.matchAll(/(\w+)\s+in\s*\(([^)]*)\)/gi)].map((match) => ({
      column: match[1]!,
      values: [...match[2]!.matchAll(/'([^']+)'/g)].map((value) => value[1]!).sort(),
    })),
  );
}

const sorted = (values: readonly string[]): string[] => [...values].sort();

describe('001_core.sql vocabulary parity', () => {
  it('mirrors every closed vocabulary as a check constraint', () => {
    expect(checkLists()).toEqual(
      [
        { column: 'level', values: sorted(LOCATION_LEVELS) },
        { column: 'source_type', values: sorted(SOURCE_TYPES) },
        { column: 'confidence', values: sorted(CONFIDENCE_LEVELS) },
        { column: 'type', values: sorted(PROJECT_TYPES) },
        { column: 'status', values: sorted(PROJECT_STATUSES) },
        { column: 'evidence', values: sorted(EVIDENCE_LEVELS) },
        { column: 'from_status', values: sorted(PROJECT_STATUSES) },
        { column: 'to_status', values: sorted(PROJECT_STATUSES) },
        { column: 'category', values: sorted(IMPACT_CATEGORIES) },
        { column: 'type', values: sorted(RELATION_TYPES) },
      ].map((entry) => ({ ...entry, values: entry.values.sort() })),
    );
  });

  it('finds no check list the table above does not account for', () => {
    expect(checkLists()).toHaveLength(10);
  });
});
