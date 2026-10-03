import type { EventRecord } from '../data/types.ts';

export interface TimelineState {
  year: number;
  playing: boolean;
  minYear: number;
  maxYear: number;
}

export function clampYear(year: number, minYear: number, maxYear: number): number {
  if (!Number.isFinite(year)) return minYear;
  return Math.min(maxYear, Math.max(minYear, Math.trunc(year)));
}

export function yearStep(state: TimelineState, direction: 1 | -1): number {
  if (direction === 1 && state.year === state.minYear) return state.minYear;
  if (direction === -1 && state.year === state.maxYear) return state.maxYear;
  return clampYear(state.year + direction, state.minYear, state.maxYear);
}

export function eventsInYear(events: readonly EventRecord[], year: number): EventRecord[] {
  return events.filter((event) => new Date(event.occurredAt).getUTCFullYear() === year);
}