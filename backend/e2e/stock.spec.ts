import {ADMIN, INVOICES, consoleErrors, expect, test} from './support/test';

// 2 Products (INV-09 – 16) and 3 Warehouses (WH-01 – 03): upload, barcode reader, incoming products, warehouses.
// The cases run in order on the fixtures (warehouses Colombia, Usa, España; KF-01 – 03 with 100 in Colombia): the stock
// INV-13 adds to Usa is what INV-14 takes out of it.
test.describe.configure({mode: 'serial'});

test.describe('2 Products: upload, barcode reader, incoming', () => {
  test('INV-09 · the upload screen explains itself and links to the template and to every product', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    const errors = consoleErrors(page);

    await page.goto('/admin/product/upload');

    await expect(page).toHaveURL(/\/admin\/products\/upload$/);
    await expect(
      page.getByRole('heading', {name: 'Upload products'}),
    ).toBeVisible();
    await expect(
      page.getByRole('link', {name: /Download template/}),
    ).toHaveAttribute('href', '/api/v1/products/template.xls');
    await expect(
      page.getByRole('link', {name: /Download All Products/}),
    ).toHaveAttribute('href', '/api/v1/products/template.xls?all=1');
    const sheet = await page.request.get('/api/v1/products/template.xls?all=1');
    expect(sheet.status(), 'the link opens a spreadsheet').toBe(200);
    expect(sheet.headers()['content-disposition']).toContain('attachment');
    expect(errors).toEqual([]);
  });

  test('INV-10 · Upload names what is missing and refuses a file that is not a spreadsheet', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/products/upload');

    await page.getByRole('button', {name: 'Upload', exact: true}).click();
    await expect(
      page.getByText('Choose a spreadsheet to upload.'),
    ).toBeVisible();
    await expect(
      page.getByText('Choose the warehouse the quantities go to.'),
    ).toBeVisible();

    await page.getByLabel(/Select a xls file/).setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not a spreadsheet'),
    });
    await page.getByLabel('Warehouse').selectOption({label: 'Usa'});
    await page.getByRole('button', {name: 'Upload', exact: true}).click();

    await expect(page.getByRole('alert')).toHaveText(
      'The file is not an Excel spreadsheet (xls or xlsx).',
    );
  });

  test('INV-11 · a spreadsheet from the template is stored in the chosen warehouse', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/products/upload');
    const sheet = await page.request.get('/api/v1/products/template.xls?all=1');

    await page.getByLabel(/Select a xls file/).setInputFiles({
      name: 'products.xls',
      mimeType: 'application/vnd.ms-excel',
      buffer: await sheet.body(),
    });
    await page.getByLabel('Warehouse').selectOption({label: 'España'});
    await page.getByRole('button', {name: 'Upload', exact: true}).click();

    await expect(
      page
        .getByRole('status')
        .filter({hasText: /products? w(as|ere) stored\./}),
    ).toBeVisible();
    await expect(
      page.getByRole('status').getByRole('link', {name: 'Product List'}),
    ).toBeVisible();
  });

  test('INV-12 · the barcode reader adds a code on Enter, counts a repeated one and checks it exists', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    const errors = consoleErrors(page);
    await page.goto('/admin/product/update/bar-code');
    await expect(page).toHaveURL(/\/admin\/products\/barcode$/);
    await expect(page.getByText('No products read yet.')).toBeVisible();

    const box = page.getByPlaceholder('Bar code');
    await box.fill('KF-01');
    await box.press('Enter');
    await box.fill('KF-01');
    await box.press('Enter');
    await box.fill('NOPE-404');
    await box.press('Enter');

    await expect(box).toHaveValue('');
    const known = page.getByRole('row', {name: /KF-01/});
    await expect(known.getByLabel('Quantity of KF-01')).toHaveValue('2');
    await expect(known.getByTitle('The product exists')).toBeVisible();
    const unknown = page.getByRole('row', {name: /NOPE-404/});
    await expect(
      unknown.getByTitle('The product does not exist'),
    ).toBeVisible();
    await page.getByRole('button', {name: 'Remove NOPE-404'}).click();
    await expect(page.getByRole('row', {name: /NOPE-404/})).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('INV-13 · the codes read are confirmed and added to the chosen warehouse', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/products/barcode');
    const box = page.getByPlaceholder('Bar code');
    await box.fill('KF-01');
    await box.press('Enter');
    await box.fill('KF-01');
    await box.press('Enter');
    await expect(
      page.getByRole('button', {name: 'Add products'}),
    ).toBeDisabled();

    await page.getByLabel('Warehouse').selectOption({label: 'Usa'});
    await page.getByRole('button', {name: 'Add products'}).click();
    const dialog = page.getByRole('dialog', {name: 'Confirm the products'});
    await expect(dialog).toContainText('These products will go to Usa');
    await expect(dialog.getByRole('cell', {name: 'KF-01'})).toBeVisible();
    await dialog.getByRole('button', {name: 'Add quantity'}).click();

    await expect(
      page
        .getByRole('status')
        .filter({hasText: 'The products were added to Usa.'}),
    ).toBeVisible();
    await expect(page.getByText('No products read yet.')).toBeVisible();
    const stock = await page.request.get('/api/v1/warehouses/2/stock');
    const rows = (await stock.json()) as {code: string; quantity: number}[];
    expect(rows.find((row) => row.code === 'KF-01')?.quantity).toBe(2);
  });

  test('INV-14 · removing more than the warehouse has is refused and keeps the list', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/products/barcode');
    const box = page.getByPlaceholder('Bar code');
    await box.fill('KF-01');
    await box.press('Enter');
    await page.getByLabel('Warehouse').selectOption({label: 'Usa'});

    await page.getByLabel('Quantity of KF-01').fill('50');
    await page.getByRole('button', {name: 'Remove products'}).click();
    await page.getByRole('button', {name: 'Remove quantity'}).click();
    await expect(page.getByRole('alert')).toHaveText(
      'There is not enough stock of KF-01: 2 available.',
    );
    await expect(page.getByLabel('Quantity of KF-01')).toHaveValue('50');

    await page.getByLabel('Quantity of KF-01').fill('1');
    await page.getByRole('button', {name: 'Remove products'}).click();
    await page.getByRole('button', {name: 'Remove quantity'}).click();
    await expect(
      page
        .getByRole('status')
        .filter({hasText: 'The products were removed from Usa.'}),
    ).toBeVisible();
    const stock = await page.request.get('/api/v1/warehouses/2/stock');
    const rows = (await stock.json()) as {code: string; quantity: number}[];
    expect(rows.find((row) => row.code === 'KF-01')?.quantity).toBe(1);
  });

  test('INV-15 · incoming products wait in a list until "Approve all" puts them in stock', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    const moved = await page.request.post('/api/v1/warehouses/1/moves/3', {
      data: {items: [{code: 'KF-02', quantity: 4}]},
    });
    expect(moved.status(), 'a move arrives as incoming').toBe(204);

    await page.goto('/admin/product/incoming');
    await expect(page).toHaveURL(/\/admin\/products\/incoming$/);
    await page.getByLabel('Warehouse').selectOption({label: 'España'});
    const row = page.getByRole('row', {name: /KF-02/});
    await expect(row).toContainText('4');
    await expect(row).toContainText('España');

    await page.getByRole('button', {name: /Approve all/}).click();

    await expect(
      page
        .getByRole('status')
        .filter({hasText: '1 incoming product was approved.'}),
    ).toBeVisible();
    await expect(
      page.getByText('Nothing is waiting for approval in this warehouse.'),
    ).toBeVisible();
    await expect(
      page.getByRole('button', {name: /Approve all/}),
    ).toBeDisabled();
    const stock = await page.request.get('/api/v1/warehouses/3/stock');
    const rows = (await stock.json()) as {code: string; quantity: number}[];
    expect(rows.find((r) => r.code === 'KF-02')?.quantity).toBe(4);
  });

  test('INV-16 · a person without the inventory role is told so on the stock screens', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(INVOICES);

    await page.goto('/admin/products/incoming');
    await expect(page.getByRole('alert')).toHaveText(
      'You do not have permission to do this.',
    );

    await page.goto('/admin/products/upload');
    await page.getByLabel(/Select a xls file/).setInputFiles({
      name: 'products.xls',
      mimeType: 'application/vnd.ms-excel',
      buffer: Buffer.from('x'),
    });
    await page.getByLabel('Warehouse').selectOption({label: 'Usa'});
    await page.getByRole('button', {name: 'Upload', exact: true}).click();
    await expect(page.getByRole('alert')).toHaveText(
      'You do not have permission to do this.',
    );
  });
});

