import {
  ADMIN,
  INVENTORY,
  PASSWORD,
  consoleErrors,
  expect,
  test,
} from './support/test';
import type {Locator, Page} from '@playwright/test';

// 5 Orders (ORD-01 – 10, and the redesign's ORD-21 – 26). The fixtures put twelve orders (W00001 – W00012) on the first
// warehouse, Colombia: W00001 – W00006 by phone with the statuses 1 – 6, W00007 – W00012 from the web likewise. The
// cases run in order.
test.describe.configure({mode: 'serial'});

/** ROLE_MANAGE_ORDERS (delete, sync), created once by the admin. */
const ORDERS_CLERK = {
  name: 'Smoke Orders Clerk',
  username: 'smoke-orders',
  email: 'smoke.orders@kf.test',
  roles: ['ROLE_MANAGE_ORDERS', 'ROLE_UPDATE_ORDERS'],
};

/** ROLE_UPDATE_ORDERS alone: create, read and update orders, but neither delete nor sync them. */
const ORDERS_UPDATER = {
  name: 'Smoke Orders Updater',
  username: 'smoke-orders-update',
  email: 'smoke.orders.update@kf.test',
  roles: ['ROLE_UPDATE_ORDERS'],
};

async function ensureUser(
  admin: Page,
  baseURL: string,
  user: typeof ORDERS_CLERK,
) {
  const users = (await (await admin.request.get('/api/v1/users')).json()) as {
    username: string;
  }[];
  if (users.some((known) => known.username === user.username)) return;
  const created = await admin.request.post('/api/v1/users', {
    data: {...user, password: PASSWORD, enabled: true},
    headers: {Origin: new URL(baseURL).origin},
  });
  expect(created.status(), `creating ${user.username}`).toBe(201);
}

/** The list narrowed to one order by its number (the search box of the toolbar). */
async function findOrder(page: Page, code: string) {
  await page
    .getByRole('searchbox', {name: 'Order number or customer'})
    .fill(code);
  const row = page.getByRole('row', {name: new RegExp(code)});
  await expect(row).toBeVisible();
  return row;
}

/** A toast (or any live message) with this text. */
const toast = (page: Page, text: string | RegExp) =>
  page.getByRole('status').filter({hasText: text});

const statusChips = (page: Page) =>
  page.getByRole('group', {name: 'Status', exact: true});

