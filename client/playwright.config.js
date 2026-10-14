// End-to-end tests: real browser + real backend + real PostgreSQL.
// Needs DATABASE_URL (a disposable database, migrated) and JWT_SECRET in the environment.
// Run: npm run test:e2e --workspace client
import { defineConfig, devices } from '@playwright/test';

const API_PORT = 5055;
const WEB_PORT = 4173;
const API_URL = `http://127.0.0.1:${API_PORT}/api`;

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.js',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node ../server/src/index.js',
      url: `${API_URL}/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        PORT: String(API_PORT),
        NODE_ENV: 'test',
        TRUST_PROXY: '0',
        CLIENT_URL: `http://127.0.0.1:${WEB_PORT}`,
        DATABASE_URL: process.env.DATABASE_URL || '',
        JWT_SECRET: process.env.JWT_SECRET || ''
      }
    },
    {
      // Production build served by `vite preview`, pointed at the test API.
      command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${WEB_PORT} --strictPort`,
      url: `http://127.0.0.1:${WEB_PORT}/login`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { VITE_API_URL: API_URL }
    }
  ]
});
