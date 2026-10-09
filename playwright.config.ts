import { defineConfig, devices } from '@playwright/test';

// Browser smoke tests against the production build (`npm run build` first;
// `npm run test:e2e` does both). Not 4173, Vite's own preview port, so a
// preview you already have open is never mistaken for this one.
const PORT = Number(process.env.E2E_PORT ?? 4317);
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  // A match on software WebGL (SwiftShader) runs a few frames a second, so a
  // test gets a minute; the waits inside it are on game state, not on time.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Each worker renders the arena on the CPU; two fill a CI runner.
  workers: process.env.CI ? 2 : 1,
  reporter: process.env.CI
    ? [['list'], ['github'], ['html', { open: 'never' }]]
    : [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    launchOptions: {
      // CI runners have no GPU: WebGL runs on SwiftShader, which Chromium
      // only allows behind these flags.
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    },
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } },
    },
    {
      // A phone-sized screen runs the flows tagged @phone.
      name: 'phone',
      grep: /@phone/,
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: {
    command: `npm run preview -- --port ${PORT} --strictPort --host 127.0.0.1`,
    url: `${BASE_URL}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
