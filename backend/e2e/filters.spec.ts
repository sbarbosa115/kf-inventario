import type {APIRequestContext, Locator, Page} from '@playwright/test';
import {
  ADMIN,
  INVENTORY,
  SALES,
  consoleErrors,
  expect,
  test,
} from './support/test';

// 13 Table filters (FLT-01 – 11), shops-settings item 2 (tables-ui). Every list filters, sorts and
// pages on the server; the filters sit in a row under the headers (a sheet on a phone) and live in the address.
// FLT-05's 1,240 customers (`flt-NNNN@flt.test`) are seeded by e2e/prepare.sh; the spec adds through the API only
// what is missing (a stack prepared another way).
test.describe.configure({mode: 'serial'});

/** The row under the headers that holds the column filters. */
const filterRow = (page: Page) => page.locator('.kf-table__filters');

/** A column's filter button in that row (the header's sort button has the same name). */
const filterButton = (page: Page, name: string | RegExp) =>
  filterRow(page).getByRole('button', {name});

/** The rows of the table's body (the header and filter rows left out). */
const bodyRows = (page: Page) => page.locator('tbody tr[role="row"]');

/** A chip of the active filters above the table. */
const chip = (page: Page, text: string | RegExp) =>
  page.locator('.kf-active-filters__chip').filter({hasText: text});

async function apiJson<T>(request: APIRequestContext, url: string): Promise<T> {
  const answer = await request.get(url);
  expect(answer.status(), url).toBe(200);
  return (await answer.json()) as T;
}

interface ListPage<T> {
  items: T[];
  total: number;
  facets?: Record<string, {value: string; count: number}[]>;
}

const SEEDED = 1240;
const seededEmail = (n: number) => `flt-${String(n).padStart(4, '0')}@flt.test`;

/** FLT-05's customers: 1,240 of them, created through the API unless an earlier run of this stack left them. */
async function seedCustomers(page: Page) {
  const origin = new URL(page.url() || 'http://nginx').origin;
  const have = await apiJson<ListPage<unknown>>(
    page.request,
    '/api/v1/customers?per_page=1&filter[email]=%40flt.test',
  );
  if (have.total >= SEEDED) return;
  const existing = new Set<string>();
  for (let p = 1; existing.size < have.total; p++) {
    const chunk = await apiJson<ListPage<{email: string}>>(
      page.request,
      `/api/v1/customers?per_page=100&page=${p}&filter[email]=%40flt.test`,
    );
    chunk.items.forEach((c) => existing.add(c.email));
    if (chunk.items.length === 0) break;
  }
  const missing = Array.from({length: SEEDED}, (_, i) => i + 1).filter(
    (n) => !existing.has(seededEmail(n)),
  );
  for (let i = 0; i < missing.length; i += 10) {
    await Promise.all(
      missing.slice(i, i + 10).map(async (n) => {
        const answer = await page.request.post('/api/v1/customers', {
          data: {
            first_name: 'Flt',
            last_name: `Seed ${String(n).padStart(4, '0')}`,
            email: seededEmail(n),
            phone: `300${String(n).padStart(7, '0')}`,
            addresses: [],
          },
          headers: {Origin: origin},
        });
        expect(answer.status(), `seeding ${seededEmail(n)}`).toBe(201);
      }),
    );
  }
}

/** Ticks a value of a list filter: it applies through the address, so the box is checked once the URL changed. */
async function tick(panel: Locator, name: string | RegExp) {
  const box = panel.getByRole('checkbox', {name});
  await box.click();
  await expect(box).toBeChecked();
}

