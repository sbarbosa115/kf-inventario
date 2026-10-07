import {createHmac} from 'node:crypto';
import type {Locator, Page} from '@playwright/test';
import {
  PHONE,
  SMALL_PHONE,
  closePhones,
  expectInSight,
  expectNoSidewaysScroll,
  expectNoneCutOff,
  expectReachable,
  phoneAs,
  visit,
} from './support/phone';
import {FAKE_SHOP_HOOK, FAKE_SHOP_WEBHOOK_SECRET} from './support/shop';
import {
  ADMIN,
  INVENTORY,
  INVOICES,
  PASSWORD,
  SALES,
  expect,
  prepareContext,
  test,
} from './support/test';

/**
 * 15 On a phone (docs/tests/ui-regression.md, MOB-01 – 20): each role's real jobs carried out with a finger on a
 * 390 × 844 touch screen (360 × 740 where the height decides), every page it can reach. Not how the screens look (the
 * sweep of section 14 does that) but whether each step can be done: nothing needed hidden under the tab bar, an action
 * bar or a toast, nothing cut off, no dialog or menu that cannot be scrolled or picked from.
 *
 * The lane runs last and alone (playwright.config.ts): it places orders, moves and scans stock, and changes Settings.
 * Its own records are named "Mob …" (product SMOKE-MOB-01 in España, its own order, customer, invoice and user).
 */
test.describe.configure({mode: 'serial'});

const RUN = Date.now();
const PRODUCT = 'SMOKE-MOB-01';
const DETAIL =
  'Front lip spoiler, matte black, fits the 2016 – 2021 models with the factory bumper and its clips';
const ESPANA = 3;

let orderCode = '';

test.afterAll(closePhones);

/** The phone of a role, its errors cleared. */
async function phone(
  {
    browser,
    baseURL,
  }: {browser: import('@playwright/test').Browser; baseURL?: string},
  username: string,
  locale: 'en' | 'es' = 'en',
) {
  return phoneAs(browser, baseURL as string, username, locale);
}

const origin = (page: Page) => ({
  Origin: new URL(page.url() || 'http://nginx').origin,
});

/** A toast (or any message said aloud: a status, or an alert for an error), by what it says. */
const anyMessage = (page: Page) =>
  page.getByRole('status').or(page.getByRole('alert'));
const toast = (page: Page, text: string | RegExp) =>
  anyMessage(page).filter({hasText: text});

/** Taps × on every toast shown, so the next step starts with a clear screen. */
async function dismissToasts(page: Page) {
  for (const close of await anyMessage(page)
    .getByRole('button', {name: 'Dismiss'})
    .all()) {
    await close.tap().catch(() => undefined);
  }
}

/** The bottom tab bar. */
const tabs = (page: Page) => page.getByRole('navigation', {name: 'Shortcuts'});

/** A card's code cell: on a phone its name starts with its label ("Code KF-01"). */
const codeCell = (page: Page, code: string) =>
  page.getByRole('cell', {name: new RegExp(`(^|\\s)${code}$`)});

/** A product card of the list, by its code. */
const card = (page: Page, code: string) =>
  page.getByRole('row').filter({has: codeCell(page, code)});

/** Picks an option of a react-select by touch: the control, then the option. */
async function pick(page: Page, control: Locator, option: string | RegExp) {
  await control.tap();
  const choice = page.getByRole('option', {name: option}).first();
  await expect(choice).toBeVisible();
  await expectInSight(choice, `the option ${option}`);
  await choice.tap();
}