async function rowMenu(page: Page, row: Locator, code: string) {
  await row.getByRole('button', {name: `Actions for ${code}`}).click();
  return page.getByRole('menu', {name: `Actions for ${code}`});
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
      page.getByRole('heading', {level: 1, name: 'Orders'}),
    ).toBeVisible();
    await expect(page.getByRole('link', {name: 'Create order'})).toBeVisible();
    await expect(
      page.getByRole('button', {name: 'Sync shop orders'}),
    ).toBeVisible();
    for (const header of [
      'Order',
      'Customer',
      'Source',
      'Status',
      'Created',
      'Comments',
    ]) {
      await expect(
        page.getByRole('columnheader', {name: header, exact: true}),
      ).toBeVisible();
    }
    const row = await findOrder(page, 'W00001');
    await expect(row.getByText('Jose Perez')).toBeVisible();
    await expect(row.getByText('jose.perez@example.com')).toBeVisible();
    await expect(row.getByText('Phone')).toBeVisible();
    await expect(
      row.getByRole('button', {name: 'Status of order W00001'}),
    ).toHaveText(/Created/);
    expect(errors).toEqual([]);
  });

  test('ORD-02 · another warehouse and a status narrow the list', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/orders');
    await expect(page.getByRole('row', {name: /W00012/})).toBeVisible();

    await statusChips(page)
      .getByRole('button', {name: /^Delivered/})
      .click();
    await expect(page.getByRole('row', {name: /W00006/})).toBeVisible();
    await expect(page.getByRole('row', {name: /W00012/})).toBeVisible();
    await expect(page.getByRole('row', {name: /W00001/})).toHaveCount(0);

    await statusChips(page).getByRole('button', {name: /^All/}).click();
    await page.getByRole('radio', {name: 'Usa'}).click();
    await expect(
      page.getByText(
        'This warehouse has no orders yet. Create one, or sync the orders of the shops.',
      ),
    ).toBeVisible();
    // The warehouse is remembered: back to Colombia for the cases after this one.
    await page.getByRole('radio', {name: 'Colombia'}).click();
    await expect(page.getByRole('row', {name: /W00012/})).toBeVisible();
  });

  test('ORD-03 · a status changes from its badge, after a question, and stays changed', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/orders');
    const row = await findOrder(page, 'W00001');

    await row.getByRole('button', {name: 'Status of order W00001'}).click();
    await page.getByRole('menuitemradio', {name: 'Processed'}).click();
    const question = page.getByRole('dialog', {
      name: 'Mark W00001 as Processed?',
    });
    await question.getByRole('button', {name: 'Mark as Processed'}).click();

    await expect(toast(page, 'Order W00001 is now Processed.')).toBeVisible();
    await page.reload();
    const again = await findOrder(page, 'W00001');
    await expect(
      again.getByRole('button', {name: 'Status of order W00001'}),
    ).toHaveText(/Processed/);
  });

  test('ORD-04 · choosing Sent opens the order’s getting-ready screen', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/orders');
    const row = await findOrder(page, 'W00002');

    await row.getByRole('button', {name: 'Status of order W00002'}).click();
    await page.getByRole('menuitemradio', {name: 'Sent'}).click();

    await expect(page).toHaveURL(/\/admin\/orders\/\d+\/getting-ready$/);
  });

  test('ORD-05 · the detail shows the customer, the status and the products', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    const errors = consoleErrors(page);
    await page.goto('/admin/orders');
    const row = await findOrder(page, 'W00003');

    await row.getByRole('button', {name: 'W00003', exact: true}).click();

    const detail = page.getByRole('dialog', {name: 'Order W00003'});
    await expect(detail.getByText('Jose Perez', {exact: true})).toBeVisible();
    await expect(
      detail.getByRole('button', {name: 'Status of order W00003'}),
    ).toHaveText(/Completed/);
    // W00003 holds 20 of each product (src/DataFixtures/OrderFixtures.php).
    await expect(detail.getByRole('row', {name: /KF-01/})).toContainText('20');
    await detail.getByRole('button', {name: 'Close'}).click();
    await expect(detail).toBeHidden();
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
    const detail = page.getByRole('dialog', {name: 'Order W00004'});
    await expect(detail.getByLabel('Comment 1', {exact: true})).toHaveValue(
      'Comment for W00004',
    );
    await detail.getByRole('button', {name: 'Add a comment'}).click();
    await detail.getByLabel('Comment 2', {exact: true}).fill('Smoke comment');
    await detail.getByRole('button', {name: 'Save comment 2'}).click();
    await expect(toast(page, 'The comments were saved.')).toBeVisible();
    await expect(
      row.getByRole('button', {name: 'Comments of order W00004: 2'}),
    ).toBeAttached();
    await detail.getByRole('button', {name: 'Close'}).click();

    await row
      .getByRole('button', {name: 'Comments of order W00004: 2'})
      .click();
    await expect(detail.getByLabel('Comment 2', {exact: true})).toHaveValue(
      'Smoke comment',
    );
    await detail.getByRole('button', {name: 'Remove comment 2'}).click();
    await expect(detail.getByLabel('Comment 2', {exact: true})).toHaveCount(0);
    await detail.getByRole('button', {name: 'Close'}).click();
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

    const menu = await rowMenu(page, row, 'W00001');
    const documents: [string, string][] = [
      ['Order PDF', 'application/pdf'],
      ['Remaining products PDF', 'application/pdf'],
      ['Excel sheet', 'application/vnd.ms-excel'],
    ];
    for (const [name, type] of documents) {
      const link = menu.getByRole('menuitem', {name});
      await expect(link).toHaveAttribute('target', '_blank');
      const answer = await page.request.get(
        (await link.getAttribute('href')) as string,
      );
      expect(answer.status(), name).toBe(200);
      expect(answer.headers()['content-type']).toContain(type);
    }
  });

  test('ORD-08 · deleting an order asks first', async ({
    signedInAs,
    baseURL,
  }) => {
    await ensureUser(await signedInAs(ADMIN), baseURL as string, ORDERS_CLERK);
    const page = await signedInAs(ORDERS_CLERK.username);
    await page.goto('/admin/orders');
    const row = await findOrder(page, 'W00005');

    await (
      await rowMenu(page, row, 'W00005')
    )
      .getByRole('menuitem', {name: 'Delete'})
      .click();
    const question = page.getByRole('dialog', {name: 'Delete order W00005?'});
    await expect(question).toContainText(
      'Its products and comments are removed with it.',
    );
    await question.getByRole('button', {name: 'Cancel'}).click();
    await expect(row).toBeVisible();

    await (
      await rowMenu(page, row, 'W00005')
    )
      .getByRole('menuitem', {name: 'Delete'})
      .click();
    await question.getByRole('button', {name: 'Delete order'}).click();

    await expect(toast(page, 'Order W00005 was deleted.')).toBeVisible();
    await expect(page.getByRole('row', {name: /W00005/})).toHaveCount(0);
  });

  test('ORD-09 · Sync shop orders answers in words', async ({signedInAs}) => {
    const page = await signedInAs(ORDERS_CLERK.username);
    await page.goto('/admin/orders');
    await expect(page.getByRole('row', {name: /W00012/})).toBeVisible();

    await page.getByRole('button', {name: 'Sync shop orders'}).click();

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

  test('ORD-21 · each status chip counts its orders and keeps only them', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/orders');
    await expect(page.getByRole('row', {name: /W00012/})).toBeVisible();

    const partial = statusChips(page).getByRole('button', {name: /^Partial/});
    const count = Number(
      await partial.locator('.kf-chip__count').textContent(),
    );
    expect(count, 'W00004 and W00010 are partial').toBeGreaterThanOrEqual(2);
    await partial.click();

    await expect(partial).toHaveAttribute('aria-pressed', 'true');
    // The header row, then one row per partial order.
    await expect(page.getByRole('row')).toHaveCount(count + 1);
    await expect(page.getByRole('row', {name: /W00004/})).toBeVisible();
    await expect(page.getByRole('row', {name: /W00001/})).toHaveCount(0);
  });

  test('ORD-22 · a date range that keeps nothing says so, and Show all clears every filter', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/orders');
    await expect(page.getByRole('row', {name: /W00012/})).toBeVisible();

    await statusChips(page)
      .getByRole('button', {name: /^Created/})
      .click();
    await page.getByLabel('Created from').fill('2999-01-01');

    await expect(
      page.getByText('Nothing matches these filters.'),
    ).toBeVisible();
    await page.getByRole('button', {name: 'Show all'}).click();
    await expect(page.getByRole('row', {name: /W00012/})).toBeVisible();
    await expect(page.getByLabel('Created from')).toHaveValue('');
    await expect(
      statusChips(page).getByRole('button', {name: /^All/}),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  test('ORD-23 · a status change cancelled changes nothing', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/orders');
    const row = await findOrder(page, 'W00007');

    await row.getByRole('button', {name: 'Status of order W00007'}).click();
    await page.getByRole('menuitemradio', {name: 'Delivered'}).click();
    const question = page.getByRole('dialog', {
      name: 'Mark W00007 as Delivered?',
    });
    await expect(question).toContainText('Its stock does not change.');
    await question.getByRole('button', {name: 'Cancel'}).click();

    await expect(question).toBeHidden();
    await page.reload();
    await expect(
      (await findOrder(page, 'W00007')).getByRole('button', {
        name: 'Status of order W00007',
      }),
    ).toHaveText(/Created/);
  });

  test('ORD-24 · the detail is a slide-over with sections and the order’s actions', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    const errors = consoleErrors(page);
    await page.goto('/admin/orders');
    const row = await findOrder(page, 'W00008');

    await row.getByText('Jose Perez').click();

    const detail = page.getByRole('dialog', {name: 'Order W00008'});
    await expect(detail.getByRole('heading', {level: 3})).toHaveText([
      'Customer',
      'Products',
      'Comments',
    ]);
    await expect(detail.getByRole('link', {name: 'Edit'})).toHaveAttribute(
      'href',
      /\/admin\/orders\/\d+\/edit$/,
    );
    await expect(
      detail.getByRole('link', {name: 'Getting ready'}),
    ).toHaveAttribute('href', /\/admin\/orders\/\d+\/getting-ready$/);
    await detail.getByRole('button', {name: 'Documents'}).click();
    await expect(
      page.getByRole('menu', {name: 'Documents'}).getByRole('menuitem'),
    ).toHaveText(['Order PDF', 'Remaining products PDF', 'Excel sheet']);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await expect(detail).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('ORD-25 · the row menu follows the roles: no Delete or Sync without the managing role', async ({
    signedInAs,
    baseURL,
  }) => {
    await ensureUser(
      await signedInAs(ADMIN),
      baseURL as string,
      ORDERS_UPDATER,
    );
    const page = await signedInAs(ORDERS_UPDATER.username);
    await page.goto('/admin/orders');
    const row = await findOrder(page, 'W00009');

    const menu = await rowMenu(page, row, 'W00009');
    await expect(menu.getByRole('menuitem')).toHaveText([
      'Edit',
      'Getting ready',
      'Order PDF',
      'Remaining products PDF',
      'Excel sheet',
    ]);
    await expect(page.getByRole('link', {name: 'Create order'})).toBeVisible();
    await expect(
      page.getByRole('button', {name: 'Sync shop orders'}),
    ).toHaveCount(0);
  });
});

test.describe('5 Orders, on a phone (390 px)', () => {
  test.use({
    viewport: {width: 390, height: 844},
    isMobile: true,
    hasTouch: true,
  });

  test('ORD-26 · the orders are cards, nothing scrolls sideways, and a card opens the detail full width', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    const errors = consoleErrors(page);
    await page.goto('/admin/orders');
    const card = page.getByRole('row', {name: /W00010/});
    await expect(card).toBeVisible();
    await expect(
      card.getByRole('columnheader'),
      'no table header on a card',
    ).toHaveCount(0);
    const [scroll, client] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);
    expect(scroll, 'the page scrolls sideways').toBe(client);

    // The card's title (the order and its customer) is a plain part of the row: a tap there opens the order.
    await card.locator('.kf-table__card-title').click();
    const detail = page.getByRole('dialog', {name: 'Order W00010'});
    await expect(detail).toBeVisible();
    expect((await detail.boundingBox())?.width).toBe(390);
    expect(errors).toEqual([]);
  });
});
