import type {Page} from '@playwright/test';
import {checkScreens, h1Shown, settled, type Screen} from './support/look';
import {ADMIN, SALES, expect, test} from './support/test';

/**
 * 14 Every screen (docs/tests/ui-regression.md, UI-01 – 11): each screen opened at 1440 px and at 390 px (touch), in
 * light and dark, in English and Spanish, and checked the same way (support/look.ts). The screens only read: they
 * open records no other spec removes (W00001, INV-0001, Jose Perez, the admin, the Fake shop connection).
 */

/** The id of a fixture order, for the addresses that name it. */
async function orderId(page: Page, code: string): Promise<number> {
  const answer = await page.request.get(
    `/api/v1/orders?warehouse_id=1&filter[code]=${code}`,
  );
  const found = (
    (await answer.json()) as {items: {id: number; code: string}[]}
  ).items.find((order) => order.code === code);
  expect(found, `fixture order ${code}`).toBeDefined();
  return found!.id;
}

async function fakeShopId(page: Page): Promise<number> {
  const shops = (await (await page.request.get('/api/v1/shops')).json()) as {
    id: number;
    name: string;
  }[];
  const found = shops.find((shop) => shop.name === 'Fake shop');
  expect(found, 'the seeded Fake shop connection').toBeDefined();
  return found!.id;
}

/** Opens a slide-over from the list and waits for it. */
function opens(click: (page: Page) => Promise<void>) {
  return async (page: Page) => {
    await h1Shown(page);
    await settled(page);
    await click(page);
    await expect(page.getByRole('dialog')).toBeVisible();
  };
}

const cases: {
  id: string;
  title: string;
  user: string | null;
  screens: Screen[];
}[] = [
  {
    id: 'UI-01',
    title: 'The sign-in page looks right',
    user: null,
    screens: [{name: 'sign in', path: '/admin/login'}],
  },
  {
    id: 'UI-02',
    title: 'The page not found looks right',
    user: ADMIN,
    screens: [{name: 'not found', path: '/admin/nothing-here'}],
  },
  {
    id: 'UI-03',
    title: 'The product list and the product form look right',
    user: ADMIN,
    screens: [
      {name: 'products', path: '/admin/products?warehouse=1'},
      {name: 'product form', path: '/admin/products/new'},
    ],
  },
  {
    id: 'UI-04',
    title: 'Upload, scan, incoming and the warehouses look right',
    user: ADMIN,
    screens: [
      {name: 'upload', path: '/admin/products/upload'},
      {name: 'scan', path: '/admin/products/barcode'},
      {name: 'incoming', path: '/admin/products/incoming'},
      {name: 'warehouses', path: '/admin/warehouses'},
    ],
  },
  {
    id: 'UI-05',
    title: 'The orders and an order’s detail look right',
    user: ADMIN,
    screens: [
      {name: 'orders', path: '/admin/orders'},
      {
        name: 'order detail',
        path: '/admin/orders?filter[code]=W00001',
        // The order's number (a card's title on a phone) opens it.
        ready: opens((page) =>
          page
            .getByRole('row', {name: /W00001/})
            .getByText('W00001')
            .filter({visible: true})
            .first()
            .click(),
        ),
      },
    ],
  },
  {
    id: 'UI-06',
    title: 'The order form and getting ready look right',
    user: ADMIN,
    screens: [
      {name: 'order form', path: '/admin/orders/new'},
      {
        name: 'getting ready',
        path: async (page) =>
          `/admin/orders/${await orderId(page, 'W00001')}/getting-ready`,
      },
    ],
  },
  {
    id: 'UI-07',
    title: 'The customers and the customer form look right',
    user: ADMIN,
    screens: [
      {name: 'customers', path: '/admin/customers'},
      {name: 'customer form', path: '/admin/customers/new'},
    ],
  },
  {
    id: 'UI-08',
    title: 'The invoices, an invoice’s detail and the invoice form look right',
    user: SALES,
    screens: [
      {name: 'invoices', path: '/admin/invoices'},
      {
        name: 'invoice detail',
        path: '/admin/invoices',
        ready: opens((page) =>
          page
            .getByRole('row', {name: /INV-0001/})
            .getByText('INV-0001', {exact: true})
            .filter({visible: true})
            .click(),
        ),
      },
      {name: 'invoice form', path: '/admin/invoices/new'},
    ],
  },
  {
    id: 'UI-09',
    title: 'The users and the user form look right',
    user: ADMIN,
    screens: [
      {name: 'users', path: '/admin/users'},
      {name: 'user form', path: '/admin/users/new'},
    ],
  },
  {
    id: 'UI-10',
    title: 'Every tab of Settings looks right',
    user: ADMIN,
    screens: [
      {name: 'settings › general', path: '/admin/settings'},
      {name: 'settings › email', path: '/admin/settings/email'},
      {name: 'settings › analytics', path: '/admin/settings/analytics'},
      {name: 'settings › shop connections', path: '/admin/settings/shops'},
      {name: 'settings › quick phrases', path: '/admin/settings/phrases'},
    ],
  },
  {
    id: 'UI-11',
    title: 'A shop connection’s form and its failed deliveries look right',
    user: ADMIN,
    screens: [
      {
        name: 'shop connection form',
        path: async (page) => `/admin/settings/shops/${await fakeShopId(page)}`,
      },
      {
        name: 'failed deliveries',
        path: async (page) =>
          `/admin/settings/shops/${await fakeShopId(page)}/deliveries`,
      },
    ],
  },
];

test.describe('14 Every screen', () => {
  for (const {id, title, user, screens} of cases) {
    test(`${id} · ${title}`, async ({browser, baseURL}) => {
      test.setTimeout(30_000 + screens.length * 40_000);
      await checkScreens(browser, baseURL as string, user, screens);
    });
  }
});
