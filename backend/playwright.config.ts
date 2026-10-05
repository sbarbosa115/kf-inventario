import {defineConfig, devices} from '@playwright/test';

/**
 * The smoke suite: the simple cases of docs/tests/ui-regression.md (a view opens, a create/edit/remove, an access
 * rule, a form's messages), run against this checkout's Docker stack before anything is checked by hand in a browser.
 *
 *   backend/e2e/smoke.sh            resets the stack to the fixtures and runs it (from the repository root)
 *   backend/e2e/smoke.sh orders     one spec file
 *
 * One worker, in file order: the specs share one database.
 */
export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/.results/artifacts',
  globalSetup: './e2e/support/globalSetup.ts',
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 30_000,
  expect: {timeout: 7_000},
  reporter: [
    ['list'],
    ['json', {outputFile: './e2e/.results/report.json'}],
    ['html', {outputFolder: './e2e/.results/html', open: 'never'}],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:8080',
    locale: 'en-US',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      // The app is used on desktops in the warehouse, often with a barcode scanner.
      name: 'desktop',
      use: {...devices['Desktop Chrome'], viewport: {width: 1280, height: 800}},
    },
  ],
});
