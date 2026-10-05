import {ADMIN, INVENTORY, expect, test} from './support/test';

/**
 * 5 Orders, the WooCommerce pull (docs/tests/ui-regression.md, ORD-19): POST /api/v1/orders/sync on a stack without
 * shop keys (WOO_COMMERCE_* empty in backend/.env) answers that nothing was pulled, and needs the sync role. Pulling a
 * real shop is ORD-20, by hand.
 */
const SYNC = '/api/v1/orders/sync';

test.describe('5 Orders: WooCommerce sync', () => {
  test('ORD-19 · without shop keys the sync places nothing, and it needs the sync role', async ({
    baseURL,
    signedInAs,
  }) => {
    const origin = new URL(baseURL as string).origin;
    const admin = await signedInAs(ADMIN);
    const ordersBefore = (await (
      await admin.request.get('/api/v1/orders?warehouse_id=1')
    ).json()) as unknown[];

    const answer = await admin.request.post(SYNC, {headers: {Origin: origin}});

    expect(answer.status()).toBe(202);
    expect(await answer.json()).toEqual({imported: 0, skipped: 0});
    const ordersAfter = (await (
      await admin.request.get('/api/v1/orders?warehouse_id=1')
    ).json()) as unknown[];
    expect(ordersAfter).toHaveLength(ordersBefore.length);

    const clerk = await signedInAs(INVENTORY);
    const refused = await clerk.request.post(SYNC, {headers: {Origin: origin}});
    expect(refused.status()).toBe(403);
  });
});
