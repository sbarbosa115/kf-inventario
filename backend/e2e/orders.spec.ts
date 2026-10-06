import {
  ADMIN,
  INVENTORY,
  consoleErrors,
  ensureUser,
  expect,
  test,
} from './support/test';
import type {Locator, Page} from '@playwright/test';

// 5 Orders (ORD-01 – 10 but 09, ORD-21 – 28 but 27). The fixtures put twelve orders (W00001 – W00012) on the first
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
  test("ORD-01 · The list shows the first warehouse's orders, and the old address lands on it", async ({
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
    await expect(page.getByRole('button', {name: 'Check now'})).toBeVisible();
    for (const header of [
      'Order',
      'Customer',
      'Source',
      'Status',
      'Created',
      'Notes',
    ]) {
      await expect(
        page.getByRole('columnheader', {name: header, exact: true}),
      ).toBeVisible();
    }
    const row = await findOrder(page, 'W00001');
    await expect(row.getByText('Jose Perez', {exact: true})).toBeVisible();
    await expect(row.getByText('jose.perez@example.com')).toBeVisible();
    await expect(row.getByText('Phone')).toBeVisible();
    await expect(
      row.getByRole('button', {name: 'Status of order W00001'}),
    ).toHaveText(/Created/);
    expect(errors).toEqual([]);
  });

  test('ORD-02 · Another warehouse and a status narrow the list', async ({
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

  test('ORD-03 · A status changes from its badge, after a question, and stays changed', async ({
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

  test('ORD-04 · Choosing Sent opens the getting-ready screen instead', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/orders');
    const row = await findOrder(page, 'W00002');

    await row.getByRole('button', {name: 'Status of order W00002'}).click();
    await page.getByRole('menuitemradio', {name: 'Sent'}).click();

    await expect(page).toHaveURL(/\/admin\/orders\/\d+\/getting-ready$/);
  });

  test('ORD-05 · The detail shows the order, its customer and its products', async ({
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

  test('ORD-06 · Comments are added and removed from the detail', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/orders');
    const row = await findOrder(page, 'W00004');

    await row
      .getByRole('button', {name: 'Comments of order W00004: 1'})
      .click();
    const detail = page.getByRole('dialog', {name: 'Order W00004'});
    const timeline = detail.getByRole('list', {
      name: 'Comments of order W00004',
    });
    await expect(timeline.getByRole('listitem')).toHaveText([
      /Comment for W00004/,
    ]);
    const box = detail.getByRole('textbox', {name: 'Write a note…'});
    await box.fill('Smoke comment');
    await box.press('Enter');
    await expect(timeline.getByRole('listitem')).toHaveCount(2);
    await expect(
      row.getByRole('button', {name: 'Comments of order W00004: 2'}),
    ).toBeAttached();
    await detail.getByRole('button', {name: 'Close'}).click();

    await row
      .getByRole('button', {name: 'Comments of order W00004: 2'})
      .click();
    await expect(timeline.getByRole('listitem').nth(1)).toContainText(
      'Smoke comment',
    );
    await timeline.getByRole('button', {name: 'Actions for comment 2'}).click();
    await page.getByRole('menuitem', {name: 'Remove'}).click();
    await page
      .getByRole('dialog', {name: 'Remove this comment?'})
      .getByRole('button', {name: 'Remove'})
      .click();
    await expect(toast(page, 'The comment was removed.')).toBeVisible();
    await expect(timeline.getByRole('listitem')).toHaveCount(1);
    await detail.getByRole('button', {name: 'Close'}).click();
    await expect(
      row.getByRole('button', {name: 'Comments of order W00004: 1'}),
    ).toBeVisible();
  });

  test("ORD-07 · The order's documents download", async ({signedInAs}) => {
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
      const body = await answer.body();
      if (type === 'application/pdf') {
        expect(body.subarray(0, 5).toString(), `${name} is a PDF`).toBe(
          '%PDF-',
        );
      } else {
        expect(answer.headers()['content-disposition']).toContain(
          'filename="file-upload-template-W00001.xls"',
        );
        expect(
          body.includes(Buffer.from('KF-01', 'utf16le')),
          "the order's products are in the sheet",
        ).toBe(true);
      }
    }
  });

  test('ORD-08 · Deleting an order asks first', async ({
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

  test('ORD-10 · A person without the orders roles is refused', async ({
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

  test('ORD-21 · Each status chip counts its orders and keeps only them', async ({
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
    // One body row per partial order (the header and its filter row left out).
    await expect(page.locator('tbody tr[role="row"]')).toHaveCount(count);
    await expect(page.getByRole('row', {name: /W00004/})).toBeVisible();
    await expect(page.getByRole('row', {name: /W00001/})).toHaveCount(0);

    // The chips count what the search keeps: W00010, W00011 and W00012.
    await statusChips(page).getByRole('button', {name: /^All/}).click();
    await page
      .getByRole('searchbox', {name: 'Order number or customer'})
      .fill('W0001');
    await expect(
      statusChips(page).getByRole('button', {name: /^All/}),
    ).toHaveText(/^All\s*3$/);
    await expect(page.locator('tbody tr[role="row"]')).toHaveCount(3);
  });

  test('ORD-22 · A date range that keeps nothing says so, and Show all clears every filter', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/orders');
    await expect(page.getByRole('row', {name: /W00012/})).toBeVisible();

    await statusChips(page)
      .getByRole('button', {name: /^Created/})
      .click();
    // The date range is the Created column's filter, in the row under the headers.
    await page
      .locator('.kf-table__filters')
      .getByRole('button', {name: 'Created', exact: true})
      .click();
    await page.getByLabel('From', {exact: true}).fill('2999-01-01');

    await expect(
      page.getByText('Nothing matches these filters.'),
    ).toBeVisible();
    await page.getByRole('button', {name: 'Show all'}).click();
    await expect(page.getByRole('row', {name: /W00012/})).toBeVisible();
    await expect(
      page
        .locator('.kf-table__filters')
        .getByRole('button', {name: 'Created', exact: true}),
      'the range is gone: the button names the column alone',
    ).toBeVisible();
    await expect(
      statusChips(page).getByRole('button', {name: /^All/}),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  test('ORD-23 · A status change cancelled changes nothing', async ({
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

  test("ORD-24 · The detail is a slide-over with sections and the order's actions", async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    const errors = consoleErrors(page);
    await page.goto('/admin/orders');
    const row = await findOrder(page, 'W00008');

    await row.getByText('Jose Perez', {exact: true}).click();

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

    // The status changes from the panel too, and the list behind follows at once.
    await detail.getByRole('button', {name: 'Status of order W00008'}).click();
    await page.getByRole('menuitemradio', {name: 'Completed'}).click();
    const question = page.getByRole('dialog', {
      name: 'Mark W00008 as Completed?',
    });
    await page.keyboard.press('Escape');
    await expect(question, 'Escape closes the question only').toBeHidden();
    await expect(detail).toBeVisible();
    await detail.getByRole('button', {name: 'Status of order W00008'}).click();
    await page.getByRole('menuitemradio', {name: 'Completed'}).click();
    await question.getByRole('button', {name: 'Mark as Completed'}).click();
    await expect(toast(page, 'Order W00008 is now Completed.')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(detail).toBeHidden();
    await expect(
      row.getByRole('button', {name: 'Status of order W00008'}),
    ).toHaveText(/Completed/);
    expect(errors).toEqual([]);
  });

  test('ORD-28 · With the keyboard only, an order opens from its number and the focus comes back to it', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/orders');
    const row = await findOrder(page, 'W00011');
    const number = row.getByRole('button', {name: 'W00011', exact: true});

    await number.focus();
    await page.keyboard.press('Enter');
    const detail = page.getByRole('dialog', {name: 'Order W00011'});
    await expect(detail).toBeVisible();
    expect(
      await page.evaluate(
        () => !!document.activeElement?.closest('[role="dialog"]'),
      ),
      'the focus moved into the detail',
    ).toBe(true);
    for (let i = 0; i < 15; i++) await page.keyboard.press('Tab');
    expect(
      await page.evaluate(
        () => !!document.activeElement?.closest('[role="dialog"]'),
      ),
      'and stays there',
    ).toBe(true);
    await page.keyboard.press('Escape');
    await expect(detail).toBeHidden();
    await expect(number).toBeFocused();

    // A status menu: Enter opens it, the arrows move, Escape gives the focus back to the badge.
    const badge = row.getByRole('button', {name: 'Status of order W00011'});
    await badge.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menuitemradio').first()).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitemradio').nth(1)).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(badge).toBeFocused();
  });

  test('ORD-25 · The row menu follows the roles', async ({
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
    await expect(page.getByRole('button', {name: 'Check now'})).toHaveCount(0);
  });
});

test.describe('5 Orders, on a phone (390 px)', () => {
  test.use({
    viewport: {width: 390, height: 844},
    isMobile: true,
    hasTouch: true,
  });

  test('ORD-26 · On a phone the orders are cards', async ({signedInAs}) => {
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

    // The card's title (the order and its customer) is a plain part of the row: a tap there opens the order. The
    // list is narrowed first, so the card is not under the sticky filters or the tab bar when it is tapped.
    await findOrder(page, 'W00010');
    await card.locator('.kf-table__card-title').click();
    const detail = page.getByRole('dialog', {name: 'Order W00010'});
    await expect(detail).toBeVisible();
    // Centred, 8 px from each edge of the phone; measured once its entry animation is over.
    await expect
      .poll(async () => {
        const box = await detail.boundingBox();
        return box ? [Math.round(box.x), Math.round(box.width)] : null;
      })
      .toEqual([8, 374]);
    expect(errors).toEqual([]);
  });
});
