import {createHmac} from 'node:crypto';
import type {APIRequestContext, Locator, Page} from '@playwright/test';
import {ADMIN, consoleErrors, expect, test} from './support/test';

/**
 * 5 Orders, the comment timeline (docs/tests/ui-regression.md, ORD-38 – 43). W00003's fixture
 * comment has no date (src/DataFixtures/ShopFixtures.php); the shop cases post a signed order to the seeded "Fake
 * shop" connection (both capabilities on) and read or set the dev stack's fake shop through /_fake-shop/_state. Notes
 * sent to the shop leave through the `shops` queue: the stack's worker sends them within seconds.
 */
const STATE = '/_fake-shop/_state';
const FAKE_SHOP_HOOK =
  '/webhooks/shops/fakeshop0000000000000000000000000000000000000000000000000000001';
const FAKE_SHOP_WEBHOOK_SECRET = 'fake-shop-webhook-secret';
const SYNC = '/api/v1/orders/sync';

interface Write {
  call: string;
  order: string;
  value: string;
}

/** A unique WooCommerce order id for this run. */
const uniqueId = () => 700000 + Math.floor(Math.random() * 99999);

/** Waits until the clock has passed the second of `at` (a Date.now()): what is written next is dated later. */
async function pastTheSecondOf(at: number): Promise<void> {
  const second = Math.floor(at / 1000);
  await expect
    .poll(() => Math.floor(Date.now() / 1000), {intervals: [100]})
    .toBeGreaterThan(second);
}

/** `YYYY-MM-DDTHH:MM:SS` in UTC, as WooCommerce writes its dates. */
const gmtNow = () => new Date().toISOString().slice(0, 19);

