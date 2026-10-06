import fs from 'node:fs';
import path from 'node:path';
import {
  expect,
  type Browser,
  type BrowserContext,
  type Page,
} from '@playwright/test';
import {consoleErrors, sessionOf, prepareContext} from './test';

/**
 * "Does this screen look right?", asked the same way of every screen (docs/tests/ui-regression.md, section 14): at
 * 1440 px and on a phone (390 px, touch), in light and dark, in English and Spanish. The look is chosen the way a
 * person's browser remembers it (localStorage kf.theme and kf.locale), so each combination is one page load.
 */
export type Theme = 'light' | 'dark';
export type Locale = 'en' | 'es';

export interface Device {
  name: 'desktop' | 'phone';
  viewport: {width: number; height: number};
  isMobile: boolean;
}

export const DEVICES: Device[] = [
  {name: 'desktop', viewport: {width: 1440, height: 900}, isMobile: false},
  {name: 'phone', viewport: {width: 390, height: 844}, isMobile: true},
];

export const LOOKS: {theme: Theme; locale: Locale}[] = [
  {theme: 'light', locale: 'en'},
  {theme: 'dark', locale: 'en'},
  {theme: 'light', locale: 'es'},
  {theme: 'dark', locale: 'es'},
];

/** The catalogue's prefixes (one JSON file per prefix): a text such as `orders.title` is a key nobody translated. */
const PREFIXES = fs
  .readdirSync(path.join(process.cwd(), 'assets/react/shared/i18n/locales/en'))
  .filter((file) => file.endsWith('.json'))
  .map((file) => file.replace(/\.json$/, ''));
// Not inside a longer word, path or address: "libcurl-errors.html" in a shop's error message is not a key.
const RAW_KEY = new RegExp(
  `(?<![\\w./@-])(?:${PREFIXES.join('|')})\\.[A-Za-z_]\\w*(?:\\.\\w+)*`,
);
/** A {{param}} the translator was not given. */
const RAW_PARAM = /\{\{\s*\w+\s*\}\}/;

/** The smallest target a finger is given on a phone (docs/design/README.md, `--kf-target`). */
const TARGET = 44;

/**
 * A browser for one device and look, signed in as `username` (or signed out with null), the choice already in its
 * storage so the first page loads with it.
 */
export async function lookContext(
  browser: Browser,
  baseURL: string,
  username: string | null,
  device: Device,
  look: {theme: Theme; locale: Locale},
): Promise<BrowserContext> {
  const signedIn = username
    ? (JSON.parse(
        fs.readFileSync(await sessionOf(browser, baseURL, username), 'utf8'),
      ) as {cookies: []})
    : {cookies: []};
  const context = await browser.newContext({
    baseURL,
    viewport: device.viewport,
    isMobile: device.isMobile,
    hasTouch: device.isMobile,
    locale: 'en-US',
    storageState: {
      cookies: signedIn.cookies,
      origins: [
        {
          origin: new URL(baseURL).origin,
          localStorage: [
            {name: 'kf.theme', value: look.theme},
            {name: 'kf.locale', value: look.locale},
          ],
        },
      ],
    },
  });
  await prepareContext(context);
  return context;
}

