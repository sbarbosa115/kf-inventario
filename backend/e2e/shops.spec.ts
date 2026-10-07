import {createHmac} from 'node:crypto';
import type {APIRequestContext, Page} from '@playwright/test';
import {ADMIN, consoleErrors, expect, test} from './support/test';

/**
 * 12 Shop connections (docs/tests/ui-regression.md, SHOP-01 – 09): the Settings tab's cards, the
 * connection form, the failed deliveries and the Orders page's warning line, Check now and Source column. Against the
 * seeded "Fake shop" connection (src/DataFixtures/ShopFixtures.php: Colombia, prints orders, http://nginx/_fake-shop,
 * keys ck_fake_shop / cs_fake_shop) and connections each test creates with a unique name. Other specs leave connections
 * behind on the dev database, so nothing here counts cards.
 */
const FAKE_SHOP = 'Fake shop';
const FAKE_SHOP_HOOK =
  '/webhooks/shops/fakeshop0000000000000000000000000000000000000000000000000000001';
const FAKE_SHOP_SECRET = 'fake-shop-webhook-secret';

interface Connection {
  id: number;
  name: string;
  active: boolean;
  webhook_url: string;
  has_keys: boolean;
  health: {failed_deliveries: number; last_failure_code: string | null};
}

/** The app's origin, for the API writes (SameOriginWrites). */
const origin = () => new URL(test.info().project.use.baseURL as string).origin;

const unique = () => Math.floor(100000 + Math.random() * 899999);

/** A WooCommerce order as the webhook posts it. */
function shopOrder(id: number, sku = 'KF-01'): string {
  return JSON.stringify({
    id,
    billing: {
      first_name: 'Shop',
      last_name: 'Buyer',
      email: `shop.buyer.${id}@example.com`,
      phone: '555-0100',
      address_1: '1 Billing St',
      postcode: '33101',
      city: 'Miami',
      state: 'FL',
      country: 'US',
    },
    shipping: {
      address_1: '2 Shipping Ave',
      postcode: '10001',
      city: 'New York',
      state: 'NY',
      country: 'US',
    },
    line_items: [{sku, quantity: 2}],
  });
}

/** Posts a body to a connection's webhook, signed with `secret` (base64 HMAC-SHA256 of the raw body). */
function deliver(
  request: APIRequestContext,
  path: string,
  body: string,
  secret: string,
) {
  return request.post(path, {
    data: body,
    headers: {
      'Content-Type': 'application/json',
      'X-WC-Webhook-Signature': createHmac('sha256', secret)
        .update(body)
        .digest('base64'),
    },
  });
}

async function connections(page: Page): Promise<Connection[]> {
  return (await (
    await page.request.get('/api/v1/shops')
  ).json()) as Connection[];
}

async function connectionNamed(page: Page, name: string): Promise<Connection> {
  const found = (await connections(page)).find((c) => c.name === name);
  expect(found, `connection ${name}`).toBeDefined();
  return found!;
}

const card = (page: Page, name: string) =>
  page.locator('article').filter({
    has: page.getByRole('heading', {name, exact: true}),
  });

const toast = (page: Page, text: string | RegExp) =>
  page.getByRole('status').filter({hasText: text});

