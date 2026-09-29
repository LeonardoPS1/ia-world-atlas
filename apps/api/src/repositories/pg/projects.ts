import type { Paginated, ProjectDetail, ProjectSummary } from '@atlas/contracts';
import type { PoolLike } from '../../db/types.ts';
import type { ProjectRepository, ProjectsQuery } from '../types.ts';
import {
  rowToEvent,
  rowToImpactRecord,
  rowToLocation,
  rowToProjectDetail,
  rowToProjectSummary,
  rowToRelation,
  rowToSource,
  rowToStatusHistoryEntry,
} from './mappers.ts';

// The `tsv` column must build its text vector with atlas_text_array_join, the same
// IMMUTABLE wrapper projects_search_idx is defined on. Any other spelling of the
// same text produces a different expression tree, and PostgreSQL matches an index
// on expression equality, not on "produces the same tsvector" - so a plain
// array_to_string here would make every search query fall back to a sequential
// scan of a GIN index the planner can no longer see it through.
const BASE_CTE = `
  with base as (
    select
      p.id, p.name, p.type, p.status, p.evidence, p.sector, p.summary, p.impact, p.year,
      p.location_id, p.actors, p.tags, p.published_at, p.last_verified_at,
      case when p.geometry is null then 'location' else 'project' end as geometry_source,
      coalesce(p.geometry, l.geography) as point,
      l.name as location_name, l.level as location_level, l.parent_id as location_parent_id,
      l.country_code as location_country_code, st_x(l.geography::geometry) as location_longitude,
      st_y(l.geography::geometry) as location_latitude, l.metadata as location_metadata,
      (select count(*)::int from locations c where c.parent_id = l.id) as location_child_count,
      (select count(*)::int from projects lp where lp.location_id = l.id) as location_project_count,
      to_tsvector('spanish'::regconfig,
        coalesce(p.name,'') || ' ' || coalesce(p.summary,'') || ' ' || atlas_text_array_join(p.tags,' ')
      ) as tsv,
      (select count(*)::int from project_sources ps where ps.project_id = p.id) as source_count,
      (select count(*)::int from events e where e.project_id = p.id) as event_count
    from projects p
    join locations l on l.id = p.location_id
  )`;

const SELECT_COLUMNS = `
  select id, name, type, status, evidence, sector, summary, impact, year, location_id,
         st_x(point::geometry) as longitude, st_y(point::geometry) as latitude,
         actors, tags, published_at, last_verified_at, geometry_source,
         location_name, location_level, location_parent_id, location_country_code,
         location_longitude, location_latitude, location_metadata,
         location_child_count, location_project_count,
         source_count, event_count, tsv
  from base`;

