import { defineConfig } from 'vitest/config';
import { sharedTestConfig } from '../../vitest.shared';

export default defineConfig({
  test: {
    ...sharedTestConfig.test,
    name: 'web',
    environment: 'jsdom',
    setupFiles: ['./src/testing/setup.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**', 'src/map/globe.test.ts', 'src/map/fallback.test.ts'],
  },
});