test.describe('12 Shop connections', () => {
  test('SHOP-01 · A new connection shows its webhook URL and secret, each with Copy', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    const errors = consoleErrors(page);
    const name = `Smoke shop ${unique()}`;

    await page.goto('/admin/settings/shops');
    await page.getByRole('link', {name: 'Add connection'}).first().click();
    await expect(
      page.getByRole('heading', {level: 1, name: 'Add connection'}),
    ).toBeVisible();
    await expect(
      page.getByRole('button', {name: 'Test connection'}),
    ).toBeDisabled();
    await page.getByLabel('Name', {exact: true}).fill(name);
    await page.getByLabel('Site URL').fill(`http://smoke-${unique()}.test`);
    await page.getByLabel('Consumer key').fill('ck_smoke');
    await page.getByLabel('Consumer secret').fill('cs_smoke');
    // España: the orders lane renames Usa for a moment (WH-02).
    await page.getByLabel('Warehouse').selectOption({label: 'España'});
    await page.getByRole('button', {name: 'Save connection'}).click();

    await expect(toast(page, `Connection ${name} created.`)).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/settings\/shops\/\d+$/);
    const webhook = page.getByRole('region', {name: 'Webhook'});
    await expect(
      webhook.getByRole('textbox', {name: 'Webhook URL'}),
    ).toHaveValue(/\/webhooks\/shops\/[0-9a-f]{64}$/);
    await expect(
      webhook.getByRole('textbox', {name: 'Signing secret'}),
    ).toHaveValue(/^[0-9a-f]{64}$/);
    await expect(
      webhook.getByRole('button', {name: 'Copy webhook URL'}),
    ).toBeVisible();
    await expect(
      webhook.getByRole('button', {name: 'Copy signing secret'}),
    ).toBeVisible();
    await expect(
      page.getByRole('button', {name: 'Test connection'}),
    ).toBeEnabled();
    expect(errors).toEqual([]);
  });

  test('SHOP-02 · Test connection says why bad keys fail and names the store with good ones', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    const fake = await connectionNamed(page, FAKE_SHOP);
    await page.goto(`/admin/settings/shops/${fake.id}`);
    await expect(page.getByLabel('Name', {exact: true})).toHaveValue(FAKE_SHOP);

    await page.getByLabel('Consumer key').fill('ck_wrong');
    await page.getByLabel('Consumer secret').fill('cs_wrong');
    await page.getByRole('button', {name: 'Test connection'}).click();
    const result = page.getByRole('region', {name: 'Test result'});
    await expect(result).toContainText('The shop did not answer');

    // Blank keys: the saved ones are tested.
    await page.getByLabel('Consumer key').fill('');
    await page.getByLabel('Consumer secret').fill('');
    await page.getByRole('button', {name: 'Test connection'}).click();
    await expect(result).toContainText('Connected to Fake shop');
    await expect(result).toContainText(/WooCommerce \d/);
  });

  test('SHOP-03 · Editing with blank keys keeps the saved ones', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    const name = `Smoke keys ${unique()}`;
    const created = await page.request.post('/api/v1/shops', {
      headers: {Origin: origin()},
      data: {
        name,
        site_url: `http://keys-${unique()}.test`,
        consumer_key: 'ck_keep',
        consumer_secret: 'cs_keep',
        warehouse_id: 2,
        email_printer: false,
        active: true,
        capabilities: {order_status: false, order_note: false},
      },
    });
    expect(created.status()).toBe(201);
    const {id} = (await created.json()) as {id: number};

    await page.goto(`/admin/settings/shops/${id}`);
    await expect(
      page.getByText('Keys are saved. Leave both blank to keep them.'),
    ).toBeVisible();
    await page.getByLabel('Name', {exact: true}).fill(`${name} renamed`);
    // The switch's input is visually hidden: a person clicks its label.
    await page
      .locator('label')
      .filter({hasText: /^Order status$/})
      .click();
    await expect(
      page.getByRole('switch', {name: 'Order status'}),
    ).toBeChecked();
    await page.getByRole('button', {name: 'Save connection'}).click();

    await expect(
      toast(page, `Connection ${name} renamed saved.`),
    ).toBeVisible();
    const saved = await connectionNamed(page, `${name} renamed`);
    expect(saved.has_keys, 'blank keys keep the saved ones').toBe(true);
  });

  test('SHOP-04 · A deactivated connection keeps what its shop sends', async ({
    request,
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    const name = `Smoke off ${unique()}`;
    const created = await page.request.post('/api/v1/shops', {
      headers: {Origin: origin()},
      data: {
        name,
        site_url: `http://off-${unique()}.test`,
        warehouse_id: 1,
        email_printer: false,
        active: true,
        capabilities: {order_status: false, order_note: false},
      },
    });
    expect(created.status()).toBe(201);
    const connection = (await created.json()) as Connection & {
      webhook_secret: string;
    };

    await page.goto('/admin/settings/shops');
    await card(page, name)
      .getByRole('button', {name: `Actions for ${name}`})
      .click();
    await page.getByRole('menuitem', {name: 'Deactivate'}).click();
    await expect(toast(page, `${name} is inactive.`)).toBeVisible();
    await expect(card(page, name).getByText('Inactive')).toBeVisible();

    const answer = await deliver(
      request,
      new URL(connection.webhook_url).pathname,
      shopOrder(unique()),
      connection.webhook_secret,
    );
    expect(answer.status()).toBe(200);
    const inbox = (await (
      await page.request.get(
        `/api/v1/shops/${connection.id}/deliveries?status=failed`,
      )
    ).json()) as {items: {reason_code: string}[]};
    expect(inbox.items.map((d) => d.reason_code)).toEqual(['inactive']);
  });

  test('SHOP-05 · Health lines and counters', async ({request, signedInAs}) => {
    const page = await signedInAs(ADMIN);
    const answer = await deliver(
      request,
      FAKE_SHOP_HOOK,
      shopOrder(unique()),
      'not-the-secret',
    );
    expect(answer.status()).toBe(401);

    await page.goto('/admin/settings/shops');
    const fake = card(page, FAKE_SHOP);
    const health = fake.getByRole('list', {name: 'Connection health'});
    await expect(health).toContainText('Last failure');
    await expect(health).toContainText('Bad signature');
    await expect(
      fake.getByRole('link', {name: /^\d+ failed deliver(y|ies)$/}),
    ).toHaveAttribute('href', /\/admin\/settings\/shops\/\d+\/deliveries$/);
  });

  test('SHOP-06 · The failed deliveries: filters, body, Retry, Discard', async ({
    request,
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    const errors = consoleErrors(page);
    const remote = unique();
    expect(
      (
        await deliver(
          request,
          FAKE_SHOP_HOOK,
          shopOrder(remote, 'KF-SMOKE-MISSING'),
          FAKE_SHOP_SECRET,
        )
      ).status(),
    ).toBe(200);
    const fake = await connectionNamed(page, FAKE_SHOP);

    await page.goto(`/admin/settings/shops/${fake.id}/deliveries`);
    await expect(
      page.getByRole('heading', {level: 1, name: 'Failed deliveries'}),
    ).toBeVisible();
    await expect(page.getByText('Status: Failed')).toBeVisible();
    await page.getByLabel('Filter by Shop order #').fill(String(remote));
    await page.getByLabel('Filter by Shop order #').press('Enter');
    const row = page.locator('tbody tr[role="row"]').filter({
      hasText: String(remote),
    });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('KF-SMOKE-MISSING × 2');
    await expect(row).toContainText('Unknown product');

    await row.click();
    const panel = page.getByRole('dialog', {name: `Shop order ${remote}`});
    await expect(panel.getByLabel('Body')).toContainText('"KF-SMOKE-MISSING"');
    await panel.getByRole('button', {name: 'Retry'}).click();
    await expect(
      page.getByRole('alert').filter({hasText: 'Still not placed'}),
    ).toBeVisible();

    await row.getByRole('button', {name: `Actions for ${remote}`}).click();
    await page.getByRole('menuitem', {name: 'Discard'}).click();
    await expect(toast(page, 'Delivery discarded.')).toBeVisible();
    await expect(row).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('SHOP-07 · The Orders warning line links to the right connection', async ({
    request,
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    expect(
      (
        await deliver(
          request,
          FAKE_SHOP_HOOK,
          shopOrder(unique(), 'KF-SMOKE-MISSING'),
          FAKE_SHOP_SECRET,
        )
      ).status(),
    ).toBe(200);
    const fake = await connectionNamed(page, FAKE_SHOP);

    await page.goto('/admin/orders');
    const warning = page.getByRole('region', {name: 'Shop connections'});
    // One line per problem, or several folded behind Show (other cases leave problems of their own).
    await expect(warning).toContainText(/Fake shop:|need attention/);
    const show = warning.getByRole('button', {name: 'Show'});
    if (await show.isVisible()) await show.click();
    const line = warning.locator('p, li').filter({
      hasText: /^Fake shop: \d+ orders? could not be placed/,
    });
    await expect(line).toHaveCount(1);
    await line.getByRole('link', {name: 'Fix in Settings'}).click();
    await expect(page).toHaveURL(
      new RegExp(`/admin/settings/shops/${fake.id}/deliveries$`),
    );
  });

  test('SHOP-08 · Check now answers per connection', async ({signedInAs}) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/orders');
    // The list first: the pull asks the fake shop, served by the same PHP pool, while the page's own requests wait
    // on the session that the pull holds. Clicked mid-load, every worker waited and the pull timed out at 15 s.
    await expect(page.getByRole('row', {name: /W00001/})).toBeVisible();

    await page.getByRole('button', {name: 'Check now'}).click();

    // Other specs leave unreachable connections behind: the answer may name them (a toast that stays).
    await expect(
      page
        .getByRole('status')
        .or(page.getByRole('alert'))
        .filter({hasText: /orders? imported from \d+ shops?, \d+ skipped/}),
    ).toBeVisible();
  });

  test('SHOP-09 · The Source column names the shop; its filter lists the shops', async ({
    request,
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    const code = unique();
    expect(
      (
        await deliver(
          request,
          FAKE_SHOP_HOOK,
          shopOrder(code),
          FAKE_SHOP_SECRET,
        )
      ).status(),
    ).toBe(200);

    await page.goto('/admin/orders');
    await page.getByRole('radio', {name: 'Colombia'}).click();
    const filters = page.locator('.kf-table__filters');
    await filters.getByRole('button', {name: 'Source'}).click();
    await page.getByRole('checkbox', {name: new RegExp(FAKE_SHOP)}).click();
    await page.keyboard.press('Escape');

    await expect(page.getByText(`Source: ${FAKE_SHOP}`)).toBeVisible();
    const row = page.locator('tbody tr[role="row"]').filter({
      hasText: String(code),
    });
    await expect(row).toContainText(FAKE_SHOP);
  });
});
