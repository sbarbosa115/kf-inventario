import type {Page} from '@playwright/test';
import {emailCount, emailTo} from './support/mail';
import {ADMIN, INVENTORY, consoleErrors, expect, test} from './support/test';

/**
 * 5 Orders, the order form and the getting-ready screen (ORD-11 – 18, ORD-29 – 32), and 8 Emails (MAIL-01 – 02). The
 * cases run in order: the order ORD-13 places is the one ORD-15 edits, ORD-16/17 ship and MAIL-01 reads the email of.
 */
test.describe.configure({mode: 'serial'});

const PRINTER = 'printer@kf.local';
const CODE = `SMOKE-${Date.now()}`;
let placedId = 0;
let placedAt = new Date();

interface ApiOrder {
  id: number;
  code: string | null;
  status: number;
  products: {uuid: string; quantity: number; product: {code: string}}[];
}

async function orderByCode(page: Page, code: string): Promise<ApiOrder> {
  const list = (await (
    await page.request.get('/api/v1/orders?warehouse_id=1')
  ).json()) as ApiOrder[];
  const found = list.find((order) => order.code === code);
  expect(found, `order ${code} is in warehouse 1`).toBeDefined();
  return (await (
    await page.request.get(`/api/v1/orders/${found?.id}`)
  ).json()) as ApiOrder;
}

async function pickOption(page: Page, label: string, option: string | RegExp) {
  await page.getByLabel(label, {exact: true}).click();
  await page.getByRole('option', {name: option}).click();
}

/** One read in the barcode box; spaced past ScanInput's 50 ms scanner-burst window. */
async function scan(page: Page, code: string) {
  await page.waitForTimeout(60);
  const input = page.getByLabel('Barcode', {exact: true});
  await input.fill(code);
  await input.press('Enter');
}

/** A product of the order on the getting-ready screen, by its code. */
const line = (page: Page, code: string) =>
  page.getByRole('listitem', {name: code, exact: true});

const shipButton = (page: Page) => page.getByRole('button', {name: /^Ship \d/});

