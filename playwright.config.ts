import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', fullyParallel: false, workers: 1,
  use: { baseURL: 'http://localhost:3013', headless: true, trace: 'retain-on-failure' },
  webServer: { command: 'npm run start -- --port 3013', url: 'http://localhost:3013', reuseExistingServer: false, timeout: 30000 },
});
