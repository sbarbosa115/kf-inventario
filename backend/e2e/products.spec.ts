import {
  ADMIN,
  INVENTORY,
  INVOICES,
  consoleErrors,
  expect,
  test,
} from './support/test';
import fs from 'node:fs';
import type {Page} from '@playwright/test';

// 2 Products (INV-01 – 08, 17 – 22). Other lanes ship KF-01 and KF-02 from Colombia while these run, so quantities are
// read before a move and compared after it, never assumed, and INV-05 moves a product of its own.
test.describe.configure({mode: 'serial'});

const NEW_PRODUCT = {code: 'SMOKE-INV-06', title: 'Smoke chair'};
/** INV-05's own product, so the move it races does not touch the stock other cases count. */
const MOVED = {code: 'SMOKE-INV-05'};

/** Whether the stock sheet (an .xls, its texts stored as UTF-16) holds a text. */
const holds = (bytes: Buffer, text: string) =>
  bytes.includes(Buffer.from(text, 'utf16le'));

function stockRow(page: Page, code: string) {
  return page.getByRole('row').filter({
    has: page.getByRole('cell', {name: code, exact: true}),
  });
}

async function quantityOf(page: Page, code: string): Promise<number> {
  const quantity = await stockRow(page, code)
    .locator('td[data-label="Quantity"]')
    .innerText();
  return Number(quantity.replace(/,/g, ''));
}