test.describe('15 On a phone', () => {
  test.beforeAll(async ({browser, baseURL}) => {
    // The lane's product: a long detail, five units in España.
    const {page} = await phoneAs(browser, baseURL as string, ADMIN);
    await page.goto('/admin/products');
    const headers = origin(page);
    const found = await page.request.get(`/api/v1/products/by-code/${PRODUCT}`);
    if (found.status() === 404) {
      const created = await page.request.post('/api/v1/products', {
        headers,
        data: {
          code: PRODUCT,
          title: 'Mob lip spoiler',
          detail: DETAIL,
          status: 1,
          price: 40,
        },
      });
      expect(created.status(), 'the lane product').toBe(201);
    }
    const added = await page.request.post(
      `/api/v1/warehouses/${ESPANA}/stock/add`,
      {
        headers,
        data: {items: [{code: PRODUCT, quantity: 5}]},
      },
    );
    expect(added.status(), 'its stock in España').toBe(204);
  });

  test('MOB-01 · The shell with a finger: sign in, tab bar, More, the top bar, back and sign out', async ({
    browser,
    baseURL,
  }) => {
    // Its own browser: signing out ends this session only, not the one the other cases share.
    const context = await browser.newContext({
      baseURL,
      viewport: PHONE,
      isMobile: true,
      hasTouch: true,
      locale: 'en-US',
    });
    await prepareContext(context);
    const page = await context.newPage();
    try {
      await page.goto('/admin/login');
      await page.getByLabel('Username').tap();
      await page.getByLabel('Username').fill(ADMIN);
      await page.getByLabel('Password', {exact: true}).fill(PASSWORD);
      await expectInSight(
        page.getByRole('button', {name: 'Sign in'}),
        'Sign in',
      );
      await page.getByRole('button', {name: 'Sign in'}).tap();
      await expect(
        page.getByRole('heading', {level: 1, name: 'Products'}),
      ).toBeVisible();
      await expect(page).toHaveTitle(/^Products · KF Inventory$/);

      // The top bar: no title squeezed to a letter beside its buttons (the page's h1 names the page).
      const bar = page.getByRole('banner');
      for (const name of [
        'Menu',
        'Open the reader',
        /^Theme: /,
        'Sergio Barbosa',
      ]) {
        await expectInSight(
          bar.getByRole('button', {name}).or(bar.getByRole('link', {name})),
          String(name),
        );
      }
      expect(
        await page.locator('.kf-topbar__title').evaluate((el) => {
          const shown = getComputedStyle(el).display !== 'none';
          return !shown || el.scrollWidth <= el.clientWidth;
        }),
        'the top bar title is shown whole or not at all',
      ).toBe(true);

      // The tab bar takes the finger to each section; More opens the whole menu, and it closes again.
      await tabs(page).getByRole('link', {name: 'Incoming', exact: true}).tap();
      await expect(
        page.getByRole('heading', {level: 1, name: 'Incoming'}),
      ).toBeVisible();
      await tabs(page).getByRole('button', {name: 'More', exact: true}).tap();
      const drawer = page.getByRole('dialog', {name: 'Main menu'});
      for (const name of [
        'Products',
        'Upload a stock sheet',
        'Scan',
        'Incoming',
        'Warehouses',
        'Orders',
        'Customers',
        'Users',
        'Settings',
      ]) {
        await expectReachable(
          drawer.getByRole('link', {name, exact: true}),
          `More › ${name}`,
        );
      }
      await drawer.getByRole('link', {name: 'Orders', exact: true}).tap();
      await expect(
        page.getByRole('heading', {level: 1, name: 'Orders'}),
      ).toBeVisible();
      await expect(drawer).toBeHidden();
      await page.getByRole('button', {name: 'Menu'}).tap();
      await page.getByRole('button', {name: 'Close the menu'}).tap();
      await expect(drawer).toBeHidden();

      // Language, theme, account: each menu opens under the finger and every choice in it can be tapped.
      await bar.getByRole('radio', {name: 'Español'}).tap();
      await expect(
        page.getByRole('heading', {level: 1, name: 'Pedidos'}),
      ).toBeVisible();
      await bar.getByRole('radio', {name: 'English'}).tap();
      await bar.getByRole('button', {name: /^Theme: /}).tap();
      await expectInSight(
        page.getByRole('menuitemradio', {name: 'Dark'}),
        'Dark',
      );
      await page.getByRole('menuitemradio', {name: 'Dark'}).tap();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      await bar.getByRole('button', {name: /^Theme/}).tap();
      await page.getByRole('menuitemradio', {name: 'Light'}).tap();

      // Back: the page's own link and the browser's.
      await page.goto('/admin/orders/new');
      await page.getByRole('link', {name: 'Back'}).tap();
      await expect(page).toHaveURL(/\/admin\/orders$/);
      await page.goBack();
      await expect(page).toHaveURL(/\/admin\/orders\/new$/);

      await bar.getByRole('button', {name: 'Sergio Barbosa'}).tap();
      const signOut = page.getByRole('menuitem', {name: 'Sign out'});
      await expectInSight(signOut, 'Sign out');
      await signOut.tap();
      await expect(page).toHaveURL(/\/admin\/login/);
      await page.goto('/admin/products');
      await expect(page).toHaveURL(/\/admin\/login/);
    } finally {
      await context.close();
    }
  });

  test('MOB-02 · Products: the Filters sheet, the whole detail on a card, the row menu and editing', async ({
    browser,
    baseURL,
  }) => {
    const {page, errors} = await phone({browser, baseURL}, ADMIN);
    await visit(page, `/admin/products?warehouse=${ESPANA}`);

    await page.getByRole('button', {name: /^Filters · /}).tap();
    const sheet = page.getByRole('dialog', {name: 'Filters'});
    await sheet.getByLabel('Sort').selectOption({label: 'Code, descending'});
    await sheet.getByRole('searchbox', {name: 'Filter by Code'}).fill('MOB');
    const show = sheet.getByRole('button', {name: /^Show 1 result$/});
    await expectInSight(show, 'Show 1 result');
    await show.tap();
    await expect(sheet).toBeHidden();
    await expect(page.getByRole('button', {name: 'Filters · 1'})).toBeVisible();

    // The approved change: the detail is a fact of the card, whole and wrapped; the stock value stays.
    const row = card(page, PRODUCT);
    const detail = row.locator('td[data-label="Detail"]');
    await expect(detail).toContainText(DETAIL);
    expect(
      await detail
        .locator('.kf-stock__detail')
        .evaluate(
          (el) =>
            el.scrollWidth <= el.clientWidth &&
            getComputedStyle(el).textOverflow !== 'ellipsis',
        ),
      'the detail is not cut',
    ).toBe(true);
    await expect(page.getByText('Stock value')).toBeVisible();

    const menu = row.getByRole('button', {name: `Actions for ${PRODUCT}`});
    await expectReachable(menu, 'the card menu');
    await menu.tap();
    await expectInSight(page.getByRole('menuitem', {name: 'Edit'}), 'Edit');
    await expectInSight(
      page.getByRole('menuitem', {name: 'Download stock sheet'}),
      'Download stock sheet',
    );
    await page.getByRole('menuitem', {name: 'Edit'}).tap();
    await expect(
      page.getByRole('heading', {level: 1, name: 'Edit product'}),
    ).toBeVisible();
    await page.getByLabel('Title').fill('Mob lip spoiler, black');
    await expectInSight(
      page.getByRole('button', {name: 'Save'}),
      'Save, above the tab bar',
    );
    await page.getByRole('button', {name: 'Save'}).tap();
    await expect(toast(page, 'Product saved')).toBeVisible();

    // A card opens its product too.
    await visit(
      page,
      `/admin/products?warehouse=${ESPANA}&filter[code]=${PRODUCT}`,
    );
    await card(page, PRODUCT)
      .getByRole('cell', {name: 'Mob lip spoiler, black'})
      .tap();
    await expect(
      page.getByRole('heading', {level: 1, name: 'Edit product'}),
    ).toBeVisible();
    await expectNoSidewaysScroll(page);
    expect(errors).toEqual([]);
  });

  test('MOB-03 · Products: two cards ticked, the selection bar moves them in a dialog that fits, and downloads them', async ({
    browser,
    baseURL,
  }) => {
    const {page, errors} = await phone({browser, baseURL}, ADMIN);
    await visit(page, '/admin/products?warehouse=1');
    await card(page, 'KF-01').getByRole('checkbox', {name: 'Select row'}).tap();
    await card(page, 'KF-02').getByRole('checkbox', {name: 'Select row'}).tap();
    await expect(page.getByText('2 selected')).toBeVisible();

    const bar = page.locator('.kf-selection-bar');
    for (const name of ['Move to warehouse', 'Clear']) {
      await expectInSight(bar.getByRole('button', {name}), name);
    }
    const sheetLink = bar.getByRole('link', {name: 'Download stock sheet'});
    await expectInSight(sheetLink, 'Download stock sheet');
    const download = page.waitForEvent('download');
    await sheetLink.tap();
    expect((await download).suggestedFilename()).toBe('Products.xls');

    // The panel is no taller than the screen, its list scrolls inside, Move stays in sight.
    await bar.getByRole('button', {name: 'Clear'}).tap();
    await visit(page, `/admin/products?warehouse=${ESPANA}`);
    await card(page, PRODUCT).getByRole('checkbox', {name: 'Select row'}).tap();
    await page
      .locator('.kf-selection-bar')
      .getByRole('button', {name: 'Move to warehouse'})
      .tap();
    const dialog = page.getByRole('dialog', {name: 'Move to warehouse'});
    const box = await dialog.boundingBox();
    expect(box!.height, 'the panel fits the screen').toBeLessThanOrEqual(
      PHONE.height,
    );
    await dialog
      .getByLabel('Destination warehouse')
      .selectOption({label: 'Usa'});
    await dialog.getByLabel(`Quantity of ${PRODUCT}`).selectOption('2');
    await expectInSight(
      dialog.getByRole('button', {name: 'Move', exact: true}),
      'Move',
    );
    await expectInSight(dialog.getByRole('button', {name: 'Cancel'}), 'Cancel');
    await dialog.getByRole('button', {name: 'Move', exact: true}).tap();
    await expect(toast(page, 'Moved to Usa.')).toBeVisible();
    await expect(card(page, PRODUCT)).toContainText('3');
    expect(errors).toEqual([]);
  });

  test('MOB-04 · A product is created on the phone, and its form says what is missing', async ({
    browser,
    baseURL,
  }) => {
    const {page, errors} = await phone({browser, baseURL}, ADMIN);
    await visit(page, '/admin/products');
    await page.getByRole('link', {name: 'Create product'}).tap();
    await expect(
      page.getByRole('heading', {level: 1, name: 'Create product'}),
    ).toBeVisible();
    const save = page.getByRole('button', {name: 'Save'});
    await expectInSight(save, 'Save');
    await save.tap();
    await expect(
      page.getByText('This value should not be blank.').first(),
    ).toBeVisible();
    await page.getByLabel('Code').fill(`SMOKE-MOB-${RUN}`);
    await page.getByLabel('Title').fill('Mob new product');
    await page.getByLabel('Price').tap();
    await page.getByLabel('Price').fill('12.5');
    await save.tap();
    await expect(page).toHaveURL(/\/admin\/products/);
    await expect(toast(page, 'Product saved')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('MOB-05 · A stock sheet is uploaded with the file picker, and the result comes into view', async ({
    browser,
    baseURL,
  }) => {
    const {page, errors} = await phone({browser, baseURL}, ADMIN);
    await visit(page, '/admin/products/upload');
    const uuid = (
      (await (
        await page.request.get(
          `/api/v1/warehouses/${ESPANA}/stock?filter[code]=${PRODUCT}`,
        )
      ).json()) as {
        items: {uuid: string}[];
      }
    ).items[0]!.uuid;
    const sheet = await page.request.get(
      `/api/v1/products/template.xls?uuid[]=${uuid}`,
    );

    const zone = page.getByText('Drop the stock sheet here, or choose a file');
    await expectReachable(zone, 'the drop zone');
    const chooser = page.waitForEvent('filechooser');
    await zone.tap();
    await (
      await chooser
    ).setFiles({
      name: 'products.xls',
      mimeType: 'application/vnd.ms-excel',
      buffer: await sheet.body(),
    });
    await page.getByRole('radio', {name: 'España'}).tap();
    const upload = page.getByRole('button', {name: 'Upload', exact: true});
    await expectReachable(upload, 'Upload');
    await upload.tap();

    const result = page
      .getByRole('status')
      .filter({hasText: 'stored in España'});
    await expectInSight(
      result,
      'the upload result, without scrolling up for it',
    );
    await expectInSight(
      result.getByRole('link', {name: 'Open the products of España'}),
      'the link to the products',
    );
    expect(errors).toEqual([]);
  });

  test('MOB-06 · Incoming is approved and a warehouse renamed with a finger', async ({
    browser,
    baseURL,
  }) => {
    const {page, errors} = await phone({browser, baseURL}, ADMIN);
    await visit(page, '/admin/products/incoming');
    await page.getByRole('radio', {name: 'Usa'}).tap();
    await expect(codeCell(page, PRODUCT)).toBeVisible();
    const approve = page.getByRole('button', {name: /^Approve all/});
    await expectInSight(approve, 'Approve all');
    await approve.tap();
    const confirm = page.getByRole('dialog');
    await expectInSight(
      confirm.getByRole('button', {name: /^Approve \d+ product/}),
      'the confirmation',
    );
    await confirm.getByRole('button', {name: /^Approve \d+ product/}).tap();
    await expect(toast(page, /approved/)).toBeVisible();

    await visit(page, '/admin/warehouses');
    await page.getByRole('button', {name: 'España', exact: true}).tap();
    const name = page.getByRole('textbox', {name: /name/i});
    await expectInSight(name, 'the name field');
    await name.fill('España');
    await expectInSight(page.getByRole('button', {name: 'Save'}), 'Save');
    await expectInSight(page.getByRole('button', {name: 'Cancel'}), 'Cancel');
    await page.getByRole('button', {name: 'Save'}).tap();
    await expect(
      page.getByRole('button', {name: 'España', exact: true}),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('MOB-07 · Scan: the box is in sight above the bars, a typed code lists under it, and Add saves', async ({
    browser,
    baseURL,
  }) => {
    const {page, errors} = await phone({browser, baseURL}, ADMIN);
    for (const size of [PHONE, SMALL_PHONE]) {
      await page.setViewportSize(size);
      await page.evaluate(() => localStorage.removeItem('kf.scanIntroSeen'));
      await visit(page, '/admin/products/barcode');
      // The one-time "What changed" note is shown: the box is at its lowest.
      await expect(page.getByText(/^What changed:/)).toBeVisible();
      const box = page.getByRole('textbox', {name: 'Barcode'});
      await expect(
        page.getByText(
          'The camera needs a secure address (https). Type the code instead.',
        ),
      ).toBeVisible();

      // The warehouse and the mode first; choosing brings the box up, clear of the tab bar and the action bar.
      await page.getByRole('radio', {name: 'España'}).tap();
      await page.getByRole('radio', {name: 'Add stock'}).tap();
      await expectInSight(
        box,
        `the barcode box at ${size.width}×${size.height}`,
      );
      await box.tap();
      await box.fill(PRODUCT);
      await box.press('Enter');
      // A second read within 50 ms is taken for the same scanner burst (ScanInput): typed after it.
      await page.waitForTimeout(60);
      await box.fill('MOB-NOPE');
      await box.press('Enter');

      await expectInSight(
        box,
        `the box after the first scan at ${size.width}×${size.height}`,
      );
      const lines = page.getByRole('list', {name: 'Scanned'});
      await expect(lines.getByRole('listitem')).toHaveCount(2);
      await expectReachable(
        lines.getByRole('button', {name: 'Remove MOB-NOPE'}),
        'Remove MOB-NOPE',
      );
      await lines.getByRole('button', {name: 'Remove MOB-NOPE'}).tap();
      await expectReachable(
        lines.getByRole('button', {name: `One more ${PRODUCT}`}),
        'the stepper',
      );
      await lines.getByRole('button', {name: `One more ${PRODUCT}`}).tap();
      await expectInSight(
        page.getByRole('button', {name: 'Undo last scan'}),
        'Undo last scan',
      );
      const add = page.getByRole('button', {name: 'Add to España'});
      await expectInSight(add, 'Add to España');
      await add.tap();
      await expect(toast(page, 'Added 2 units to España.')).toBeVisible();
      await expectInSight(add, 'the action bar is not under the toast');
      await dismissToasts(page);
    }
    expect(errors).toEqual([]);
  });

  test('MOB-08 · Orders: the Filters sheet, a status chip, a status changed from a card, an order opened and its menus', async ({
    browser,
    baseURL,
  }) => {
    const {page, errors} = await phone({browser, baseURL}, ADMIN);
    await visit(page, '/admin/orders');
    await page.getByRole('radio', {name: 'Colombia'}).tap();
    await page.getByRole('button', {name: /^Created \d+$/}).tap();
    await expect(
      page.getByRole('button', {name: /^Created \d+$/}),
    ).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', {name: /^Filters · /}).tap();
    const sheet = page.getByRole('dialog', {name: 'Filters'});
    await sheet.getByRole('button', {name: 'Order'}).tap();
    await sheet
      .getByRole('searchbox', {name: 'Filter by Order'})
      .fill('W00004');
    await sheet.getByRole('button', {name: 'Clear filters'}).tap();
    await sheet
      .getByRole('searchbox', {name: 'Filter by Order'})
      .fill('W00004');
    await expectInSight(
      sheet.getByRole('button', {name: /^Show 1 result$/}),
      'Show 1 result',
    );
    await sheet.getByRole('button', {name: /^Show 1 result$/}).tap();
    await expect(sheet).toBeHidden();

    // W00004 is Partial: its status menu from the card, then Cancel leaves it be.
    const status = page.getByRole('button', {name: 'Status of order W00004'});
    await expectReachable(status, 'the card status');
    await status.tap();
    await expectInSight(
      page
        .getByRole('menuitem', {name: 'Delivered'})
        .or(page.getByRole('menuitemradio', {name: 'Delivered'})),
      'Delivered',
    );
    await page.keyboard.press('Escape');

    // The order opens in a centred panel no taller than the screen; its actions and menus are in reach.
    await page
      .getByRole('cell', {name: /W00004/})
      .filter({visible: true})
      .first()
      .tap();
    const panel = page.getByRole('dialog', {name: 'Order W00004'});
    expect((await panel.boundingBox())!.height).toBeLessThanOrEqual(
      PHONE.height,
    );
    for (const name of ['Edit', 'Getting ready']) {
      await expectReachable(panel.getByRole('link', {name}), name);
    }
    await panel.getByRole('button', {name: 'Documents'}).tap();
    for (const name of ['Order PDF', 'Remaining products PDF', 'Excel sheet']) {
      await expectInSight(page.getByRole('menuitem', {name}), name);
    }
    await page.keyboard.press('Escape');
    await expectReachable(
      panel.getByRole('heading', {name: 'Products'}),
      'the products, scrolled to',
    );
    await expectInSight(
      panel.getByRole('button', {name: 'Close'}),
      'Close, after scrolling',
    );
    await panel.getByRole('button', {name: 'Close'}).tap();
    await expect(panel).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('MOB-09 · Create an order with a finger: the customer and product pickers open over the bars, rows added and removed', async ({
    browser,
    baseURL,
  }) => {
    const {page, errors} = await phone({browser, baseURL}, ADMIN);
    for (const size of [SMALL_PHONE, PHONE]) {
      await page.setViewportSize(size);
      await visit(page, '/admin/orders/new');
      // The customer list opens down over the action bar: its options are tappable, not under the bar.
      await page.getByRole('combobox', {name: 'Search customer'}).tap();
      const options = page.getByRole('option');
      await expect(options.first()).toBeVisible();
      const listed = await options.count();
      for (const index of [0, Math.min(3, listed - 1)]) {
        await expectInSight(
          options.nth(index),
          `customer option ${index + 1} at ${size.width}×${size.height}`,
        );
        const height = (await options.nth(index).boundingBox())!.height;
        expect(height, 'an option is a 44 px target').toBeGreaterThanOrEqual(
          44,
        );
      }
      await page.keyboard.type('Jose');
      await page.getByRole('option', {name: /Jose Perez/}).tap();
      await expect(page.getByLabel('First name')).toHaveValue('Jose');
    }

    // The missing-fields bar: a name goes to its field.
    const missing = page.locator('.kf-action-bar__status');
    await missing.getByRole('button', {name: 'warehouse'}).tap();
    await expect(page.getByLabel('Warehouse')).toBeFocused();
    await expectInSight(
      page.getByLabel('Warehouse'),
      'the warehouse, brought into view',
    );
    await page.getByLabel('Warehouse').selectOption({label: 'Colombia'});
    await page.getByLabel('Payment method').selectOption({label: 'PayPal'});

    // The product lines: the picker is not cut by its table, and is wide enough to read.
    const product1 = page.getByRole('combobox', {name: 'Product 1'});
    await expectReachable(product1, 'the product picker');
    await product1.tap();
    const kf03 = page.getByRole('option', {name: 'KF-03 (KF-03)'});
    await expectInSight(kf03, 'KF-03 in the product list');
    expect(
      (await kf03.boundingBox())!.width,
      'the list is as wide as the field',
    ).toBeGreaterThan(200);
    await kf03.tap();
    await page.getByLabel('Quantity of product 1').fill('1');
    await page.getByRole('button', {name: 'Add product'}).tap();
    await pick(
      page,
      page.getByRole('combobox', {name: 'Product 2'}),
      'KF-02 (KF-02)',
    );
    await page.getByLabel('Quantity of product 2').fill('1');
    const remove = page.getByRole('button', {name: 'Remove product 2'});
    await expectReachable(remove, 'Remove product 2');
    await remove.tap();
    await expect(page.getByLabel('Product 2')).toHaveCount(0);

    orderCode = `MOB-${RUN}`;
    await page.getByLabel('Order number').fill(orderCode);
    await page.getByLabel('Source').selectOption({label: 'Phone'});
    await page.getByLabel('Status').selectOption({label: 'Created'});
    const create = page.getByRole('button', {name: 'Create order'});
    await expectInSight(create, 'Create order');
    await create.tap();
    await expect(page).toHaveURL(/\/admin\/orders$/);
    await expect(toast(page, 'The order was created.')).toBeVisible();

    // And edited: the same form, Update order in sight.
    await page
      .getByRole('searchbox', {name: 'Order number or customer'})
      .fill(orderCode);
    await page.getByRole('button', {name: `Actions for ${orderCode}`}).tap();
    await page.getByRole('menuitem', {name: 'Edit'}).tap();
    await expect(
      page.getByRole('heading', {level: 1, name: 'Edit order'}),
    ).toBeVisible();
    await page.getByLabel('Phone').fill('+57 3000000000');
    await expectInSight(
      page.getByRole('button', {name: 'Update order'}),
      'Update order',
    );
    await page.getByRole('button', {name: 'Update order'}).tap();
    await expect(toast(page, /updated/)).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('MOB-10 · Order comments with a finger: send, a quick phrase, pin and unpin, nothing under the write box or a toast', async ({
    browser,
    baseURL,
  }) => {
    const {page, errors} = await phone({browser, baseURL}, ADMIN);
    const phrase = `Mob phrase ${RUN}`;
    const created = await page.request.post('/api/v1/settings/quick-phrases', {
      headers: origin(page),
      data: {text: phrase, active: true},
    });
    expect(created.status()).toBe(201);
    const {id} = (await created.json()) as {id: number};
    try {
      await visit(page, `/admin/orders?filter[code]=${orderCode}`);
      // The card's notes count opens the order at its comments, the write box at the bottom.
      await page
        .getByRole('button', {
          name: new RegExp(`^Comments of order ${orderCode}`),
        })
        .tap();
      const panel = page.getByRole('dialog', {name: `Order ${orderCode}`});
      const box = panel.getByRole('textbox', {name: 'Write a note…'});
      await expectInSight(box, 'the write box');
      await box.tap();
      for (const note of ['Mob note one', 'Mob note two', 'Mob note three']) {
        await box.fill(note);
        await box.press('Enter');
        const added = panel.getByRole('listitem').filter({hasText: note});
        await expect(added).toBeVisible();
        await expectInSight(
          added.getByText(note),
          `the new note "${note}", above the write box`,
        );
      }
      await panel
        .getByRole('button', {name: `Add “${phrase}” as a comment`})
        .tap();
      await expectInSight(
        panel.getByRole('listitem').filter({hasText: phrase}).getByText(phrase),
        'the phrase note',
      );

      const entry = panel
        .getByRole('listitem')
        .filter({hasText: 'Mob note two'});
      const menu = entry.getByRole('button', {name: /^Actions for comment/});
      await expectReachable(menu, 'the note menu');
      await menu.tap();
      await page.getByRole('menuitem', {name: 'Pin'}).tap();
      await expect(
        toast(page, 'The comment is pinned to the order.'),
      ).toBeVisible();
      await expectInSight(box, 'the write box, while the toast shows');
      await expectInSight(
        panel.getByRole('button', {name: 'Send'}),
        'Send, while the toast shows',
      );
      const pinned = panel.getByRole('region', {name: 'Pinned'});
      await expectReachable(
        pinned.getByRole('button', {name: 'Unpin'}),
        'Unpin',
      );
      await pinned.getByRole('button', {name: 'Unpin'}).tap();
      await expect(pinned).toBeHidden();
      await panel.getByRole('button', {name: 'Close'}).tap();
    } finally {
      await page.request.delete(`/api/v1/settings/quick-phrases/${id}`, {
        headers: origin(page),
      });
    }
    expect(errors).toEqual([]);
  });

  test('MOB-11 · Getting ready with a finger: the scan box, the steppers and the Ship bar', async ({
    browser,
    baseURL,
  }) => {
    const {page, errors} = await phone({browser, baseURL}, ADMIN);
    await visit(page, `/admin/orders?filter[code]=${orderCode}`);
    await page.getByRole('button', {name: `Actions for ${orderCode}`}).tap();
    await page.getByRole('menuitem', {name: 'Getting ready'}).tap();
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: `Getting ready · ${orderCode}`,
      }),
    ).toBeVisible();
    const box = page.getByLabel('Barcode', {exact: true});
    await expectInSight(box, 'the barcode box');
    await box.fill('KF-03');
    await box.press('Enter');
    const line = page.getByRole('listitem', {name: 'KF-03', exact: true});
    await expect(
      line.getByRole('status', {name: 'This shipment of KF-03'}),
    ).toHaveText('1');
    await expectReachable(
      line.getByRole('button', {name: 'One less KF-03'}),
      'One less',
    );
    await expectReachable(
      line.getByRole('button', {name: 'One more KF-03'}),
      'One more',
    );
    const ship = page.getByRole('button', {name: /^Ship 1 product/});
    await expectInSight(ship, 'the Ship bar');
    await ship.tap();
    await expect(toast(page, /Shipment saved/)).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('MOB-12 · Customers with a finger: filters, pages, create with the place pickers, delete', async ({
    browser,
    baseURL,
  }) => {
    const {page, errors} = await phone({browser, baseURL}, ADMIN);
    await visit(page, '/admin/customers');
    const next = page.getByRole('button', {name: /^Next/});
    await expectReachable(next, 'the next page');
    await next.tap();
    await expect(page).toHaveURL(/page=2/);
    await page.getByRole('button', {name: /^Filters · /}).tap();
    const sheet = page.getByRole('dialog', {name: 'Filters'});
    await expectInSight(
      sheet.getByRole('button', {name: 'Clear filters'}),
      'Clear filters',
    );
    await page.keyboard.press('Escape');

    await visit(page, '/admin/customers/new');
    const email = `mob.${RUN}@example.com`;
    await page.getByLabel('Name', {exact: true}).fill('Mob');
    await page.getByLabel('Last Name').fill('Customer');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Address', {exact: true}).fill('1 Mob Street');
    await page.getByLabel('Zip Code').fill('33415');
    // Save at the bottom with the phone left empty: the field that says why comes into view, focused.
    await page.getByRole('button', {name: 'Save'}).tap();
    await expect(page.getByLabel('Phone')).toBeFocused();
    await expectInSight(
      page.getByLabel('Phone'),
      'the phone, which is required',
    );
    await page.getByLabel('Phone').fill('3005550123');
    const address = page.getByRole('group', {name: 'Address 1'});
    for (const [place, name] of [
      ['Country', 'USA'],
      ['State', 'Florida'],
      ['City', 'West Palm Beach'],
    ] as const) {
      const control = address.getByRole('combobox', {name: place});
      await expectReachable(control, place);
      await pick(page, control, name);
    }
    await expect(address).toContainText('West Palm Beach');
    await expectInSight(page.getByRole('button', {name: 'Save'}), 'Save');
    await page.getByRole('button', {name: 'Save'}).tap();
    await expect(
      toast(page, 'The customer was created successfully.'),
    ).toBeVisible();

    await page.getByRole('searchbox', {name: 'Search customers'}).fill(email);
    const row = page.getByRole('row', {name: new RegExp(email)});
    await row.getByRole('button', {name: /Actions for/}).tap();
    await page.getByRole('menuitem', {name: 'Delete'}).tap();
    const confirm = page.getByRole('dialog');
    await expectInSight(
      confirm.getByRole('button', {name: 'Delete', exact: true}),
      'Delete',
    );
    await confirm.getByRole('button', {name: 'Delete', exact: true}).tap();
    await expect(toast(page, 'The customer was deleted.')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('MOB-13 · Invoices with a finger: filters, the detail and its PDF, an invoice created with a line', async ({
    browser,
    baseURL,
  }) => {
    const {page, errors} = await phone({browser, baseURL}, SALES);
    await visit(page, '/admin/invoices');
    await page.getByRole('button', {name: /^Filters · /}).tap();
    await expectInSight(
      page
        .getByRole('dialog', {name: 'Filters'})
        .getByRole('button', {name: 'Clear filters'}),
      'Clear filters',
    );
    await page.keyboard.press('Escape');
    await page
      .getByText('INV-0001', {exact: true})
      .filter({visible: true})
      .tap();
    const panel = page.getByRole('dialog', {name: 'Invoice INV-0001'});
    const pdf = panel.getByRole('link', {name: 'Open PDF'});
    await expectInSight(pdf, 'Open PDF');
    expect(
      (await page.request.get((await pdf.getAttribute('href'))!)).headers()[
        'content-type'
      ],
    ).toContain('application/pdf');
    await panel.getByRole('button', {name: 'Close'}).first().tap();

    await visit(page, '/admin/invoices/new');
    const product = page.getByRole('combobox', {name: 'Product 1'});
    await expectReachable(product, 'the product picker');
    await pick(page, product, 'KF-01 (KF-01)');
    await expect(page.getByLabel('Description 1')).toHaveValue('KF-01');
    await expectReachable(
      page.getByRole('button', {name: 'Remove line 1'}),
      'Remove line 1',
    );
    await expectReachable(page.getByTestId('total'), 'the total');
    const created = page.context().waitForEvent('page');
    await expectInSight(
      page.getByRole('button', {name: 'Create invoice'}),
      'Create invoice',
    );
    await page.getByRole('button', {name: 'Create invoice'}).tap();
    await (await created).close();
    await expect(toast(page, 'Invoice created.')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('MOB-14 · Users with a finger: filters, a user created with roles ticked, the password shown and hidden', async ({
    browser,
    baseURL,
  }) => {
    const {page, errors} = await phone({browser, baseURL}, ADMIN);
    await visit(page, '/admin/users');
    await page.getByRole('button', {name: /^Inactive/}).tap();
    await page.getByRole('button', {name: /^All/}).tap();
    await page.getByRole('link', {name: /Create user/}).tap();
    await expect(
      page.getByRole('heading', {level: 1, name: 'New user'}),
    ).toBeVisible();
    await page.getByLabel('Name', {exact: true}).fill('Mob User');
    await page.getByLabel('Email').fill(`mob.user.${RUN}@kf.local`);
    await page.getByLabel('Username').fill(`mob-${RUN}`);
    const password = page.getByLabel('Password', {exact: true});
    await password.fill('mob-secret');
    await page.getByRole('button', {name: 'Show password'}).tap();
    await expect(password).toHaveAttribute('type', 'text');
    await page.getByRole('button', {name: 'Hide password'}).tap();
    await expect(password).toHaveAttribute('type', 'password');
    for (const role of ['Inventory', 'Orders']) {
      const tick = page.getByLabel(role, {exact: true});
      await expectReachable(tick, role);
      await tick.tap();
      await expect(tick).toBeChecked();
    }
    await expectInSight(page.getByRole('button', {name: 'Save'}), 'Save');
    await page.getByRole('button', {name: 'Save'}).tap();
    await expect(toast(page, 'The user was created.')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('MOB-15 · Settings: every tab in reach without sideways scrolling, the test email panel, Analytics', async ({
    browser,
    baseURL,
  }) => {
    const {page, errors} = await phone({browser, baseURL}, ADMIN);
    for (const [tab, path] of [
      ['Quick phrases', '/admin/settings/phrases'],
      ['General', '/admin/settings'],
    ] as const) {
      await visit(page, path);
      const nav = page.getByRole('navigation', {name: 'Settings sections'});
      for (const name of [
        'General',
        'Email',
        'Analytics',
        'Shop connections',
        'Quick phrases',
      ]) {
        await expectInSight(
          nav.getByRole('link', {name}),
          `the ${name} tab, on ${tab}`,
        );
      }
    }
    await page
      .getByRole('navigation', {name: 'Settings sections'})
      .getByRole('link', {name: 'Email'})
      .tap();
    await page.getByRole('button', {name: 'Send test email'}).tap();
    const panel = page.getByRole('dialog', {name: 'Send test email'});
    await expectInSight(panel.getByLabel('Send to'), 'Send to');
    await expectInSight(panel.getByRole('button', {name: 'Send'}), 'Send');
    await panel.getByRole('button', {name: 'Send'}).tap();
    await expect(
      panel.getByRole('status').or(panel.getByRole('alert')),
    ).toBeVisible({timeout: 30_000});
    await expectInSight(
      panel.getByRole('button', {name: 'Close'}).last(),
      'Close',
    );
    await panel.getByRole('button', {name: 'Close'}).last().tap();

    await page
      .getByRole('navigation', {name: 'Settings sections'})
      .getByRole('link', {name: 'Analytics'})
      .tap();
    await page.getByLabel('Google Analytics 4 Measurement ID').tap();
    await expectInSight(
      page.getByLabel('Google Analytics 4 Measurement ID'),
      'the GA field',
    );
    await expectReachable(page.getByRole('button', {name: 'Save'}), 'Save');
    await expectNoSidewaysScroll(page);
    expect(errors).toEqual([]);
  });

  test('MOB-16 · Shop connections with a finger: the card menu, the form with Copy and Test connection, Save', async ({
    browser,
    baseURL,
  }) => {
    const {page, errors} = await phone({browser, baseURL}, ADMIN);
    await visit(page, '/admin/settings/shops');
    await page.getByRole('button', {name: 'Actions for Fake shop'}).tap();
    for (const name of [
      'Edit',
      'Test connection',
      'Failed deliveries',
      'Deactivate',
      'Delete',
    ]) {
      await expectInSight(page.getByRole('menuitem', {name}), name);
    }
    await page.getByRole('menuitem', {name: 'Edit'}).tap();
    await expect(
      page.getByRole('heading', {level: 1, name: 'Edit connection'}),
    ).toBeVisible();

    const copy = page.getByRole('button', {name: /^Copy/}).first();
    await expectReachable(copy, 'Copy');
    await copy.tap();
    // Plain http here: the browser may refuse the clipboard, which says so in a toast that stays. It is not over the
    // buttons that save or test the connection.
    await expect(anyMessage(page)).toBeVisible();
    await expectInSight(
      page.getByRole('button', {name: 'Save connection'}),
      'Save connection, while the toast shows',
    );
    await expectInSight(
      page.getByRole('button', {name: 'Test connection'}),
      'Test connection, while the toast shows',
    );
    await dismissToasts(page);
    await page.getByRole('button', {name: 'Test connection'}).tap();
    await expect(page.getByText('Connected to Fake shop')).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole('button', {name: 'Save connection'}).tap();
    await expect(toast(page, /saved/i)).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('MOB-17 · Quick phrases with a finger: add, move, switch off, delete', async ({
    browser,
    baseURL,
  }) => {
    const {page, errors} = await phone({browser, baseURL}, ADMIN);
    await visit(page, '/admin/settings/phrases');
    const add = page.getByLabel('Add phrase');
    const list = page.getByRole('list', {name: 'Quick phrases'});
    for (const text of ['Mob packed', 'Mob courier']) {
      await add.fill(text);
      await page.getByRole('button', {name: 'Add', exact: true}).tap();
      await expect(list.getByText(text)).toBeVisible();
    }
    // The toast of the last add is shown: the row's buttons are not under it.
    for (const name of [
      'Move Mob courier up',
      'Rename Mob courier',
      'Delete Mob courier',
    ]) {
      await expectReachable(page.getByRole('button', {name}), name);
    }
    await page.getByRole('button', {name: 'Move Mob courier up'}).tap();
    await expect(
      page.getByRole('button', {name: 'Move Mob courier down'}),
    ).toBeEnabled();
    const active = page.getByRole('switch', {name: 'Mob packed is active'});
    await active.tap();
    await expect(active).not.toBeChecked();
    for (const text of ['Mob packed', 'Mob courier']) {
      await page.getByRole('button', {name: `Delete ${text}`}).tap();
      const confirm = page.getByRole('dialog');
      await expectInSight(
        confirm.getByRole('button', {name: 'Delete phrase'}),
        'Delete phrase',
      );
      await confirm.getByRole('button', {name: 'Delete phrase'}).tap();
      await expect(list.getByText(text)).toHaveCount(0);
    }
    expect(errors).toEqual([]);
  });

  test('MOB-18 · Failed deliveries with a finger: the list, the detail, Retry and Discard; Check now on Orders', async ({
    browser,
    baseURL,
  }) => {
    const {page, errors} = await phone({browser, baseURL}, ADMIN);
    const remote = 960000 + Math.floor(Math.random() * 9999);
    const body = JSON.stringify({
      id: remote,
      status: 'processing',
      billing: {
        first_name: 'Mob',
        last_name: 'Buyer',
        email: 'mob.buyer@example.com',
        phone: '1',
        address_1: '1 St',
        postcode: '1',
        city: 'Miami',
        state: 'FL',
        country: 'US',
      },
      shipping: {
        address_1: '1 St',
        postcode: '1',
        city: 'Miami',
        state: 'FL',
        country: 'US',
      },
      line_items: [{sku: 'KF-MOB-MISSING', quantity: 2}],
    });
    const delivered = await page.request.post(FAKE_SHOP_HOOK, {
      data: body,
      headers: {
        'Content-Type': 'application/json',
        'X-WC-Webhook-Signature': createHmac('sha256', FAKE_SHOP_WEBHOOK_SECRET)
          .update(body)
          .digest('base64'),
      },
    });
    expect(delivered.status()).toBe(200);
    const shops = (await (await page.request.get('/api/v1/shops')).json()) as {
      id: number;
      name: string;
    }[];
    const fake = shops.find((shop) => shop.name === 'Fake shop')!;

    await visit(page, `/admin/settings/shops/${fake.id}/deliveries`);
    await page.getByText(String(remote)).first().tap();
    const panel = page.getByRole('dialog', {name: `Shop order ${remote}`});
    expect((await panel.boundingBox())!.height).toBeLessThanOrEqual(
      PHONE.height,
    );
    await expectInSight(panel.getByRole('button', {name: 'Retry'}), 'Retry');
    await expectInSight(
      panel.getByRole('button', {name: 'Discard'}),
      'Discard',
    );
    await panel.getByRole('button', {name: 'Retry'}).tap();
    await expect(
      page.getByRole('alert').filter({hasText: 'Still not placed'}),
    ).toBeVisible();
    await dismissToasts(page);
    if (await panel.isVisible())
      await panel.getByRole('button', {name: 'Close'}).first().tap();
    const row = page
      .locator('tbody tr[role="row"]')
      .filter({hasText: String(remote)});
    await row.getByRole('button', {name: `Actions for ${remote}`}).tap();
    await page.getByRole('menuitem', {name: 'Discard'}).tap();
    await expect(toast(page, 'Delivery discarded.')).toBeVisible();

    await visit(page, '/admin/orders');
    // The list first (SHOP-08 says why: the pull and the page's requests share the dev stack's PHP pool).
    await expect(page.getByText('W00001').first()).toBeVisible();
    await page.getByRole('button', {name: 'More', exact: true}).first().tap();
    const check = page.getByRole('button', {name: 'Check now'});
    await expectInSight(check, 'Check now');
    await check.tap();
    await expect(anyMessage(page)).toBeVisible({timeout: 30_000});
    expect(errors).toEqual([]);
  });

  test('MOB-19 · In Spanish, the longest labels stay whole and in reach', async ({
    browser,
    baseURL,
  }) => {
    const {page, errors} = await phone({browser, baseURL}, ADMIN, 'es');
    for (const size of [PHONE, SMALL_PHONE]) {
      await page.setViewportSize(size);
      const at = `${size.width}×${size.height}`;

      await visit(page, '/admin/products?warehouse=1');
      await card(page, 'KF-01').getByRole('checkbox').tap();
      const bar = page.locator('.kf-selection-bar');
      await expectNoneCutOff(bar, `the selection bar at ${at}`);
      await expectInSight(
        bar.getByRole('button', {name: 'Trasladar a bodega'}),
        `Trasladar a bodega at ${at}`,
      );
      await expectInSight(
        bar.getByRole('link', {name: 'Descargar hoja de existencias'}),
        `Descargar hoja de existencias at ${at}`,
      );
      await page.getByRole('button', {name: 'Filtros · 0'}).tap();
      await expectNoneCutOff(
        page.getByRole('dialog', {name: 'Filtros'}),
        `the filter sheet at ${at}`,
      );
      await page.keyboard.press('Escape');

      await visit(page, '/admin/products/barcode');
      await page.getByRole('radio', {name: 'Colombia'}).tap();
      await expectNoneCutOff(
        page.locator('.kf-action-bar'),
        `the scan bar at ${at}`,
      );
      await expectInSight(
        page.getByRole('textbox', {name: 'Código de barras'}),
        `the scan box at ${at}`,
      );

      await visit(page, '/admin/orders/new');
      await expectNoneCutOff(
        page.locator('.kf-action-bar'),
        `the order form bar at ${at}`,
      );
      await expectInSight(
        page.getByRole('button', {name: 'Crear pedido'}),
        `Crear pedido at ${at}`,
      );

      await visit(page, '/admin/settings');
      const nav = page.getByRole('navigation', {name: /Secciones/});
      for (const link of await nav.getByRole('link').all()) {
        await expectInSight(link, `the tab ${await link.innerText()} at ${at}`);
      }
      await expectNoSidewaysScroll(page);
    }
    expect(errors).toEqual([]);
  });

  test('MOB-20 · The inventory and invoice clerks reach their pages from the tab bar and More', async ({
    browser,
    baseURL,
  }) => {
    const clerk = await phone({browser, baseURL}, INVENTORY);
    await visit(clerk.page, '/admin/products');
    await expect(tabs(clerk.page).getByRole('link')).toHaveText([
      'Products',
      'Scan',
      'Incoming',
    ]);
    await tabs(clerk.page).getByRole('link', {name: 'Scan', exact: true}).tap();
    await expect(
      clerk.page.getByRole('heading', {level: 1, name: 'Scan stock'}),
    ).toBeVisible();
    await tabs(clerk.page)
      .getByRole('button', {name: 'More', exact: true})
      .tap();
    const drawer = clerk.page.getByRole('dialog', {name: 'Main menu'});
    await expect(
      drawer.getByRole('link', {name: 'Orders', exact: true}),
    ).toHaveCount(0);
    await drawer
      .getByRole('link', {name: 'Upload a stock sheet', exact: true})
      .tap();
    await expect(
      clerk.page.getByRole('heading', {level: 1, name: 'Upload a stock sheet'}),
    ).toBeVisible();
    expect(clerk.errors).toEqual([]);

    const invoices = await phone({browser, baseURL}, INVOICES);
    await visit(invoices.page, '/admin/invoices');
    const links = tabs(invoices.page).getByRole('link');
    await expect(links.filter({hasText: 'Invoices'})).toHaveCount(1);
    await expect(links.filter({hasText: 'Customers'})).toHaveCount(1);
    await tabs(invoices.page)
      .getByRole('link', {name: 'Customers', exact: true})
      .tap();
    await expect(
      invoices.page.getByRole('heading', {level: 1, name: 'Customers'}),
    ).toBeVisible();
    await tabs(invoices.page)
      .getByRole('link', {name: 'Invoices', exact: true})
      .tap();
    // An invoice opens from its card (creating one is the sales clerk's, MOB-13: the form reads a warehouse's stock).
    await invoices.page
      .getByText('INV-0001', {exact: true})
      .filter({visible: true})
      .tap();
    const panel = invoices.page.getByRole('dialog', {name: 'Invoice INV-0001'});
    await expectInSight(
      panel.getByRole('link', {name: 'Open PDF'}),
      'Open PDF',
    );
    await expectInSight(
      panel.getByRole('button', {name: 'Close'}).last(),
      'Close',
    );
    expect(invoices.errors).toEqual([]);
  });
});
