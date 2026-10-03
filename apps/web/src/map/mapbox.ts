import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

/**
 * The Mapbox GL `Map` constructor, plus the library stylesheet.
 *
 * `mapbox-gl` exports a namespace object, so the class is `mapboxgl.Map` — not
 * `mapboxgl` itself. Keeping the real constructor behind this module means the
 * rest of the application never depends on how the library is loaded, and the
 * loading itself is covered by a test. The globe adapter receives this value
 * through its `mapbox` option; without it the adapter falls back with
 * "mapboxgl is not loaded".
 */
export const MapboxMap = mapboxgl.Map;
