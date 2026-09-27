import type { z } from 'zod';
import type {
  apiErrorSchema,
  eventSchema,
  healthResponseSchema,
  impactRecordSchema,
  locationSchema,
  projectDetailSchema,
  projectSummarySchema,
  relationSchema,
  sourceSchema,
  statsResponseSchema,
  statusHistoryEntrySchema,
} from './schemas.js';
import type {
  CONFIDENCE_LEVELS,
  EVIDENCE_LEVELS,
  IMPACT_CATEGORIES,
  LOCATION_LEVELS,
  PROJECT_STATUSES,
  PROJECT_TYPES,
  RELATION_DIRECTIONS,
  RELATION_TYPES,
  SOURCE_TYPES,
} from './vocabularies.js';

export type ProjectType = (typeof PROJECT_TYPES)[number];
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type EvidenceLevel = (typeof EVIDENCE_LEVELS)[number];
export type LocationLevel = (typeof LOCATION_LEVELS)[number];
export type SourceType = (typeof SOURCE_TYPES)[number];
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];
export type RelationType = (typeof RELATION_TYPES)[number];
export type RelationDirection = (typeof RELATION_DIRECTIONS)[number];
export type ImpactCategory = (typeof IMPACT_CATEGORIES)[number];

export type Location = z.infer<typeof locationSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type Event = z.infer<typeof eventSchema>;
export type Relation = z.infer<typeof relationSchema>;
export type StatusHistoryEntry = z.infer<typeof statusHistoryEntrySchema>;
export type ImpactRecord = z.infer<typeof impactRecordSchema>;
export type ProjectSummary = z.infer<typeof projectSummarySchema>;
export type ProjectDetail = z.infer<typeof projectDetailSchema>;
export type StatsResponse = z.infer<typeof statsResponseSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
