import type { StatsResponse } from '@atlas/contracts';
import type { PoolLike } from '../../db/types.ts';
import type { StatsRepository } from '../types.ts';

function toRecord(rows: unknown[]): Record<string, number> {
  const output: Record<string, number> = {};
  for (const row of rows) {
    const entry = row as { key: string; count: number };
    output[entry.key] = Number(entry.count);
  }
  return output;
}

export function createStatsRepository(pool: PoolLike): StatsRepository {
  return {
    async overview(): Promise<StatsResponse> {
      const [totals, byEvidence, byType, byStatus] = await Promise.all([
        pool.query(
          `select
             (select count(*)::int from projects) as projects,
             (select count(*)::int from locations) as locations,
             (select count(*)::int from sources) as sources`,
        ),
        pool.query(`select evidence as key, count(*)::int as count from projects group by evidence order by key`),
        pool.query(`select type as key, count(*)::int as count from projects group by type order by key`),
        pool.query(`select status as key, count(*)::int as count from projects group by status order by key`),
      ]);
      const row = totals.rows[0] as { projects: number; locations: number; sources: number };
      return {
        totals: {
          projects: Number(row.projects),
          locations: Number(row.locations),
          sources: Number(row.sources),
        },
        byEvidence: toRecord(byEvidence.rows),
        byType: toRecord(byType.rows),
        byStatus: toRecord(byStatus.rows),
      };
    },
  };
}