export function createProjectRepository(pool: PoolLike): ProjectRepository {
  function buildFilters(query: ProjectsQuery): { where: string; values: unknown[]; textLength: number } {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let textLength = 0;

    if (query.q && query.q.trim().length > 0) {
      const q = query.q.trim();
      const hasLongToken = q.split(/\s+/).some((token) => token.replace(/[^\p{L}\p{N}]/gu, '').length >= 3);
      if (hasLongToken) {
        values.push(q);
        const placeholder = `$${values.length}`;
        conditions.push(
          `(tsv @@ plainto_tsquery('spanish', ${placeholder}) or name ilike '%' || ${placeholder} || '%' or summary ilike '%' || ${placeholder} || '%' or array_to_string(tags,' ') ilike '%' || ${placeholder} || '%')`,
        );
      } else {
        values.push(`%${q}%`);
        const placeholder = `$${values.length}`;
        conditions.push(
          `(name ilike ${placeholder} or summary ilike ${placeholder} or array_to_string(tags,' ') ilike ${placeholder})`,
        );
      }
      textLength = values.length;
    }
    if (query.type && query.type.length > 0) {
      values.push(query.type);
      conditions.push(`type = any($${values.length}::text[])`);
    }
    if (query.status && query.status.length > 0) {
      values.push(query.status);
      conditions.push(`status = any($${values.length}::text[])`);
    }
    if (query.evidence && query.evidence.length > 0) {
      values.push(query.evidence);
      conditions.push(`evidence = any($${values.length}::text[])`);
    }
    if (query.sector) {
      values.push(query.sector);
      conditions.push(`sector = $${values.length}`);
    }
    if (query.locationIds && query.locationIds.length > 0) {
      values.push(query.locationIds);
      conditions.push(`location_id = any($${values.length}::text[])`);
    }
    if (query.yearFrom !== undefined) {
      values.push(query.yearFrom);
      conditions.push(`year >= $${values.length}`);
    }
    if (query.yearTo !== undefined) {
      values.push(query.yearTo);
      conditions.push(`year <= $${values.length}`);
    }

    return {
      where: conditions.length > 0 ? ` where ${conditions.join(' and ')}` : '',
      values,
      textLength,
    };
  }

  return {
    async list(query: ProjectsQuery): Promise<Paginated<ProjectSummary>> {
      const { where, values, textLength } = buildFilters(query);
      // The count query shares the same `where` clause, so it needs every value
      // the where references, in the same order. Slicing to `textLength` only
      // happened to work when a query had exactly one condition: with no `q`
      // the slice was empty, and with `q` plus a filter it kept only the `q`
      // value, so anything with two conditions raised "there is no parameter
      // $1". `textLength` marks whether the ORDER BY may reference $1, not how
      // many values the count needs.
      const countResult = await pool.query(
        `${BASE_CTE} select count(*)::int as total from base${where}`,
        values,
      );
      const total = Number((countResult.rows[0] as { total: number }).total);

      const orderBy =
        query.sort === 'name'
          ? textLength > 0
            ? " order by ts_rank(tsv, plainto_tsquery('spanish', $1)) desc, name asc"
            : ' order by name asc'
          : textLength > 0
            ? " order by ts_rank(tsv, plainto_tsquery('spanish', $1)) desc, published_at desc nulls last, name asc"
            : ' order by published_at desc nulls last, name asc';

      const paged = [...values];
      paged.push(query.pageSize);
      const limitPlaceholder = `$${paged.length}`;
      paged.push((query.page - 1) * query.pageSize);
      const offsetPlaceholder = `$${paged.length}`;

      const result = await pool.query(
        `${BASE_CTE}${SELECT_COLUMNS}${where}${orderBy} limit ${limitPlaceholder} offset ${offsetPlaceholder}`,
        paged,
      );
      return {
        data: result.rows.map((row) => rowToProjectSummary(row as Record<string, unknown>)),
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: query.pageSize > 0 ? Math.ceil(total / query.pageSize) : 0,
      };
    },

    async findById(id: string): Promise<ProjectDetail | null> {
      const result = await pool.query(`${BASE_CTE}${SELECT_COLUMNS} where id = $1`, [id]);
      const row = result.rows[0] as Record<string, unknown> | undefined;
      if (!row) return null;

      const [sources, events, relations, history, impacts] = await Promise.all([
        pool.query(
          `select s.id, s.name, s.url, s.source_type, s.publication_date, s.last_verified_at,
                  s.confidence, ps.snippet, ps.is_primary
             from project_sources ps join sources s on s.id = ps.source_id
            where ps.project_id = $1
            order by ps.is_primary desc, s.publication_date desc nulls last, s.name asc`,
          [id],
        ),
        pool.query(
          `select id, project_id, title, occurred_at, kind, description, source_id
             from events where project_id = $1 order by occurred_at asc`,
          [id],
        ),
        pool.query(
          `select r.id, r.from_project, r.to_project, r.type, r.description, r.source_id,
                  case when r.from_project = $1 then 'OUTGOING' else 'INCOMING' end as direction
             from relations r
            where r.from_project = $1 or r.to_project = $1
            order by r.type asc, r.id asc`,
          [id],
        ),
        pool.query(
          `select id, from_status, to_status, changed_at, note, source_id
             from status_history where project_id = $1 order by changed_at asc, id asc`,
          [id],
        ),
        pool.query(
          `select id, category, description, source_id
             from impact_records where project_id = $1 order by id asc`,
          [id],
        ),
      ]);

      const location = rowToLocation({
        id: row.location_id,
        name: row.location_name,
        level: row.location_level,
        parent_id: row.location_parent_id,
        country_code: row.location_country_code,
        longitude: row.location_longitude,
        latitude: row.location_latitude,
        metadata: row.location_metadata,
        child_count: row.location_child_count,
        project_count: row.location_project_count,
      });

      return rowToProjectDetail(rowToProjectSummary(row), row, {
        location,
        sources: sources.rows.map((r) => rowToSource(r as Record<string, unknown>)),
        events: events.rows.map((r) => rowToEvent(r as Record<string, unknown>)),
        relations: relations.rows.map((r) => rowToRelation(r as Record<string, unknown>)),
        statusHistory: history.rows.map((r) => rowToStatusHistoryEntry(r as Record<string, unknown>)),
        impactRecords: impacts.rows.map((r) => rowToImpactRecord(r as Record<string, unknown>)),
      });
    },
  };
}
