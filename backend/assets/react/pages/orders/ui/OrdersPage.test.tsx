import {render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import {SessionProvider} from '@/entities/session';
import {fakeApi} from '@/shared/test/fakeApi';
import {pageOf} from '@/shared/test/fakeList';
import {ToastProvider} from '@/shared/ui';
import {OrdersPage} from './OrdersPage';

const ORDER = {
  id: 1,
  code: 'W00001',
  status: 1,
  source: 2,
  created_at: '2026-10-05T10:15:00-05:00',
  warehouse: {id: 1, name: 'Colombia'},
  customer: null,
  comments_count: 0,
};

function renderPage(roles: string[], routes: Parameters<typeof fakeApi>[0]) {
  const api = fakeApi({
    'GET /auth/me': [
      200,
      {id: 1, username: 'a', name: 'A', email: 'a@kf.test', roles},
    ],
    'GET /warehouses': [200, [{id: 1, name: 'Colombia', urls: []}]],
    ...routes,
  });
  render(
    <SessionProvider>
      <ToastProvider>
        <MemoryRouter>
          <OrdersPage />
        </MemoryRouter>
      </ToastProvider>
    </SessionProvider>,
  );
  return api;
}

/** A connection as GET /shops answers it, with its failed deliveries. */
const shop = (id: number, name: string, failedDeliveries: number) => ({
  id,
  name,
  site_url: `https://${name.toLowerCase()}.example.com`,
  active: true,
  warehouse: {id: 1, name: 'Colombia'},
  email_printer: false,
  capabilities: {order_status: false, order_note: false},
  webhook_url: `https://kf.test/webhooks/shops/t${id}`,
  has_keys: true,
  health: {
    last_webhook_at: null,
    last_import_at: null,
    last_pull_at: null,
    last_pull_ok_at: null,
    last_failure_at: null,
    last_failure_code: null,
    last_failure: null,
    failed_deliveries: failedDeliveries,
    failed_pushes: 0,
  },
  webhook_secret: null,
});

const listCalls = (api: ReturnType<typeof fakeApi>) =>
  api.calls.filter((c) => c.path === '/orders');

describe('OrdersPage', () => {
  it('is titled Orders, with Create order as its one primary action and Check now beside it', async () => {
    renderPage(
      ['ROLE_USER', 'ROLE_CAN_CREATE_ORDERS', 'ROLE_CAN_SYNC_ORDERS'],
      {'GET /orders': [200, pageOf([ORDER])]},
    );

    expect(
      await screen.findByRole('heading', {level: 1, name: 'Orders'}),
    ).toBeInTheDocument();
    const create = await screen.findByRole('link', {name: 'Create order'});
    expect(create).toHaveAttribute('href', '/admin/orders/new');
    expect(create).toHaveClass('kf-btn--primary');
    expect(screen.getByRole('button', {name: 'Check now'})).toHaveClass(
      'kf-btn--secondary',
    );
  });

  it('shows neither create nor Check now without their roles, and reads no shop connection', async () => {
    const api = renderPage(['ROLE_USER', 'ROLE_CAN_READ_ORDERS'], {
      'GET /orders': [200, pageOf([ORDER])],
    });

    await screen.findByRole('row', {name: /W00001/}, {timeout: 3000});
    expect(
      screen.queryByRole('link', {name: 'Create order'}),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Check now'}),
    ).not.toBeInTheDocument();
    expect(api.calls.some((c) => c.path === '/shops')).toBe(false);
  });

  it('reloads the list after Check now', async () => {
    let rows = [ORDER];
    const api = renderPage(['ROLE_USER', 'ROLE_CAN_SYNC_ORDERS'], {
      'GET /orders': () => [200, pageOf(rows)],
      'POST /orders/sync': () => {
        rows = [ORDER, {...ORDER, id: 2, code: 'W00002'}];
        return [
          202,
          {
            imported: 1,
            skipped: 0,
            failed: 0,
            connections: [
              {id: 1, name: 'Fake shop', imported: 1, skipped: 0, error: null},
            ],
          },
        ];
      },
    });
    await screen.findByRole('row', {name: /W00001/}, {timeout: 3000});

    await userEvent.click(screen.getByRole('button', {name: 'Check now'}));

    expect(
      await screen.findByRole('row', {name: /W00002/}),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      '1 order imported from 1 shop, 0 skipped.',
    );
    expect(listCalls(api)).toHaveLength(2);
  });

  it('opens an order’s detail beside the list with its comment timeline, and the list counts a comment added there', async () => {
    let comments: unknown[] = [];
    const api = renderPage(['ROLE_USER'], {
      'GET /orders': () => [
        200,
        pageOf([{...ORDER, comments_count: comments.length}]),
      ],
      'GET /orders/1': () => [200, {...ORDER, comments, products: []}],
      'GET /settings/quick-phrases': [200, []],
      'POST /orders/1/comments': (body) => {
        const added = {
          id: 5,
          content: (body as {content: string}).content,
          created_at: '2026-10-06T09:00:00-05:00',
          approximate: false,
          author: {id: 1, name: 'Ana'},
          origin: 'app',
          shop: null,
          pinned: false,
          pinned_at: null,
          pinned_by: null,
          sent_to_shop: false,
        };
        comments = [added];
        return [201, added];
      },
    });

    await userEvent.click(
      await screen.findByRole(
        'button',
        {name: 'Comments of order W00001: 0'},
        {timeout: 3000},
      ),
    );
    const detail = await screen.findByRole('dialog', {name: 'Order W00001'});
    await userEvent.type(
      await within(detail).findByRole('textbox', {name: 'Write a note…'}),
      'Ring twice{Enter}',
    );

    expect(
      await within(detail).findByText('Ring twice'),
      'the timeline shows it',
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('button', {name: 'Comments of order W00001: 1'}),
    ).toBeInTheDocument();
    await userEvent.click(within(detail).getByRole('button', {name: 'Close'}));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(listCalls(api)).toHaveLength(2));
  });

  it('shows admins the shops’ warning line above the list, and reads it again after Check now', async () => {
    let failed = 2;
    const api = renderPage(
      ['ROLE_USER', 'ROLE_ADMIN', 'ROLE_CAN_SYNC_ORDERS'],
      {
        'GET /orders': [200, pageOf([ORDER])],
        'GET /shops': () => [200, [shop(4, 'Kfvintage', failed)]],
        'GET /settings/webhooks': [
          200,
          {
            legacy_enabled: true,
            legacy_hits_since: 0,
            legacy_last_hit_at: null,
          },
        ],
        'POST /orders/sync': () => {
          failed = 0;
          return [202, {imported: 0, skipped: 0, failed: 0, connections: []}];
        },
      },
    );

    const warning = await screen.findByRole('region', {
      name: 'Shop connections',
    });
    expect(warning).toHaveTextContent(
      'Kfvintage: 2 orders could not be placed',
    );
    expect(
      within(warning).getByRole('link', {name: 'Fix in Settings'}),
    ).toHaveAttribute('href', '/admin/settings/shops/4/deliveries');

    await userEvent.click(screen.getByRole('button', {name: 'Check now'}));

    await waitFor(() =>
      expect(
        screen.queryByRole('region', {name: 'Shop connections'}),
      ).not.toBeInTheDocument(),
    );
    expect(api.calls.filter((c) => c.path === '/shops').length).toBeGreaterThan(
      1,
    );
  });

  it('names the shop in the Source column and lists every shop in the Source filter', async () => {
    const api = renderPage(['ROLE_USER', 'ROLE_ADMIN'], {
      'GET /orders': [
        200,
        {
          ...pageOf([
            {...ORDER, source: 1, shop: {id: 4, name: 'Kfvintage'}},
            {...ORDER, id: 2, code: 'W00002', source: 1, shop: null},
          ]),
          facets: {
            source: [
              {value: 'shop:4', count: 1},
              {value: 'web', count: 1},
            ],
          },
        },
      ],
      'GET /shops': [200, [shop(4, 'Kfvintage', 0), shop(7, 'Klassicfab', 0)]],
      'GET /settings/webhooks': [
        200,
        {legacy_enabled: true, legacy_hits_since: 0, legacy_last_hit_at: null},
      ],
    });

    const linked = await screen.findByRole(
      'row',
      {name: /W00001/},
      {timeout: 3000},
    );
    expect(linked).toHaveTextContent('Kfvintage');
    expect(screen.getByRole('row', {name: /W00002/})).toHaveTextContent('Web');

    const filterRow = within(screen.getAllByRole('rowgroup')[0]!).getAllByRole(
      'row',
    )[1]!;
    await userEvent.click(
      within(filterRow).getByRole('button', {name: 'Source'}),
    );
    expect(
      screen
        .getAllByRole('checkbox')
        .map((box) => box.closest('label')?.textContent?.replace(/\d+$/, '')),
    ).toEqual(['Phone', 'Web', 'Kfvintage', 'Klassicfab']);
    await userEvent.click(screen.getByRole('checkbox', {name: /Klassicfab/}));

    await waitFor(() =>
      expect(
        listCalls(api).at(-1)?.url.searchParams.getAll('filter[source][]'),
      ).toEqual(['shop:7']),
    );
  });
});
