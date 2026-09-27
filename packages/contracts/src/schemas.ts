import { z } from 'zod';
import {
  CONFIDENCE_LEVELS,
  EVIDENCE_LEVELS,
  IMPACT_CATEGORIES,
  LOCATION_LEVELS,
  PROJECT_STATUSES,
  PROJECT_TYPES,
  RELATION_DIRECTIONS,
  RELATION_TYPES,
  SOURCE_TYPES,
  TIMELINE_SORTS,
} from './vocabularies.js';
import type { Paginated } from './types.js';

export const projectTypeSchema = z.enum(PROJECT_TYPES);
export const projectStatusSchema = z.enum(PROJECT_STATUSES);
export const evidenceSchema = z.enum(EVIDENCE_LEVELS);
export const locationLevelSchema = z.enum(LOCATION_LEVELS);
export const sourceTypeSchema = z.enum(SOURCE_TYPES);
export const confidenceSchema = z.enum(CONFIDENCE_LEVELS);
export const relationTypeSchema = z.enum(RELATION_TYPES);
export const relationDirectionSchema = z.enum(RELATION_DIRECTIONS);
export const impactCategorySchema = z.enum(IMPACT_CATEGORIES);
export const sortSchema = z.enum(TIMELINE_SORTS);

// Every timestamp in this package goes through `isoDate`, including
// `healthResponseSchema.time`. The columns behind the rest are `timestamptz`, so a
// bare `z.string()` would let a malformed value cross the wire and surface later as
// `NaN` from `new Date(...)` in the web timeline, far from the query that produced
// it. `isoDate` is deliberately a floor, not a full ISO parser: it rejects the junk a
// bad cast produces without trying to enumerate every legal ISO-8601 form.
const isoDate = z
  .string()
  .min(10)
  .refine((value) => !Number.isNaN(Date.parse(value)), { message: 'expected ISO-8601 date' });

export const srcUrlSchema = z
  .string()
  .min(1)
  .max(2048)
  .refine(
    (value) => {
      try {
        const protocol = new URL(value).protocol;
        return protocol === 'https:' || protocol === 'http:';
      } catch {
        return false;
      }
    },
    { message: 'source url must be an absolute http(s) url' },
  );

export const locationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  level: locationLevelSchema,
  parentId: z.string().min(1).nullable(),
  countryCode: z.string().length(2).nullable(),
  longitude: z.number().min(-180).max(180),
  latitude: z.number().min(-90).max(90),
  childCount: z.number().int().nonnegative(),
  projectCount: z.number().int().nonnegative(),
  metadata: z.record(z.unknown()),
});

export const sourceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  url: srcUrlSchema,
  sourceType: sourceTypeSchema,
  publicationDate: isoDate.nullable(),
  lastVerifiedAt: isoDate,
  confidence: confidenceSchema,
  snippet: z.string().min(1),
  isPrimary: z.boolean(),
});

export const eventSchema = z.object({
  id: z.number().int(),
  projectId: z.string().min(1),
  title: z.string().min(1),
  occurredAt: isoDate,
  kind: z.string().min(1),
  description: z.string(),
  sourceId: z.string().nullable(),
});

export const relationSchema = z.object({
  id: z.string().min(1),
  fromProject: z.string().min(1),
  toProject: z.string().min(1),
  type: relationTypeSchema,
  direction: relationDirectionSchema,
  description: z.string(),
  sourceId: z.string().nullable(),
});

export const statusHistoryEntrySchema = z.object({
  id: z.number().int(),
  fromStatus: projectStatusSchema.nullable(),
  toStatus: projectStatusSchema,
  changedAt: isoDate,
  note: z.string().nullable(),
  sourceId: z.string().nullable(),
});

export const impactRecordSchema = z.object({
  id: z.number().int(),
  category: impactCategorySchema,
  description: z.string().min(1),
  sourceId: z.string().nullable(),
});

export const projectSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: projectTypeSchema,
  status: projectStatusSchema,
  evidence: evidenceSchema,
  sector: z.string().nullable(),
  summary: z.string().min(1),
  year: z.number().int().min(1900).max(2100).nullable(),
  locationId: z.string().min(1),
  longitude: z.number().min(-180).max(180),
  latitude: z.number().min(-90).max(90),
  actors: z.array(z.string()),
  tags: z.array(z.string()),
  publishedAt: isoDate.nullable(),
  lastVerifiedAt: isoDate,
  sourceCount: z.number().int().nonnegative(),
  eventCount: z.number().int().nonnegative(),
});

export const projectDetailSchema = projectSummarySchema.extend({
  impact: z.string().nullable(),
  location: locationSchema,
  sources: z.array(sourceSchema),
  events: z.array(eventSchema),
  relations: z.array(relationSchema),
  statusHistory: z.array(statusHistoryEntrySchema),
  impactRecords: z.array(impactRecordSchema),
  geometrySource: z.enum(['project', 'location']),
});

// A count map is keyed by a vocabulary, so the key set is part of the contract.
// Without this, `byEvidence: { NOT_A_REAL_EVIDENCE_LEVEL: 7 }` parses, and the API can
// emit a distribution nobody downstream knows how to read.
function countMap(allowed: readonly string[]) {
  return z
    .record(z.number().int().nonnegative())
    .refine((map) => Object.keys(map).every((key) => allowed.includes(key)), {
      message: 'count map contains a key outside its vocabulary',
    });
}

export const statsResponseSchema = z.object({
  totals: z.object({
    projects: z.number().int().nonnegative(),
    locations: z.number().int().nonnegative(),
    sources: z.number().int().nonnegative(),
  }),
  byEvidence: countMap(EVIDENCE_LEVELS),
  byType: countMap(PROJECT_TYPES),
  byStatus: countMap(PROJECT_STATUSES),
});

export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  api: z.literal('atlas-api'),
  database: z.enum(['up', 'down']),
  version: z.string().min(1),
  time: isoDate,
});

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    details: z.array(z.unknown()),
    requestId: z.string().min(1),
  }),
});

export function paginatedSchema<T extends z.ZodTypeAny>(item: T): z.ZodType<Paginated<T>> {
  return z.object({
    data: z.array(item),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  });
}
