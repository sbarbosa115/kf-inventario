import {
  ADMIN,
  INVENTORY,
  INVOICES,
  consoleErrors,
  expect,
  test,
} from './support/test';
import type {Page} from '@playwright/test';

// 2 Products (INV-01 – 08), item 6. Other spec files may change the stock of the fixtures' products before these
// run (orders ship stock), so quantities are read before a move and compared after it, never assumed.
test.describe.configure({mode: 'serial'});

const NEW_PRODUCT = {code: 'SMOKE-INV-06', title: 'Smoke chair'};

function stockRow(page: Page, code: string) {
  return page.getByRole('row').filter({
    has: page.getByRole('cell', {name: code, exact: true}),
  });
}

async function quantityOf(page: Page, code: string): Promise<number> {
  const cells = stockRow(page, code).getByRole('cell');
  // Cells: selection, code, description, title, quantity…
  return Number(await cells.nth(4).innerText());
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
      page.getByRole('heading', {name: 'View products'}),
    ).toBeVisible();
    await expect(page.getByLabel('Warehouse')).toHaveValue('1');
    const row = stockRow(page, 'KF-01');
    await expect(row.getByRole('cell', {name: 'Colombia'})).toBeVisible();
    await expect(row.getByRole('cell', {name: '100.00'})).toBeVisible();
    await expect(row.getByRole('link', {name: 'Edit KF-01'})).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('INV-02 · another warehouse reloads the list; a search narrows it and "Show all" brings it back', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(INVENTORY);
    await page.goto('/admin/products');
    await expect(stockRow(page, 'KF-01')).toBeVisible();

    await page.getByLabel('Warehouse').selectOption({label: 'España'});
    await expect(
      page.getByText(/This warehouse has no products in stock/),
    ).toBeVisible();
    await page.getByLabel('Warehouse').selectOption({label: 'Colombia'});
    await expect(stockRow(page, 'KF-03')).toBeVisible();

    await page.getByRole('searchbox').fill('KF-02');
    await expect(stockRow(page, 'KF-02')).toBeVisible();
    await expect(stockRow(page, 'KF-01')).toHaveCount(0);
    await page.getByRole('searchbox').fill('no-such-product');
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
      page.getByRole('button', {name: /Update Selected Using Excel/}),
    ).toBeDisabled();

    await stockRow(page, 'KF-01').getByRole('checkbox').check();
    await stockRow(page, 'KF-02').getByRole('checkbox').check();
    await expect(page.getByText('2 products selected')).toBeVisible();
    const download = page.waitForEvent('download');
    await page.getByRole('link', {name: /Update Selected Using Excel/}).click();

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
    await page.getByRole('button', {name: /Move to Warehouse/}).click();
    const dialog = page.getByRole('dialog', {name: 'Move to Warehouse'});
    const destination = dialog.getByLabel('Destination Warehouse');
    await expect(destination.getByRole('option')).toHaveText(['Usa', 'España']);
    await destination.selectOption({label: 'Usa'});
    await dialog.getByLabel('Quantity of KF-03').selectOption('2');
    await dialog.getByRole('button', {name: 'Move', exact: true}).click();

    await expect(page.getByRole('status').filter({hasText: 'The products were moved to Usa.'})).toBeVisible();
    await expect(dialog).toHaveCount(0);
    await expect.poll(() => quantityOf(page, 'KF-03')).toBe(before - 2);
    const incoming = await page.request.get(
      '/api/v1/warehouses/2/stock?status=0',
    );
    const rows = (await incoming.json()) as {code: string; quantity: number}[];
    expect(
      rows.find((r) => r.code === 'KF-03')?.quantity,
    ).toBeGreaterThanOrEqual(2);
  });

  test('INV-06 · a new product is created, and the form names what is missing', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(INVENTORY);
    await page.goto('/admin/products');

    await page.getByRole('link', {name: 'Create Product'}).click();
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
    await expect(page.getByRole('status').filter({hasText: 'The product was created successfully.'})).toBeVisible();
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
    await page.getByLabel('Status').selectOption({label: 'Inactive'});
    await page.getByRole('button', {name: 'Save'}).click();

    await expect(page.getByRole('status').filter({hasText: 'The product was updated successfully.'})).toBeVisible();
    const saved = (await (
      await page.request.get(`/api/v1/products/${product.uuid}`)
    ).json()) as {title: string; status: number};
    expect(saved).toMatchObject({title: 'Smoke chair, renamed', status: 0});

    await stockRow(page, 'KF-01')
      .getByRole('link', {name: 'Edit KF-01'})
      .click();
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
      page.getByRole('link', {name: 'Product List', exact: true}),
    ).toHaveCount(0);
    const answer = await page.request.get('/api/v1/warehouses/1/stock');
    expect(answer.status()).toBe(403);
  });
});
