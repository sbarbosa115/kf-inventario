import {createHmac} from 'node:crypto';
import type {APIRequestContext} from '@playwright/test';
import {ADMIN, INVENTORY, expect, test} from './support/test';

/**
 * 5 Orders, the shops' catch-up pull and write-back (docs/tests/ui-regression.md, ORD-19 and ORD-35 – 37), against
 * the dev stack's fake shop (/_fake-shop: its orders are set and its writes read through /_fake-shop/_state) and the
 * seeded "Fake shop" connection (src/DataFixtures/ShopFixtures.php). The pushes go through the `shops` queue: the
 * stack's worker sends them, so the specs wait for the fake shop to receive them.
 */
const SYNC = '/api/v1/orders/sync';
const STATE = '/_fake-shop/_state';
/** The seeded connection's webhook, signed with its secret. */
const FAKE_SHOP_HOOK =
  '/webhooks/shops/fakeshop0000000000000000000000000000000000000000000000000000001';
const FAKE_SHOP_WEBHOOK_SECRET = 'fake-shop-webhook-secret';
/** PHP reaches the dev stack's fake shop as nginx; another spelling of its URL is another connection. */
const FAKE_SHOP_AGAIN = 'http://nginx:80/_fake-shop';
/** No shop answers there. */
const NO_SHOP = 'http://nginx/_fake-shop-gone';

interface SyncAnswer {
  imported: number;
  skipped: number;
  failed: number;
  connections: {
    id: number;
    name: string;
    imported: number;
    skipped: number;
    error: string | null;
  }[];
}

interface Push {
  id: number;
  capability: string;
  order: {id: number; code: string};
  payload: Record<string, string>;
  status: string;
  attempts: number;
  last_error: string | null;
}

interface Write {
  call: string;
  order: string;
  value: string;
}

/** A WooCommerce order as the REST API answers it (KF-01 and KF-02 are fixture products). */
function shopOrder(id: number, modifiedGmt?: string): Record<string, unknown> {
  return {
    id,
    status: 'processing',
    ...(modifiedGmt === undefined ? {} : {date_modified_gmt: modifiedGmt}),
    billing: {
      first_name: 'Pull',
      last_name: 'Buyer',
      email: `pull.buyer.${id}@example.com`,
      phone: '555-0177',
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
      {sku: 'KF-01', quantity: 1},
      {sku: 'KF-02', quantity: 1},
    ],
  };
}

/** `YYYY-MM-DDTHH:MM:SS` in UTC, as WooCommerce writes date_modified_gmt, `hours` from now. */
function gmt(hours: number): string {
  return new Date(Date.now() + hours * 3_600_000).toISOString().slice(0, 19);
}

function uniqueId(): number {
  return 600000 + Math.floor(Math.random() * 99999);
}

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

/** The statuses the app wrote to the fake shop for one of its orders, oldest first. */
async function statusWritesOf(
  request: APIRequestContext,
  order: number,
): Promise<string[]> {
  const state = (await (await request.get(STATE)).json()) as {writes: Write[]};
  return state.writes
    .filter((write) => write.call === 'status' && write.order === String(order))
    .map((write) => write.value);
}

