import type {Page} from '@playwright/test';
import {
  ADMIN,
  INVENTORY,
  INVOICES,
  consoleErrors,
  expect,
  test,
} from './support/test';

// 2 Products (INV-09 – 16, INV-23 – 30) and 3 Warehouses (WH-01 – 05): upload, scan, incoming, warehouses.
// The cases run in order on the fixtures (warehouses Colombia, Usa, España; KF-01 – 03 with 100 in Colombia): the stock
// INV-13 adds to Usa is what INV-14 takes out of it. Each test's browser starts with nothing remembered, so the scan
// screen opens on Colombia, in Add mode, with the "What changed" note.
test.describe.configure({mode: 'serial'});

const scanBox = (page: Page) => page.getByLabel('Barcode', {exact: true});

/** Reads codes as a person types them: an Enter within 50 ms of the last read is a scanner's burst, not a new read. */
async function scan(page: Page, ...codes: string[]) {
  for (const code of codes) {
    await page.waitForTimeout(60);
    await scanBox(page).fill(code);
    await scanBox(page).press('Enter');
  }
}

/** The running list's row of a code. */
const scanned = (page: Page, code: string) =>
  page
    .getByRole('list', {name: 'Scanned'})
    .getByRole('listitem')
    .filter({hasText: code});

const card = (page: Page, name: string) =>
  page
    .getByRole('article')
    .filter({has: page.getByRole('heading', {name, exact: true})});