test.describe('13 Table filters', () => {
  test('FLT-01 · Orders: the Order filter finds an order by its number on the server', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    const errors = consoleErrors(page);
    await page.goto('/admin/orders');
    await expect(bodyRows(page).first()).toBeVisible();

    const asked = page.waitForRequest(
      (r) =>
        r.url().includes('/api/v1/orders?') &&
        new URL(r.url()).searchParams.get('filter[code]') === 'W00007',
    );
    await filterRow(page)
      .getByRole('searchbox', {name: 'Filter by Order'})
      .fill('W00007');
    await asked;

    await expect(bodyRows(page)).toHaveCount(1);
    await expect(bodyRows(page).first()).toContainText('W00007');
    await expect(chip(page, 'Order: W00007')).toBeVisible();
    await expect(page).toHaveURL(
      /filter%5Bcode%5D=W00007|filter\[code\]=W00007/,
    );
    expect(errors).toEqual([]);
  });

  test('FLT-02 · Orders: the Status list counts each status, ticks several, and the chip names them', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    // The fixtures' orders (W000…), whose Partial and Delivered ones no case changes: other lanes place orders and
    // change statuses while this runs.
    await page.goto('/admin/orders?filter[code]=W000');
    await expect(bodyRows(page).first()).toBeVisible();

    await filterButton(page, 'Status').click();
    const panel = page.getByRole('dialog', {name: 'Status'});
    const count = async (status: string) =>
      Number(
        await panel
          .locator('label', {hasText: status})
          .locator('.kf-filter-checklist__count')
          .textContent(),
      );
    const partial = await count('Partial');
    const delivered = await count('Delivered');
    expect(
      [partial, delivered],
      'W00004 and W00010 are partial, W00006 and W00012 delivered',
    ).toEqual([2, 2]);
    await tick(panel, /Partial/);
    await tick(panel, /Delivered/);
    await expect(filterButton(page, 'Status · 2')).toBeVisible();
    await page.keyboard.press('Escape');

    await expect(chip(page, 'Status: Partial, Delivered')).toBeVisible();
    await expect(bodyRows(page)).toHaveCount(partial + delivered);
    for (const status of await bodyRows(page)
      .getByRole('button', {name: /^Status of order/})
      .allTextContents()) {
      expect(status).toMatch(/Partial|Delivered/);
    }
    // Two statuses are not one chip of the toolbar: none is pressed, not even All.
    await expect(
      page
        .getByRole('group', {name: 'Status', exact: true})
        .getByRole('button', {pressed: true}),
    ).toHaveCount(0);
  });

  test('FLT-03 · Orders: Last 30 days fills the Created range, and the chip says it', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    // The fixtures' delivered orders, which no case changes.
    await page.goto('/admin/orders?filter[code]=W000&filter[status][]=6');
    await expect(bodyRows(page)).toHaveCount(2);

    await filterButton(page, 'Created').click();
    await page.getByRole('button', {name: 'Last 30 days'}).click();
    await page.keyboard.press('Escape');

    await expect(filterButton(page, /^Created: /)).toBeVisible();
    await expect(chip(page, /^Created: /)).toBeVisible();
    await expect(page).toHaveURL(/created_at/);
    // The fixtures' orders were all created when the stack was prepared.
    await expect(bodyRows(page)).toHaveCount(2);
  });

  test('FLT-04 · Products: a price and a quantity range narrow the stock on the server', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(INVENTORY);
    const stock = (
      await apiJson<ListPage<{code: string; quantity: number; price: number}>>(
        page.request,
        '/api/v1/warehouses/1/stock?per_page=0',
      )
    ).items;
    await page.goto('/admin/products?warehouse=1');
    await expect(bodyRows(page).first()).toBeVisible();

    await filterButton(page, 'Price').click();
    await page.getByRole('button', {name: 'Over $500'}).click();
    await page.keyboard.press('Escape');
    const over500 = stock.filter((s) => s.price > 500);
    if (over500.length === 0) {
      await expect(
        page.getByText('Nothing matches these filters.'),
      ).toBeVisible();
    } else {
      await expect(bodyRows(page)).toHaveCount(over500.length);
    }
    await expect(chip(page, 'Price: Over $500')).toBeVisible();

    // A typed minimum, then the quantity's quick range.
    const prices = [...new Set(stock.map((s) => s.price))].sort(
      (a, b) => a - b,
    );
    const min = prices[Math.floor(prices.length / 2)]!;
    await filterButton(page, /^Price/).click();
    await page.getByLabel('Min').fill(String(min));
    await page.getByLabel('Min').press('Enter');
    await page.keyboard.press('Escape');
    await filterButton(page, 'Quantity').click();
    await page.getByRole('button', {name: 'Over 10'}).click();
    await page.keyboard.press('Escape');

    const kept = stock.filter((s) => s.price >= min && s.quantity > 10);
    await expect(bodyRows(page)).toHaveCount(kept.length);
    for (const s of kept) {
      await expect(
        bodyRows(page).filter({
          has: page.getByRole('cell', {name: s.code, exact: true}),
        }),
      ).toHaveCount(1);
    }
    await expect(chip(page, 'Quantity: Over 10')).toBeVisible();
    await expect(page).toHaveURL(/price.*min|quantity.*min/);
  });

  test('FLT-05 · Customers: 1,240 of them are paged on the server, and an email filter finds one on a late page', async ({
    signedInAs,
  }) => {
    test.setTimeout(300_000);
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/customers');
    await seedCustomers(page);

    await page.goto('/admin/customers?filter[email]=%40flt.test');
    const pager = page.getByRole('navigation', {name: 'Pages'});
    await expect(pager).toContainText('1 – 25 of 1,240');
    await expect(bodyRows(page)).toHaveCount(25);
    await pager.getByRole('button', {name: 'Next'}).click();
    await expect(pager).toContainText('26 – 50 of 1,240');
    await expect(page).toHaveURL(/page=2/);

    // The seventh seeded customer is near the end, newest first: a filter finds it from any page.
    const email = filterRow(page).getByRole('searchbox', {
      name: 'Filter by Email',
    });
    await email.fill(seededEmail(7));
    await email.press('Enter');
    await expect(bodyRows(page)).toHaveCount(1);
    await expect(bodyRows(page).first()).toContainText(seededEmail(7));
    await expect(page).not.toHaveURL(/page=2/);
  });

  test('FLT-06 · Invoices: a total range and the payment method narrow the list', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(SALES);
    const invoices = (
      await apiJson<
        ListPage<{code: string; total: string; payment_method: string | null}>
      >(page.request, '/api/v1/invoices?per_page=100')
    ).items;
    await page.goto('/admin/invoices');
    await expect(bodyRows(page)).toHaveCount(invoices.length);

    await filterButton(page, 'Total').click();
    await page.getByRole('button', {name: '$100 – $500'}).click();
    await page.keyboard.press('Escape');
    const between = invoices.filter(
      (i) => Number(i.total) >= 100 && Number(i.total) <= 500,
    );
    await expect(chip(page, 'Total: $100 – $500')).toBeVisible();
    if (between.length > 0) {
      await expect(bodyRows(page)).toHaveCount(between.length);
    }

    await filterButton(page, 'Payment').click();
    const panel = page.getByRole('dialog', {name: 'Payment'});
    await expect(panel.getByRole('checkbox')).toHaveCount(2);
    await tick(panel, /Credit card - Paypal/);
    await page.keyboard.press('Escape');
    await expect(chip(page, 'Payment: Credit card - Paypal')).toBeVisible();
    const both = between.filter((i) => i.payment_method === 'credit_card');
    if (both.length === 0) {
      await expect(
        page.getByText('Nothing matches these filters.'),
      ).toBeVisible();
    } else {
      await expect(bodyRows(page)).toHaveCount(both.length);
    }
    await expect(page).toHaveURL(/payment_method/);
  });

  test('FLT-07 · Users: the Roles list counts each role, and a tick keeps who has it', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    const facets = (
      await apiJson<ListPage<unknown>>(
        page.request,
        '/api/v1/users?per_page=1&facets=roles',
      )
    ).facets!.roles!;
    const inventory =
      facets.find((f) => f.value === 'ROLE_MANAGE_INVENTORY')?.count ?? 0;
    expect(inventory, 'the fixtures have inventory clerks').toBeGreaterThan(0);
    await page.goto('/admin/users');
    await expect(bodyRows(page).first()).toBeVisible();

    await filterButton(page, 'Roles').click();
    const panel = page.getByRole('dialog', {name: 'Roles'});
    await expect(panel.getByRole('checkbox')).toHaveCount(9);
    await expect(
      panel
        .locator('label', {hasText: /^Inventory/})
        .locator('.kf-filter-checklist__count'),
    ).toHaveText(String(inventory));
    await expect(panel).not.toContainText('ROLE_');
    await tick(panel, /^Inventory/);
    await page.keyboard.press('Escape');

    await expect(chip(page, 'Roles: Inventory')).toBeVisible();
    await expect(bodyRows(page)).toHaveCount(inventory);
    for (const row of await bodyRows(page).all()) {
      await expect(row.getByText('Inventory', {exact: true})).toBeVisible();
    }
  });

  test('FLT-08 · The address holds the filters: a reload and a pasted link restore them, Clear filters empties it', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/orders');
    await expect(bodyRows(page).first()).toBeVisible();

    await filterButton(page, 'Status').click();
    // Delivered: no case changes the fixtures' delivered orders while this runs.
    await tick(page.getByRole('dialog', {name: 'Status'}), /Delivered/);
    await page.keyboard.press('Escape');
    const code = filterRow(page).getByRole('searchbox', {
      name: 'Filter by Order',
    });
    await code.fill('W0000');
    await code.press('Enter');
    await expect(page).toHaveURL(/filter%5Bcode%5D=W0000|filter\[code\]=W0000/);
    await expect(page).toHaveURL(/filter%5Bstatus%5D|filter\[status\]/);
    const link = page.url();
    // As many rows as the server holds for both filters (the address changes before the filtered page arrives).
    const rows = (
      await apiJson<ListPage<unknown>>(
        page.request,
        '/api/v1/orders?warehouse_id=1&per_page=1&filter[status][]=6&filter[code]=W0000',
      )
    ).total;
    await expect(chip(page, 'Order: W0000')).toBeVisible();
    await expect(bodyRows(page)).toHaveCount(rows);

    await page.reload();
    await expect(chip(page, 'Status: Delivered')).toBeVisible();
    await expect(chip(page, 'Order: W0000')).toBeVisible();
    await expect(
      filterRow(page).getByRole('searchbox', {name: 'Filter by Order'}),
    ).toHaveValue('W0000');
    await expect(bodyRows(page)).toHaveCount(rows);

    const pasted = await signedInAs(ADMIN);
    await pasted.goto(link);
    await expect(chip(pasted, 'Status: Delivered')).toBeVisible();
    await expect(bodyRows(pasted)).toHaveCount(rows);

    await page.getByRole('button', {name: 'Clear filters'}).click();
    await expect(chip(page, /./)).toHaveCount(0);
    await expect(page).not.toHaveURL(/filter/);
  });

  test('FLT-09 · A header sorts on the server and its arrow follows', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/users');
    await expect(bodyRows(page).first()).toBeVisible();
    const header = page.getByRole('columnheader', {name: 'Email'});
    const sort = header.getByRole('button', {name: 'Email'});

    let asked = page.waitForRequest(
      (r) =>
        r.url().includes('/api/v1/users?') &&
        new URL(r.url()).searchParams.get('sort') === 'email',
    );
    await sort.click();
    await asked;
    await expect(header).toHaveAttribute('aria-sort', 'ascending');
    await expect(page).toHaveURL(/sort=email/);

    asked = page.waitForRequest(
      (r) =>
        r.url().includes('/api/v1/users?') &&
        new URL(r.url()).searchParams.get('sort') === '-email',
    );
    await sort.click();
    await asked;
    await expect(header).toHaveAttribute('aria-sort', 'descending');
    await expect(page).toHaveURL(/sort=-email/);
  });
});

