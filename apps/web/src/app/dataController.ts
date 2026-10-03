import { toQuery } from '../state/filters.ts';
import type { ApiClient } from '../data/client.ts';
import type { Store } from '../state/store.ts';

export interface DataControllerOptions {
  client: ApiClient;
  store: Store;
  debounceMs?: number;
}

function errorDetail(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    return String((error as { code: string }).code);
  }
  if (error instanceof Error) return error.message.slice(0, 120);
  return 'UNKNOWN_ERROR';
}

export function createDataController(options: DataControllerOptions) {
  const { client, store } = options;
  const debounceMs = options.debounceMs ?? 250;
  let inFlight: AbortController | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;

  async function load(): Promise<void> {
    if (disposed) return;
    inFlight?.abort();
    const controller = new AbortController();
    inFlight = controller;
    const { filters, selectedProjectId, focusLocationId } = store.getState();

    try {
      const health = await client.health(controller.signal);
      store.dispatch({ type: 'api/healthy' });
      store.dispatch({ type: 'ui/lastRequestId', requestId: health.requestId ?? null });
    } catch (error) {
      if ((error as { name?: string }).name === 'AbortError') return;
      store.dispatch({ type: 'api/unhealthy', detail: errorDetail(error) });
      return;
    }

    try {
      const stats = await client.stats(controller.signal);
      store.dispatch({ type: 'data/stats', payload: stats });
    } catch (error) {
      if ((error as { name?: string }).name === 'AbortError') return;
    }

    const listQuery: Record<string, unknown> = { ...toQuery(filters) };
    if (focusLocationId) listQuery.locationId = focusLocationId;

    try {
      // Every location is loaded, unfiltered by the active scale: the map needs
      // the whole hierarchy to place one marker per location, and the scale
      // control only enables the levels that actually have data. Filtering the
      // request by `level` left the first load with the empty world node alone,
      // which hid every project from the map and disabled every other scale.
      const [locations, projects] = await Promise.all([
        client.locations({}, controller.signal),
        client.projects({ ...listQuery }, controller.signal),
      ]);
      store.dispatch({ type: 'data/locations', payload: locations });
      store.dispatch({
        type: 'data/projects',
        payload: { data: projects.data, page: projects.page, pageSize: projects.pageSize, total: projects.total, totalPages: projects.totalPages },
      });
      // Relations are intentionally not fetched here: the API requires a
      // projectId and answers 400 without one, and the response is not stored
      // in state yet. Fetching them per selected project is a separate change.
    } catch (error) {
      if ((error as { name?: string }).name === 'AbortError') return;
      store.dispatch({ type: 'data/error', detail: errorDetail(error) });
      return;
    }

    try {
      const events = await client.events({}, controller.signal);
      store.dispatch({ type: 'data/events', payload: events });
    } catch {
      store.dispatch({ type: 'data/events', payload: { data: [], count: 0 } });
    }

    if (selectedProjectId) {
      try {
        const detail = await client.project(selectedProjectId, controller.signal);
        store.dispatch({ type: 'data/detail', payload: detail });
      } catch (error) {
        if ((error as { name?: string }).name === 'AbortError') return;
        store.dispatch({ type: 'data/detail', payload: null });
      }
    } else {
      store.dispatch({ type: 'data/detail', payload: null });
    }
  }

  return {
    refresh(): Promise<void> {
      if (debounceMs === 0) return load();
      return new Promise((resolve) => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          void load().then(resolve);
        }, debounceMs);
      });
    },
    refreshHealth(): Promise<void> {
      return load();
    },
    dispose(): void {
      disposed = true;
      inFlight?.abort();
      if (timer) clearTimeout(timer);
    },
  };
}