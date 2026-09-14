import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: '**/*.spec.ts', fullyParallel: false, workers: 1,
  use: { baseURL: 'http://localhost:3013', headless: true, serviceWorkers: 'block', trace: 'retain-on-failure' },
  webServer: { command: 'npm run start -- --port 3013', url: 'http://localhost:3013', reuseExistingServer: false, timeout: 30000 },
});
