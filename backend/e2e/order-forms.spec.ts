import type {Page} from '@playwright/test';
import {emailCount, emailTo} from './support/mail';
import {ADMIN, INVENTORY, consoleErrors, expect, test} from './support/test';

/**
 * 5 Orders, the order form and the getting-ready screen (ORD-11 – 18), and 8 Emails (MAIL-01 – 02). The cases run in
 * order: the order ORD-13 places is the one ORD-15 edits, ORD-16/17 ship and MAIL-01/02 read the email of.
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

async function scan(page: Page, code: string) {
  const input = page.getByLabel('Bar Code');
  await input.fill(code);
  await input.press('Enter');
}

const row = (page: Page, code: string) =>
  page.getByRole('row', {name: new RegExp(`\\b${code}\\b`)});

test.describe('5 Orders: the order form and getting ready', () => {
  test('ORD-11 · the old new, edit and getting-ready addresses land on the new screens', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    const errors = consoleErrors(page);
    const w2 = await orderByCode(page, 'W00002');

    await page.goto('/admin/order/new');
    await expect(page).toHaveURL(/\/admin\/orders\/new$/);
    await expect(
      page.getByRole('heading', {name: 'Create a new order'}),
    ).toBeVisible();

    await page.goto(`/admin/order/edit/${w2.id}`);
    await expect(page).toHaveURL(new RegExp(`/admin/orders/${w2.id}/edit$`));
    await expect(
      page.getByRole('heading', {name: 'Editing Order'}),
    ).toBeVisible();
    await expect(page.getByLabel('Consecutive')).toHaveValue('W00002');

    await page.goto(`/admin/order/partial/getting-ready/${w2.id}`);
    await expect(page).toHaveURL(
      new RegExp(`/admin/orders/${w2.id}/getting-ready$`),
    );
    await expect(
      page.getByRole('heading', {name: 'Getting ready order #W00002'}),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('ORD-12 · the form saves only when complete, and the warehouse locks once a product is filled', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/orders/new');

    const create = page.getByRole('button', {name: 'Create'});
    await expect(create).toBeDisabled();
    await expect(page.getByText(/To save, fill in the customer/)).toBeVisible();

    await page.getByLabel('Warehouse').selectOption({label: 'Colombia'});
    await pickOption(page, 'Product 1', 'KF-01 (KF-01)');
    await expect(page.getByLabel('Warehouse')).toBeEnabled();
    await page.getByLabel('Quantity of product 1').fill('1');
    await expect(page.getByLabel('Warehouse')).toBeDisabled();
    await expect(create).toBeDisabled();
  });

  test('ORD-13 · an order is placed for a new customer with two products', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/orders/new');

    await page.getByLabel('First Name').fill('Smoke');
    await page.getByLabel('Last Name').fill('Buyer');
    await page.getByLabel('Email').fill(`${CODE.toLowerCase()}@kf.test`);
    await page.getByLabel('Phone').fill('3005550101');
    await page.getByLabel('Address', {exact: true}).fill('9 Smoke Lane');
    await page.getByLabel('Zip Code').fill('05001');
    await page.getByLabel('Warehouse').selectOption({label: 'Colombia'});
    await pickOption(page, 'Product 1', 'KF-01 (KF-01)');
    await page.getByLabel('Quantity of product 1').fill('3');
    await page.getByRole('button', {name: 'Add a product'}).click();
    await pickOption(page, 'Product 2', 'KF-02 (KF-02)');
    await page.getByLabel('Quantity of product 2').fill('1');
    await page.getByLabel('Consecutive').fill(CODE);
    await page.getByLabel('Source').selectOption({label: 'Phone'});
    await page.getByLabel('Payment Method').selectOption({label: 'Credit Card'});
    await page.getByLabel('Status').selectOption({label: 'Created'});
    placedAt = new Date();
    await page.getByRole('button', {name: 'Create'}).click();

    await expect(page).toHaveURL(/\/admin\/orders$/);
    const placed = await orderByCode(page, CODE);
    placedId = placed.id;
    expect(placed.status).toBe(1);
    expect(
      placed.products.map((line) => [line.product.code, line.quantity]),
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

    await pickOption(page, 'Search Customer', /Jose Perez/);

    await expect(page.getByLabel('First Name')).toHaveValue('Jose');
    await expect(page.getByLabel('Last Name')).toHaveValue('Perez');
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

    await expect(page.getByLabel('First Name')).toHaveValue('Smoke');
    await expect(page.getByLabel('Consecutive')).toHaveValue(CODE);
    await expect(page.getByLabel('Warehouse')).toBeDisabled();
    await expect(page.getByLabel('Quantity of product 1')).toHaveValue('3');
    await page.getByLabel('Quantity of product 1').fill('2');
    await page.getByRole('button', {name: 'Update'}).click();

    await expect(page).toHaveURL(/\/admin\/orders$/);
    const updated = await orderByCode(page, CODE);
    expect(updated.products[0]).toMatchObject({
      quantity: 2,
      product: {code: 'KF-01'},
    });
  });

  test('ORD-16 · getting ready: a scan adds one, and what is not on the order or over its quantity is refused', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    const errors = consoleErrors(page);
    await page.goto(`/admin/orders/${placedId}/getting-ready`);
    await expect(page.getByLabel('Bar Code')).toBeFocused();

    await scan(page, 'KF-01');
    await expect(row(page, 'KF-01').getByLabel('This Order')).toHaveValue('1');
    await expect(row(page, 'KF-01')).toContainText('2 / 1');

    await scan(page, 'NOPE-404');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText(
      'You are trying to add a product that is not on the current order',
    );
    await dialog.getByRole('button', {name: 'Continue adding'}).click();
    await expect(dialog).toHaveCount(0);

    await scan(page, 'KF-01');
    await expect(row(page, 'KF-01')).toContainText('2 / ~');
    await scan(page, 'KF-01');
    await expect(page.getByRole('dialog')).toContainText(
      'You reached the limit of product allowed to add to this order.',
    );
    await page.getByRole('button', {name: 'Continue adding'}).click();

    await row(page, 'KF-01').getByRole('button', {name: 'Remove one'}).click();
    await expect(row(page, 'KF-01').getByLabel('This Order')).toHaveValue('1');
    expect(errors).toEqual([]);
  });

  test('ORD-17 · partial shipments take the stock out, and a sent order takes no more', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto(`/admin/orders/${placedId}/getting-ready`);
    const stockButton = row(page, 'KF-01').getByTitle(
      'Amount of products available on inventory',
    );
    const before = Number(await stockButton.textContent());

    await scan(page, 'KF-01');
    await scan(page, 'KF-01');
    await page.getByRole('button', {name: 'Save Current'}).click();
    await expect(page).toHaveURL(/\/admin\/orders$/);
    expect((await orderByCode(page, CODE)).status, 'a partial shipment').toBe(
      4,
    );

    await page.goto(`/admin/orders/${placedId}/getting-ready`);
    await expect(stockButton).toHaveText(String(before - 2));
    await expect(row(page, 'KF-01')).toContainText('2 / ~');
    await scan(page, 'KF-02');
    await page.getByRole('button', {name: 'Save Current'}).click();
    await expect(page).toHaveURL(/\/admin\/orders$/);

    await page.goto(`/admin/orders/${placedId}/getting-ready`);
    await expect(row(page, 'KF-02')).toContainText('1 / ~');
    await expect(
      row(page, 'KF-02').getByRole('button', {name: 'Add one'}),
    ).toBeDisabled();

    const sent = await orderByCode(page, 'W00005');
    await page.goto(`/admin/orders/${sent.id}/getting-ready`);
    await expect(
      page.getByRole('button', {name: 'Save Current'}),
      'W00005 is sent',
    ).toBeDisabled();
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
    await page.getByLabel('Payment Method').selectOption({label: 'Paypal'});
    await page.getByRole('button', {name: 'Update'}).click();
    await expect(page).toHaveURL(/\/admin\/orders$/);

    // The queue sends within seconds; give it the time it would take, then count again.
    await page.waitForTimeout(5000);
    expect(await emailCount(request, PRINTER)).toBe(before);
  });
});
