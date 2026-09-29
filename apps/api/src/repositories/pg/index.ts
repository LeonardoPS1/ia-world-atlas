import type { PoolLike } from '../../db/types.ts';
import type { AtlasRepositories } from '../types.ts';
import { createEventRepository } from './events.ts';
import { createLocationRepository } from './locations.ts';
import { createProjectRepository } from './projects.ts';
import { createRelationRepository } from './relations.ts';
import { createStatsRepository } from './stats.ts';

export function createPgRepositories(pool: PoolLike): AtlasRepositories {
  return {
    locations: createLocationRepository(pool),
    projects: createProjectRepository(pool),
    events: createEventRepository(pool),
    relations: createRelationRepository(pool),
    stats: createStatsRepository(pool),
    health: {
      async ping() {
        try {
          const result = await pool.query('select 1 as ok');
          return (result.rows[0] as { ok: number }).ok === 1;
        } catch {
          return false;
        }
      },
    },
  };
}
