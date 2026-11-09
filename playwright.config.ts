import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  workers: 1,
  use: { baseURL: 'http://localhost:5273' },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
      },
    },
  ],
  webServer: {
    // Seeds local R2 (needs ffmpeg), then starts the real Worker + SPA dev server.
    command: 'pnpm seed && pnpm dev --port 5273 --strictPort',
    url: 'http://localhost:5273/robots.txt',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
