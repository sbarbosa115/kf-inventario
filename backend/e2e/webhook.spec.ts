import {ADMIN, expect, test} from './support/test';
import {emailCount, emailTo} from './support/mail';

/**
 * 9 WooCommerce webhook (docs/tests/ui-regression.md, HOOK-01 – 02): what a shop posts to the unchanged, public URL.
 * The fixtures' warehouse 1 (Colombia) receives https://colombia.test's orders and prints them.
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
    const orders = (await (
      await admin.request.get('/api/v1/orders?warehouse_id=1')
    ).json()) as {id: number; code: string}[];
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
      const orders = (await (
        await admin.request.get(`/api/v1/orders?warehouse_id=${warehouse}`)
      ).json()) as {code: string}[];
      expect(orders.map((order) => order.code)).not.toContain(String(code));
    }
    expect(await emailCount(request, PRINTER)).toBe(emailsBefore);
  });
});
