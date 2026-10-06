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
/** Invoices and the products to put on them (the invoice form lists a warehouse's stock: ROLE_MANAGE_INVENTORY). */
export const SALES = 'sales';
export const PASSWORD = '123456';

const AUTH_DIR = path.join(process.cwd(), 'e2e', '.results', 'auth');

/** Signs a username in through the API once per run and keeps the session cookie for every test that needs it. */
export async function sessionOf(
  browser: Browser,
  baseURL: string,
  username: string,
  password = PASSWORD,
): Promise<string> {
  const file = path.join(AUTH_DIR, `${username}.json`);
  if (fs.existsSync(file)) {
    return file;
  }
  const context = await browser.newContext({baseURL});
  const answer = await context.request.post('/api/v1/auth/login', {
    data: {username, password},
    headers: {Origin: new URL(baseURL).origin},
  });
  expect(answer.status(), `signing ${username} in`).toBe(200);
  fs.mkdirSync(AUTH_DIR, {recursive: true});
  // The lanes run side by side: written aside, then renamed, so no lane reads a half-written file.
  const draft = `${file}.${process.pid}.${Date.now()}`;
  await context.storageState({path: draft});
  fs.renameSync(draft, file);
  await context.close();
  return file;
}

/**
 * Every browser of a run: the smoke stack is a dev build, and Symfony's debug toolbar sits over the bottom of the page
 * (dialog footers, the phone tab bar) and its panels hold texts such as ROLE_ADMIN. Production has no toolbar, so
 * every page goes without it.
 */
export async function prepareContext(context: BrowserContext): Promise<void> {
  // Analytics IDs saved in Settings (SET-06, in another lane) make every page load two outside scripts: answered
  // empty here, so no page waits for or fails on the outside world.
  await context.route(/googletagmanager\.com|clarity\.ms/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: '',
    }),
  );
  await context.addInitScript(() => {
    const strip = () =>
      document
        .querySelectorAll('.sf-toolbar, [id^="sfwdt"], [id^="sfMiniToolbar"]')
        .forEach((node) => node.remove());
    new MutationObserver(strip).observe(document, {
      childList: true,
      subtree: true,
    });
  });
}

interface Fixtures {
  /** A page signed in as this username (with the fixtures' password unless another is given). */
  signedInAs: (username: string, password?: string) => Promise<Page>;
}

export const test = base.extend<Fixtures>({
  context: async ({context}, provide) => {
    await prepareContext(context);
    await provide(context);
  },
  signedInAs: async (
    {browser, baseURL, viewport, locale, isMobile, hasTouch},
    provide,
  ) => {
    const contexts: BrowserContext[] = [];
    await provide(async (username, password) => {
      const storageState = await sessionOf(
        browser,
        baseURL as string,
        username,
        password,
      );
      const context = await browser.newContext({
        baseURL,
        viewport,
        locale,
        isMobile,
        hasTouch,
        storageState,
      });
      contexts.push(context);
      await prepareContext(context);
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

/** An account a spec needs beyond the fixtures, created once through the API by a signed-in admin. */
export interface SmokeUser {
  name: string;
  username: string;
  email: string;
  roles: string[];
}

export async function ensureUser(
  admin: Page,
  baseURL: string,
  user: SmokeUser,
): Promise<void> {
  const users = (
    (await (await admin.request.get('/api/v1/users?per_page=100')).json()) as {
      items: {username: string}[];
    }
  ).items;
  if (users.some((known) => known.username === user.username)) return;
  const created = await admin.request.post('/api/v1/users', {
    data: {...user, password: PASSWORD, enabled: true},
    headers: {Origin: new URL(baseURL).origin},
  });
  expect(created.status(), `creating ${user.username}`).toBe(201);
}