test.describe('13 Table filters, on a phone (390 px)', () => {
  test.use({
    viewport: {width: 390, height: 844},
    isMobile: true,
    hasTouch: true,
  });

  test('FLT-10 · On a phone, the filters are a sheet: "Show N results" counts the draft and applies it', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    const errors = consoleErrors(page);
    // The fixtures' orders (W000…), whose delivered ones no case changes.
    await page.goto('/admin/orders?filter[code]=W000');
    await expect(bodyRows(page).first()).toBeVisible();
    await expect(filterRow(page)).toHaveCount(0);
    const delivered = (
      await apiJson<ListPage<unknown>>(
        page.request,
        '/api/v1/orders?warehouse_id=1&per_page=1&filter[status][]=6&filter[code]=W000',
      )
    ).total;

    await page.getByRole('button', {name: 'Filters · 1'}).click();
    const sheet = page.getByRole('dialog', {name: 'Filters'});
    await expect(sheet).toBeVisible();
    await sheet.getByRole('button', {name: /^Status/}).click();
    await tick(sheet, /Delivered/);
    const show = sheet.getByRole('button', {
      name: delivered === 1 ? 'Show 1 result' : `Show ${delivered} results`,
    });
    await expect(show).toBeVisible();
    const box = await show.boundingBox();
    expect(box?.height ?? 0, 'a 44 px target').toBeGreaterThanOrEqual(44);
    await show.click();

    await expect(sheet).toHaveCount(0);
    await expect(chip(page, 'Status: Delivered')).toBeVisible();
    await expect(page.getByRole('button', {name: 'Filters · 2'})).toBeVisible();
    await expect(bodyRows(page)).toHaveCount(delivered);
    expect(errors).toEqual([]);
  });
});

