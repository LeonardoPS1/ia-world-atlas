import type { Event } from '@atlas/contracts';
import type { PoolLike } from '../../db/types.ts';
import type { EventRepository, EventsQuery } from '../types.ts';
import { rowToEvent } from './mappers.ts';

export function createEventRepository(pool: PoolLike): EventRepository {
  return {
    async list(query: EventsQuery): Promise<Event[]> {
      const conditions: string[] = [];
      const values: unknown[] = [];
      if (query.projectId) {
        values.push(query.projectId);
        conditions.push(`project_id = $${values.length}`);
      }
      if (query.yearFrom !== undefined) {
        values.push(String(query.yearFrom));
        conditions.push(`extract(year from occurred_at) >= $${values.length}`);
      }
      if (query.yearTo !== undefined) {
        values.push(String(query.yearTo));
        conditions.push(`extract(year from occurred_at) <= $${values.length}`);
      }
      const where = conditions.length > 0 ? ` where ${conditions.join(' and ')}` : '';
      const result = await pool.query(
        `select id, project_id, title, occurred_at, kind, description, source_id
           from events${where} order by occurred_at asc, id asc`,
        values,
      );
      return result.rows.map((row) => rowToEvent(row as Record<string, unknown>));
    },
  };
}
