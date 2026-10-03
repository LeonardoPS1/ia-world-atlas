export type QueryValue = string | number | boolean | string[] | undefined | null;

import type {
  ProjectSummary,
  ProjectDetail,
  Location,
  Event,
  Relation,
  Source,
  StatusHistoryEntry,
  ImpactRecord,
  ProjectType,
  ProjectStatus,
  EvidenceLevel,
  LocationLevel,
} from '@atlas/contracts';

export type {
  ProjectSummary,
  ProjectDetail,
  Location,
  Event,
  Relation,
  Source,
  StatusHistoryEntry,
  ImpactRecord,
  ProjectType,
  ProjectStatus,
  EvidenceLevel,
  LocationLevel,
};

// Local type aliases for compatibility with plan's naming
export type Project = ProjectSummary;
export type EventRecord = Event;
export type RelationRecord = Relation;
export type EvidenceIntent = EvidenceLevel;
export type EventKind = string;