test.describe('5 Orders: shops sync and write-back', () => {
  let origin = '';
  test.beforeEach(({baseURL}) => {
    origin = new URL(baseURL as string).origin;
  });

  /** A connection made for a test, the fake shop's keys, order status write-back on. */
  async function aConnection(
    admin: APIRequestContext,
    name: string,
    siteUrl: string,
    warehouseId: number,
  ): Promise<{id: number; webhook_url: string; webhook_secret: string}> {
    const created = await admin.post('/api/v1/shops', {
      headers: {Origin: origin},
      data: {
        name,
        site_url: siteUrl,
        consumer_key: 'ck_fake_shop',
        consumer_secret: 'cs_fake_shop',
        warehouse_id: warehouseId,
        email_printer: false,
        active: true,
        capabilities: {order_status: true, order_note: false},
      },
    });
    expect(created.status(), `creating ${name}`).toBe(201);
    return created.json();
  }

  /** Deletes a test's connection, or deactivates it when it holds orders (a connection with orders stays). */
  async function putAway(
    admin: APIRequestContext,
    id: number,
    name: string,
    siteUrl: string,
    warehouseId: number,
  ): Promise<void> {
    const removed = await admin.delete(`/api/v1/shops/${id}`, {
      headers: {Origin: origin},
    });
    if (removed.status() === 204) {
      return;
    }
    const off = await admin.put(`/api/v1/shops/${id}`, {
      headers: {Origin: origin},
      data: {
        name,
        site_url: siteUrl,
        consumer_key: '',
        consumer_secret: '',
        warehouse_id: warehouseId,
        email_printer: false,
        active: false,
        capabilities: {order_status: false, order_note: false},
      },
    });
    expect(off.status(), `deactivating ${name}`).toBe(200);
  }

  test('ORD-19 · with nothing waiting at the shops, Check now places nothing, and it needs the sync role', async ({
    request,
    signedInAs,
  }) => {
    await request.put(STATE, {data: {orders: [], notes: {}}});
    const admin = await signedInAs(ADMIN);
    const total = async () =>
      (
        (await (
          await admin.request.get('/api/v1/orders?warehouse_id=1')
        ).json()) as {total: number}
      ).total;
    const before = await total();

    const answer = await admin.request.post(SYNC, {headers: {Origin: origin}});

    expect(answer.status()).toBe(202);
    const body = (await answer.json()) as SyncAnswer;
    expect([body.imported, body.failed]).toEqual([0, 0]);
    expect(body.connections.map((c) => [c.name, c.error])).toContainEqual([
      'Fake shop',
      null,
    ]);
    expect(await total()).toBe(before);

    const clerk = await signedInAs(INVENTORY);
    const refused = await clerk.request.post(SYNC, {headers: {Origin: origin}});
    expect(refused.status()).toBe(403);
  });

  test('ORD-35 · Check now pulls every active connection, only what changed since its last pull, and a failing shop fails alone', async ({
    request,
    signedInAs,
  }) => {
    const admin = (await signedInAs(ADMIN)).request;
    const suffix = Math.floor(Math.random() * 99999);
    const again = await aConnection(
      admin,
      `Sync check ${suffix}`,
      FAKE_SHOP_AGAIN,
      2,
    );
    const gone = await aConnection(admin, `Gone shop ${suffix}`, NO_SHOP, 2);
    const [first, second, older, newer] = [
      uniqueId(),
      uniqueId(),
      uniqueId(),
      uniqueId(),
    ];
    // The modification dates, fixed once: the fake shop compares them with the cursor to the second.
    const [hoursAgo4, hoursAgo3, hoursAgo2, hourAgo] = [-4, -3, -2, -1].map(
      gmt,
    );
    const row = (id: number, of: SyncAnswer) =>
      of.connections.find((c) => c.id === id);
    const inUsa = async (code: number) =>
      (
        (await (
          await admin.get(`/api/v1/orders?warehouse_id=2&filter[code]=${code}`)
        ).json()) as {items: {code: string; shop: {name: string} | null}[]}
      ).items.find((order) => order.code === String(code));
    try {
      await request.put(STATE, {
        data: {
          orders: [shopOrder(first, hoursAgo3), shopOrder(second, hoursAgo2)],
          notes: {},
        },
      });

      const answer = await admin.post(SYNC, {headers: {Origin: origin}});

      expect(answer.status(), 'one shop failing is not the check failing').toBe(
        202,
      );
      const body = (await answer.json()) as SyncAnswer;
      expect(row(again.id, body)).toMatchObject({imported: 2, error: null});
      expect(row(gone.id, body)?.error).toBeTruthy();
      expect(body.failed).toBeGreaterThanOrEqual(1);
      expect((await inUsa(first))?.shop?.name).toBe(`Sync check ${suffix}`);
      const shops = (await (await admin.get('/api/v1/shops')).json()) as {
        id: number;
        health: {last_failure_code: string | null};
      }[];
      expect(
        shops.find((shop) => shop.id === gone.id)?.health.last_failure_code,
        "in the failing connection's health",
      ).toBe('pull_failed');

      await request.put(STATE, {
        data: {
          orders: [
            shopOrder(first, hoursAgo3),
            shopOrder(second, hoursAgo2),
            shopOrder(older, hoursAgo4),
            shopOrder(newer, hourAgo),
          ],
          notes: {},
        },
      });

      const next = (await (
        await admin.post(SYNC, {headers: {Origin: origin}})
      ).json()) as SyncAnswer;

      expect(
        row(again.id, next),
        'only the order modified since the last pull is read: the two placed ones are not read again',
      ).toMatchObject({imported: 1, skipped: 0, error: null});
      expect(await inUsa(newer)).toBeDefined();
      expect(await inUsa(older)).toBeUndefined();
    } finally {
      await request.put(STATE, {data: {orders: [], notes: {}}});
      await putAway(admin, gone.id, `Gone shop ${suffix}`, NO_SHOP, 2);
      await putAway(
        admin,
        again.id,
        `Sync check ${suffix}`,
        FAKE_SHOP_AGAIN,
        2,
      );
    }
  });

  test('ORD-36 · Processed is written back as processing, Sent as completed, the other statuses touch nothing', async ({
    request,
    signedInAs,
  }) => {
    const code = uniqueId();
    const delivered = await request.post(
      FAKE_SHOP_HOOK,
      signed(shopOrder(code)),
    );
    expect(delivered.status()).toBe(200);
    const admin = (await signedInAs(ADMIN)).request;
    const order = (
      (await (
        await admin.get(`/api/v1/orders?warehouse_id=1&filter[code]=${code}`)
      ).json()) as {items: {id: number; code: string}[]}
    ).items.find((o) => o.code === String(code));
    expect(order, 'placed through the Fake shop connection').toBeDefined();
    const id = order?.id as number;
    const status = (value: number) =>
      admin.post(`/api/v1/orders/${id}/status`, {
        headers: {Origin: origin},
        data: {status: value},
      });

    expect((await status(2)).status()).toBe(200);
    await expect
      .poll(() => statusWritesOf(request, code), {timeout: 20_000})
      .toEqual(['processing']);

    const detail = (await (await admin.get(`/api/v1/orders/${id}`)).json()) as {
      products: {uuid: string; quantity: number}[];
    };
    const shipped = await admin.post(`/api/v1/orders/${id}/partials`, {
      headers: {Origin: origin},
      data: {
        items: detail.products.map((line) => ({
          uuid: line.uuid,
          quantity: line.quantity,
        })),
      },
    });
    expect(shipped.status(), 'getting ready ships the whole order: Sent').toBe(
      200,
    );
    await expect
      .poll(() => statusWritesOf(request, code), {timeout: 20_000})
      .toEqual(['processing', 'completed']);

    for (const other of [1, 3, 4]) {
      expect((await status(other)).status()).toBe(200);
    }
    const shops = (await (await admin.get('/api/v1/shops')).json()) as {
      id: number;
      name: string;
    }[];
    const fake = shops.find((shop) => shop.name === 'Fake shop');
    const rows: Push[] = [];
    for (const state of ['pending', 'sent', 'failed']) {
      rows.push(
        ...((await (
          await admin.get(`/api/v1/shops/${fake?.id}/outbox?status=${state}`)
        ).json()) as Push[]),
      );
    }
    expect(
      rows.filter((r) => r.order.id === id).map((r) => r.payload.status),
      'Created, Completed and Partial queue nothing (newest first)',
    ).toEqual(['completed', 'processing']);
  });

  test('ORD-37 · a push that fails three times is failed in the outbox and the health, and Retry queues it again', async ({
    request,
    signedInAs,
  }) => {
    const admin = (await signedInAs(ADMIN)).request;
    const name = `Unreachable ${Math.floor(Math.random() * 99999)}`;
    const gone = await aConnection(admin, name, NO_SHOP, 1);
    try {
      const code = uniqueId();
      const delivered = await request.post(
        new URL(gone.webhook_url).pathname,
        signed(shopOrder(code), gone.webhook_secret),
      );
      expect(delivered.status()).toBe(200);
      const order = (
        (await (
          await admin.get(`/api/v1/orders?warehouse_id=1&filter[code]=${code}`)
        ).json()) as {items: {id: number; code: string}[]}
      ).items.find((o) => o.code === String(code));
      expect(order, "placed through the connection's webhook").toBeDefined();
      const changed = await admin.post(`/api/v1/orders/${order?.id}/status`, {
        headers: {Origin: origin},
        data: {status: 2},
      });
      expect(
        changed.status(),
        'the local change never waits for the shop',
      ).toBe(200);

      const push = async (): Promise<Push | undefined> => {
        for (const state of ['pending', 'failed', 'sent']) {
          const rows = (await (
            await admin.get(`/api/v1/shops/${gone.id}/outbox?status=${state}`)
          ).json()) as Push[];
          const found = rows.find((r) => r.order.id === order?.id);
          if (found) {
            return found;
          }
        }
        return undefined;
      };
      const attempts = async () => (await push())?.attempts ?? 0;
      await expect.poll(attempts, {timeout: 20_000}).toBeGreaterThanOrEqual(1);
      expect((await push())?.last_error).toBeTruthy();

      // The worker tries again 1 and 5 minutes later; Retry tries now.
      for (let round = 0; round < 3; round++) {
        const current = (await push()) as Push;
        if (current.status === 'failed') {
          break;
        }
        const retried = await admin.post(
          `/api/v1/shops/${gone.id}/outbox/${current.id}/retry`,
          {headers: {Origin: origin}},
        );
        expect(retried.status()).toBe(200);
        await expect
          .poll(attempts, {timeout: 20_000})
          .toBeGreaterThan(current.attempts);
      }
      const failed = (await push()) as Push;
      expect([failed.status, failed.attempts]).toEqual(['failed', 3]);
      const shop = (await (
        await admin.get(`/api/v1/shops/${gone.id}`)
      ).json()) as {
        health: {failed_pushes: number; last_failure_code: string | null};
      };
      expect(shop.health.failed_pushes).toBe(1);
      expect(shop.health.last_failure_code).toBe('push_failed');

      const retried = await admin.post(
        `/api/v1/shops/${gone.id}/outbox/${failed.id}/retry`,
        {headers: {Origin: origin}},
      );
      expect(retried.status()).toBe(200);
      expect(((await retried.json()) as Push).status).toBe('pending');
      await expect.poll(attempts, {timeout: 20_000}).toBe(4);
      expect((await push())?.status).toBe('failed');
    } finally {
      await putAway(admin, gone.id, name, NO_SHOP, 1);
    }
  });
});
