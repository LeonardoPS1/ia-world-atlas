import type { Relation } from '@atlas/contracts';
import type { PoolLike } from '../../db/types.ts';
import type { RelationRepository } from '../types.ts';
import { rowToRelation } from './mappers.ts';

export function createRelationRepository(pool: PoolLike): RelationRepository {
  return {
    async listByProject(projectId: string): Promise<Relation[]> {
      const result = await pool.query(
        `select r.id, r.from_project, r.to_project, r.type, r.description, r.source_id,
                case when r.from_project = $1 then 'OUTGOING' else 'INCOMING' end as direction
           from relations r
          where r.from_project = $1 or r.to_project = $1
          order by r.type asc, r.id asc`,
        [projectId],
      );
      return result.rows.map((row) => rowToRelation(row as Record<string, unknown>));
    },
  };
}