test.describe('5 Orders: the order form and getting ready', () => {
  test('ORD-11 · the old new, edit and getting-ready addresses land on the new screens', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    const errors = consoleErrors(page);
    const w2 = await orderByCode(page, 'W00002');

    await page.goto('/admin/order/new');
    await expect(page).toHaveURL(/\/admin\/orders\/new$/);
    await expect(page.getByRole('heading', {name: 'New order'})).toBeVisible();

    await page.goto(`/admin/order/edit/${w2.id}`);
    await expect(page).toHaveURL(new RegExp(`/admin/orders/${w2.id}/edit$`));
    await expect(page.getByRole('heading', {name: 'Edit order'})).toBeVisible();
    await expect(page.getByLabel('Order number')).toHaveValue('W00002');

    await page.goto(`/admin/order/partial/getting-ready/${w2.id}`);
    await expect(page).toHaveURL(
      new RegExp(`/admin/orders/${w2.id}/getting-ready$`),
    );
    await expect(
      page.getByRole('heading', {name: 'Getting ready · W00002'}),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('ORD-12 · the form saves only when complete, and the warehouse locks once a product is filled', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/orders/new');

    const create = page.getByRole('button', {name: 'Create order'});
    await expect(create).toBeDisabled();
    await expect(page.getByText('8 things missing:')).toBeVisible();

    await page.getByLabel('Warehouse').selectOption({label: 'Colombia'});
    await pickOption(page, 'Product 1', 'KF-01 (KF-01)');
    await expect(page.getByLabel('Warehouse')).toBeEnabled();
    await page.getByLabel('Quantity of product 1').fill('1');
    await expect(page.getByLabel('Warehouse')).toBeDisabled();
    await expect(
      page.getByText('Remove the products to change the warehouse.'),
    ).toBeVisible();
    await expect(create).toBeDisabled();
  });

  test('ORD-13 · an order is placed for a new customer with two products', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/orders/new');

    await page.getByLabel('First name').fill('Smoke');
    await page.getByLabel('Last name').fill('Buyer');
    await page.getByLabel('Email').fill(`${CODE.toLowerCase()}@kf.test`);
    await page.getByLabel('Phone').fill('3005550101');
    await page.getByLabel('Address', {exact: true}).fill('9 Smoke Lane');
    await page.getByLabel('Zip Code').fill('05001');
    await page.getByLabel('Warehouse').selectOption({label: 'Colombia'});
    await pickOption(page, 'Product 1', 'KF-01 (KF-01)');
    await page.getByLabel('Quantity of product 1').fill('3');
    await page.getByRole('button', {name: 'Add product'}).click();
    await pickOption(page, 'Product 2', 'KF-02 (KF-02)');
    await page.getByLabel('Quantity of product 2').fill('1');
    await page.getByLabel('Order number').fill(CODE);
    await page.getByLabel('Source').selectOption({label: 'Phone'});
    await page
      .getByLabel('Payment method')
      .selectOption({label: 'Credit card'});
    await page.getByLabel('Status').selectOption({label: 'Created'});
    placedAt = new Date();
    await page.getByRole('button', {name: 'Create order'}).click();

    await expect(page).toHaveURL(/\/admin\/orders$/);
    await expect(page.getByText('The order was created.')).toBeVisible();
    const placed = await orderByCode(page, CODE);
    placedId = placed.id;
    expect(placed.status).toBe(1);
    expect(
      placed.products.map((product) => [
        product.product.code,
        product.quantity,
      ]),
    ).toEqual([
      ['KF-01', 3],
      ['KF-02', 1],
    ]);
  });

  test('ORD-14 · picking an existing customer fills the customer block', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/orders/new');

    await pickOption(page, 'Search customer', /Jose Perez/);

    await expect(page.getByLabel('First name')).toHaveValue('Jose');
    await expect(page.getByLabel('Last name')).toHaveValue('Perez');
    await expect(page.getByLabel('Email')).toHaveValue(
      'jose.perez@example.com',
    );
    await expect(page.getByLabel('Address', {exact: true})).toHaveValue(
      'Palm Beach 5800 Roger Regan Drive',
    );
  });

  test('ORD-15 · editing an order shows what was saved and updates it', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto(`/admin/orders/${placedId}/edit`);

    await expect(page.getByLabel('First name')).toHaveValue('Smoke');
    await expect(page.getByLabel('Order number')).toHaveValue(CODE);
    await expect(page.getByLabel('Warehouse')).toBeDisabled();
    await expect(page.getByLabel('Quantity of product 1')).toHaveValue('3');
    await page.getByLabel('Quantity of product 1').fill('2');
    await page.getByRole('button', {name: 'Update order'}).click();

    await expect(page).toHaveURL(/\/admin\/orders$/);
    await expect(page.getByText('The order was updated.')).toBeVisible();
    const updated = await orderByCode(page, CODE);
    expect(updated.products[0]).toMatchObject({
      quantity: 2,
      product: {code: 'KF-01'},
    });
  });

  test('ORD-16 · getting ready: a scan adds one, and what is not on the order or over its quantity is refused inline', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    const errors = consoleErrors(page);
    await page.goto(`/admin/orders/${placedId}/getting-ready`);
    const box = page.getByLabel('Barcode', {exact: true});
    await expect(box).toBeFocused();

    await scan(page, 'KF-01');
    await expect(
      line(page, 'KF-01').getByLabel('This shipment of KF-01'),
    ).toHaveText('1');
    await expect(line(page, 'KF-01')).toContainText(
      'Shipped 0 of 2 · this shipment 1',
    );

    await scan(page, 'NOPE-404');
    await expect(page.getByRole('alert')).toHaveText(
      'NOPE-404 is not on this order.',
    );
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(box, 'the refusal does not take the focus').toBeFocused();

    await scan(page, 'KF-01');
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(line(page, 'KF-01')).toContainText('Complete');
    await scan(page, 'KF-01');
    await expect(page.getByRole('alert')).toHaveText(
      'Nothing more of KF-01 is left to ship.',
    );
    await expect(box).toBeFocused();

    await line(page, 'KF-01')
      .getByRole('button', {name: 'One less KF-01'})
      .click();
    await expect(
      line(page, 'KF-01').getByLabel('This shipment of KF-01'),
    ).toHaveText('1');
    expect(errors).toEqual([]);
  });

  test('ORD-17 · partial shipments take the stock out, and a sent order takes no more', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto(`/admin/orders/${placedId}/getting-ready`);
    const stock = line(page, 'KF-01').getByText(/^In stock \d+$/);
    const before = Number((await stock.textContent())?.replace(/\D/g, ''));

    await scan(page, 'KF-01');
    await scan(page, 'KF-01');
    await expect(shipButton(page)).toHaveText('Ship 2 products');
    await shipButton(page).click();
    await expect(page).toHaveURL(/\/admin\/orders$/);
    await expect(
      page.getByText(`Shipment saved: order ${CODE} is partial.`),
    ).toBeVisible();
    expect((await orderByCode(page, CODE)).status, 'a partial shipment').toBe(
      4,
    );

    await page.goto(`/admin/orders/${placedId}/getting-ready`);
    await expect(stock).toHaveText(`In stock ${before - 2}`);
    await expect(line(page, 'KF-01')).toContainText(
      'Shipped 2 of 2 · this shipment 0',
    );
    await expect(line(page, 'KF-01')).toContainText('Shipped');
    await scan(page, 'KF-02');
    await expect(shipButton(page)).toHaveText('Ship 1 product');
    await shipButton(page).click();
    await expect(page).toHaveURL(/\/admin\/orders$/);
    // Only a shipment of the whole order at once sends it (RecordPartialShipmentHandler, as the legacy code did):
    // the shipment that completes it leaves it Partial.
    await expect(
      page.getByText(`Shipment saved: order ${CODE} is partial.`),
    ).toBeVisible();

    await page.goto(`/admin/orders/${placedId}/getting-ready`);
    await expect(line(page, 'KF-02')).toContainText('Shipped 1 of 1');
    await expect(
      line(page, 'KF-02').getByRole('button', {name: 'One more KF-02'}),
    ).toBeDisabled();

    const sent = await orderByCode(page, 'W00005');
    await page.goto(`/admin/orders/${sent.id}/getting-ready`);
    await expect(shipButton(page), 'W00005 is sent').toBeDisabled();
    await expect(
      page.getByText(
        'This order was already sent: it takes no more shipments.',
      ),
    ).toBeVisible();
  });

  test('ORD-18 · an order that no longer exists says so, and a person without the order roles is refused', async ({
    signedInAs,
  }) => {
    const admin = await signedInAs(ADMIN);
    await admin.goto('/admin/orders/999999/edit');
    await expect(admin.getByRole('alert')).toContainText(
      'This order no longer exists.',
    );
    await admin.goto('/admin/orders/999999/getting-ready');
    await expect(admin.getByRole('alert')).toContainText(
      'This order no longer exists.',
    );

    const clerk = await signedInAs(INVENTORY);
    await clerk.goto(`/admin/orders/${placedId}/edit`);
    await expect(clerk.getByRole('alert')).toContainText(
      'You do not have permission to do this.',
    );
    const answer = await clerk.request.get(`/api/v1/orders/${placedId}`);
    expect(answer.status()).toBe(403);
  });

  test('ORD-29 · the action bar names what is missing, and a name goes to its field, highlighted', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/orders/new');
    const missing = page.locator('.order-form__missing');

    await page.getByLabel('First name').fill('Smoke');
    await expect(missing).toHaveText(
      '7 things missing: last name, email, warehouse, a product with its quantity, source, payment method, status',
    );
    await missing.getByRole('button', {name: 'source', exact: true}).click();
    await expect(page.getByLabel('Source')).toBeFocused();
    await expect(page.getByLabel('Source')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    await expect(page.getByLabel('Last name')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    await expect(page.getByLabel('First name')).not.toHaveAttribute(
      'aria-invalid',
    );
    await page.getByLabel('Source').selectOption({label: 'Web'});
    await expect(missing).toContainText('6 things missing:');
  });

  test('ORD-30 · the product lines are a table: headers, Add product under it, any row removed', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/orders/new');
    const table = page.getByRole('table', {name: 'Products'});

    await expect(table.getByRole('columnheader')).toHaveText([
      'Product',
      'Quantity',
      'Remove',
    ]);
    await expect(
      page.getByText(
        'Choose the warehouse first: its products are offered here.',
      ),
    ).toBeVisible();
    const add = page.getByRole('button', {name: 'Add product'});
    await expect(add).toBeDisabled();

    await page.getByLabel('Warehouse').selectOption({label: 'Colombia'});
    await pickOption(page, 'Product 1', 'KF-01 (KF-01)');
    await page.getByLabel('Quantity of product 1').fill('2');
    await add.click();
    await expect(add, 'one empty row at a time').toBeDisabled();
    await pickOption(page, 'Product 2', 'KF-02 (KF-02)');
    await expect(table.getByRole('row')).toHaveCount(3);

    await page.getByRole('button', {name: 'Remove product 1'}).click();
    await expect(table.getByRole('row')).toHaveCount(2);
    await expect(table).toContainText('KF-02 (KF-02)');
  });

  test('ORD-31 · getting ready starts neutral: progress in words, stock as text, nothing to ship yet', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    const w1 = await orderByCode(page, 'W00001');
    await page.goto(`/admin/orders/${w1.id}/getting-ready`);

    await expect(page.getByRole('heading', {level: 1})).toHaveText(
      'Getting ready · W00001',
    );
    await expect(page.getByText('Created', {exact: true})).toBeVisible();
    const lines = page.getByRole('list', {name: 'Products of the order'});
    await expect(lines.getByRole('listitem')).toHaveCount(3);
    for (const item of await lines.getByRole('listitem').all()) {
      await expect(item).toContainText(/Shipped 0 of \d+ · this shipment 0/);
      await expect(item).toContainText(/In stock \d+/);
      await expect(item).not.toHaveClass(/is-complete/);
    }
    await expect(shipButton(page)).toBeDisabled();
    await expect(page.getByText('Scan the products to ship.')).toBeVisible();
    await expect(page.getByRole('link', {name: 'Cancel'})).toHaveAttribute(
      'href',
      '/admin/orders',
    );
  });
});

