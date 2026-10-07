import {defineConfig, devices} from '@playwright/test';

/**
 * The smoke suite: the regression baseline, every case of docs/tests/ui-regression.md, run against this checkout's
 * Docker stack.
 *
 *   backend/e2e/smoke.sh            resets the stack to the fixtures and runs it (from the repository root)
 *   backend/e2e/smoke.sh orders     one spec file
 *
 * The specs share one database. They run in lanes, each lane one worker in file order, so the specs of a lane may
 * build on each other's data, and no lane counts or changes what another lane changes:
 *
 *   1. side by side: orders and stock; the lists; the screens (which only read);
 *   2. then, alone: the shops, the comments, the settings and the webhook. Their requests to the fake shop are served
 *      by the stack's own PHP, which the first three lanes keep busy (a pull would time out waiting for it), and the
 *      settings switch the SMTP server the other lanes' emails go through;
 *   3. last, alone: the phone (every role's jobs with a finger), which moves stock, places orders and changes Settings.
 */
const desktop = {
  ...devices['Desktop Chrome'],
  // The app is used on desktops in the warehouse, often with a barcode scanner.
  viewport: {width: 1280, height: 800},
};

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/.results/artifacts',
  globalSetup: './e2e/support/globalSetup.ts',
  workers: 3,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  // A dev build (debug, profiler) on two PHP CPUs shared by the lanes: under load a list can take several seconds to
  // answer. The waits are conditions, so a generous ceiling costs nothing when the stack is quick.
  timeout: 60_000,
  expect: {timeout: 15_000},
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
      // Orders placed, edited, shipped and emailed; stock moved, scanned and uploaded; the warehouses.
      name: 'orders-stock',
      testMatch: /\/(order-forms|orders|products|stock)\.spec\.ts$/,
      workers: 1,
      use: desktop,
    },
    {
      // Sign-in and the shell, the lists and their filters, customers, invoices, users.
      name: 'lists',
      testMatch:
        /\/(auth|customers|design-system|filters|invoices|users)\.spec\.ts$/,
      workers: 1,
      use: desktop,
    },
    {
      // Every screen at 1440 and 390 px, light and dark, English and Spanish.
      name: 'screens',
      testMatch: /\/screens\.spec\.ts$/,
      workers: 1,
      use: desktop,
    },
    {
      // The shops (the fake shop, Check now, the write-back), the comment timeline, Settings, the webhook.
      name: 'shops-settings',
      testMatch: /\/(comments|orders-sync|settings|shops|webhook)\.spec\.ts$/,
      dependencies: ['orders-stock', 'lists', 'screens'],
      workers: 1,
      use: desktop,
    },
    {
      // Operating every page on a phone with a finger (390 × 844, touch; some cases also at 360 × 740).
      name: 'mobile',
      testMatch: /\/mobile\.spec\.ts$/,
      dependencies: ['shops-settings'],
      workers: 1,
      use: {
        ...devices['Desktop Chrome'],
        viewport: {width: 390, height: 844},
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
