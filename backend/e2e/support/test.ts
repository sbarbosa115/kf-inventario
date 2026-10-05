import fs from 'node:fs';
import path from 'node:path';
import {
  test as base,
  expect,
  type Browser,
  type BrowserContext,
  type Page,
} from '@playwright/test';

export {expect};

/** The accounts of a smoke run (src/DataFixtures/UserFixtures.php; docs/tests/ui-regression.md, "Accounts"). */
export const ADMIN = 'sbarbosa115';
export const INVENTORY = 'inventory';
export const INVOICES = 'invoices';
export const PASSWORD = '123456';

const AUTH_DIR = path.join(process.cwd(), 'e2e', '.results', 'auth');

/** Signs a username in through the API once per run and keeps the session cookie for every test that needs it. */
async function sessionOf(
  browser: Browser,
  baseURL: string,
  username: string,
): Promise<string> {
  const file = path.join(AUTH_DIR, `${username}.json`);
  if (fs.existsSync(file)) {
    return file;
  }
  const context = await browser.newContext({baseURL});
  const answer = await context.request.post('/api/v1/auth/login', {
    data: {username, password: PASSWORD},
    headers: {Origin: new URL(baseURL).origin},
  });
  expect(answer.status(), `signing ${username} in`).toBe(200);
  fs.mkdirSync(AUTH_DIR, {recursive: true});
  await context.storageState({path: file});
  await context.close();
  return file;
}

interface Fixtures {
  /** A page signed in as this username. */
  signedInAs: (username: string) => Promise<Page>;
}

export const test = base.extend<Fixtures>({
  signedInAs: async ({browser, baseURL, viewport, locale}, provide) => {
    const contexts: BrowserContext[] = [];
    await provide(async (username) => {
      const storageState = await sessionOf(
        browser,
        baseURL as string,
        username,
      );
      const context = await browser.newContext({
        baseURL,
        viewport,
        locale,
        storageState,
      });
      contexts.push(context);
      return context.newPage();
    });
    await Promise.all(contexts.map((c) => c.close()));
  },
});

/** A page's console errors, collected from now on: `expect(errors).toEqual([])` at the end of a view's test. */
export function consoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    // Signed out, the app's first question (GET /api/v1/auth/me) is answered 401 on purpose, and the browser logs
    // every 4xx resource; that one is not an error of the page.
    const signInProbe =
      message.text().includes('status of 401') &&
      message.location().url.endsWith('/api/v1/auth/me');
    if (message.type() === 'error' && !signInProbe) {
      errors.push(message.text());
    }
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}
