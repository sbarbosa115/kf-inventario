import {
  ADMIN,
  INVENTORY,
  INVOICES,
  consoleErrors,
  expect,
  test,
} from './support/test';
import type {Page} from '@playwright/test';

// 2 Products (INV-01 – 08, 17 – 22), item 1 (products-ui). Other spec files may change the stock of the fixtures' products before these
// run (orders ship stock), so quantities are read before a move and compared after it, never assumed.
test.describe.configure({mode: 'serial'});

const NEW_PRODUCT = {code: 'SMOKE-INV-06', title: 'Smoke chair'};

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
  test('INV-01 · the product list opens on the first warehouse, and the old address lands on it', async ({
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

  test('INV-02 · another warehouse reloads the list; a search narrows it and "Show all" brings it back', async ({
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
    await page.getByRole('searchbox', {name: 'Search products'}).fill('no-such-product');
    await expect(
      page.getByText('Nothing matches these filters.'),
    ).toBeVisible();
    await page.getByRole('button', {name: 'Show all'}).click();
    await expect(stockRow(page, 'KF-01')).toBeVisible();
  });

  test('INV-03 · the selected products download as the stock spreadsheet', async ({
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

    expect((await download).suggestedFilename()).toBe('Products.xls');
  });

  test('INV-04 · Move to Warehouse moves the chosen quantity, which leaves the source', async ({
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
  });

  test('INV-06 · a new product is created, and the form names what is missing', async ({
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

  test('INV-07 · a product is edited, from the list and from its old address', async ({
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

    await expect(
      page.getByRole('status').filter({hasText: 'Product saved'}),
    ).toBeVisible();
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

  test('INV-08 · a person without the inventory role is refused', async ({
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
  test('INV-17 · the figures come from the list, and the chips count and narrow it', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(INVENTORY);
    const errors = consoleErrors(page);
    const stock = (
      (await (
        await page.request.get('/api/v1/warehouses/1/stock?status=1&per_page=0')
      ).json()) as {
        items: {code: string; quantity: number; price: number | null}[];
      }
    ).items;
    const units = stock.reduce((sum, row) => sum + row.quantity, 0);
    const inStock = stock.filter((row) => row.quantity > 0).length;

    await page.goto('/admin/products?warehouse=1');

    const figure = (label: string) =>
      page
        .locator('dt', {hasText: label})
        .locator('xpath=following-sibling::dd');
    await expect(figure('Products')).toHaveText(String(stock.length));
    await expect(figure('Units')).toHaveText(
      units.toLocaleString('en-US', {maximumFractionDigits: 3}),
    );
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

  test('INV-18 · each row has one menu, and a click on the row opens its form', async ({
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

  test('INV-19 · the selection bar moves or downloads what is ticked, and Move opens beside the list', async ({
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
  });

  test('INV-20 · the warehouse is remembered, and the address can name it', async ({
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

  test('INV-21 · a saved new product offers what to do next, and the links work', async ({
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

// The phone: lists as cards, nothing scrolls sideways (INV-22; the light and dark themes are run by hand).
test.describe('2 Products on a phone', () => {
  test.use({
    viewport: {width: 390, height: 844},
    isMobile: true,
    hasTouch: true,
  });

  test('INV-22 · on a phone the list is cards and the form one column, without sideways scroll', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(INVENTORY);
    await page.goto('/admin/products?warehouse=1');
    await expect(stockRow(page, 'KF-01')).toBeVisible();
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
