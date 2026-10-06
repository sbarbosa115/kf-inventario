import {createHmac} from 'node:crypto';
import {ADMIN, expect, test} from './support/test';
import {emailCount, emailTo} from './support/mail';

/**
 * 9 WooCommerce webhook (docs/tests/ui-regression.md, HOOK-01 – 06): what a shop posts to the legacy, public URL (the
 * fixtures' warehouse 1, Colombia, receives https://colombia.test's orders and prints them) and to a connection's own
 * URL (the seeded "Fake shop" connection: Colombia, prints its orders; src/DataFixtures/ShopFixtures.php).
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
  test('HOOK-01 · a shop order lands in its warehouse with both addresses and is emailed to the printer', async ({
    request,
    signedInAs,
  }) => {
    const code = 900000 + Math.floor(Math.random() * 99999);
    const since = new Date();

    const answer = await request.post(WEBHOOK, {
      data: shopOrder(code),
      headers: {'X-WC-Webhook-Source': 'https://colombia.test'},
    });

    expect(answer.status()).toBe(200);
    expect(await answer.json()).toEqual({status: true});
    const admin = await signedInAs(ADMIN);
    const orders = (
      (await (
        await admin.request.get(
          `/api/v1/orders?warehouse_id=1&filter[code]=${code}`,
        )
      ).json()) as {items: {id: number; code: string}[]}
    ).items;
    const placed = orders.find((order) => order.code === String(code));
    expect(placed, 'the order is in warehouse 1').toBeDefined();
    const detail = (await (
      await admin.request.get(`/api/v1/orders/${placed?.id}`)
    ).json()) as {
      customer: {addresses: {address_type: number}[]};
      products: {product: {code: string}; quantity: number}[];
    };
    expect(detail.customer.addresses.map((a) => a.address_type)).toEqual([
      1, 2,
    ]);
    expect(
      detail.products.map((line) => [line.product.code, line.quantity]),
    ).toEqual([
      ['KF-01', 2],
      ['KF-02', 1],
    ]);
    const email = await emailTo(request, PRINTER, {
      subject: new RegExp(`Order #${code} was created`),
      since,
    });
    expect(email.to).toEqual([PRINTER]);
  });

  test('HOOK-02 · an unknown shop is answered ok and nothing is placed or emailed', async ({
    request,
    signedInAs,
  }) => {
    const code = 800000 + Math.floor(Math.random() * 99999);
    const emailsBefore = await emailCount(request, PRINTER);

    const answer = await request.post(WEBHOOK, {
      data: shopOrder(code),
      headers: {'X-WC-Webhook-Source': 'https://unknown-shop.test'},
    });

    expect(answer.status()).toBe(200);
    expect(await answer.json()).toEqual({status: true});
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
    expect(await emailCount(request, PRINTER)).toBe(emailsBefore);
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

test.describe('9 WooCommerce webhook · connections', () => {
  test('HOOK-03 · a signed delivery to a connection lands in its warehouse, linked, named and printed', async ({
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
    expect(placed, 'in the connection\'s warehouse, Colombia').toBeDefined();
    expect(placed?.shop?.name, 'the order names its shop').toBe('Fake shop');
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
  });

  test('HOOK-04 · a wrong signature is refused, kept without its body and shown in health', async ({
    request,
    signedInAs,
  }) => {
    const code = 600000 + Math.floor(Math.random() * 99999);

    const answer = await request.post(
      FAKE_SHOP_HOOK,
      signed(shopOrder(code), 'not-the-secret'),
    );

    expect(answer.status()).toBe(401);
    expect(await answer.json()).toEqual({status: false});
    const unknown = await request.post(
      `/webhooks/shops/${'ab'.repeat(32)}`,
      signed(shopOrder(code)),
    );
    expect(unknown.status(), 'an unknown token stores nothing').toBe(404);
    const admin = await signedInAs(ADMIN);
    const shop = (
      (await (await admin.request.get('/api/v1/shops')).json()) as Shop[]
    ).find((s) => s.name === 'Fake shop') as Shop;
    expect(shop.health.last_failure_code).toBe('bad_signature');
    const inbox = (
      (await (
        await admin.request.get(
          `/api/v1/shops/${shop.id}/deliveries?status=failed&filter[reason_code][]=bad_signature`,
        )
      ).json()) as {items: Delivery[]}
    ).items;
    expect(inbox.length).toBeGreaterThan(0);
    const detail = (await (
      await admin.request.get(
        `/api/v1/shops/${shop.id}/deliveries/${inbox[0].id}`,
      )
    ).json()) as {payload: string | null};
    expect(detail.payload, 'a refused signature keeps no body').toBeNull();
  });

  test('HOOK-05 · an unknown SKU is kept in the inbox; once the product exists, Retry places it', async ({
    request,
    signedInAs,
  }) => {
    const code = 500000 + Math.floor(Math.random() * 99999);
    const sku = `HOOK-${code}`;
    const order = shopOrder(code);
    order.line_items = [
      {sku: 'KF-01', quantity: 1},
      {sku, quantity: 2},
    ];

    const answer = await request.post(FAKE_SHOP_HOOK, signed(order));

    expect(answer.status(), 'accepted: the shop must not retry it').toBe(200);
    const admin = await signedInAs(ADMIN);
    const shop = (
      (await (await admin.request.get('/api/v1/shops')).json()) as Shop[]
    ).find((s) => s.name === 'Fake shop') as Shop;
    const kept = (
      (await (
        await admin.request.get(
          `/api/v1/shops/${shop.id}/deliveries?status=failed&q=${code}`,
        )
      ).json()) as {items: Delivery[]}
    ).items;
    expect(kept.map((d) => [d.remote_order_id, d.reason_code])).toEqual([
      [String(code), 'unknown_product'],
    ]);
    expect(kept[0].reason).toContain(sku);

    const product = await admin.request.post('/api/v1/products', {
      data: {code: sku, title: `Hook product ${code}`, status: 1, price: 10},
    });
    expect(product.status()).toBe(201);
    const retried = await admin.request.post(
      `/api/v1/shops/${shop.id}/deliveries/${kept[0].id}/retry`,
    );

    expect(retried.status()).toBe(200);
    const placed = (await retried.json()) as Delivery;
    expect(placed.status).toBe('placed');
    expect(placed.order?.code).toBe(String(code));
  });

  test('HOOK-06 · the legacy URL counts its hits; turned off it answers 410', async ({
    request,
    signedInAs,
  }) => {
    const admin = await signedInAs(ADMIN);
    try {
      expect(
        (
          await admin.request.put('/api/v1/settings/webhooks', {
            data: {legacy_enabled: false},
          })
        ).status(),
      ).toBe(200);

      const answer = await request.post(WEBHOOK, {
        data: shopOrder(400000 + Math.floor(Math.random() * 99999)),
        headers: {'X-WC-Webhook-Source': 'https://colombia.test'},
      });

      expect(answer.status()).toBe(410);
      expect(await answer.json()).toEqual({
        status: false,
        error: 'webhook_moved',
      });
      const settings = (await (
        await admin.request.get('/api/v1/settings/webhooks')
      ).json()) as {legacy_hits_since: number; legacy_last_hit_at: string};
      expect(settings.legacy_hits_since).toBe(1);
      expect(settings.legacy_last_hit_at).not.toBeNull();
    } finally {
      await admin.request.put('/api/v1/settings/webhooks', {
        data: {legacy_enabled: true},
      });
    }
  });
});
