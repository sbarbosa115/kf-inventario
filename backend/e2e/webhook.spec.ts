import {createHmac} from 'node:crypto';
import type {Page} from '@playwright/test';
import {ADMIN, expect, test} from './support/test';
import {emailCount, emailTo} from './support/mail';

/**
 * 9 WooCommerce webhook (docs/tests/ui-regression.md, HOOK-01 – 05): the old, public URL is a tombstone (410, nothing
 * placed, the hit counted: the legacy webhook was removed on 2026-10-06), and a shop posts to its connection's own URL
 * (the seeded "Fake shop" connection: Colombia, prints its orders; src/DataFixtures/ShopFixtures.php).
 */
const WEBHOOK = '/admin/order/1H39j0jpQPsWL958v9R4';
const PRINTER = 'printer@kf.local';

/** A WooCommerce order as the shops post it (the fields the webhook reads). */
function shopOrder(id: number): Record<string, unknown> {
  return {
    id,
    billing: {
      first_name: 'Hook',
      last_name: 'Buyer',
      email: `hook.buyer.${id}@example.com`,
      phone: '555-0199',
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
    line_items: [
      {sku: 'KF-01', quantity: 2},
      {sku: 'KF-02', quantity: 1},
    ],
  };
}

test.describe('9 WooCommerce webhook', () => {
  test('HOOK-01 · The old webhook URL answers 410 to everything and places nothing', async ({
    request,
    signedInAs,
  }) => {
    const code = 900000 + Math.floor(Math.random() * 99999);

    // A source the removed import matched (warehouse 1's `urls`) and the Fake shop's own site: neither is imported.
    for (const source of ['https://colombia.test', 'http://nginx/_fake-shop']) {
      const answer = await request.post(WEBHOOK, {
        data: shopOrder(code),
        headers: {'X-WC-Webhook-Source': source},
      });
      expect(answer.status()).toBe(410);
      expect(await answer.json()).toEqual({
        status: false,
        error: 'webhook_moved',
      });
    }
    const ping = await request.get(WEBHOOK);
    expect(ping.status(), 'GET too, public').toBe(410);

    const admin = await signedInAs(ADMIN);
    for (const warehouse of [1, 2, 3]) {
      const orders = (
        (await (
          await admin.request.get(
            `/api/v1/orders?warehouse_id=${warehouse}&filter[code]=${code}`,
          )
        ).json()) as {items: {code: string}[]}
      ).items;
      expect(orders.map((order) => order.code)).not.toContain(String(code));
    }
    expect(
      await emailCount(request, PRINTER, new RegExp(`^Order #${code} `)),
    ).toBe(0);
  });

  test('HOOK-02 · A hit on the old URL is counted and shown in Settings', async ({
    request,
    signedInAs,
  }) => {
    const admin = await signedInAs(ADMIN);
    const before = (await (
      await admin.request.get('/api/v1/settings/webhooks')
    ).json()) as {legacy_hits: number};

    await request.post(WEBHOOK, {
      data: shopOrder(800000 + Math.floor(Math.random() * 99999)),
      headers: {'X-WC-Webhook-Source': 'https://colombia.test'},
    });

    const after = (await (
      await admin.request.get('/api/v1/settings/webhooks')
    ).json()) as {legacy_hits: number; legacy_last_hit_at: string | null};
    expect(after.legacy_hits).toBe(before.legacy_hits + 1);
    expect(after.legacy_last_hit_at).not.toBeNull();
    await admin.goto('/admin/settings');
    await expect(
      admin.getByText(
        new RegExp(
          `^${after.legacy_hits} deliver(y|ies) reached it since the deploy`,
        ),
      ),
    ).toBeVisible();
    await admin.goto('/admin/settings/shops');
    await expect(
      admin
        .getByRole('alert')
        .filter({hasText: 'The old webhook URL received'}),
    ).toContainText(
      `The old webhook URL received ${after.legacy_hits} deliver`,
    );
  });
});

/** The seeded connection (src/DataFixtures/ShopFixtures.php). */
const FAKE_SHOP_TOKEN =
  'fakeshop0000000000000000000000000000000000000000000000000000001';
const FAKE_SHOP_WEBHOOK_SECRET = 'fake-shop-webhook-secret';
const FAKE_SHOP_HOOK = `/webhooks/shops/${FAKE_SHOP_TOKEN}`;

/** The body and headers WooCommerce sends: the signature is base64(HMAC-SHA256(raw body, secret)). */
function signed(
  order: Record<string, unknown>,
  secret = FAKE_SHOP_WEBHOOK_SECRET,
): {data: string; headers: Record<string, string>} {
  const data = JSON.stringify(order);
  return {
    data,
    headers: {
      'Content-Type': 'application/json',
      'X-WC-Webhook-Signature': createHmac('sha256', secret)
        .update(data)
        .digest('base64'),
    },
  };
}

interface Shop {
  id: number;
  name: string;
  health: {
    last_webhook_at: string | null;
    last_import_at: string | null;
    last_failure_code: string | null;
    failed_deliveries: number;
  };
}

interface Delivery {
  id: number;
  remote_order_id: string | null;
  status: string;
  reason_code: string | null;
  reason: string | null;
  order: {id: number; code: string} | null;
}

/** A connection of the case's own (Colombia, no keys, prints nothing), so the Fake shop's health is the shops lane's. */
interface OwnConnection {
  id: number;
  name: string;
  siteUrl: string;
  path: string;
  secret: string;
}

async function ownConnection(
  admin: Page,
  baseURL: string,
): Promise<OwnConnection> {
  const n = Math.floor(100000 + Math.random() * 899999);
  const [name, siteUrl] = [`Hook ${n}`, `http://hook-${n}.test`];
  const created = await admin.request.post('/api/v1/shops', {
    headers: {Origin: new URL(baseURL).origin},
    data: {
      name,
      site_url: siteUrl,
      warehouse_id: 1,
      email_printer: false,
      active: true,
      capabilities: {order_status: false, order_note: false},
    },
  });
  expect(created.status(), `creating ${name}`).toBe(201);
  const body = (await created.json()) as {
    id: number;
    webhook_url: string;
    webhook_secret: string;
  };
  return {
    id: body.id,
    name,
    siteUrl,
    path: new URL(body.webhook_url).pathname,
    secret: body.webhook_secret,
  };
}

/** Deletes the case's connection, or deactivates it when orders came through it (such a connection stays). */
async function putAway(
  admin: Page,
  baseURL: string,
  own: OwnConnection,
): Promise<void> {
  const headers = {Origin: new URL(baseURL).origin};
  const removed = await admin.request.delete(`/api/v1/shops/${own.id}`, {
    headers,
  });
  if (removed.status() === 204) return;
  const off = await admin.request.put(`/api/v1/shops/${own.id}`, {
    headers,
    data: {
      name: own.name,
      site_url: own.siteUrl,
      consumer_key: '',
      consumer_secret: '',
      warehouse_id: 1,
      email_printer: false,
      active: false,
      capabilities: {order_status: false, order_note: false},
    },
  });
  expect(off.status(), `deactivating ${own.name}`).toBe(200);
}

test.describe('9 WooCommerce webhook · connections', () => {
  test('HOOK-03 · A signed delivery to a connection is placed in its warehouse, linked, named and printed', async ({
    request,
    signedInAs,
  }) => {
    const code = 700000 + Math.floor(Math.random() * 99999);
    const since = new Date();

    const answer = await request.post(FAKE_SHOP_HOOK, signed(shopOrder(code)));

    expect(answer.status()).toBe(200);
    expect(await answer.json()).toEqual({status: true});
    const admin = await signedInAs(ADMIN);
    const orders = (
      (await (
        await admin.request.get(
          `/api/v1/orders?warehouse_id=1&filter[code]=${code}`,
        )
      ).json()) as {
        items: {id: number; code: string; shop: {name: string} | null}[];
      }
    ).items;
    const placed = orders.find((order) => order.code === String(code));
    expect(placed, "in the connection's warehouse, Colombia").toBeDefined();
    expect(placed?.shop?.name, 'the order names its shop').toBe('Fake shop');
    const detail = (await (
      await admin.request.get(`/api/v1/orders/${placed?.id}`)
    ).json()) as {
      customer: {addresses: {address_type: number}[]};
      products: {product: {code: string}; quantity: number}[];
    };
    expect(
      detail.customer.addresses.map((a) => a.address_type),
      'billing and shipping',
    ).toEqual([1, 2]);
    expect(
      detail.products.map((line) => [line.product.code, line.quantity]),
    ).toEqual([
      ['KF-01', 2],
      ['KF-02', 1],
    ]);
    const shops = (await (
      await admin.request.get('/api/v1/shops')
    ).json()) as Shop[];
    const fake = shops.find((shop) => shop.name === 'Fake shop');
    expect(fake?.health.last_webhook_at).not.toBeNull();
    expect(fake?.health.last_import_at).not.toBeNull();
    const email = await emailTo(request, PRINTER, {
      subject: new RegExp(`Order #${code} was created`),
      since,
    });
    expect(email.to, 'the connection prints its orders').toEqual([PRINTER]);

    // WooCommerce delivers again when unsure: the same order is placed once.
    const again = await request.post(FAKE_SHOP_HOOK, signed(shopOrder(code)));
    expect(await again.json()).toEqual({status: true});
    const twice = (
      (await (
        await admin.request.get(
          `/api/v1/orders?warehouse_id=1&filter[code]=${code}`,
        )
      ).json()) as {items: {code: string}[]}
    ).items.filter((order) => order.code === String(code));
    expect(twice, 'placed once').toHaveLength(1);
  });

  test('HOOK-04 · A wrong signature is refused and kept without its body; an unknown token stores nothing', async ({
    request,
    signedInAs,
    baseURL,
  }) => {
    const admin = await signedInAs(ADMIN);
    const own = await ownConnection(admin, baseURL as string);
    try {
      const code = 600000 + Math.floor(Math.random() * 99999);

      const answer = await request.post(
        own.path,
        signed(shopOrder(code), 'not-the-secret'),
      );

      expect(answer.status()).toBe(401);
      expect(await answer.json()).toEqual({status: false});
      const unknown = await request.post(
        `/webhooks/shops/${'ab'.repeat(32)}`,
        signed(shopOrder(code)),
      );
      expect(unknown.status(), 'an unknown token stores nothing').toBe(404);
      const inbox = (
        (await (
          await admin.request.get(
            `/api/v1/shops/${own.id}/deliveries?status=failed&filter[reason_code][]=bad_signature`,
          )
        ).json()) as {items: Delivery[]}
      ).items;
      expect(inbox, 'kept in the inbox').toHaveLength(1);
      const detail = (await (
        await admin.request.get(
          `/api/v1/shops/${own.id}/deliveries/${inbox[0]!.id}`,
        )
      ).json()) as {payload: string | null};
      expect(detail.payload, 'a refused signature keeps no body').toBeNull();
    } finally {
      await putAway(admin, baseURL as string, own);
    }
  });

  test('HOOK-05 · An unknown SKU is kept in the inbox and placed by Retry once the product exists', async ({
    request,
    signedInAs,
    baseURL,
  }) => {
    const admin = await signedInAs(ADMIN);
    const own = await ownConnection(admin, baseURL as string);
    try {
      const code = 500000 + Math.floor(Math.random() * 99999);
      const sku = `HOOK-${code}`;
      const order = shopOrder(code);
      order.line_items = [
        {sku: 'KF-01', quantity: 1},
        {sku, quantity: 2},
      ];

      const answer = await request.post(own.path, signed(order, own.secret));

      expect(answer.status(), 'accepted: the shop must not retry it').toBe(200);
      const kept = (
        (await (
          await admin.request.get(
            `/api/v1/shops/${own.id}/deliveries?status=failed&q=${code}`,
          )
        ).json()) as {items: Delivery[]}
      ).items;
      expect(kept.map((d) => [d.remote_order_id, d.reason_code])).toEqual([
        [String(code), 'unknown_product'],
      ]);
      const row = kept[0] as Delivery;
      expect(row.reason).toContain(sku);

      const product = await admin.request.post('/api/v1/products', {
        data: {code: sku, title: `Hook product ${code}`, status: 1, price: 10},
      });
      expect(product.status()).toBe(201);
      const retried = await admin.request.post(
        `/api/v1/shops/${own.id}/deliveries/${row.id}/retry`,
      );

      expect(retried.status()).toBe(200);
      const placed = (await retried.json()) as Delivery;
      expect(placed.status).toBe('placed');
      expect(placed.order?.code).toBe(String(code));
    } finally {
      await putAway(admin, baseURL as string, own);
    }
  });
});
