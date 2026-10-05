import {
  ADMIN,
  INVENTORY,
  PASSWORD,
  consoleErrors,
  expect,
  test,
} from './support/test';
import type {Page} from '@playwright/test';

// 5 Orders (ORD-01 – 10). The fixtures put twelve orders (W00001 – W00012) on the first warehouse, Colombia: W00001 –
// W00006 by phone with the statuses 1 – 6, W00007 – W00012 from the web likewise. The cases run in order.
test.describe.configure({mode: 'serial'});

/**
 * Deleting and syncing need ROLE_MANAGE_ORDERS, which no fixture account reaches (the admin's ROLE_ADMIN gives
 * ROLE_UPDATE_ORDERS only, as in production): the admin creates this account once.
 */
const ORDERS_CLERK = {
  name: 'Smoke Orders Clerk',
  username: 'smoke-orders',
  email: 'smoke.orders@kf.test',
  roles: ['ROLE_MANAGE_ORDERS', 'ROLE_UPDATE_ORDERS'],
};

async function ensureOrdersClerk(admin: Page, baseURL: string) {
  const users = (await (await admin.request.get('/api/v1/users')).json()) as {
    username: string;
  }[];
  if (users.some((user) => user.username === ORDERS_CLERK.username)) return;
  const created = await admin.request.post('/api/v1/users', {
    data: {...ORDERS_CLERK, password: PASSWORD, enabled: true},
    headers: {Origin: new URL(baseURL).origin},
  });
  expect(created.status(), 'creating the orders clerk').toBe(201);
}

/** The list narrowed to one order by its code (twelve orders do not fit one page). */
async function findOrder(page: Page, code: string) {
  await page.getByRole('searchbox').fill(code);
  const row = page.getByRole('row', {name: new RegExp(code)});
  await expect(row).toBeVisible();
  return row;
}

