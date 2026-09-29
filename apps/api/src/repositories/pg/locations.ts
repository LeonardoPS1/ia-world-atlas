import type { Location, Paginated } from '@atlas/contracts';
import type { PoolLike } from '../../db/types.ts';
import type { LocationRepository, LocationsQuery } from '../types.ts';
import { rowToLocation } from './mappers.ts';

const SELECT_LOCATION = `
  select l.id, l.name, l.level, l.parent_id, l.country_code,
         st_x(l.geography::geometry) as longitude,
         st_y(l.geography::geometry) as latitude,
         l.metadata,
         (select count(*)::int from locations c where c.parent_id = l.id) as child_count,
         (select count(*)::int from projects p where p.location_id = l.id) as project_count
  from locations l`;

export function createLocationRepository(pool: PoolLike): LocationRepository {
  return {
    async all(): Promise<Location[]> {
      const result = await pool.query(`${SELECT_LOCATION} order by l.name asc`);
      return result.rows.map((row) => rowToLocation(row as Record<string, unknown>));
    },

    async list(query: LocationsQuery): Promise<Paginated<Location>> {
      const conditions: string[] = [];
      const values: unknown[] = [];
      if (query.parentId) {
        values.push(query.parentId);
        conditions.push(`l.parent_id = $${values.length}`);
      }
      if (query.level) {
        values.push(query.level);
        conditions.push(`l.level = $${values.length}`);
      }
      const where = conditions.length > 0 ? ` where ${conditions.join(' and ')}` : '';

      values.push(query.pageSize);
      const limitPlaceholder = `$${values.length}`;
      values.push((query.page - 1) * query.pageSize);
      const offsetPlaceholder = `$${values.length}`;

      const countResult = await pool.query(
        `select count(*)::int as total from locations l${where}`,
        values.slice(0, values.length - 2),
      );
      const total = Number((countResult.rows[0] as { total: number }).total);

      const result = await pool.query(
        `${SELECT_LOCATION}${where} order by l.name asc limit ${limitPlaceholder} offset ${offsetPlaceholder}`,
        values,
      );
      return {
        data: result.rows.map((row) => rowToLocation(row as Record<string, unknown>)),
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: query.pageSize > 0 ? Math.ceil(total / query.pageSize) : 0,
      };
    },

    async descendantIds(id: string): Promise<string[]> {
      const result = await pool.query(
        `
        with recursive tree as (
          select id from locations where id = $1
          union all
          select child.id from locations child join tree on child.parent_id = tree.id
        )
        select id from tree`,
        [id],
      );
      return result.rows.map((row) => (row as { id: string }).id);
    },
  };
}
