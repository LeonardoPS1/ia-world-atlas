import type {
  Event,
  ImpactRecord,
  Location,
  ProjectDetail,
  ProjectSummary,
  Relation,
  Source,
  StatusHistoryEntry,
} from '@atlas/contracts';

type Row = Record<string, unknown>;

const asString = (value: unknown): string => String(value);
const asNullableString = (value: unknown): string | null =>
  value === null || value === undefined ? null : String(value);
const asNumber = (value: unknown): number => Number(value);
const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((item) => String(item)) : [];
const asDate = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
};

export function rowToLocation(row: Row): Location {
  return {
    id: asString(row.id),
    name: asString(row.name),
    level: asString(row.level) as Location['level'],
    parentId: asNullableString(row.parent_id),
    countryCode: asNullableString(row.country_code),
    longitude: asNumber(row.longitude),
    latitude: asNumber(row.latitude),
    childCount: asNumber(row.child_count),
    projectCount: asNumber(row.project_count),
    metadata: (row.metadata as Location['metadata']) ?? {},
  };
}

export function rowToProjectSummary(row: Row): ProjectSummary {
  return {
    id: asString(row.id),
    name: asString(row.name),
    type: asString(row.type) as ProjectSummary['type'],
    status: asString(row.status) as ProjectSummary['status'],
    evidence: asString(row.evidence) as ProjectSummary['evidence'],
    sector: asNullableString(row.sector),
    summary: asString(row.summary),
    year: row.year === null || row.year === undefined ? null : asNumber(row.year),
    locationId: asString(row.location_id),
    longitude: asNumber(row.longitude),
    latitude: asNumber(row.latitude),
    actors: asStringArray(row.actors),
    tags: asStringArray(row.tags),
    publishedAt: row.published_at ? new Date(asString(row.published_at)).toISOString() : null,
    lastVerifiedAt: new Date(asString(row.last_verified_at)).toISOString(),
    sourceCount: asNumber(row.source_count),
    eventCount: asNumber(row.event_count),
  };
}

export function rowToSource(row: Row): Source {
  return {
    id: asString(row.id),
    name: asString(row.name),
    url: asString(row.url),
    sourceType: asString(row.source_type) as Source['sourceType'],
    publicationDate: asDate(row.publication_date),
    lastVerifiedAt: new Date(asString(row.last_verified_at)).toISOString(),
    confidence: asString(row.confidence) as Source['confidence'],
    snippet: asString(row.snippet),
    isPrimary: Boolean(row.is_primary),
  };
}

export function rowToEvent(row: Row): Event {
  return {
    id: asNumber(row.id),
    projectId: asString(row.project_id),
    title: asString(row.title),
    occurredAt: asDate(row.occurred_at) ?? '1970-01-01',
    kind: asString(row.kind),
    description: asString(row.description),
    sourceId: asNullableString(row.source_id),
  };
}

export function rowToRelation(row: Row): Relation {
  return {
    id: asString(row.id),
    fromProject: asString(row.from_project),
    toProject: asString(row.to_project),
    type: asString(row.type) as Relation['type'],
    direction: asString(row.direction) as Relation['direction'],
    description: asString(row.description),
    sourceId: asNullableString(row.source_id),
  };
}

export function rowToStatusHistoryEntry(row: Row): StatusHistoryEntry {
  return {
    id: asNumber(row.id),
    fromStatus: asNullableString(row.from_status) as StatusHistoryEntry['fromStatus'],
    toStatus: asString(row.to_status) as StatusHistoryEntry['toStatus'],
    changedAt: new Date(asString(row.changed_at)).toISOString(),
    note: asNullableString(row.note),
    sourceId: asNullableString(row.source_id),
  };
}

export function rowToImpactRecord(row: Row): ImpactRecord {
  return {
    id: asNumber(row.id),
    category: asString(row.category) as ImpactRecord['category'],
    description: asString(row.description),
    sourceId: asNullableString(row.source_id),
  };
}

export function rowToProjectDetail(
  summary: ProjectSummary,
  row: Row,
  extra: {
    sources: Source[];
    events: Event[];
    relations: Relation[];
    statusHistory: StatusHistoryEntry[];
    impactRecords: ImpactRecord[];
    location: Location;
  },
): ProjectDetail {
  return {
    ...summary,
    impact: asNullableString(row.impact),
    location: extra.location,
    sources: extra.sources,
    events: extra.events,
    relations: extra.relations,
    statusHistory: extra.statusHistory,
    impactRecords: extra.impactRecords,
    geometrySource: asString(row.geometry_source) === 'location' ? 'location' : 'project',
  };
}
