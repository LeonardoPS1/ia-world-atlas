import { diagnoseMapEnvironment } from '../map/diagnostics.ts';
import { createFallbackAdapter } from '../map/fallback.ts';
import { createGlobeAdapter } from '../map/globe.ts';
import { buildSelectors } from '../state/selectors.ts';
import { createDrawer, renderDrawer } from '../ui/drawer.ts';
import { createHeader } from '../ui/header.ts';
import { createRail, renderRail } from '../ui/rail.ts';
import { createShell } from '../ui/shell.ts';
import { createStrip, renderStrip } from '../ui/strip.ts';
import { renderStatusBadge } from '../ui/statusBadge.ts';
import { clear, el } from '../ui/dom.ts';
import { createDataController } from './dataController.ts';
import { createInitialState, createStore } from '../state/store.ts';
import type { ApiClient } from '../data/client.ts';
import type { Cluster } from '../state/selectors.ts';
import type { MapDiagnostics } from '../map/diagnostics.ts';
import type { Store } from '../state/store.ts';
import type { AtlasState } from '../state/store.ts';

export interface MapAdapter {
  setClusters(clusters: Cluster[]): void;
  setSelected(id: string | null): void;
  focus(id: string): void;
  setMode(mode: 'globe' | 'fallback'): void;
  destroy(): void;
}

export type MapFactory = (
  host: HTMLElement,
  diagnostics: MapDiagnostics,
  onSelect: (projectId: string) => void,
) => Promise<MapAdapter>;

export interface BootOptions {
  container: HTMLElement;
  client: ApiClient;
  store?: Store;
  createMap?: MapFactory;
  allowHttpSources?: boolean;
}

function defaultMapFactory(): MapFactory {
  return async (host, diagnostics, onSelect) => {
    if (!diagnostics.ok) {
      host.hidden = false;
      return createFallbackAdapter({
        host,
        reason: diagnostics.reason ?? 'unknown',
        onSelect,
        width: host.clientWidth ?? 960,
        height: host.clientHeight ?? 540,
      });
    }
    const globe = await createGlobeAdapter({ host, onSelect, token: diagnostics.token ?? '' });
    globe.setMode('globe');
    return globe;
  };
}

