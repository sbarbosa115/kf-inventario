import fs from 'node:fs';
import {
  expect,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from '@playwright/test';
import {prepareContext, sessionOf} from './test';

/**
 * Operating the app on a phone (docs/tests/ui-regression.md, section 15): a touch screen held upright, 390 × 844 (and
 * 360 × 740 where the height decides), fingers only (`tap()`, never a hover), each role in one browser kept for the
 * whole spec.
 */
export const PHONE = {width: 390, height: 844};
export const SMALL_PHONE = {width: 360, height: 740};

export interface PhoneSession {
  page: Page;
  /** Console errors and page errors since the last `fresh()`. */
  errors: string[];
}

const open: BrowserContext[] = [];
const sessions = new Map<string, PhoneSession>();

/**
 * One phone per username and language, signed in once (the session cookie of support/test.ts), light theme. A spec
 * reuses it from test to test; `closePhones()` in its afterAll closes them.
 */
export async function phoneAs(
  browser: Browser,
  baseURL: string,
  username: string,
  locale: 'en' | 'es' = 'en',
): Promise<PhoneSession> {
  const key = `${username}:${locale}`;
  const known = sessions.get(key);
  if (known) {
    known.errors.length = 0;
    await known.page.setViewportSize(PHONE);
    return known;
  }
  const signedIn = JSON.parse(
    fs.readFileSync(await sessionOf(browser, baseURL, username), 'utf8'),
  ) as {cookies: []};
  const context = await browser.newContext({
    baseURL,
    viewport: PHONE,
    isMobile: true,
    hasTouch: true,
    locale: 'en-US',
    storageState: {
      cookies: signedIn.cookies,
      origins: [
        {
          origin: new URL(baseURL).origin,
          localStorage: [
            {name: 'kf.theme', value: 'light'},
            {name: 'kf.locale', value: locale},
          ],
        },
      ],
    },
  });
  open.push(context);
  await prepareContext(context);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    // The browser logs every 4xx/5xx answer. Two are answers the page shows in words: a scanned code that is not a
    // product (404 from the lookup), and an outside service that failed (502 from Send test email or Check now).
    const url = message.location().url;
    const shown =
      message.text().startsWith('Failed to load resource') &&
      (url.includes('/api/v1/products/by-code/') ||
        url.endsWith('/api/v1/settings/email/test') ||
        url.endsWith('/api/v1/orders/sync'));
    if (!shown) errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  const session = {page, errors};
  sessions.set(key, session);
  return session;
}

export async function closePhones(): Promise<void> {
  await Promise.all(open.map((context) => context.close()));
  open.length = 0;
  sessions.clear();
}

/** Opens an address and waits for its title (h1). */
export async function visit(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page.getByRole('heading', {level: 1})).toBeVisible();
}

/**
 * Where a finger lands on the element as the page is now, without scrolling: "ok" when the element (or its label) is
 * what the tap hits, inside the screen; otherwise what is wrong (outside the screen, covered by the tab bar…).
 */
async function hitOf(locator: Locator): Promise<string> {
  return locator.evaluate((el) => {
    const box = el.getBoundingClientRect();
    if (box.width < 1 || box.height < 1) return 'not shown';
    const {innerWidth: width, innerHeight: height} = window;
    if (
      box.left < -0.5 ||
      box.top < -0.5 ||
      box.right > width + 0.5 ||
      box.bottom > height + 0.5
    ) {
      return `outside the screen (${Math.round(box.left)},${Math.round(box.top)} – ${Math.round(box.right)},${Math.round(box.bottom)} of ${width}×${height})`;
    }
    const hit = document.elementFromPoint(
      box.left + box.width / 2,
      box.top + box.height / 2,
    );
    const label = el.closest('label');
    if (hit && (el.contains(hit) || hit.contains(el) || label?.contains(hit))) {
      return 'ok';
    }
    const name = (node: Element | null) =>
      node
        ? `${node.tagName.toLowerCase()}.${String(node.className).split(' ')[0]}`
        : 'nothing';
    return `covered by ${name(hit)}`;
  });
}

/** The element is on the screen now and nothing covers it: a finger can tap it without scrolling first. */
export async function expectInSight(
  locator: Locator,
  what: string,
): Promise<void> {
  await expect
    .poll(() => hitOf(locator), {message: `${what} is in sight`})
    .toBe('ok');
}

/** The element can be scrolled to and then tapped: brought to the middle of the screen, nothing covers it. */
export async function expectReachable(
  locator: Locator,
  what: string,
): Promise<void> {
  await locator.evaluate((el) =>
    el.scrollIntoView({block: 'center', inline: 'nearest'}),
  );
  await expectInSight(locator, what);
}

/** The page is no wider than the phone. */
export async function expectNoSidewaysScroll(page: Page): Promise<void> {
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    ),
    'the page does not scroll sideways',
  ).toBeLessThanOrEqual(0);
}

/**
 * Every button, link and field of the scope that is shown lies inside the screen's width (none cut off at the right
 * edge, as a long Spanish label could push it).
 */
export async function expectNoneCutOff(scope: Locator, what: string) {
  const cut = await scope.evaluate((root) =>
    [
      ...root.querySelectorAll(
        'a[href], button, input:not([type="hidden"]), select, textarea, [role="tab"]',
      ),
    ]
      .map((el) => ({el, box: el.getBoundingClientRect()}))
      .filter(({box}) => box.width > 1 && box.height > 1)
      .filter(({box}) => box.left < -0.5 || box.right > window.innerWidth + 0.5)
      .map(
        ({el, box}) =>
          `${(el as HTMLElement).innerText?.trim() || el.getAttribute('aria-label')} (${Math.round(box.left)}–${Math.round(box.right)})`,
      ),
  );
  expect(cut, `${what}: nothing cut off at the edges`).toEqual([]);
}
