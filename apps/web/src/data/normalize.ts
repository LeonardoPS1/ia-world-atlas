import type {
  EventRecord,
  EvidenceLevel,
  ProjectStatus,
  ProjectSummary,
  Source,
} from './types.ts';
import { EVIDENCE_COLORS, STATUS_COLORS } from '../state/colors.ts';

const STATUS_ORDER: Readonly<Record<ProjectStatus, number>> = {
  IDEA: 0,
  RESEARCH: 1,
  ANNOUNCED: 2,
  FUNDED: 3,
  PILOT: 4,
  BUILDING: 5,
  DEPLOYING: 6,
  ACTIVE: 7,
  SCALING: 8,
  COMPLETED: 9,
  PAUSED: 10,
  CANCELLED: 11,
};

const EVIDENCE_ORDER: Readonly<Record<EvidenceLevel, number>> = {
  VERIFIED: 0,
  REPORTED: 1,
  ANNOUNCED: 2,
  ANALYSIS: 3,
  SIGNAL: 4,
  POSSIBILITY: 5,
};

export function pickAccent(project: ProjectSummary): string {
  return STATUS_COLORS[project.status];
}

export function sortSources(sources: readonly Source[]): Source[] {
  return [...sources].sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    return new Date(b.publicationDate ?? 0).getTime() - new Date(a.publicationDate ?? 0).getTime();
  });
}

export function sortTimelineEvents(events: readonly EventRecord[]): EventRecord[] {
  return [...events].sort(
    (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
  );
}

export function visibleProjectsInYear(
  projects: readonly ProjectSummary[],
  year: number,
): ProjectSummary[] {
  return projects.filter((project) => {
    const start = project.publishedAt ? new Date(project.publishedAt).getUTCFullYear() : Number.NEGATIVE_INFINITY;
    // Contracts have no endedAt; treat all projects as ongoing.
    return year >= start;
  });
}

export function accentRank(project: ProjectSummary): number {
  return Math.min(STATUS_ORDER[project.status] ?? 12, EVIDENCE_ORDER[project.evidence] ?? 6);
}

export const ACCENT_FALLBACK = STATUS_COLORS.IDEA;
export const ACCENT_BY_EVIDENCE = EVIDENCE_COLORS;