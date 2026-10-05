import {ADMIN, INVOICES, consoleErrors, expect, test} from './support/test';

// 6 Invoices (INVC-01 – 06), signed in as the invoice clerk (the admin is refused on invoices by design). The cases run
// in order on the fixtures (invoice INV-0001; customer Jose Perez; KF-01 – 03 in Colombia): the invoice INVC-03
// creates is INV-0002, which INVC-05 then finds taken.
test.describe.configure({mode: 'serial'});

test.describe('6 Invoices', () => {
  test('INVC-01 · the list shows the invoices, and the old addresses land on the new screens', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(INVOICES);
    const errors = consoleErrors(page);

    await page.goto('/admin/invoice/');

    await expect(page).toHaveURL(/\/admin\/invoices$/);
    await expect(page.getByRole('heading', {name: 'Invoices'})).toBeVisible();
    await expect(
      page.getByRole('link', {name: 'Create invoice'}),
    ).toBeVisible();
    const row = page.getByRole('row', {name: /INV-0001/});
    await expect(row).toContainText('POS Client');
    await expect(row).toContainText('100.00');
    await expect(row.getByRole('link', {name: /View as PDF/})).toHaveAttribute(
      'target',
      '_blank',
    );
    await page.getByRole('searchbox').fill('nobody-is-called-this');
    await expect(
      page.getByText('Nothing matches these filters.'),
    ).toBeVisible();
    await page.getByRole('button', {name: 'Show all'}).click();
    await expect(row).toBeVisible();

    await page.goto('/admin/invoice/new');
    await expect(page).toHaveURL(/\/admin\/invoices\/new$/);
    expect(errors).toEqual([]);
  });

  test('INVC-02 · the detail opens in a dialog with the lines and the PDF link', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(INVOICES);
    await page.goto('/admin/invoices');

    await page.getByRole('button', {name: 'Invoice Detail: INV-0001'}).click();

    const dialog = page.getByRole('dialog', {name: 'Invoice Detail'});
    await expect(dialog).toContainText('Example product');
    await expect(dialog).toContainText('100.00');
    await expect(dialog.getByRole('link', {name: 'View as PDF'})).toBeVisible();
    await dialog.getByRole('button', {name: 'Close'}).first().click();
    await expect(dialog).toHaveCount(0);
  });

  test('INVC-03 · an invoice is created with a customer, a product and tax, its PDF opens and the list shows it', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(INVOICES);
    const errors = consoleErrors(page);
    await page.goto('/admin/invoices');

    await page.getByRole('link', {name: 'Create invoice'}).click();
    await expect(
      page.getByRole('heading', {name: 'Create invoice'}),
    ).toBeVisible();
    await expect(page.getByLabel('Invoice #')).toHaveValue('INV-0002');
    await page.getByLabel('Customer', {exact: true}).fill('jose');
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('Email')).toHaveValue(
      'jose.perez@example.com',
    );
    await page.getByLabel('Product 1').fill('KF-02');
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('Description 1')).toHaveValue('KF-02');
    await expect(page.getByLabel('Unit price 1')).toHaveValue('150');
    await page.getByLabel('Quantity 1').fill('2');
    await page.getByLabel('Sale Tax').selectOption('6%');
    await expect(page.getByTestId('subtotal')).toHaveText('300.00');
    await expect(page.getByTestId('tax')).toHaveText('18.00');
    await expect(page.getByTestId('total')).toHaveText('318.00');
    await page
      .getByLabel('Payment Method')
      .selectOption({label: 'Credit card - Paypal'});

    const opened = page.context().waitForEvent('page');
    await page.getByRole('button', {name: 'Create Invoice'}).click();
    await (await opened).close();

    await expect(page).toHaveURL(/\/admin\/invoices$/);
    await expect(page.getByRole('status')).toContainText(
      'The invoice was created successfully.',
    );
    const row = page.getByRole('row', {name: /INV-0002/});
    await expect(row).toContainText('Jose Perez');
    await expect(row).toContainText('318.00');
    const href = await row
      .getByRole('link', {name: /View as PDF/})
      .getAttribute('href');
    const pdf = await page.request.get(href!);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()['content-type']).toContain('application/pdf');
    expect(errors).toEqual([]);
  });

  test('INVC-04 · Add all products puts every product of the warehouse on the invoice, and an item can be removed', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(INVOICES);
    await page.goto('/admin/invoices/new');

    await expect(page.getByLabel('Description 1')).toHaveValue('');
    await page.getByRole('button', {name: 'Add all products'}).click();

    await expect(page.getByLabel('Description 1')).toHaveValue('KF-01');
    await expect(page.getByLabel('Description 2')).toHaveValue('KF-02');
    await expect(page.getByLabel('Description 3')).toHaveValue('KF-03');
    await expect(page.getByTestId('total')).toHaveText('450.00');
    await page.getByRole('button', {name: 'Remove item 3'}).click();
    await expect(page.getByLabel('Description 3')).toHaveCount(0);
    await expect(page.getByTestId('total')).toHaveText('250.00');
    await page.getByRole('button', {name: 'Add item'}).click();
    await expect(page.getByLabel('Description 3')).toHaveValue('');
  });

  test('INVC-05 · an invoice needs an item, and a code already used is refused', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(INVOICES);
    await page.goto('/admin/invoices/new');

    await page.getByRole('button', {name: 'Create Invoice'}).click();
    await expect(page.getByRole('alert')).toContainText(
      'Please add at least one invoice item.',
    );
    await expect(page).toHaveURL(/\/admin\/invoices\/new$/);

    await page.getByLabel('Description 1').fill('Shipping');
    await page.getByLabel('Invoice #').fill('INV-0001');
    await page.getByRole('button', {name: 'Create Invoice'}).click();
    await expect(
      page.getByText('An invoice with this code already exists.'),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/invoices\/new$/);
  });

  test('INVC-06 · the admin is refused on invoices: no sidebar entry, no list, 403 from the API', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);

    await page.goto('/admin/invoices');

    await expect(page.getByRole('link', {name: 'Invoices'})).toHaveCount(0);
    await expect(page.getByRole('alert')).toContainText(
      'You do not have permission to do this.',
    );
    expect((await page.request.get('/api/v1/invoices')).status()).toBe(403);
  });
});