/** A WooCommerce order as its REST API (and its webhook) sends it. */
function shopOrder(id: number, modifiedGmt?: string): Record<string, unknown> {
  return {
    id,
    status: 'processing',
    ...(modifiedGmt === undefined ? {} : {date_modified_gmt: modifiedGmt}),
    customer_note: 'Please call before delivering.',
    billing: {
      first_name: 'Note',
      last_name: 'Buyer',
      email: `note.buyer.${id}@example.com`,
      phone: '555-0188',
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
  };
}

/** Posts a shop order to the Fake shop's webhook, signed as WooCommerce signs it: it lands in Colombia, linked. */
async function placeShopOrder(request: APIRequestContext, id: number) {
  const data = JSON.stringify(shopOrder(id));
  const answer = await request.post(FAKE_SHOP_HOOK, {
    data,
    headers: {
      'Content-Type': 'application/json',
      'X-WC-Webhook-Signature': createHmac('sha256', FAKE_SHOP_WEBHOOK_SECRET)
        .update(data)
        .digest('base64'),
    },
  });
  expect(answer.status(), 'the shop order is placed').toBe(200);
}

/** The list narrowed to one order by its number (the search box of the toolbar). */
async function findOrder(page: Page, code: string): Promise<Locator> {
  await page
    .getByRole('searchbox', {name: 'Order number or customer'})
    .fill(code);
  const row = page.getByRole('row', {name: new RegExp(code)});
  await expect(row).toBeVisible();
  return row;
}

/** Opens an order's detail from its Notes cell (the count, or the pinned line). */
async function openNotes(page: Page, code: string): Promise<Locator> {
  const row = await findOrder(page, code);
  await row
    .getByRole('button', {name: /^(Comments of order|Pinned note of order)/})
    .click();
  const detail = page.getByRole('dialog', {name: `Order ${code}`});
  await expect(detail).toBeVisible();
  return detail;
}

const timeline = (detail: Locator, code: string) =>
  detail.getByRole('list', {name: `Comments of order ${code}`});

const entry = (detail: Locator, code: string, text: string | RegExp) =>
  timeline(detail, code).getByRole('listitem').filter({hasText: text});

const box = (detail: Locator) =>
  detail.getByRole('textbox', {name: 'Write a note…'});

test.describe('5 Orders: comment timeline', () => {
  let origin = '';
  test.beforeEach(({baseURL}) => {
    origin = new URL(baseURL as string).origin;
  });

  test("ORD-38 · The timeline shows who wrote each comment and when; a dateless one shows the order's date, marked approximate", async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    const errors = consoleErrors(page);
    await page.goto('/admin/orders');

    const detail = await openNotes(page, 'W00003');
    const legacy = entry(detail, 'W00003', 'Comment for W00003');
    await expect(legacy).toBeVisible();
    await expect(legacy.getByText('Sergio Barbosa')).toBeVisible();
    const when = legacy.locator('time');
    await expect(when).toHaveAttribute(
      'title',
      "Approximate date (the order's): written before comments had dates",
    );
    await expect(when).toHaveText(/^≈ /);
    const created = (
      await detail
        .locator('.kf-order-detail__fact', {hasText: 'Created'})
        .locator('dd')
        .textContent()
    )?.trim();
    await expect(when, 'the order’s own date').toHaveText(`≈ ${created}`);
    expect(errors).toEqual([]);
  });

  test('ORD-39 · Enter sends, Shift+Enter starts a line, and the box keeps the focus', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/orders');
    // W00009: the orders lane deletes W00005 and changes other orders' statuses; nothing else writes to W00009.
    const detail = await openNotes(page, 'W00009');
    const text = `Smoke note ${Date.now()}`;

    const send = detail.getByRole('button', {name: 'Send', exact: true});
    await expect(send, 'nothing to send yet').toBeDisabled();
    await box(detail).fill('   ');
    await expect(send, 'blank is nothing').toBeDisabled();
    await box(detail).fill('');
    await box(detail).click();
    await page.keyboard.type(`${text} first line`);
    await expect(send).toBeEnabled();
    await page.keyboard.press('Shift+Enter');
    await page.keyboard.type('second line');
    await expect(box(detail)).toHaveValue(`${text} first line\nsecond line`);
    await page.keyboard.press('Enter');

    const added = entry(detail, 'W00009', text);
    await expect(added).toBeVisible();
    await expect(added.getByText('Sergio Barbosa')).toBeVisible();
    await expect(added.locator('time')).not.toHaveText(/≈/);
    await expect(box(detail)).toHaveValue('');
    await expect(box(detail), 'ready for the next note').toBeFocused();
    await expect(
      page.getByRole('row', {name: /W00009/}).getByRole('button', {
        name: 'Comments of order W00009: 2',
      }),
      'the list counts it at once',
    ).toBeAttached();
  });

  test('ORD-40 · A pinned comment is shown on top of the order and on its row; pinning another unpins it', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/orders');
    const detail = await openNotes(page, 'W00006');
    const first = `Pin me ${Date.now()}`;
    const second = `Pin me instead ${Date.now()}`;
    for (const text of [first, second]) {
      await box(detail).fill(text);
      await box(detail).press('Enter');
      await expect(entry(detail, 'W00006', text)).toBeVisible();
    }

    const pin = async (text: string) => {
      await entry(detail, 'W00006', text)
        .getByRole('button', {name: /^Actions for comment/})
        .click();
      await page.getByRole('menuitem', {name: 'Pin'}).click();
    };
    await pin(first);
    const card = detail.getByRole('region', {name: 'Pinned'});
    await expect(card).toContainText(first);
    const row = page.getByRole('row', {name: /W00006/});
    await expect(
      row.getByRole('button', {name: `Pinned note of order W00006: ${first}`}),
      'the Notes column shows the pinned line',
    ).toBeVisible();

    await pin(second);
    await expect(card).toContainText(second);
    await expect(card, 'one pinned comment per order').not.toContainText(first);
    await expect(
      row.getByRole('button', {name: `Pinned note of order W00006: ${second}`}),
    ).toBeVisible();

    await card.getByRole('button', {name: 'Unpin'}).click();
    await expect(card).toBeHidden();
    await expect(
      row.getByRole('button', {name: /^Comments of order W00006/}),
    ).toBeVisible();
  });

  test('ORD-41 · A quick phrase adds a dated comment in one tap', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    // Not "Smoke …": the Settings cases remove those phrases when they end.
    const phrase = `Phrase ${Date.now()}`;
    const created = await page.request.post('/api/v1/settings/quick-phrases', {
      headers: {Origin: origin},
      data: {text: phrase, active: true},
    });
    expect(created.status()).toBe(201);
    const {id} = (await created.json()) as {id: number};
    try {
      await page.goto('/admin/orders');
      const detail = await openNotes(page, 'W00007');

      await detail
        .getByRole('group', {name: 'Quick phrases'})
        .getByRole('button', {name: `Add “${phrase}” as a comment`})
        .click();

      const added = entry(detail, 'W00007', phrase);
      await expect(added).toBeVisible();
      await expect(added.getByText('Quick phrase')).toBeVisible();
      await expect(added.locator('time')).toHaveText(/\d{4}/);
      await expect(box(detail), 'the box was not needed').toHaveValue('');
    } finally {
      await page.request.delete(`/api/v1/settings/quick-phrases/${id}`, {
        headers: {Origin: origin},
      });
    }
  });

  test('ORD-42 · On a shop\'s order, "Also send to the shop" sends the note to the shop', async ({
    request,
    signedInAs,
  }) => {
    const shopId = uniqueId();
    await placeShopOrder(request, shopId);
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/orders');
    const code = String(shopId);
    const detail = await openNotes(page, code);
    const text = `To the shop ${Date.now()}`;

    await detail
      .getByRole('checkbox', {name: 'Also send to Fake shop as an order note'})
      .check();
    await box(detail).fill(text);
    await box(detail).press('Enter');

    const added = entry(detail, code, text);
    await expect(added.getByText('Sent to the shop')).toBeVisible();
    await expect
      .poll(
        async () =>
          (
            (await (await request.get(STATE)).json()) as {writes: Write[]}
          ).writes.some(
            (w) => w.call === 'note' && w.order === code && w.value === text,
          ),
        {message: 'the fake shop received the note', timeout: 20_000},
      )
      .toBe(true);
  });

  test("ORD-43 · The shop's notes come in with Check now, marked with the shop, among the others, once", async ({
    request,
    signedInAs,
  }) => {
    const shopId = uniqueId();
    const code = String(shopId);
    await placeShopOrder(request, shopId);
    const page = await signedInAs(ADMIN);
    const orderId = (
      (await (
        await page.request.get(
          `/api/v1/orders?warehouse_id=1&filter[code]=${code}`,
        )
      ).json()) as {items: {id: number}[]}
    ).items[0]!.id;
    const before = `Office before ${Date.now()}`;
    await page.request.post(`/api/v1/orders/${orderId}/comments`, {
      headers: {Origin: origin},
      data: {content: before},
    });
    const beforeAt = Date.now();
    // Dates are to the second: the shop's note is dated in a later second than the office's comment.
    await pastTheSecondOf(beforeAt);
    const note = `From the shop ${Date.now()}`;
    const noteAt = Date.now();
    try {
      await request.put(STATE, {
        data: {
          orders: [shopOrder(shopId, gmtNow())],
          notes: {
            [code]: [
              {
                id: shopId,
                note,
                customer_note: true,
                date_created_gmt: gmtNow(),
              },
            ],
          },
        },
      });
      // And the comment written after it, in a later second still.
      await pastTheSecondOf(noteAt);
      for (let i = 0; i < 2; i++) {
        const sync = await page.request.post(SYNC, {
          headers: {Origin: origin},
        });
        expect(sync.status()).toBe(202);
      }

      await page.goto('/admin/orders');
      const detail = await openNotes(page, code);
      const after = `Office after ${Date.now()}`;
      await box(detail).fill(after);
      await box(detail).press('Enter');
      await expect(entry(detail, code, after)).toBeVisible();

      const pulled = entry(detail, code, note);
      await expect(pulled, 'once, though the shop was read twice').toHaveCount(
        1,
      );
      await expect(pulled.getByText('Shop · Fake shop')).toBeVisible();
      const texts = await timeline(detail, code)
        .getByRole('listitem')
        .allTextContents();
      const at = (text: string) => texts.findIndex((t) => t.includes(text));
      expect(at(before), 'by date: the office’s note first').toBeLessThan(
        at(note),
      );
      expect(at(note), 'then the shop’s').toBeLessThan(at(after));
    } finally {
      await request.put(STATE, {data: {orders: [], notes: {}}});
    }
  });
});