test.describe('2 Products: upload, scan, incoming', () => {
  test('INV-09 · the upload screen shows its three steps and links to the template and to every product', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    const errors = consoleErrors(page);

    await page.goto('/admin/product/upload');

    await expect(page).toHaveURL(/\/admin\/products\/upload$/);
    await expect(
      page.getByRole('heading', {level: 1, name: 'Upload a stock sheet'}),
    ).toBeVisible();
    const steps = page
      .getByRole('list', {name: 'How to upload a stock sheet'})
      .getByRole('listitem');
    await expect(steps).toHaveCount(3);
    await expect(
      page.getByRole('link', {name: 'Download the template'}),
    ).toHaveAttribute('href', '/api/v1/products/template.xls');
    await expect(
      page.getByRole('link', {name: 'Download every product'}),
    ).toHaveAttribute('href', '/api/v1/products/template.xls?all=1');
    const sheet = await page.request.get('/api/v1/products/template.xls?all=1');
    expect(sheet.status(), 'the link opens a spreadsheet').toBe(200);
    expect(sheet.headers()['content-disposition']).toContain('attachment');
    expect(errors).toEqual([]);
  });

  test('INV-10 · Upload names what is missing and refuses a file that is not a spreadsheet in place', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/products/upload');

    await page.getByRole('button', {name: 'Upload', exact: true}).click();
    await expect(
      page.getByText('Choose the stock sheet to upload.'),
    ).toBeVisible();

    await page.getByLabel('Stock sheet', {exact: true}).setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not a spreadsheet'),
    });
    await expect(page.getByRole('alert')).toHaveText(
      'notes.txt is not an Excel sheet. Choose an .xls or .xlsx file.',
    );
    let sent = 0;
    page.on('request', (request) => {
      if (request.url().includes('/api/v1/products/upload')) sent += 1;
    });
    await page.getByRole('button', {name: 'Upload', exact: true}).click();
    await expect(page.getByRole('alert')).toHaveText(
      'Choose the stock sheet to upload.',
    );
    expect(sent, 'nothing is sent').toBe(0);
  });

  test('INV-11 · a spreadsheet from the template is stored in the chosen warehouse', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/products/upload');
    const sheet = await page.request.get('/api/v1/products/template.xls?all=1');

    await page.getByLabel('Stock sheet', {exact: true}).setInputFiles({
      name: 'products.xls',
      mimeType: 'application/vnd.ms-excel',
      buffer: await sheet.body(),
    });
    await page.getByRole('radio', {name: 'España'}).click();
    await page.getByRole('button', {name: 'Upload', exact: true}).click();

    const summary = page
      .getByRole('status')
      .filter({hasText: /rows? stored in España/});
    await expect(summary).toBeVisible();
    await expect(
      summary.getByRole('link', {name: 'Open the products of España'}),
    ).toHaveAttribute('href', '/admin/products?warehouse=3');
  });

  test('INV-12 · the scan screen lists a code on Enter, counts a repeated one and says when one is not a product', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    const errors = consoleErrors(page);
    await page.goto('/admin/product/update/bar-code');
    await expect(page).toHaveURL(/\/admin\/products\/barcode$/);
    await expect(
      page.getByRole('heading', {level: 1, name: 'Scan stock'}),
    ).toBeVisible();
    await expect(page.getByText(/Nothing scanned yet/)).toBeVisible();

    await scan(page, 'KF-01', 'KF-01', 'NOPE-404');

    await expect(scanBox(page)).toHaveValue('');
    await expect(scanBox(page)).toBeFocused();
    await expect(
      scanned(page, 'KF-01').getByLabel('Quantity of KF-01'),
    ).toHaveValue('2');
    await expect(scanned(page, 'NOPE-404')).toContainText('Not a product');
    await expect(scanned(page, 'KF-01')).not.toContainText('Not a product');
    await page.getByRole('button', {name: 'Remove NOPE-404'}).click();
    await expect(scanned(page, 'NOPE-404')).toHaveCount(0);
    // An unknown code is looked up and answered 404 on purpose ("Not a product"); the browser logs that request.
    expect(errors.filter((e) => !e.includes('status of 404'))).toEqual([]);
  });

  test('INV-13 · with Usa and Add chosen, the codes read are added in one tap', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/products/barcode');
    await page.getByRole('radio', {name: 'Usa'}).click();
    await scan(page, 'KF-01', 'KF-01');

    await page.getByRole('button', {name: 'Add to Usa'}).click();

    await expect(page.getByRole('dialog'), 'adding does not ask').toHaveCount(
      0,
    );
    await expect(
      page.getByRole('status').filter({hasText: 'Added 2 units to Usa.'}),
    ).toBeVisible();
    await expect(page.getByText(/Nothing scanned yet/)).toBeVisible();
    await expect(scanBox(page)).toBeFocused();
    const stock = await page.request.get(
      '/api/v1/warehouses/2/stock?per_page=0',
    );
    const rows = ((await stock.json()) as {items: {code: string; quantity: number}[]})
      .items;
    expect(rows.find((row) => row.code === 'KF-01')?.quantity).toBe(2);
  });

  test('INV-14 · removing asks first; more than the warehouse has is refused and keeps the list', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/products/barcode');
    await page.getByRole('radio', {name: 'Usa'}).click();
    await page.getByRole('radio', {name: 'Remove stock'}).click();
    await scan(page, 'KF-01');

    await page.getByLabel('Quantity of KF-01').fill('50');
    await page.getByRole('button', {name: 'Remove from Usa'}).click();
    const dialog = page.getByRole('dialog', {name: 'Remove from Usa?'});
    await expect(dialog).toContainText('50 units of 1 product');
    await dialog.getByRole('button', {name: 'Remove 50 units'}).click();
    await expect(page.getByRole('alert')).toHaveText(
      'There is not enough stock of KF-01: 2 available.',
    );
    await expect(page.getByLabel('Quantity of KF-01')).toHaveValue('50');

    await page.getByLabel('Quantity of KF-01').fill('1');
    await page.getByRole('button', {name: 'Remove from Usa'}).click();
    await page.getByRole('button', {name: 'Remove 1 unit'}).click();
    await expect(
      page.getByRole('status').filter({hasText: 'Removed 1 unit from Usa.'}),
    ).toBeVisible();
    const stock = await page.request.get(
      '/api/v1/warehouses/2/stock?per_page=0',
    );
    const rows = ((await stock.json()) as {items: {code: string; quantity: number}[]})
      .items;
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
    await page.getByRole('radio', {name: 'España'}).click();
    const row = page.getByRole('row', {name: /KF-02/});
    await expect(row).toContainText('4');

    await page.getByRole('button', {name: 'Approve all (1)'}).click();
    await page
      .getByRole('dialog')
      .getByRole('button', {name: 'Approve 1 product'})
      .click();

    await expect(
      page
        .getByRole('status')
        .filter({hasText: '1 incoming product was approved.'}),
    ).toBeVisible();
    await expect(page.getByText('Nothing waiting')).toBeVisible();
    await expect(
      page.getByRole('button', {name: 'Approve all (0)'}),
    ).toBeDisabled();
    const stock = await page.request.get(
      '/api/v1/warehouses/3/stock?per_page=0',
    );
    const rows = ((await stock.json()) as {items: {code: string; quantity: number}[]})
      .items;
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
    await page.getByLabel('Stock sheet', {exact: true}).setInputFiles({
      name: 'products.xls',
      mimeType: 'application/vnd.ms-excel',
      buffer: Buffer.from('x'),
    });
    await page.getByRole('radio', {name: 'Usa'}).click();
    await page.getByRole('button', {name: 'Upload', exact: true}).click();
    await expect(page.getByRole('alert')).toHaveText(
      'You do not have permission to do this.',
    );
  });

  test('INV-23 · the scan screen remembers the warehouse and the mode', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(INVENTORY);
    await page.goto('/admin/products/barcode');
    await expect(page.getByRole('radio', {name: 'Colombia'})).toBeChecked();
    await expect(page.getByRole('radio', {name: 'Add stock'})).toBeChecked();

    await page.getByRole('radio', {name: 'España'}).click();
    await page.getByRole('radio', {name: 'Remove stock'}).click();
    await page.reload();

    await expect(page.getByRole('radio', {name: 'España'})).toBeChecked();
    await expect(page.getByRole('radio', {name: 'Remove stock'})).toBeChecked();
    await expect(
      page.getByRole('button', {name: 'Remove from España'}),
    ).toBeDisabled();
  });

  test('INV-24 · Undo last scan takes back the last read, by button and by Ctrl+Z', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/products/barcode');
    const undo = page.getByRole('button', {name: 'Undo last scan'});
    await expect(undo).toBeDisabled();

    await scan(page, 'KF-01', 'KF-01', 'KF-02');
    await undo.click();
    await expect(scanned(page, 'KF-02')).toHaveCount(0);
    await expect(page.getByLabel('Quantity of KF-01')).toHaveValue('2');
    await expect(scanBox(page)).toBeFocused();

    await page.keyboard.press('Control+z');
    await expect(page.getByLabel('Quantity of KF-01')).toHaveValue('1');
  });

  test('INV-25 · the footer sums the products and units to send, leaving out codes that are not products', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/products/barcode');

    await scan(page, 'KF-01', 'KF-02', 'KF-02', 'NOPE-25');
    await expect(scanned(page, 'NOPE-25')).toContainText('Not a product');

    await expect(page.getByText('2 products · 3 units')).toBeVisible();
    await expect(
      page.getByText('1 code that is not a product is left out.'),
    ).toBeVisible();
    await expect(
      page.getByRole('button', {name: 'Add to Colombia'}),
    ).toBeEnabled();
    await page.getByRole('button', {name: 'One more KF-01'}).click();
    await expect(page.getByText('2 products · 4 units')).toBeVisible();
  });

  test('INV-26 · on an address that is not https the camera says why, and typing still works', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/products/barcode');

    await expect(
      page.getByText(
        'The camera needs a secure address (https). Type the code instead.',
      ),
    ).toBeVisible();
    await expect(page.getByRole('button', {name: 'Start camera'})).toHaveCount(
      0,
    );
    await scan(page, 'KF-03');
    await expect(page.getByLabel('Quantity of KF-03')).toHaveValue('1');
  });

  test('INV-27 · the note on what changed is shown until it is dismissed', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(INVENTORY);
    await page.goto('/admin/products/barcode');
    await expect(page.getByText(/What changed/)).toBeVisible();

    await page.getByRole('button', {name: 'Dismiss', exact: true}).click();
    await expect(page.getByText(/What changed/)).toHaveCount(0);
    await page.reload();

    await expect(
      page.getByRole('heading', {level: 1, name: 'Scan stock'}),
    ).toBeVisible();
    await expect(page.getByText(/What changed/)).toHaveCount(0);
  });

  test('INV-28 · the chosen sheet shows its name, size and type, and can be taken back', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/products/upload');
    const sheet = await page.request.get('/api/v1/products/template.xls');

    await page.getByLabel('Stock sheet', {exact: true}).setInputFiles({
      name: 'products.xls',
      mimeType: 'application/vnd.ms-excel',
      buffer: await sheet.body(),
    });

    await expect(page.getByText('products.xls', {exact: true})).toBeVisible();
    await expect(page.getByText(/KB · XLS$/)).toBeVisible();
    await page.getByRole('button', {name: 'Remove products.xls'}).click();
    await expect(page.getByText('products.xls', {exact: true})).toHaveCount(0);
  });

  test('INV-29 · Approve all names the products, units and warehouse first, and Cancel approves nothing', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    const moved = await page.request.post('/api/v1/warehouses/1/moves/3', {
      data: {items: [{code: 'KF-03', quantity: 1}]},
    });
    expect(moved.status()).toBe(204);

    await page.goto('/admin/products/incoming?warehouse=3');
    await expect(
      page.getByText('in España · 1 product · 1 unit'),
    ).toBeVisible();
    await page.getByRole('button', {name: 'Approve all (1)'}).click();
    const dialog = page.getByRole('dialog', {
      name: 'Approve everything incoming?',
    });
    await expect(dialog).toContainText(
      "Approve 1 product, 1 unit, into España's stock?",
    );
    await dialog.getByRole('button', {name: 'Cancel'}).click();
    await expect(page.getByRole('row', {name: /KF-03/})).toBeVisible();
    const incoming = await page.request.get(
      '/api/v1/warehouses/3/stock?status=0&per_page=0',
    );
    expect(
      ((await incoming.json()) as {items: unknown[]}).items,
      'nothing was approved',
    ).toHaveLength(1);

    // Leave nothing waiting for the next run's cases.
    await page.getByRole('button', {name: 'Approve all (1)'}).click();
    await page.getByRole('button', {name: 'Approve 1 product'}).click();
    await expect(page.getByText('Nothing waiting')).toBeVisible();
  });

  test.describe('at 390 px', () => {
    test.use({
      viewport: {width: 390, height: 844},
      isMobile: true,
      hasTouch: true,
    });

    test('INV-30 · the scan, upload, incoming and warehouses screens fit a phone', async ({
      signedInAs,
    }) => {
      const page = await signedInAs(ADMIN);
      for (const address of [
        '/admin/products/barcode',
        '/admin/products/upload',
        '/admin/products/incoming',
        '/admin/warehouses',
      ]) {
        await page.goto(address);
        await expect(page.getByRole('heading', {level: 1})).toBeVisible();
        const [scroll, client] = await page.evaluate(() => [
          document.documentElement.scrollWidth,
          document.documentElement.clientWidth,
        ]);
        expect(scroll, `${address} does not scroll sideways`).toBe(client);
      }
      await page.goto('/admin/products/barcode');
      await scan(page, 'KF-01');
      await expect(
        page.getByRole('button', {name: 'Add to Colombia'}),
      ).toBeInViewport();
    });
  });
});

