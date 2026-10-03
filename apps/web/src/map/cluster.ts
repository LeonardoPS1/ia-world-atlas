import type { Cluster } from '../state/selectors.ts';

export function clusterAt(
  clusters: readonly Cluster[],
  x: number,
  y: number,
  radiusPx: number,
  projection: (cluster: Cluster) => [number, number],
): Cluster | null {
  let best: Cluster | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const cluster of clusters) {
    const [px, py] = projection(cluster);
    const distance = Math.hypot(px - x, py - y);
    if (distance > radiusPx) continue;
    if (distance < bestDistance || (distance === bestDistance && cluster.count > (best?.count ?? 0))) {
      best = cluster;
      bestDistance = distance;
    }
  }
  return best;
}