test.describe('13 Table filters, the sheet (390 px)', () => {
  test.use({
    viewport: {width: 390, height: 844},
    isMobile: true,
    hasTouch: true,
  });

  test("FLT-11 · The sheet's date quick picks and money ranges", async ({
    signedInAs,
  }) => {
    const page = await signedInAs(SALES);
    const invoices = (
      await apiJson<ListPage<{total: string}>>(
        page.request,
        '/api/v1/invoices?per_page=100',
      )
    ).items;
    const show = (n: number) =>
      n === 1 ? 'Show 1 result' : `Show ${n} results`;
    await page.goto('/admin/invoices');
    await expect(bodyRows(page)).toHaveCount(invoices.length);

    await page.getByRole('button', {name: 'Filters · 0'}).click();
    const sheet = page.getByRole('dialog', {name: 'Filters'});
    await sheet.getByRole('button', {name: /^Date/}).click();
    for (const name of ['Today', 'Last 7 days', 'Last 30 days', 'This month']) {
      const pick = sheet.getByRole('button', {name, exact: true});
      expect(
        (await pick.boundingBox())?.height ?? 0,
        `${name} is a 44 px target`,
      ).toBeGreaterThanOrEqual(44);
    }
    await expect(sheet.getByLabel('From', {exact: true})).toHaveAttribute(
      'type',
      'date',
    );
    const last30 = sheet.getByRole('button', {name: 'Last 30 days'});
    await last30.click();
    await expect(last30).toHaveAttribute('aria-pressed', 'true');
    await expect(sheet.getByLabel('From', {exact: true})).not.toHaveValue('');
    await expect(sheet.getByLabel('To', {exact: true})).not.toHaveValue('');
    await expect(
      sheet.getByRole('button', {name: /^Show \d+ results?$/}),
    ).toBeVisible();
    await last30.click();

    await sheet.getByRole('button', {name: /^Total/}).click();
    await expect(sheet.getByLabel('Min')).toHaveAttribute(
      'inputmode',
      'decimal',
    );
    for (const name of ['Under $100', '$100 – $500', 'Over $500']) {
      await expect(
        sheet.getByRole('button', {name, exact: true}),
      ).toBeVisible();
    }
    await sheet.getByRole('button', {name: '$100 – $500'}).click();
    const between = invoices.filter(
      (i) => Number(i.total) >= 100 && Number(i.total) <= 500,
    ).length;
    await expect(
      sheet.getByRole('button', {name: show(between)}),
      'the count follows the draft',
    ).toBeVisible();

    await sheet.getByRole('button', {name: 'Clear filters'}).click();
    await expect(
      sheet.getByRole('button', {name: show(invoices.length)}),
    ).toBeVisible();
    await sheet.getByRole('button', {name: '$100 – $500'}).click();
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(
      page.getByRole('button', {name: 'Filters · 0'}),
      'closed without applying',
    ).toBeVisible();
    await expect(bodyRows(page)).toHaveCount(invoices.length);
  });
});