test.describe('2 Products', () => {
  test('INV-01 · The product list opens on the first warehouse, and the old address lands on it', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    const errors = consoleErrors(page);

    await page.goto('/admin/product/');

    await expect(page).toHaveURL(/\/admin\/products$/);
    await expect(
      page.getByRole('heading', {name: 'Products', exact: true}),
    ).toBeVisible();
    await expect(page.getByRole('radio', {name: 'Colombia'})).toBeChecked();
    const row = stockRow(page, 'KF-01');
    await expect(row.getByRole('cell', {name: '$100.00'})).toBeVisible();
    await expect(
      row.getByRole('button', {name: 'Actions for KF-01'}),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('INV-02 · Another warehouse reloads the list; the search narrows it', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(INVENTORY);
    await page.goto('/admin/products');
    await expect(stockRow(page, 'KF-01')).toBeVisible();

    await page.getByRole('radio', {name: 'España'}).click();
    await expect(
      page.getByText(/This warehouse has no products in stock/),
    ).toBeVisible();
    await page.getByRole('radio', {name: 'Colombia'}).click();
    await expect(stockRow(page, 'KF-03')).toBeVisible();

    await page.getByRole('searchbox', {name: 'Search products'}).fill('KF-02');
    await expect(stockRow(page, 'KF-02')).toBeVisible();
    await expect(stockRow(page, 'KF-01')).toHaveCount(0);
    await page
      .getByRole('searchbox', {name: 'Search products'})
      .fill('no-such-product');
    await expect(
      page.getByText('Nothing matches these filters.'),
    ).toBeVisible();
    await page.getByRole('button', {name: 'Show all'}).click();
    await expect(stockRow(page, 'KF-01')).toBeVisible();
  });

  test('INV-03 · The ticked products download as the stock spreadsheet', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(INVENTORY);
    await page.goto('/admin/products');
    await expect(
      page.getByRole('link', {name: 'Download stock sheet'}),
    ).toHaveCount(0);

    await stockRow(page, 'KF-01').getByRole('checkbox').check();
    await stockRow(page, 'KF-02').getByRole('checkbox').check();
    await expect(page.getByText('2 selected')).toBeVisible();
    const download = page.waitForEvent('download');
    await page.getByRole('link', {name: 'Download stock sheet'}).click();

    const sheet = await download;
    expect(sheet.suggestedFilename()).toBe('Products.xls');
    const bytes = fs.readFileSync(await sheet.path());
    for (const text of ['Code', 'Title', 'Detail', 'Quantity', 'Price']) {
      expect(holds(bytes, text), `the header ${text}`).toBe(true);
    }
    expect(holds(bytes, 'KF-01') && holds(bytes, 'KF-02')).toBe(true);
    expect(holds(bytes, 'KF-03'), 'only the products ticked').toBe(false);

    await page.getByRole('checkbox', {name: 'Select all'}).check();
    const rows = await page.locator('tbody tr[role="row"]').count();
    await expect(page.getByText(`${rows} selected`)).toBeVisible();
  });

  test('INV-04 · Move to warehouse moves the chosen quantity; it arrives as incoming', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(INVENTORY);
    await page.goto('/admin/products');
    const before = await quantityOf(page, 'KF-03');
    expect(before, 'the fixtures give KF-03 stock in Colombia').toBeGreaterThan(
      2,
    );

    await stockRow(page, 'KF-03').getByRole('checkbox').check();
    await page.getByRole('button', {name: 'Move to warehouse'}).click();
    const dialog = page.getByRole('dialog', {name: 'Move to warehouse'});
    const destination = dialog.getByLabel('Destination warehouse');
    await expect(destination.getByRole('option')).toHaveText(['Usa', 'España']);
    await destination.selectOption({label: 'Usa'});
    await dialog.getByLabel('Quantity of KF-03').selectOption('2');
    await dialog.getByRole('button', {name: 'Move', exact: true}).click();

    await expect(
      page.getByRole('status').filter({
        hasText: 'Moved to Usa. The products arrive there as incoming.',
      }),
    ).toBeVisible();
    await expect(dialog).toHaveCount(0);
    await expect.poll(() => quantityOf(page, 'KF-03')).toBe(before - 2);
    const incoming = await page.request.get(
      '/api/v1/warehouses/2/stock?status=0&per_page=0',
    );
    const rows = (
      (await incoming.json()) as {items: {code: string; quantity: number}[]}
    ).items;
    expect(
      rows.find((r) => r.code === 'KF-03')?.quantity,
    ).toBeGreaterThanOrEqual(2);
    await page.goto('/admin/products/incoming?warehouse=2');
    await expect(page.getByRole('row', {name: /KF-03/})).toBeVisible();
  });

  test('INV-05 · A move the warehouse can no longer cover is refused, and nothing moves', async ({
    signedInAs,
    baseURL,
  }) => {
    const page = await signedInAs(INVENTORY);
    const origin = new URL(baseURL as string).origin;
    const created = await page.request.post('/api/v1/products', {
      headers: {Origin: origin},
      data: {code: MOVED.code, title: MOVED.code, status: 1, price: 5},
    });
    expect(created.status(), 'its own product').toBe(201);
    // España: the invoice cases list Colombia's stock while this runs, in another lane.
    const added = await page.request.post('/api/v1/warehouses/3/stock/add', {
      headers: {Origin: origin},
      data: {items: [{code: MOVED.code, quantity: 3}]},
    });
    expect(added.status()).toBe(204);

    await page.goto('/admin/products?warehouse=3');
    await page
      .getByRole('searchbox', {name: 'Search products'})
      .fill(MOVED.code);
    await stockRow(page, MOVED.code).getByRole('checkbox').check();
    await page.getByRole('button', {name: 'Move to warehouse'}).click();
    const dialog = page.getByRole('dialog', {name: 'Move to warehouse'});
    await dialog
      .getByLabel('Destination warehouse')
      .selectOption({label: 'Usa'});
    await dialog.getByLabel(`Quantity of ${MOVED.code}`).selectOption('3');

    // Meanwhile, in another tab, all three leave for Usa.
    const elsewhere = await page.request.post('/api/v1/warehouses/3/moves/2', {
      headers: {Origin: origin},
      data: {items: [{code: MOVED.code, quantity: 3}]},
    });
    expect(elsewhere.status()).toBe(204);
    await dialog.getByRole('button', {name: 'Move', exact: true}).click();

    await expect(dialog.getByRole('alert')).toHaveText(
      `Only 0 of ${MOVED.code} are available.`,
    );
    await expect(
      dialog.getByRole('button', {name: 'Move', exact: true}),
    ).toBeEnabled();
    await dialog.getByRole('button', {name: 'Cancel'}).click();
    await expect(dialog).toHaveCount(0);
    const incoming = (
      (await (
        await page.request.get('/api/v1/warehouses/2/stock?status=0&per_page=0')
      ).json()) as {items: {code: string; quantity: number}[]}
    ).items;
    expect(
      incoming.find((r) => r.code === MOVED.code)?.quantity,
      'only the other tab moved',
    ).toBe(3);
  });

  test('INV-06 · A new product is created, and the form names what is missing', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(INVENTORY);
    await page.goto('/admin/products');

    await page.getByRole('link', {name: 'Create product'}).click();
    await expect(
      page.getByRole('heading', {name: 'Create product'}),
    ).toBeVisible();
    await page.getByRole('button', {name: 'Save'}).click();
    await expect(page.getByLabel('Code')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    await expect(page.getByLabel('Title')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    await page.getByLabel('Code').fill('CODE');
    await page.getByRole('button', {name: 'Save'}).click();
    await expect(
      page.getByText('This value should not be equal to "CODE".'),
    ).toBeVisible();

    await page.getByLabel('Code').fill(NEW_PRODUCT.code);
    await page.getByLabel('Title').fill(NEW_PRODUCT.title);
    await page.getByLabel('Price').fill('25.5');
    await page.getByRole('button', {name: 'Save'}).click();

    await expect(page).toHaveURL(/\/admin\/products$/);
    await expect(
      page.getByRole('status').filter({hasText: 'Product saved'}),
    ).toBeVisible();
    const created = await page.request.get(
      `/api/v1/products/by-code/${NEW_PRODUCT.code}`,
    );
    expect(created.status()).toBe(200);
  });

  test('INV-07 · A product is edited, from the list and from its old address', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(INVENTORY);
    const product = (await (
      await page.request.get(`/api/v1/products/by-code/${NEW_PRODUCT.code}`)
    ).json()) as {uuid: string};

    await page.goto(`/admin/product/edit/${product.uuid}`);
    await expect(page).toHaveURL(
      new RegExp(`/admin/products/${product.uuid}/edit$`),
    );
    await expect(
      page.getByRole('heading', {name: 'Edit product'}),
    ).toBeVisible();
    await expect(page.getByLabel('Code')).toHaveValue(NEW_PRODUCT.code);
    await page.getByLabel('Title').fill('Smoke chair, renamed');
    await expect(page.getByRole('switch', {name: 'Active'})).toBeChecked();
    await page.getByText('Active', {exact: true}).click();
    await expect(page.getByRole('switch', {name: 'Active'})).not.toBeChecked();
    await page.getByRole('button', {name: 'Save'}).click();

    const toast = page.getByRole('status').filter({hasText: 'Product saved'});
    await expect(toast).toBeVisible();
    await expect(
      toast.getByRole('link'),
      'no next steps after an edit',
    ).toHaveCount(0);
    const saved = (await (
      await page.request.get(`/api/v1/products/${product.uuid}`)
    ).json()) as {title: string; status: number};
    expect(saved).toMatchObject({title: 'Smoke chair, renamed', status: 0});

    await stockRow(page, 'KF-01')
      .getByRole('button', {name: 'Actions for KF-01'})
      .click();
    await page.getByRole('menuitem', {name: 'Edit'}).click();
    await expect(page.getByLabel('Code')).toHaveValue('KF-01');
    await page.goto(
      '/admin/products/00000000-0000-4000-8000-000000000000/edit',
    );
    await expect(page.getByRole('alert')).toContainText(
      'This product no longer exists.',
    );
  });

  test('INV-08 · A person without the inventory role is refused', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(INVOICES);

    await page.goto('/admin/products');

    await expect(page.getByRole('alert')).toHaveText(
      'You do not have permission to do this.',
    );
    await expect(
      page.getByRole('link', {name: 'Products', exact: true}),
    ).toHaveCount(0);
    const answer = await page.request.get('/api/v1/warehouses/1/stock');
    expect(answer.status()).toBe(403);
  });
  test('INV-17 · The figures come from the list; the chips count it and narrow it', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(INVENTORY);
    const errors = consoleErrors(page);
    const figure = (label: string) =>
      page
        .locator('dt', {hasText: label})
        .locator('xpath=following-sibling::dd');
    const stockNow = async () =>
      (
        (await (
          await page.request.get(
            '/api/v1/warehouses/1/stock?status=1&per_page=0',
          )
        ).json()) as {
          items: {code: string; quantity: number; price: number | null}[];
        }
      ).items;

    // The page against the stock it was given (another lane ships from Colombia now and then: read both again).
    let stock = await stockNow();
    await expect
      .poll(
        async () => {
          stock = await stockNow();
          await page.goto('/admin/products?warehouse=1');
          await expect(figure('Units')).not.toHaveText('');
          const units = stock.reduce((sum, row) => sum + row.quantity, 0);
          return (
            [
              await figure('Products').textContent(),
              await figure('Units').textContent(),
            ].join(' ') ===
            `${stock.length} ${units.toLocaleString('en-US', {maximumFractionDigits: 3})}`
          );
        },
        {timeout: 20_000},
      )
      .toBe(true);
    const inStock = stock.filter((row) => row.quantity > 0).length;
    await expect(figure('Stock value')).toContainText('$');
    await expect(
      page.getByRole('button', {name: `All ${stock.length}`}),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(
      page.getByRole('button', {name: `In stock ${inStock}`}),
    ).toBeVisible();
    await page
      .getByRole('button', {name: `Out of stock ${stock.length - inStock}`})
      .click();
    await expect(stockRow(page, 'KF-01')).toHaveCount(0);
    await page.getByRole('button', {name: 'Clear filters'}).click();
    await expect(stockRow(page, 'KF-01')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('INV-18 · Each row has one "⋯" menu, and a click on the row opens its form', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(INVENTORY);
    await page.goto('/admin/products?warehouse=1');
    await expect(stockRow(page, 'KF-02')).toBeVisible();

    await stockRow(page, 'KF-02')
      .getByRole('button', {name: 'Actions for KF-02'})
      .click();
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem')).toHaveText([
      'Edit',
      'Download stock sheet',
    ]);
    const download = page.waitForEvent('download');
    await menu.getByRole('menuitem', {name: 'Download stock sheet'}).click();
    expect((await download).suggestedFilename()).toBe('Products.xls');

    // The fixtures' title is the code too: the Code cell comes first.
    await stockRow(page, 'KF-02')
      .getByRole('cell', {name: 'KF-02', exact: true})
      .first()
      .click();
    await expect(page).toHaveURL(/\/admin\/products\/[^/]+\/edit$/);
    await expect(page.getByLabel('Code')).toHaveValue('KF-02');
  });

  test('INV-19 · The selection bar moves or downloads what is ticked, and Move opens beside the list', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(INVENTORY);
    await page.goto('/admin/products?warehouse=1');
    await stockRow(page, 'KF-01').getByRole('checkbox').check();
    await stockRow(page, 'KF-02').getByRole('checkbox').check();
    await expect(page.getByText('2 selected')).toBeVisible();

    await page.getByRole('button', {name: 'Move to warehouse'}).click();
    const panel = page.getByRole('dialog', {name: 'Move to warehouse'});
    await expect(panel.getByText('From Colombia')).toBeVisible();
    await expect(panel.getByLabel('Quantity of KF-01')).toBeVisible();
    await expect(panel.getByLabel('Quantity of KF-02')).toBeVisible();
    await expect(
      page.getByRole('radiogroup', {name: 'Warehouse'}),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(page.getByText('2 selected')).toBeVisible();

    await page.getByRole('button', {name: 'Clear', exact: true}).click();
    await expect(page.getByText('2 selected')).toHaveCount(0);

    // Two products left at 1 each: one move, one of each, waiting in Usa as incoming.
    const incomingInUsa = async () => {
      const rows = (
        (await (
          await page.request.get(
            '/api/v1/warehouses/2/stock?status=0&per_page=0',
          )
        ).json()) as {items: {code: string; quantity: number}[]}
      ).items;
      return ['KF-02', 'KF-03'].map(
        (code) => rows.find((r) => r.code === code)?.quantity ?? 0,
      );
    };
    const before = await incomingInUsa();
    await stockRow(page, 'KF-02').getByRole('checkbox').check();
    await stockRow(page, 'KF-03').getByRole('checkbox').check();
    await page.getByRole('button', {name: 'Move to warehouse'}).click();
    await panel
      .getByLabel('Destination warehouse')
      .selectOption({label: 'Usa'});
    const moves: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().includes('/moves/')) {
        moves.push(request.url());
      }
    });
    await panel.getByRole('button', {name: 'Move', exact: true}).click();
    await expect(
      page.getByRole('status').filter({hasText: 'Moved to Usa.'}),
    ).toBeVisible();
    expect(moves, 'one move for both').toHaveLength(1);
    expect(await incomingInUsa()).toEqual([before[0]! + 1, before[1]! + 1]);
  });

  test('INV-20 · The warehouse is remembered, and the address can name it', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(INVENTORY);
    await page.goto('/admin/products?warehouse=1');
    await page.getByRole('radio', {name: 'Usa'}).click();
    await expect(page.getByRole('radio', {name: 'Usa'})).toBeChecked();

    await page.goto('/admin/products');
    await expect(page.getByRole('radio', {name: 'Usa'})).toBeChecked();

    await page.goto('/admin/products?warehouse=1');
    await expect(page.getByRole('radio', {name: 'Colombia'})).toBeChecked();
    await page.goto('/admin/products');
    await expect(page.getByRole('radio', {name: 'Colombia'})).toBeChecked();
  });

  test('INV-21 · A saved new product offers what to do next', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(INVENTORY);
    await page.goto('/admin/products/new');
    await expect(
      page.getByText(/won't be shown on the product list/),
    ).toHaveCount(0);
    await page.getByLabel('Code').fill('SMOKE-INV-21');
    await page.getByLabel('Title').fill('Smoke stool');
    await page.getByRole('button', {name: 'Save'}).click();

    await expect(page).toHaveURL(/\/admin\/products$/);
    await expect(
      page.getByRole('status').filter({hasText: 'Product saved'}),
    ).toBeVisible();
    await page
      .getByRole('status')
      .getByRole('link', {name: 'Upload a stock sheet'})
      .click();
    await expect(page).toHaveURL(/\/admin\/products\/upload$/);
  });
});

