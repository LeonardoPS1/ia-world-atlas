import { describe, expect, it } from 'vitest';
import { clusterAt } from './cluster.ts';
import type { Cluster } from '../state/selectors.ts';

function cluster(id: string, x: number, y: number, count = 1): Cluster {
  return {
    id,
    locationId: id,
    level: 'CITY',
    lat: 0,
    lng: 0,
    count,
    shape: 'diamond',
    size: 10,
    color: '#4b8cff',
  };
}

const identity = (c: Cluster): [number, number] => [Number(c.id.replace('c', '')), 0];

describe('clusterAt', () => {
  it('returns the cluster under the pointer', () => {
    const clusters = [cluster('c1', 10, 0), cluster('c2', 200, 0)];
    expect(clusterAt(clusters, 0, 0, 12, identity)?.id).toBe('c1');
  });

  it('returns null when the pointer is outside every radius', () => {
    const clusters = [cluster('c1', 10, 0), cluster('c2', 200, 0)];
    // Pointer at (100, 0) - both clusters at x=1 and x=2 are far outside radius 12
    expect(clusterAt(clusters, 100, 0, 12, identity)).toBeNull();
  });

  it('prefers the densest cluster when two overlap at same distance', () => {
    const clusters = [cluster('c1', 10, 0, 1), cluster('c2', 11, 0, 9)];
    // Both clusters at distance 10 from pointer (at x=10, c1 at x=1, c2 at x=2... wait)
    // Use pointer at x=1.5 so both are at distance 0.5
    // Actually identity returns 1 and 2, so use pointer at 1.5
    expect(clusterAt(clusters, 1.5, 0, 20, identity)?.id).toBe('c2');
  });

  it('is safe with no clusters', () => {
    expect(clusterAt([], 0, 0, 10, identity)).toBeNull();
  });
});