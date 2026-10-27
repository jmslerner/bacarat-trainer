import { defineConfig } from '@playwright/test';

/** Point BT_BASE_URL at a running server (e.g. `vite --port 5181`) to skip the production build + preview. */
const baseURL = process.env.BT_BASE_URL ?? 'http://localhost:4173';

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  use: { baseURL, viewport: { width: 1440, height: 900 } },
  webServer: process.env.BT_BASE_URL
    ? undefined
    : {
        command: 'npm run build && npm run preview -- --port 4173 --strictPort',
        url: 'http://localhost:4173',
        reuseExistingServer: true,
        timeout: 180_000,
      },
});