// The phone: lists as cards, nothing scrolls sideways (INV-22; every look of every screen is section 14's).
test.describe('2 Products on a phone', () => {
  test.use({
    viewport: {width: 390, height: 844},
    isMobile: true,
    hasTouch: true,
  });

  test('INV-22 · On a phone the list is cards and the form is one column', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(INVENTORY);
    await page.goto('/admin/products?warehouse=1');
    const card = stockRow(page, 'KF-01');
    await expect(card).toBeVisible();
    await expect(
      card.getByRole('columnheader'),
      'a card, not a table row',
    ).toHaveCount(0);
    await expect(
      card.getByRole('button', {name: 'Actions for KF-01'}),
    ).toBeVisible();
    await card.getByRole('checkbox').check();
    await expect(page.getByText('1 selected')).toBeVisible();
    await page.getByRole('button', {name: 'Move to warehouse'}).click();
    const panel = page.getByRole('dialog', {name: 'Move to warehouse'});
    await expect(panel).toBeVisible();
    await expect
      .poll(async () => Math.round((await panel.boundingBox())?.width ?? 0))
      .toBeGreaterThanOrEqual(358);
    await page.keyboard.press('Escape');
    const overflow = () =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
    expect(await overflow()).toBeLessThanOrEqual(0);

    await page.goto('/admin/products/new');
    await expect(page.getByLabel('Code')).toBeVisible();
    await expect(page.getByRole('button', {name: 'Save'})).toBeVisible();
    expect(await overflow()).toBeLessThanOrEqual(0);
  });
});