test.describe('5 Orders', () => {
  test('ORD-01 · the list shows the first warehouse’s orders, and the old address lands on it', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    const errors = consoleErrors(page);

    await page.goto('/admin/order/');

    await expect(page).toHaveURL(/\/admin\/orders$/);
    await expect(
      page.getByRole('heading', {name: 'View Orders'}),
    ).toBeVisible();
    await expect(
      page.getByRole('link', {name: 'Create an Order'}),
    ).toBeVisible();
    for (const header of ['Customer', 'Order #', 'Source', 'Created Date']) {
      await expect(
        page.getByRole('columnheader', {name: header}),
      ).toBeVisible();
    }
    const row = await findOrder(page, 'W00001');
    await expect(
      row.getByText('Jose Perez [jose.perez@example.com]'),
    ).toBeVisible();
    await expect(row.getByText('Phone')).toBeVisible();
    // ROLE_ADMIN reaches ROLE_MANAGE_ORDERS (security.yaml): delete and sync, as the legacy page showed it.
    await expect(
      page.getByRole('button', {name: /Delete Order/}).first(),
    ).toBeVisible();
    await expect(page.getByRole('button', {name: 'Sync Orders'})).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('ORD-02 · another warehouse and a status narrow the list', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/orders');
    await expect(page.getByRole('row', {name: /W00012/})).toBeVisible();

    await page
      .getByRole('combobox', {name: 'Status', exact: true})
      .selectOption('Delivered');
    await expect(page.getByRole('row', {name: /W00006/})).toBeVisible();
    await expect(page.getByRole('row', {name: /W00012/})).toBeVisible();
    await expect(page.getByRole('row', {name: /W00001/})).toHaveCount(0);

    await page
      .getByRole('combobox', {name: 'Status', exact: true})
      .selectOption('');
    await page.getByRole('combobox', {name: 'Warehouse'}).selectOption('Usa');
    await expect(
      page.getByText(
        'This warehouse has no orders yet. Create one, or sync the orders of the shops.',
      ),
    ).toBeVisible();
  });

  test('ORD-03 · a status changes in its row and stays changed', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/orders');
    const row = await findOrder(page, 'W00001');

    await row
      .getByRole('combobox', {name: 'Status of order W00001'})
      .selectOption('Processed');

    await expect(
      page
        .getByRole('status')
        .filter({hasText: 'Order W00001 is now Processed.'}),
    ).toBeVisible();
    await page.reload();
    const again = await findOrder(page, 'W00001');
    await expect(
      again.getByRole('combobox', {name: 'Status of order W00001'}),
    ).toHaveValue('2');
  });

  test('ORD-04 · choosing Sent opens the order’s getting-ready screen', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/orders');
    const row = await findOrder(page, 'W00002');

    await row
      .getByRole('combobox', {name: 'Status of order W00002'})
      .selectOption('Sent');

    await expect(page).toHaveURL(/\/admin\/orders\/\d+\/getting-ready$/);
  });

  test('ORD-05 · the detail shows the customer, the status and the products', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    const errors = consoleErrors(page);
    await page.goto('/admin/orders');
    const row = await findOrder(page, 'W00003');

    await row.getByRole('button', {name: 'Order Detail of W00003'}).click();

    const dialog = page.getByRole('dialog', {name: 'Order Detail'});
    await expect(dialog.getByText('Jose Perez', {exact: true})).toBeVisible();
    await expect(dialog.getByText('Completed', {exact: true})).toBeVisible();
    await expect(
      dialog.getByRole('tab', {name: 'Products Detail'}),
    ).toHaveAttribute('aria-selected', 'true');
    // W00003 holds 20 of each product (src/DataFixtures/OrderFixtures.php).
    await expect(dialog.getByRole('row', {name: /KF-01/})).toContainText('20');
    await dialog.getByRole('button', {name: 'Close'}).last().click();
    await expect(dialog).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('ORD-06 · a comment is added and removed from the detail, and the count follows', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/orders');
    const row = await findOrder(page, 'W00004');

    await row
      .getByRole('button', {name: 'Comments of order W00004: 1'})
      .click();
    const dialog = page.getByRole('dialog', {name: 'Order Detail'});
    await expect(dialog.getByLabel('Comment 1', {exact: true})).toHaveValue(
      'Comment for W00004',
    );
    await dialog.getByRole('button', {name: 'Add a comment'}).click();
    await dialog.getByLabel('Comment 2', {exact: true}).fill('Smoke comment');
    await dialog.getByRole('button', {name: 'Save comment 2'}).click();
    await expect(dialog.getByText('The comments were saved.')).toBeVisible();
    await dialog.getByRole('button', {name: 'Close'}).last().click();

    await row
      .getByRole('button', {name: 'Comments of order W00004: 2'})
      .click();
    await expect(dialog.getByLabel('Comment 2', {exact: true})).toHaveValue(
      'Smoke comment',
    );
    await dialog.getByRole('button', {name: 'Remove comment 2'}).click();
    await expect(dialog.getByText('The comments were saved.')).toBeVisible();
    await expect(dialog.getByLabel('Comment 2', {exact: true})).toHaveCount(0);
    await dialog.getByRole('button', {name: 'Close'}).last().click();
    await expect(
      row.getByRole('button', {name: 'Comments of order W00004: 1'}),
    ).toBeVisible();
  });

  test('ORD-07 · the order PDF, its Excel and the remaining products PDF download', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/orders');
    const row = await findOrder(page, 'W00001');

    const pdf = row.getByRole('link', {name: 'View as PDF'});
    await expect(pdf).toHaveAttribute('target', '_blank');
    const xls = row.getByRole('link', {name: 'Download as Excel'});
    await row.getByRole('button', {name: 'Order Detail of W00001'}).click();
    const remaining = page
      .getByRole('dialog')
      .getByRole('link', {name: 'Remaining Products'});

    const documents: [typeof pdf, string][] = [
      [pdf, 'application/pdf'],
      [xls, 'application/vnd.ms-excel'],
      [remaining, 'application/pdf'],
    ];
    for (const [link, type] of documents) {
      const answer = await page.request.get(
        (await link.getAttribute('href')) as string,
      );
      expect(answer.status()).toBe(200);
      expect(answer.headers()['content-type']).toContain(type);
    }
  });

  test('ORD-08 · deleting an order asks first', async ({
    signedInAs,
    baseURL,
  }) => {
    await ensureOrdersClerk(await signedInAs(ADMIN), baseURL as string);
    const page = await signedInAs(ORDERS_CLERK.username);
    await page.goto('/admin/orders');
    const row = await findOrder(page, 'W00005');

    await row.getByRole('button', {name: 'Delete Order W00005'}).click();
    const dialog = page.getByRole('dialog');
    await expect(
      dialog.getByText('Are you sure that you want to delete this order?'),
    ).toBeVisible();
    await dialog.getByRole('button', {name: 'Cancel'}).click();
    await expect(row).toBeVisible();

    await row.getByRole('button', {name: 'Delete Order W00005'}).click();
    await dialog.getByRole('button', {name: 'Delete'}).click();

    await expect(
      page.getByRole('status').filter({hasText: 'The order was deleted.'}),
    ).toBeVisible();
    await expect(page.getByRole('row', {name: /W00005/})).toHaveCount(0);
  });

  test('ORD-09 · Sync Orders answers in words', async ({signedInAs}) => {
    const page = await signedInAs(ORDERS_CLERK.username);
    await page.goto('/admin/orders');
    await expect(page.getByRole('row', {name: /W00012/})).toBeVisible();

    await page.getByRole('button', {name: 'Sync Orders'}).click();

    // Without shop credentials on the smoke stack, either answer is right: what matters is a message, not a blank.
    await expect(
      page
        .getByText(/orders imported, \d+ skipped\./)
        .or(page.getByText(/shops could not be reached|not available yet/)),
    ).toBeVisible();
  });

  test('ORD-10 · a person without the orders roles is refused', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(INVENTORY);
    await page.goto('/admin/products');
    await expect(
      page.getByRole('link', {name: 'Products', exact: true}),
    ).toBeVisible();
    await expect(page.getByRole('link', {name: 'Orders'})).toHaveCount(0);

    await page.goto('/admin/orders');
    await expect(page.getByRole('alert')).toHaveText(
      'You do not have permission to do this.',
    );
    const answer = await page.request.get('/api/v1/orders?warehouse_id=1');
    expect(answer.status()).toBe(403);
  });
});
