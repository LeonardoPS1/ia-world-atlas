import type {
  EventListResponse,
  LocationListResponse,
  ProjectListResponse,
  StatsResponse,
} from '@atlas/contracts';
import type { HealthResponse, LocationLevel, ProjectSummary, ProjectDetail } from '../data/types.ts';
import type { AtlasFilters } from './filters.ts';
import { EMPTY_FILTERS, toggleInList } from './filters.ts';
import type { TimelineState } from './timeline.ts';
import { clampYear } from './timeline.ts';

export { toggleInList } from './filters.ts';

function shallowEqual<T extends object>(a: T, b: T): boolean {
  const keysA = Object.keys(a as Record<string, unknown>);
  const keysB = Object.keys(b as Record<string, unknown>);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if ((a as Record<string, unknown>)[key] !== (b as Record<string, unknown>)[key]) return false;
  }
  return true;
}

export interface AtlasState {
  filters: AtlasFilters;
  focusLocationId: string | null;
  selectedProjectId: string | null;
  level: LocationLevel;
  timeline: TimelineState;
  railOpen: boolean;
  drawerOpen: boolean;
  projects: ProjectListResponse;
  locations: LocationListResponse;
  stats: StatsResponse | null;
  health: HealthResponse | null;
  api: { status: 'idle' | 'loading' | 'ok' | 'error'; detail: string | null };
  lastRequestId: string | null;
  globalTotal: number;
  matchingTotal: number;
  mapMode: 'globe' | 'fallback';
  fallbackReason: string | null;
  detail: ProjectDetail | null;
  events: EventListResponse;
}

export type Action =
  | { type: 'filters/set'; patch: Partial<AtlasFilters> }
  | { type: 'filters/reset' }
  | { type: 'filters/toggleValue'; key: 'type' | 'status' | 'evidence'; value: string }
  | { type: 'focus/set'; locationId: string | null }
  | { type: 'selection/set'; id: string | null }
  | { type: 'selection/clear' }
  | { type: 'level/set'; level: LocationLevel }
  | { type: 'timeline/setYear'; year: number }
  | { type: 'timeline/play' }
  | { type: 'timeline/pause' }
  | { type: 'timeline/step'; delta: number }
  | { type: 'panel/rail'; open: boolean }
  | { type: 'panel/drawer'; open: boolean }
  | { type: 'data/projects'; payload: { data: ProjectSummary[]; page: number; pageSize: number; total: number; totalPages: number } }
  | { type: 'data/locations'; payload: LocationListResponse }
  | { type: 'data/events'; payload: EventListResponse }
  | { type: 'data/stats'; payload: StatsResponse }
  | { type: 'data/detail'; payload: ProjectDetail | null }
  | { type: 'data/error'; detail: string }
  | { type: 'api/healthy' }
  | { type: 'api/unhealthy'; detail: string }
  | { type: 'ui/lastRequestId'; requestId: string | null }
  | { type: 'map/mode'; payload: { mode: 'globe' | 'fallback'; reason?: string | null } };

export function createInitialState(patch: Partial<AtlasState> = {}): AtlasState {
  return {
    filters: { ...EMPTY_FILTERS },
    focusLocationId: null,
    selectedProjectId: null,
    level: 'WORLD',
    timeline: { year: 2026, playing: false, minYear: 2020, maxYear: 2026 },
    railOpen: true,
    drawerOpen: false,
    projects: { data: [], page: 1, pageSize: 50, total: 0, totalPages: 0 },
    locations: { data: [], page: 1, pageSize: 50, total: 0, totalPages: 0 },
    stats: null,
    health: null,
    api: { status: 'idle', detail: null },
    lastRequestId: null,
    globalTotal: 0,
    matchingTotal: 0,
    mapMode: 'globe',
    fallbackReason: null,
    detail: null,
    events: { data: [], count: 0 },
    ...patch,
  };
}

export function toggleFilterValue(state: AtlasState, key: 'type' | 'status' | 'evidence', value: string): AtlasState {
  const current = state.filters[key] as readonly string[];
  return { ...state, filters: { ...state.filters, [key]: toggleInList(current, value) } };
}

export function reduce(state: AtlasState, action: Action): AtlasState {
  switch (action.type) {
    case 'filters/set': {
      const next = { ...state.filters, ...action.patch };
      if (next.yearFrom !== null && next.yearTo !== null && next.yearFrom > next.yearTo) {
        const adjusted = { ...next, yearTo: next.yearFrom };
        if (shallowEqual(adjusted, state.filters)) return state;
        return { ...state, filters: adjusted };
      }
      if (shallowEqual(next, state.filters)) return state;
      return { ...state, filters: next };
    }
    case 'filters/reset':
      return { ...state, filters: { ...EMPTY_FILTERS }, selectedProjectId: null, drawerOpen: false };
    case 'filters/toggleValue':
      return toggleFilterValue(state, action.key, action.value);
    case 'focus/set':
      return { ...state, focusLocationId: action.locationId };
    case 'selection/set':
      return action.id === null
        ? { ...state, selectedProjectId: null, drawerOpen: false }
        : { ...state, selectedProjectId: action.id, drawerOpen: true };
    case 'selection/clear':
      return { ...state, selectedProjectId: null, drawerOpen: false };
    case 'level/set':
      return { ...state, level: action.level };
    case 'timeline/setYear':
      return { ...state, timeline: { ...state.timeline, year: clampYear(action.year, state.timeline.minYear, state.timeline.maxYear) } };
    case 'timeline/play':
      return { ...state, timeline: { ...state.timeline, playing: true } };
    case 'timeline/pause':
      return { ...state, timeline: { ...state.timeline, playing: false } };
    case 'timeline/step':
      return {
        ...state,
        timeline: {
          ...state.timeline,
          playing: false,
          year: clampYear(state.timeline.year + action.delta, state.timeline.minYear, state.timeline.maxYear),
        },
      };
    case 'panel/rail':
      return { ...state, railOpen: action.open };
    case 'panel/drawer':
      return { ...state, drawerOpen: action.open };
    case 'data/projects':
      return { ...state, projects: action.payload, matchingTotal: action.payload.total };
    case 'data/locations':
      return { ...state, locations: action.payload };
    case 'data/events':
      return { ...state, events: action.payload };
    case 'data/stats':
      return { ...state, stats: action.payload, globalTotal: action.payload.totals.projects };
    case 'data/detail':
      return { ...state, detail: action.payload };
    case 'data/error':
      return { ...state, api: { status: 'error', detail: action.detail } };
    case 'api/healthy':
      return { ...state, api: { status: 'ok', detail: null } };
    case 'api/unhealthy':
      return { ...state, api: { status: 'error', detail: action.detail } };
    case 'ui/lastRequestId':
      return { ...state, lastRequestId: action.requestId };
    case 'map/mode':
      return {
        ...state,
        mapMode: action.payload.mode,
        fallbackReason: action.payload.mode === 'fallback' ? (action.payload.reason ?? 'unknown') : null,
      };
    default:
      return state;
  }
}

export interface Store {
  getState(): AtlasState;
  dispatch(action: Action): void;
  subscribe(listener: (state: AtlasState) => void): () => void;
}

export function createStore(initial: AtlasState): Store {
  let state = initial;
  const listeners = new Set<(state: AtlasState) => void>();
  return {
    getState: () => state,
    dispatch(action) {
      const next = reduce(state, action);
      if (next === state) return;
      state = next;
      for (const listener of listeners) listener(state);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}