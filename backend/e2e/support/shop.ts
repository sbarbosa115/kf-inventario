import {createHmac} from 'node:crypto';
import {expect, type APIRequestContext} from '@playwright/test';

/** The seeded "Fake shop" connection (src/DataFixtures/ShopFixtures.php): Colombia, prints its orders. */
export const FAKE_SHOP_HOOK =
  '/webhooks/shops/fakeshop0000000000000000000000000000000000000000000000000000001';
export const FAKE_SHOP_WEBHOOK_SECRET = 'fake-shop-webhook-secret';

/** A shop order id no other case uses. */
export const uniqueShopOrder = () => 400000 + Math.floor(Math.random() * 99999);

/**
 * Posts a new order to the Fake shop's webhook, signed as WooCommerce signs it (base64 HMAC-SHA256 of the raw body):
 * it is placed in Colombia and its email queued for the printer.
 */
export async function placeFakeShopOrder(
  request: APIRequestContext,
  id: number,
): Promise<void> {
  const data = JSON.stringify({
    id,
    status: 'processing',
    billing: {
      first_name: 'Mail',
      last_name: 'Buyer',
      email: `mail.buyer.${id}@example.com`,
      phone: '555-0166',
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
    line_items: [{sku: 'KF-01', quantity: 1}],
  });
  const answer = await request.post(FAKE_SHOP_HOOK, {
    data,
    headers: {
      'Content-Type': 'application/json',
      'X-WC-Webhook-Signature': createHmac('sha256', FAKE_SHOP_WEBHOOK_SECRET)
        .update(data)
        .digest('base64'),
    },
  });
  expect(answer.status(), `shop order ${id} placed`).toBe(200);
}
