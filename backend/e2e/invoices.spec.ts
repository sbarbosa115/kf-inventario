import {ADMIN, SALES, consoleErrors, expect, test} from './support/test';

// 6 Invoices (INVC-01 – 10), signed in as the sales clerk (the invoice roles + inventory: the form lists products; the
// admin is refused on invoices by design). The cases run in order on the fixtures (invoice INV-0001; customer Jose
// Perez; KF-01 – 03 in Colombia): the invoice INVC-03 creates is INV-0002, which INVC-05 then finds taken.
test.describe.configure({mode: 'serial'});

test.describe('6 Invoices', () => {
  test('INVC-01 · The list shows the invoices, and the old addresses land on the new screens', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(SALES);
    const errors = consoleErrors(page);

    await page.goto('/admin/invoice/');

    await expect(page).toHaveURL(/\/admin\/invoices$/);
    await expect(page.getByRole('heading', {name: 'Invoices'})).toBeVisible();
    await expect(
      page.getByRole('link', {name: 'Create invoice'}),
    ).toBeVisible();
    const row = page.getByRole('row', {name: /INV-0001/});
    await expect(row).toContainText('Walk-in customer');
    await expect(row).toContainText('$100.00');
    await row.getByRole('button', {name: /Actions for INV-0001/}).click();
    await expect(
      page.getByRole('menuitem', {name: /Open PDF/}),
    ).toHaveAttribute('target', '_blank');
    await page.keyboard.press('Escape');
    await page
      .getByRole('searchbox', {name: 'Customer or invoice number'})
      .fill('nobody-is-called-this');
    await expect(
      page.getByText('Nothing matches these filters.'),
    ).toBeVisible();
    await page.getByRole('button', {name: 'Show all'}).click();
    await expect(row).toBeVisible();

    await page.goto('/admin/invoice/new');
    await expect(page).toHaveURL(/\/admin\/invoices\/new$/);
    expect(errors).toEqual([]);
  });

  test('INVC-02 · The detail opens in a slide-over with the lines and the PDF', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(SALES);
    await page.goto('/admin/invoices');

    await page.getByRole('button', {name: /Actions for INV-0001/}).click();
    await page.getByRole('menuitem', {name: /Detail/}).click();

    const dialog = page.getByRole('dialog', {name: 'Invoice INV-0001'});
    await expect(dialog).toContainText('Example product');
    await expect(dialog).toContainText('$100.00');
    const pdf = dialog.getByRole('link', {name: 'Open PDF'});
    await expect(pdf).toHaveAttribute('target', '_blank');
    const answer = await page.request.get(
      (await pdf.getAttribute('href')) as string,
    );
    expect(answer.headers()['content-type']).toContain('application/pdf');
    expect((await answer.body()).subarray(0, 5).toString()).toBe('%PDF-');
    await dialog.getByRole('button', {name: 'Close'}).first().click();
    await expect(dialog).toHaveCount(0);
  });

  test('INVC-03 · An invoice is created with a customer, a product and tax, and the list shows it', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(SALES);
    const errors = consoleErrors(page);
    await page.goto('/admin/invoices');

    await page.getByRole('link', {name: 'Create invoice'}).click();
    await expect(
      page.getByRole('heading', {name: 'Create invoice'}),
    ).toBeVisible();
    await expect(page.getByLabel('Invoice number')).toHaveValue('INV-0002');
    await page.getByRole('combobox', {name: 'Customer'}).fill('jose');
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('Email')).toHaveValue(
      'jose.perez@example.com',
    );
    await page.getByLabel('Product 1').fill('KF-02');
    // Click the option once it is listed: Enter before the warehouse's stock has loaded picks nothing.
    await page.getByRole('option', {name: 'KF-02 (KF-02)'}).click();
    await expect(page.getByLabel('Description 1')).toHaveValue('KF-02');
    await expect(page.getByLabel('Unit price 1')).toHaveValue('150');
    await page.getByLabel('Quantity 1').fill('2');
    await page.getByLabel('Sales tax').selectOption('6%');
    await expect(page.getByTestId('subtotal')).toHaveText('$300.00');
    await expect(page.getByTestId('tax')).toHaveText('$18.00');
    await expect(page.getByTestId('total')).toHaveText('$318.00');
    await page
      .getByLabel('Payment method')
      .selectOption({label: 'Credit card - Paypal'});

    const opened = page.context().waitForEvent('page');
    await page.getByRole('button', {name: 'Create invoice'}).click();
    await (await opened).close();

    await expect(page).toHaveURL(/\/admin\/invoices$/);
    await expect(
      page.getByRole('status').filter({hasText: 'Invoice created.'}),
    ).toBeVisible();
    const row = page.getByRole('row', {name: /INV-0002/});
    await expect(row).toContainText('Jose Perez');
    await expect(row).toContainText('$318.00');
    await row.getByRole('button', {name: /Actions for INV-0002/}).click();
    const href = await page
      .getByRole('menuitem', {name: /Open PDF/})
      .getAttribute('href');
    const pdf = await page.request.get(href!);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()['content-type']).toContain('application/pdf');
    expect(errors).toEqual([]);
  });

  test('INVC-04 · Add all products puts every product of the warehouse on the invoice, and a line can be removed', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(SALES);
    await page.goto('/admin/invoices/new');

    await expect(page.getByLabel('Description 1')).toHaveValue('');
    await page.getByRole('button', {name: /Add all products from/}).click();

    await expect(page.getByLabel('Description 1')).toHaveValue('KF-01');
    await expect(page.getByLabel('Description 2')).toHaveValue('KF-02');
    await expect(page.getByLabel('Description 3')).toHaveValue('KF-03');
    await expect(page.getByTestId('total')).toHaveText('$450.00');
    await page.getByRole('button', {name: 'Remove line 3'}).click();
    await expect(page.getByLabel('Description 3')).toHaveCount(0);
    await expect(page.getByTestId('total')).toHaveText('$250.00');
    await page.getByRole('button', {name: 'Add line'}).click();
    await expect(page.getByLabel('Description 3')).toHaveValue('');
  });

  test('INVC-05 · An invoice needs a line, and a code already used is refused', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(SALES);
    await page.goto('/admin/invoices/new');

    await page.getByRole('button', {name: 'Create invoice'}).click();
    await expect(page.getByRole('alert')).toContainText(
      'Please add at least one invoice item.',
    );
    await expect(page).toHaveURL(/\/admin\/invoices\/new$/);

    await page.getByLabel('Description 1').fill('Shipping');
    await page.getByLabel('Invoice number').fill('INV-0001');
    await page.getByRole('button', {name: 'Create invoice'}).click();
    await expect(
      page.getByText('An invoice with this code already exists.'),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/invoices\/new$/);
  });

  test('INVC-07 · The list is filtered by customer or number and by a date range', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(SALES);
    await page.goto('/admin/invoices');
    const search = page.getByRole('searchbox', {
      name: 'Customer or invoice number',
    });

    await search.fill('jose');
    await expect(page.getByRole('row', {name: /INV-0002/})).toBeVisible();
    await expect(page.getByRole('row', {name: /INV-0001/})).toHaveCount(0);
    await search.fill('walk-in');
    await expect(page.getByRole('row', {name: /INV-0001/})).toBeVisible();
    await expect(page.getByRole('row', {name: /INV-0002/})).toHaveCount(0);

    await page.getByRole('button', {name: 'Clear filters'}).click();
    await expect(search).toHaveValue('');
    // The date range is the Date column's filter, in the row under the headers.
    const dateFilter = page
      .locator('.kf-table__filters')
      .getByRole('button', {name: /^Date/});
    await dateFilter.click();
    await page.getByLabel('From', {exact: true}).fill('2999-01-01');
    await expect(
      page.getByText('Nothing matches these filters.'),
    ).toBeVisible();
    await page.getByRole('button', {name: 'Clear filters'}).click();
    await dateFilter.click();
    await page.getByLabel('To', {exact: true}).fill('2000-01-01');
    await expect(
      page.getByText('Nothing matches these filters.'),
    ).toBeVisible();
    await page.getByRole('button', {name: 'Show all'}).click();
    await expect(page.getByRole('row', {name: /INV-0001/})).toBeVisible();
    await expect(page.getByRole('row', {name: /INV-0002/})).toBeVisible();
  });

  test('INVC-08 · A row opens the invoice in a slide-over beside the list', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(SALES);
    await page.goto('/admin/invoices');

    await page
      .getByRole('row', {name: /INV-0002/})
      .getByText('Jose Perez', {exact: true})
      .click();

    const dialog = page.getByRole('dialog', {name: 'Invoice INV-0002'});
    await expect(dialog).toContainText('KF-02');
    await expect(dialog).toContainText('Sales tax 6%');
    await expect(dialog).toContainText('$318.00');
    await expect(page.getByRole('row', {name: /INV-0001/})).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });

  test.describe('on a phone', () => {
    test.use({
      viewport: {width: 390, height: 844},
      isMobile: true,
      hasTouch: true,
    });

    test('INVC-09 · On a phone the invoice form and the list fit without scrolling sideways', async ({
      signedInAs,
    }) => {
      const page = await signedInAs(SALES);
      const noSidewaysScroll = () =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth ===
            document.documentElement.clientWidth,
        );
      await page.goto('/admin/invoices/new');

      await page.getByRole('button', {name: /Add all products from/}).click();
      await expect(page.getByLabel('Description 3')).toHaveValue('KF-03');
      await expect(page.getByTestId('total')).toHaveText('$450.00');
      await expect(page.getByLabel('Quantity 1')).toBeVisible();
      expect(await noSidewaysScroll()).toBe(true);

      await page.goto('/admin/invoices');
      await expect(page.getByRole('row', {name: /INV-0001/})).toContainText(
        '$100.00',
      );
      expect(await noSidewaysScroll()).toBe(true);
    });
  });

  test('INVC-06 · The admin is refused on invoices', async ({signedInAs}) => {
    const page = await signedInAs(ADMIN);

    await page.goto('/admin/invoices');

    await expect(page.getByRole('link', {name: 'Invoices'})).toHaveCount(0);
    await expect(page.getByRole('alert')).toContainText(
      'You do not have permission to do this.',
    );
    expect((await page.request.get('/api/v1/invoices')).status()).toBe(403);
  });

  test('INVC-10 · The invoice form reads like the document', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(SALES);
    await page.setViewportSize({width: 1440, height: 900});
    await page.goto('/admin/invoices/new');

    const customer = page.getByRole('region', {name: 'Customer', exact: true});
    const invoice = page.getByRole('region', {name: 'Invoice', exact: true});
    await expect(customer).toBeVisible();
    const [left, right] = [
      await customer.boundingBox(),
      await invoice.boundingBox(),
    ];
    expect(Math.abs(left!.y - right!.y), 'tops aligned').toBeLessThan(1);
    expect(right!.x, 'Invoice on the right').toBeGreaterThanOrEqual(
      left!.x + left!.width,
    );
    const lines = page.getByRole('region', {name: 'Lines', exact: true});
    expect(
      (await lines.boundingBox())!.y,
      'the lines under both',
    ).toBeGreaterThan(left!.y + left!.height - 1);
    await expect(lines.getByRole('columnheader')).toHaveText([
      'Product',
      'Description',
      'Qty',
      'Unit price',
      'Line total',
      'Actions',
    ]);
    await expect(lines.getByRole('button', {name: 'Add line'})).toBeVisible();
    await expect(
      lines.getByRole('button', {name: 'Add all products from Colombia'}),
    ).toBeVisible();
    await lines
      .getByRole('button', {name: 'Add all products from Colombia'})
      .click();
    await expect(page.getByTestId('subtotal')).toHaveText('$450.00');
    await expect(page.getByTestId('total')).toHaveText('$450.00');

    // Line by line with the keyboard: description, quantity, unit price.
    await page.getByLabel('Description 1').focus();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Quantity 1')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Unit price 1')).toBeFocused();

    // Create invoice is the one primary action; Cancel leaves without saving.
    await expect(page.locator('main .kf-btn--primary')).toHaveText([
      'Create invoice',
    ]);
    await expect(page.getByRole('link', {name: 'Cancel'})).toHaveAttribute(
      'href',
      '/admin/invoices',
    );
  });
});
