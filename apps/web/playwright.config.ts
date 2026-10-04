import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../..');

const WEB_PORT = 5173;
const API_PORT = 8787;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: process.env['CI'] === 'true',
  retries: process.env['CI'] === 'true' ? 1 : 0,
  reporter: process.env['CI'] === 'true' ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    trace: 'on-first-retry',
    launchOptions: {
      args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
        },
      },
    },
  ],
  webServer: [
    {
      command: 'npm run dev:e2e --workspace @atlas/api',
      cwd: REPO_ROOT,
      url: `http://127.0.0.1:${API_PORT}/api/health`,
      reuseExistingServer: !process.env['CI'],
      timeout: 120_000,
      env: {
        NODE_ENV: 'test',
        PORT: String(API_PORT),
        ATLAS_REPOS: 'memory',
        CORS_ORIGIN: `http://127.0.0.1:${WEB_PORT},http://localhost:${WEB_PORT}`,
        LOG_LEVEL: 'warn',
      },
    },
    {
      command: 'npm run dev --workspace @atlas/web -- --host 127.0.0.1',
      cwd: REPO_ROOT,
      url: `http://127.0.0.1:${WEB_PORT}`,
      reuseExistingServer: !process.env['CI'],
      timeout: 120_000,
      env: { VITE_API_BASE_URL: '/api' },
    },
  ],
});