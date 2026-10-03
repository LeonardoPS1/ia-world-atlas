import { describe, expect, it } from 'vitest';
import { createMarkerElement } from './markers.ts';
import type { Cluster } from '../state/selectors.ts';
import { MARKER_SHAPES } from '../state/palette.ts';

const base: Cluster = {
  id: 'valparaiso::2026',
  locationId: 'valparaiso',
  level: 'CITY',
  lat: -33.0472,
  lng: -71.543,
  count: 2,
  shape: 'diamond',
  size: 14,
  color: '#4b8cff',
};

describe('createMarkerElement', () => {
  it('is a button with an accessible name and a data hook', () => {
    const node = createMarkerElement(base, { selected: false, reducedMotion: false });
    expect(node.tagName).toBe('BUTTON');
    expect(node.getAttribute('type')).toBe('button');
    expect(node.getAttribute('aria-label')).toBeTruthy();
    expect(node.getAttribute('data-cluster-id')).toBe(base.locationId);
  });

  it('never renders a solid circle fill', () => {
    const node = createMarkerElement(base, { selected: false, reducedMotion: false });
    expect(node.querySelectorAll('circle[fill]').length).toBe(0);
    expect(node.innerHTML).not.toContain('fill:#');
  });

  it('draws a different glyph per level', () => {
    const shapes = (['WORLD', 'CONTINENT', 'COUNTRY', 'REGION', 'CITY', 'LOCAL_AREA'] as const).map(
      (level) =>
        createMarkerElement(
          { ...base, level, shape: MARKER_SHAPES[level] },
          { selected: false, reducedMotion: false },
        ).querySelector('svg')?.firstElementChild?.tagName.toLowerCase(),
    );
    expect(new Set(shapes).size).toBeGreaterThan(2);
  });

  it('adds a counter only when the count is above one', () => {
    expect(createMarkerElement(base, { selected: false, reducedMotion: false }).textContent).toBe('2');
    const single = createMarkerElement({ ...base, count: 1 }, { selected: false, reducedMotion: false });
    expect(single.textContent).toBe('');
  });

  it('drops every animation class when motion is reduced', () => {
    const reduced = createMarkerElement(base, { selected: true, reducedMotion: true });
    expect(reduced.className).not.toContain('marker-pulse');
    expect(reduced.className).not.toContain('marker-orbit');
    const full = createMarkerElement(base, { selected: true, reducedMotion: false });
    expect(full.className).toContain('marker-orbit');
  });

  it('marks the selected cluster for the camera', () => {
    const selected = createMarkerElement(base, { selected: true, reducedMotion: false });
    expect(selected.getAttribute('aria-pressed')).toBe('true');
    expect(createMarkerElement(base, { selected: false, reducedMotion: false }).getAttribute('aria-pressed')).toBe('false');
  });
});