test.describe('3 Warehouses', () => {
  test('WH-01 · the list shows every warehouse, and the old address lands on it', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    const errors = consoleErrors(page);

    await page.goto('/admin/warehouse/');

    await expect(page).toHaveURL(/\/admin\/warehouses$/);
    await expect(
      page.getByRole('heading', {name: 'View warehouses'}),
    ).toBeVisible();
    for (const name of ['Colombia', 'Usa', 'España']) {
      await expect(
        page.getByRole('row', {name: new RegExp(name)}),
      ).toBeVisible();
    }
    await page.goto('/admin/warehouse/edit/1');
    await expect(page).toHaveURL(/\/admin\/warehouses$/);
    expect(errors).toEqual([]);
  });

  test('WH-02 · a warehouse is renamed in a modal, and a blank name is refused', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/warehouses');

    await page
      .getByRole('row', {name: /Usa/})
      .getByRole('button', {name: /Edit/})
      .click();
    const dialog = page.getByRole('dialog', {name: 'Edit warehouse'});
    await expect(dialog.getByLabel('Name')).toHaveValue('Usa');
    await dialog.getByLabel('Name').fill('');
    await dialog.getByRole('button', {name: 'Save'}).click();
    await expect(
      dialog.getByText('This value should not be blank.'),
    ).toBeVisible();

    await dialog.getByLabel('Name').fill('Miami');
    await dialog.getByRole('button', {name: 'Save'}).click();
    await expect(
      page
        .getByRole('status')
        .filter({hasText: 'Warehouse updated successfully'}),
    ).toBeVisible();
    await expect(page.getByRole('row', {name: /Miami/})).toBeVisible();

    // The other specs know the fixtures' name: put it back.
    await page
      .getByRole('row', {name: /Miami/})
      .getByRole('button', {name: /Edit/})
      .click();
    await page.getByLabel('Name').fill('Usa');
    await page.getByRole('button', {name: 'Save'}).click();
    await expect(page.getByRole('row', {name: /Usa/})).toBeVisible();
  });

  test('WH-03 · any signed-in person can open the warehouses by address', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(INVOICES);

    await page.goto('/admin/warehouses');

    await expect(
      page.getByRole('heading', {name: 'View warehouses'}),
    ).toBeVisible();
    await expect(page.getByRole('row', {name: /Colombia/})).toBeVisible();
  });
});