export function boot(options: BootOptions) {
  const store = options.store ?? createStore(createInitialState());
  const container = options.container;
  clear(container);

  const shell = createShell(container);
  const mapHost = shell.map;
  const headerRefs = createHeader(shell, {
    onSearch: (value) => {
      store.dispatch({ type: 'filters/set', patch: { q: value } });
      void controller.refresh();
    },
    onRailToggle: () => {
      if (shell.rail.hasAttribute('hidden')) shell.rail.removeAttribute('hidden');
      else shell.rail.setAttribute('hidden', '');
    },
  });
  const statusSlot = headerRefs.status;

  const drawer = createDrawer(shell.drawer, {
    onClose: () => {
      store.dispatch({ type: 'selection/clear' });
    },
    onFocus: (locationId) => {
      store.dispatch({ type: 'focus/set', locationId });
      void controller.refresh();
    },
  });

  const rail = createRail(shell.rail, {
    onLevel: (level) => {
      store.dispatch({ type: 'level/set', level });
      void controller.refresh();
    },
    onToggle: (key, value) => {
      store.dispatch({ type: 'filters/toggleValue', key, value });
      void controller.refresh();
    },
    onYearRange: (patch) => {
      store.dispatch({ type: 'filters/set', patch });
      void controller.refresh();
    },
    onReset: () => {
      store.dispatch({ type: 'filters/reset' });
      void controller.refresh();
    },
    onFocus: (locationId) => {
      store.dispatch({ type: 'focus/set', locationId });
      void controller.refresh();
    },
  });

  const strip = createStrip(shell.strip, {
    onYear: (year) => {
      store.dispatch({ type: 'timeline/setYear', year });
    },
    onPlayToggle: () => {
      store.dispatch({ type: 'timeline/play' });
    },
    onStep: (delta) => {
      const state = store.getState();
      const year = state.timeline.year + delta;
      store.dispatch({ type: 'timeline/setYear', year });
    },
  });

  const controller = createDataController({ client: options.client, store });

  const listHost = el('div', { class: 'project-list', 'data-testid': 'project-list', role: 'list' });

  let adapter: MapAdapter | undefined;
  let disposed = false;

  const renderProjectList = (state: AtlasState): void => {
    clear(listHost);
    for (const project of state.projects.data) {
      const button = el(
        'button',
        {
          type: 'button',
          class: 'project-list__item',
          role: 'listitem',
          'data-project-id': project.id,
          'aria-pressed': String(project.id === state.selectedProjectId),
        },
        [document.createTextNode(project.name)],
      ) as HTMLButtonElement;
      button.addEventListener('click', async () => {
        store.dispatch({ type: 'selection/set', id: project.id });
        await controller.refresh();
      });
      listHost.append(button);
    }
  };

  const factory = options.createMap ?? defaultMapFactory();

  const ensureAdapter = (): void => {
    if (adapter || disposed) return;
    const diagnostics = diagnoseMapEnvironment({
      token: (import.meta.env.VITE_MAPBOX_TOKEN as string | undefined) ?? '',
    });
    void factory(mapHost, diagnostics, (projectId) => {
      store.dispatch({ type: 'selection/set', id: projectId });
      void controller.refresh();
    })
      .then((created) => {
        if (disposed) {
          created.destroy();
          return;
        }
        adapter = created;
        if (!diagnostics.ok) {
          store.dispatch({ type: 'map/mode', payload: { mode: 'fallback', reason: diagnostics.reason } });
        } else {
          store.dispatch({ type: 'map/mode', payload: { mode: 'globe' } });
        }
        // Force render now that adapter is ready
        render();
      })
      .catch((error: unknown) => {
        store.dispatch({ type: 'map/mode', payload: { mode: 'fallback', reason: error instanceof Error ? error.message : 'map-unavailable' } });
      });
  };

  const render = (): void => {
    if (disposed) return;
    const state = store.getState();
    const selectors = buildSelectors(state);

    renderStatusBadge(statusSlot, state.api, state.lastRequestId, state.matchingTotal, state.globalTotal);
    renderRail(rail, state, selectors);
    renderStrip(strip, state, selectors, state.events.data);
    renderDrawer(drawer, state.detail, { allowHttp: options.allowHttpSources === true });

    if (state.selectedProjectId) {
      shell.drawer.removeAttribute('hidden');
    } else {
      shell.drawer.setAttribute('hidden', '');
    }

    const clusters = selectors.clusters;
    if (adapter) {
      adapter.setClusters(clusters);
      adapter.setSelected(state.selectedProjectId);
    }

    mapHost.setAttribute('data-map-mode', state.mapMode);
    renderProjectList(state);

    if (state.mapMode === 'fallback') {
      const host = mapHost;
      clear(host);
      host.hidden = false;
      const reason = state.fallbackReason ?? 'map-unavailable';
      host.append(
        el('div', { class: 'fallback', 'data-testid': 'fallback' }, [
          el('div', { class: 'fallback__diagnostic', 'data-testid': 'fallback-diagnostic', text: `Mapa 3D no disponible: ${reason}` }),
          el('div', { class: 'fallback__canvas' }, [
            el('div', { class: 'fallback__graticule' }, [el('div', { class: 'fallback__points' })]),
          ]),
        ]),
      );
    }

    mapHost.append(listHost);
  };

  store.subscribe(render);
  render();
  // Load initial data before creating adapter so clusters have data
  controller.refresh().then(() => {
    if (!disposed) ensureAdapter();
  });

  return {
    dispose(): void {
      disposed = true;
      controller.dispose();
      adapter?.destroy();
      clear(container);
    },
  };
}