/** What is wrong with the page as it is now: the list is empty when it looks right. */
async function problems(page: Page, device: Device): Promise<string[]> {
  return page.evaluate(
    ({rawKey, rawParam, phone, target}) => {
      const found: string[] = [];
      const doc = document.documentElement;
      if (doc.scrollWidth > doc.clientWidth) {
        found.push(
          `scrolls sideways: ${doc.scrollWidth} px wide in ${doc.clientWidth}`,
        );
      }

      // What a person reads, and what a screen reader says.
      const texts = [document.body.innerText];
      for (const el of document.querySelectorAll(
        '[aria-label], [placeholder], [title], [alt]',
      )) {
        for (const name of ['aria-label', 'placeholder', 'title', 'alt']) {
          const value = el.getAttribute(name);
          if (value) texts.push(value);
        }
      }
      for (const text of texts) {
        const key = text.match(new RegExp(rawKey));
        if (key) found.push(`raw translation key: ${key[0]}`);
        const param = text.match(new RegExp(rawParam));
        if (param) found.push(`placeholder left in a text: ${param[0]}`);
      }

      if (phone) {
        const describe = (el: Element) => {
          const label =
            el.getAttribute('aria-label') ||
            (el as HTMLElement).innerText?.trim().slice(0, 30) ||
            el.getAttribute('name') ||
            el.getAttribute('title') ||
            '';
          return `<${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}> "${label}"`;
        };
        for (const el of document.querySelectorAll(
          'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="checkbox"], [role="radio"], [role="switch"], [role="tab"], [role="menuitem"], [role="option"]',
        )) {
          // A visually hidden checkbox, radio or switch is hit through its label: the label is the target.
          let hit: Element = el;
          if (
            el instanceof HTMLInputElement &&
            ['checkbox', 'radio'].includes(el.type)
          ) {
            hit =
              el.closest('label') ??
              (el.id
                ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`)
                : null) ??
              el;
          }
          // A searchable select's text input grows with what is typed: the finger hits the whole control.
          hit = hit.closest('.kf-select__control') ?? hit;
          const box = hit.getBoundingClientRect();
          // Not rendered (display: none, a closed panel) or visually hidden: nothing to tap.
          if (box.width < 2 || box.height < 2) continue;
          if (hit.closest('[aria-hidden="true"], [inert]')) continue;
          if (getComputedStyle(hit).visibility === 'hidden') continue;
          // Off the page until the keyboard focuses it (the "Skip to content" link): not a touch target.
          if (box.bottom + window.scrollY <= 0 || box.right <= 0) continue;
          // Inside a clipped, screen-reader-only part (a phone's table header, read but not shown).
          let clipped = false;
          for (
            let up = hit.parentElement;
            up && up !== document.body;
            up = up.parentElement
          ) {
            const style = getComputedStyle(up);
            const size = up.getBoundingClientRect();
            if (
              (style.clip !== 'auto' && style.clip !== '') ||
              (style.overflow === 'hidden' &&
                (size.width <= 1 || size.height <= 1))
            ) {
              clipped = true;
              break;
            }
          }
          if (clipped) continue;
          // A link or link-styled button inside a sentence is as tall as the sentence (WCAG 2.5.8 leaves such inline
          // targets out): the order form's "7 things missing: last name, email, …".
          if (
            ['A', 'BUTTON'].includes(hit.tagName) &&
            getComputedStyle(hit).display.startsWith('inline') &&
            (hit.parentElement?.innerText.trim().length ?? 0) >
              ((hit as HTMLElement).innerText.trim().length ?? 0) + 2 &&
            getComputedStyle(hit.parentElement as Element).display === 'block'
          ) {
            continue;
          }
          if (box.height < target - 0.5 || box.width < target - 0.5) {
            found.push(
              `target under ${target} px: ${describe(hit)} ${Math.round(box.width)}×${Math.round(box.height)}`,
            );
          }
        }
      }
      return [...new Set(found)];
    },
    {
      rawKey: RAW_KEY.source,
      rawParam: RAW_PARAM.source,
      phone: device.isMobile,
      target: TARGET,
    },
  );
}

export interface Screen {
  /** How the failure names it. */
  name: string;
  /** The address to open. */
  path: string | ((page: Page) => Promise<string>);
  /** After the page loaded: what to wait for, or what to open (a slide-over). Default: the page's h1. */
  ready?: (page: Page) => Promise<void>;
}

/**
 * The page is measured once it has settled: nothing is loading (a skeleton, a busy table) and no animation is
 * running (a slide-over opening, a toast arriving).
 */
export async function settled(page: Page): Promise<void> {
  // Checked on every frame, not on the assertions' back-off: a list that arrives in 200 ms is measured then.
  await page.waitForFunction(
    () =>
      !document.querySelector('.kf-skeleton, .kf-table-wrap[aria-busy="true"]'),
    undefined,
    {polling: 'raf'},
  );
  await page.evaluate(async () => {
    // The fonts decide the widths that are measured.
    await document.fonts.ready;
    await Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    );
  });
}

/** Waits for the screen's title: its h1, which every screen of the app has. */
export async function h1Shown(page: Page): Promise<void> {
  await page.waitForFunction(
    () => (document.querySelector('h1')?.textContent ?? '').trim() !== '',
    undefined,
    {polling: 'raf'},
  );
  await expect(page.getByRole('heading', {level: 1})).toBeVisible();
}

/**
 * Changes the look the way a person does, in the top bar: the theme menu and the language switch (no reload). The
 * sign-in page has no theme menu: there the look is stored and the page reloaded.
 */
async function switchLook(
  page: Page,
  look: {theme: Theme; locale: Locale},
): Promise<void> {
  const html = page.locator('html');
  const themeMenu = page.getByRole('button', {name: /^(Theme|Tema): /});
  if ((await themeMenu.count()) === 0) {
    await page.evaluate(({theme, locale}) => {
      localStorage.setItem('kf.theme', theme);
      localStorage.setItem('kf.locale', locale);
    }, look);
    await page.reload({waitUntil: 'commit'});
    return;
  }
  if ((await html.getAttribute('data-theme')) !== look.theme) {
    await themeMenu.click();
    await page
      .getByRole('menuitemradio', {
        name: look.theme === 'dark' ? /^(Dark|Oscuro)$/ : /^(Light|Claro)$/,
      })
      .click();
  }
  if ((await html.getAttribute('lang')) !== look.locale) {
    await page
      .getByRole('radio', {name: look.locale === 'es' ? 'Español' : 'English'})
      .click();
  }
}

/** Closes what is open over the page (a slide-over, a menu), as Escape does. */
async function closeOverlays(page: Page): Promise<void> {
  for (let i = 0; i < 3 && (await page.getByRole('dialog').count()) > 0; i++) {
    await page.keyboard.press('Escape');
  }
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

/**
 * Opens each screen once per device and checks it in every look: the title shown, no sideways scroll, no raw key or
 * {{param}}, no console error, the theme and language applied, and on a phone every target at least 44 px. Every
 * problem of every combination is collected, so one run names them all. A screen is loaded once per device, in
 * light and English, then switched to dark, Spanish and light again from the top bar.
 */
export async function checkScreens(
  browser: Browser,
  baseURL: string,
  username: string | null,
  screens: Screen[],
): Promise<void> {
  const found: string[] = [];
  const onDevice = async (device: Device) => {
    const context = await lookContext(
      browser,
      baseURL,
      username,
      device,
      LOOKS[0]!,
    );
    const page = await context.newPage();
    try {
      for (const screen of screens) {
        if (page.url().startsWith('http')) {
          await page.evaluate(({theme, locale}) => {
            localStorage.setItem('kf.theme', theme);
            localStorage.setItem('kf.locale', locale);
          }, LOOKS[0]!);
        }
        const address =
          typeof screen.path === 'string'
            ? screen.path
            : await screen.path(page);
        // The screen's own title says it is up (the app's script has run): no need to wait for every font and image.
        await page.goto(address, {waitUntil: 'commit'});
        for (const look of LOOKS) {
          const where = `${screen.name} · ${device.name} · ${look.theme} · ${look.locale}`;
          const errors = consoleErrors(page);
          if (look !== LOOKS[0]) {
            await closeOverlays(page);
            await switchLook(page, look);
          }
          await (screen.ready ?? h1Shown)(page);
          await expect(page.locator('html')).toHaveAttribute(
            'data-theme',
            look.theme,
          );
          await expect(page.locator('html')).toHaveAttribute(
            'lang',
            look.locale,
          );
          await settled(page);
          for (const problem of await problems(page, device)) {
            found.push(`${where}: ${problem}`);
          }
          for (const error of errors) {
            found.push(`${where}: console error: ${error}`);
          }
          page.removeAllListeners('console');
          page.removeAllListeners('pageerror');
        }
      }
    } finally {
      await context.close();
    }
  };
  // One device after the other: the other two lanes share the stack meanwhile.
  for (const device of DEVICES) {
    await onDevice(device);
  }
  expect(found, 'every screen looks right').toEqual([]);
}
