import {render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import type {ShopDelivery} from '@/entities/shop-connection';
import {fakeApi} from '@/shared/test/fakeApi';
import {fakeList} from '@/shared/test/fakeList';
import {ToastProvider} from '@/shared/ui';
import {ShopDeliveriesPage} from './ShopDeliveriesPage';

const SHOP = {
  id: 4,
  name: 'Kfvintage',
  site_url: 'https://kfvintage.example.com',
  active: true,
  warehouse: {id: 2, name: 'Usa'},
  email_printer: false,
  capabilities: {order_status: true, order_note: false},
  webhook_url: 'https://kf.test/webhooks/shops/abc',
  has_keys: true,
  health: {failed_deliveries: 2, failed_pushes: 0},
  webhook_secret: null,
};

const UNKNOWN: ShopDelivery = {
  id: 11,
  kind: 'webhook',
  remote_order_id: '7502',
  status: 'failed',
  reason_code: 'unknown_product',
  reason: 'Unknown product KF-99',
  received_at: '2026-10-06T10:00:00-05:00',
  attempts: 1,
  order: null,
  summary: {
    customer: 'Hook Buyer',
    lines: [
      {sku: 'KF-99', quantity: 2},
      {sku: 'KF-01', quantity: 1},
    ],
  },
};
const SIGNATURE: ShopDelivery = {
  id: 12,
  kind: 'webhook',
  remote_order_id: null,
  status: 'failed',
  reason_code: 'bad_signature',
  reason: 'The signature does not match',
  received_at: '2026-10-05T08:00:00-05:00',
  attempts: 1,
  order: null,
  summary: {customer: null, lines: []},
};
const PLACED: ShopDelivery = {
  ...UNKNOWN,
  id: 13,
  remote_order_id: '7400',
  status: 'placed',
  reason_code: null,
  reason: null,
  order: {id: 40, code: '7400'},
};

const inbox = (rows: () => ShopDelivery[]) => {
  const list = () =>
    fakeList(rows(), {
      fields: {
        status: (d) => d.status,
        kind: (d) => d.kind,
        reason_code: (d) => d.reason_code ?? null,
        remote_order_id: (d) => d.remote_order_id ?? null,
        customer: (d) => d.summary.customer ?? null,
      },
      search: [(d) => d.remote_order_id, (d) => d.summary.customer],
    });
  return (body: unknown, url: URL) => list()(body, url);
};

function renderPage(
  routes: Parameters<typeof fakeApi>[0],
  path = '/admin/settings/shops/4/deliveries',
) {
  const api = fakeApi({'GET /shops/4': [200, SHOP], ...routes});
  render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <Routes>
          <Route
            path="/admin/settings/shops/:id/deliveries"
            element={<ShopDeliveriesPage />}
          />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
  return api;
}

const lastList = (api: ReturnType<typeof fakeApi>) =>
  api.calls.filter((c) => c.path === '/shops/4/deliveries').at(-1)!.url;

describe('ShopDeliveriesPage', () => {
  it('lists the failed deliveries of the connection, newest first, with what each one held', async () => {
    const api = renderPage({
      'GET /shops/4/deliveries': inbox(() => [UNKNOWN, SIGNATURE, PLACED]),
    });

    expect(
      await screen.findByRole('heading', {level: 1, name: 'Failed deliveries'}),
    ).toBeInTheDocument();
    expect(await screen.findByText('Kfvintage')).toBeInTheDocument();
    const row = await screen.findByRole('row', {name: /7502/});
    expect(row).toHaveTextContent('Hook Buyer');
    expect(row).toHaveTextContent('KF-99 × 2');
    expect(row).toHaveTextContent('KF-01 × 1');
    expect(within(row).getByText('Unknown product')).toHaveClass('kf-badge');
    expect(row).toHaveTextContent('Unknown product KF-99');
    // The failed ones by default: the placed delivery is not listed.
    expect(screen.queryByRole('row', {name: /7400/})).not.toBeInTheDocument();
    const url = lastList(api);
    expect(url.searchParams.getAll('filter[status][]')).toEqual(['failed']);
    // The server's `status` default is not used: the filter is the page's, in the address.
    expect(url.searchParams.get('status') ?? '').toBe('');
    expect(screen.getByText('Status: Failed')).toBeInTheDocument();
  });

  it('shows every status once the Failed chip is removed', async () => {
    const api = renderPage({
      'GET /shops/4/deliveries': inbox(() => [UNKNOWN, PLACED]),
    });
    await screen.findByRole('row', {name: /7502/});

    await userEvent.click(
      screen.getByRole('button', {name: 'Remove the filter Status: Failed'}),
    );

    expect(await screen.findByRole('row', {name: /7400/})).toHaveTextContent(
      'Placed',
    );
    expect(lastList(api).searchParams.getAll('filter[status][]')).toEqual([]);
  });

  it('filters by reason, received date and shop order number under the headers', async () => {
    const api = renderPage({
      'GET /shops/4/deliveries': inbox(() => [UNKNOWN, SIGNATURE]),
    });
    await screen.findByRole('row', {name: /7502/});

    for (const header of ['Received', 'Shop order #', 'Customer']) {
      expect(
        screen.getByRole('columnheader', {name: new RegExp(header)}),
      ).toBeInTheDocument();
    }
    await userEvent.type(
      screen.getByLabelText('Filter by Shop order #'),
      '7502{Enter}',
    );

    await waitFor(() =>
      expect(lastList(api).searchParams.get('filter[remote_order_id]')).toBe(
        '7502',
      ),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('row', {name: /signature/i}),
      ).not.toBeInTheDocument(),
    );
  });

  it('opens a delivery’s body in a panel, and Retry places it with a toast', async () => {
    let rows = [UNKNOWN, SIGNATURE];
    const api = renderPage({
      'GET /shops/4/deliveries': inbox(() => rows),
      'GET /shops/4/deliveries/11': [
        200,
        {...UNKNOWN, payload: '{"id":7502,"line_items":[{"sku":"KF-99"}]}'},
      ],
      'POST /shops/4/deliveries/11/retry': () => {
        rows = [SIGNATURE];
        return [
          200,
          {
            ...UNKNOWN,
            status: 'placed',
            reason_code: null,
            reason: null,
            order: {id: 41, code: '7502'},
          },
        ];
      },
    });

    await userEvent.click(await screen.findByRole('row', {name: /7502/}));
    const panel = await screen.findByRole('dialog', {
      name: 'Shop order 7502',
    });
    const body = await within(panel).findByLabelText('Body');
    expect(body.textContent).toContain('"sku": "KF-99"');
    await userEvent.click(within(panel).getByRole('button', {name: 'Retry'}));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Order 7502 placed.',
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(screen.queryByRole('row', {name: /7502/})).not.toBeInTheDocument(),
    );
    expect(
      api.calls.filter((c) => c.path === '/shops/4/deliveries/11/retry'),
    ).toHaveLength(1);
  });

  it('says why a retry still fails, and keeps the row', async () => {
    renderPage({
      'GET /shops/4/deliveries': inbox(() => [UNKNOWN]),
      'POST /shops/4/deliveries/11/retry': [200, {...UNKNOWN, attempts: 2}],
    });

    await userEvent.click(
      await screen.findByRole('button', {name: 'Actions for 7502'}),
    );
    await userEvent.click(screen.getByRole('menuitem', {name: 'Retry'}));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Still not placed: Unknown product KF-99',
    );
    expect(screen.getByRole('row', {name: /7502/})).toBeInTheDocument();
  });

  it('discards a delivery from its menu', async () => {
    let rows = [UNKNOWN, SIGNATURE];
    const api = renderPage({
      'GET /shops/4/deliveries': inbox(() => rows),
      'POST /shops/4/deliveries/12/discard': () => {
        rows = [UNKNOWN];
        return [200, {...SIGNATURE, status: 'discarded'}];
      },
    });

    const row = await screen.findByRole('row', {name: /signature/i});
    await userEvent.click(
      within(row).getByRole('button', {name: /^Actions for/}),
    );
    const items = screen.getAllByRole('menuitem');
    expect(items.map((item) => item.textContent?.trim())).toEqual([
      'View body',
      'Retry',
      'Discard',
    ]);
    await userEvent.click(screen.getByRole('menuitem', {name: 'Discard'}));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Delivery discarded.',
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('row', {name: /signature/i}),
      ).not.toBeInTheDocument(),
    );
    expect(
      api.calls.some((c) => c.path === '/shops/4/deliveries/12/discard'),
    ).toBe(true);
  });

  it('says a refused signature kept no body', async () => {
    renderPage({
      'GET /shops/4/deliveries': inbox(() => [SIGNATURE]),
      'GET /shops/4/deliveries/12': [200, {...SIGNATURE, payload: null}],
    });

    await userEvent.click(await screen.findByRole('row', {name: /signature/i}));

    const panel = await screen.findByRole('dialog');
    expect(
      await within(panel).findByText(
        'A delivery with a wrong signature is kept without its body.',
      ),
    ).toBeInTheDocument();
  });

  it('says so when nothing failed', async () => {
    renderPage({'GET /shops/4/deliveries': inbox(() => [])});

    expect(
      await screen.findByText('Nothing matches these filters.'),
    ).toBeInTheDocument();
  });
});