test.describe('5 Orders: the order form and getting ready, on a phone (390 px)', () => {
  test.use({
    viewport: {width: 390, height: 844},
    isMobile: true,
    hasTouch: true,
  });

  test('ORD-32 · the form and getting ready fit a phone: one column, nothing scrolls sideways', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    const errors = consoleErrors(page);
    const w1 = await orderByCode(page, 'W00001');

    for (const path of [
      '/admin/orders/new',
      `/admin/orders/${w1.id}/getting-ready`,
    ]) {
      await page.goto(path);
      await expect(page.getByRole('heading', {level: 1})).toBeVisible();
      const [scroll, client] = await page.evaluate(() => [
        document.documentElement.scrollWidth,
        document.documentElement.clientWidth,
      ]);
      expect(scroll, `${path} scrolls sideways`).toBe(client);
    }
    await expect(page.getByLabel('Barcode', {exact: true})).toBeFocused();
    // The smoke stack is plain http: the camera says why it cannot start (INV-26), typing still works.
    await expect(
      page.getByText(
        'The camera needs a secure address (https). Type the code instead.',
      ),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe('8 Emails: the printer email of an order placed by hand', () => {
  test('MAIL-01 · the order placed in ORD-13 reached the printer', async ({
    request,
  }) => {
    const email = await emailTo(request, PRINTER, {
      subject: new RegExp(`Order #${CODE} was created`),
      since: new Date(placedAt.getTime() - 1000),
    });

    expect(email.to).toContain(PRINTER);
    expect(email.text).toContain(
      'A new order was created and attached to this email.',
    );
  });

  test('MAIL-02 · editing an order sends no email', async ({
    request,
    signedInAs,
  }) => {
    const before = await emailCount(request, PRINTER);
    const page = await signedInAs(ADMIN);
    const w1 = await orderByCode(page, 'W00001');
    await page.goto(`/admin/orders/${w1.id}/edit`);
    await page.getByLabel('Comment').fill('Edited by the smoke suite');
    await page.getByLabel('Payment method').selectOption({label: 'PayPal'});
    await page.getByRole('button', {name: 'Update order'}).click();
    await expect(page).toHaveURL(/\/admin\/orders$/);

    // The queue sends within seconds; give it the time it would take, then count again.
    await page.waitForTimeout(5000);
    expect(await emailCount(request, PRINTER)).toBe(before);
  });
});