test.describe('3 Warehouses', () => {
  test('WH-01 · every warehouse has a card, and the old address lands on them', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    const errors = consoleErrors(page);

    await page.goto('/admin/warehouse/');

    await expect(page).toHaveURL(/\/admin\/warehouses$/);
    await expect(
      page.getByRole('heading', {level: 1, name: 'Warehouses'}),
    ).toBeVisible();
    for (const name of ['Colombia', 'Usa', 'España']) {
      await expect(card(page, name)).toBeVisible();
    }
    await page.goto('/admin/warehouse/edit/1');
    await expect(page).toHaveURL(/\/admin\/warehouses$/);
    expect(errors).toEqual([]);
  });

  test('WH-02 · a warehouse is renamed in place, and a blank name is refused', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/warehouses');

    await card(page, 'Usa')
      .getByRole('button', {name: 'Usa', exact: true})
      .click();
    const name = page.getByLabel('New name for Usa');
    await expect(name).toHaveValue('Usa');
    await name.fill('');
    await page.getByRole('button', {name: 'Save'}).click();
    await expect(
      page.getByText('Type a name for the warehouse.'),
    ).toBeVisible();

    await name.fill('Miami');
    await name.press('Enter');
    await expect(
      page.getByRole('status').filter({hasText: 'Usa is now Miami.'}),
    ).toBeVisible();
    await expect(card(page, 'Miami')).toBeVisible();

    // The other specs know the fixtures' name: put it back.
    await card(page, 'Miami')
      .getByRole('button', {name: 'Miami', exact: true})
      .click();
    await page.getByLabel('New name for Miami').fill('Usa');
    await page.getByLabel('New name for Miami').press('Enter');
    await expect(card(page, 'Usa')).toBeVisible();
  });

  test('WH-03 · any signed-in person can open the warehouses by address', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(INVOICES);

    await page.goto('/admin/warehouses');

    await expect(
      page.getByRole('heading', {level: 1, name: 'Warehouses'}),
    ).toBeVisible();
    await expect(card(page, 'Colombia')).toBeVisible();
  });

  test('WH-04 · Rename in the card menu opens the name, and Escape cancels without saving', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/warehouses');

    await page.getByRole('button', {name: 'Actions for España'}).click();
    await page.getByRole('menuitem', {name: 'Rename'}).click();
    const name = page.getByLabel('New name for España');
    await expect(name).toBeFocused();
    await name.fill('Madrid');
    await name.press('Escape');

    await expect(page.getByLabel('New name for España')).toHaveCount(0);
    await expect(card(page, 'España')).toBeVisible();
    const list = await page.request.get('/api/v1/warehouses');
    const names = ((await list.json()) as {name: string}[]).map((w) => w.name);
    expect(names, 'nothing was saved').toContain('España');
  });

  test('WH-05 · each card shows the shop addresses whose orders arrive there', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/warehouses');

    await expect(card(page, 'Colombia')).toContainText(
      'Shop orders arrive from',
    );
    await expect(card(page, 'Colombia')).toContainText('https://colombia.test');
    await expect(card(page, 'España')).toContainText('https://espana.test');
  });
});
