import {render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter, Route, Routes, useParams} from 'react-router-dom';
import {vi} from 'vitest';
import {SessionProvider} from '@/entities/session';
import {fakeApi} from '@/shared/test/fakeApi';
import {OrderTable} from './OrderTable';

const WAREHOUSES = [
  {id: 1, name: 'Colombia', urls: ['https://colombia.test']},
  {id: 2, name: 'Usa', urls: []},
];

const order = (
  id: number,
  code: string,
  status: number,
  extra: Record<string, unknown> = {},
) => ({
  id,
  code,
  status,
  source: 2,
  payment_method: 1,
  comment: null,
  created_at: '2026-10-05T10:15:00-05:00',
  warehouse: {id: 1, name: 'Colombia'},
  customer: {
    id: 9,
    first_name: 'Ana',
    last_name: 'Gomez',
    email: 'ana@kf.test',
    phone: '3001',
  },
  comments_count: 2,
  ...extra,
});

const CREATED = order(1, 'W00001', 1);
const PARTIAL = order(4, 'W00004', 4, {source: 1, comments_count: 0});
const USA_ORDER = order(20, 'U00020', 2, {warehouse: {id: 2, name: 'Usa'}});

/** The roles of ROLE_UPDATE_ORDERS (the Orders entry of the sidebar) and of ROLE_MANAGE_ORDERS. */
const UPDATE_ORDERS = [
  'ROLE_UPDATE_ORDERS',
  'ROLE_CAN_CREATE_ORDERS',
  'ROLE_CAN_READ_ORDERS',
  'ROLE_CAN_UPDATE_ORDERS',
  'ROLE_USER',
];
const MANAGE_ORDERS = [
  ...UPDATE_ORDERS,
  'ROLE_MANAGE_ORDERS',
  'ROLE_CAN_DELETE_ORDERS',
  'ROLE_CAN_SYNC_ORDERS',
];

function GettingReady() {
  return <p>getting ready {useParams().id}</p>;
}

function renderTable({
  roles = UPDATE_ORDERS,
  routes = {},
  orders = {1: [CREATED, PARTIAL], 2: [USA_ORDER]},
}: {
  roles?: string[];
  routes?: Parameters<typeof fakeApi>[0];
  orders?: Record<number, unknown[]>;
} = {}) {
  const api = fakeApi({
    'GET /auth/me': [
      200,
      {id: 1, username: 'ana', name: 'Ana', email: 'ana@kf.test', roles},
    ],
    'GET /warehouses': [200, WAREHOUSES],
    'GET /orders': (_body, url) => [
      200,
      orders[Number(url.searchParams.get('warehouse_id'))] ?? [],
    ],
    ...routes,
  });
  const onOpenDetail = vi.fn();
  render(
    <SessionProvider>
      <MemoryRouter initialEntries={['/admin/orders']}>
        <Routes>
          <Route
            path="/admin/orders"
            element={<OrderTable onOpenDetail={onOpenDetail} refreshKey={0} />}
          />
          <Route
            path="/admin/orders/:id/getting-ready"
            element={<GettingReady />}
          />
        </Routes>
      </MemoryRouter>
    </SessionProvider>,
  );
  return {api, onOpenDetail};
}

const rowOf = async (code: string) =>
  (await screen.findByText(code)).closest('tr')!;

const listCalls = (api: ReturnType<typeof fakeApi>) =>
  api.calls.filter((c) => c.method === 'GET' && c.path === '/orders');

describe('OrderTable', () => {
  it('lists the first warehouse’s orders with their customer, source, status, date and documents', async () => {
    const {api} = renderTable();

    const row = await rowOf('W00001');
    expect(
      within(row).getByText('Ana Gomez [ana@kf.test]'),
    ).toBeInTheDocument();
    expect(within(row).getByText('Phone')).toBeInTheDocument();
    expect(within(row).getByText('05 Oct 2026')).toBeInTheDocument();
    expect(
      within(row).getByRole('combobox', {name: 'Status of order W00001'}),
    ).toHaveValue('1');
    expect(within(await rowOf('W00004')).getByText('Web')).toBeInTheDocument();
    expect(
      within(row).getByRole('link', {name: 'Edit this order'}),
    ).toHaveAttribute('href', '/admin/orders/1/edit');
    expect(
      within(row).getByRole('link', {name: 'Getting ready this Order'}),
    ).toHaveAttribute('href', '/admin/orders/1/getting-ready');
    const pdf = within(row).getByRole('link', {name: 'View as PDF'});
    expect(pdf).toHaveAttribute('href', '/api/v1/orders/1/pdf');
    expect(pdf).toHaveAttribute('target', '_blank');
    expect(
      within(row).getByRole('link', {name: 'Download as Excel'}),
    ).toHaveAttribute('href', '/api/v1/orders/1/xls');
    expect(listCalls(api)[0]?.url.search).toBe('?warehouse_id=1');
  });

  it('loads another warehouse’s orders when it is picked', async () => {
    const {api} = renderTable();
    await rowOf('W00001');

    await userEvent.selectOptions(
      screen.getByRole('combobox', {name: 'Warehouse'}),
      'Usa',
    );

    expect(await screen.findByText('U00020')).toBeInTheDocument();
    expect(screen.queryByText('W00001')).not.toBeInTheDocument();
    expect(listCalls(api).at(-1)?.url.search).toBe('?warehouse_id=2');
  });

  it('shows only the orders of the status picked, and every order again with Show all', async () => {
    renderTable();
    await rowOf('W00001');

    const filter = screen.getByRole('combobox', {name: 'Status'});
    await userEvent.selectOptions(filter, 'Partial');
    expect(screen.queryByText('W00001')).not.toBeInTheDocument();
    expect(screen.getByText('W00004')).toBeInTheDocument();

    await userEvent.selectOptions(filter, 'Delivered');
    expect(
      screen.getByText('No order of this warehouse has that status.'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Show all'}));
    expect(screen.getByText('W00001')).toBeInTheDocument();
    expect(filter).toHaveValue('');
  });

  it('finds an order by its code or its customer', async () => {
    renderTable({
      orders: {
        1: [
          CREATED,
          order(5, 'W00005', 1, {
            customer: {
              id: 3,
              first_name: 'Ben',
              last_name: 'Ruiz',
              email: 'ben@kf.test',
            },
          }),
        ],
      },
    });
    await rowOf('W00001');

    await userEvent.type(screen.getByRole('searchbox'), 'ruiz');

    expect(screen.getByText('W00005')).toBeInTheDocument();
    expect(screen.queryByText('W00001')).not.toBeInTheDocument();
  });

  it('changes an order’s status in its row and reloads the list', async () => {
    let status = 1;
    const {api} = renderTable({
      routes: {
        'GET /orders': () => [200, [order(1, 'W00001', status)]],
        'POST /orders/1/status': (body) => {
          status = (body as {status: number}).status;
          return [200, {}];
        },
      },
    });
    const row = await rowOf('W00001');

    await userEvent.selectOptions(
      within(row).getByRole('combobox', {name: 'Status of order W00001'}),
      'Completed',
    );

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Order W00001 is now Completed.',
    );
    expect(api.calls.find((c) => c.method === 'POST')?.body).toEqual({
      status: 3,
    });
    await waitFor(() => expect(listCalls(api)).toHaveLength(2));
    expect(
      screen.getByRole('combobox', {name: 'Status of order W00001'}),
    ).toHaveValue('3');
  });

  it('opens the getting-ready screen instead of marking an order Sent', async () => {
    const {api} = renderTable();
    const row = await rowOf('W00001');

    await userEvent.selectOptions(
      within(row).getByRole('combobox', {name: 'Status of order W00001'}),
      'Sent',
    );

    expect(await screen.findByText('getting ready 1')).toBeInTheDocument();
    expect(
      api.calls.some((c) => c.method === 'POST'),
      'Sent takes the stock out: only the getting-ready screen does that',
    ).toBe(false);
  });

  it('says why a status change failed and keeps the status', async () => {
    renderTable({
      routes: {
        'POST /orders/1/status': [
          404,
          {error: 'order_not_found', message: 'Not found'},
        ],
      },
    });
    const row = await rowOf('W00001');

    await userEvent.selectOptions(
      within(row).getByRole('combobox', {name: 'Status of order W00001'}),
      'Processed',
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This order no longer exists. Reload the list.',
    );
    expect(
      screen.getByRole('combobox', {name: 'Status of order W00001'}),
    ).toHaveValue('1');
  });

  it('shows Create an Order but neither delete nor sync to whoever only updates orders', async () => {
    renderTable({roles: UPDATE_ORDERS});
    await rowOf('W00001');

    expect(screen.getByRole('link', {name: 'Create an Order'})).toHaveAttribute(
      'href',
      '/admin/orders/new',
    );
    expect(
      screen.queryByRole('button', {name: /Delete Order/}),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Sync Orders'}),
    ).not.toBeInTheDocument();
  });

  it('shows delete and sync to whoever manages orders, and nothing to create without that role', async () => {
    renderTable({
      roles: MANAGE_ORDERS.filter((r) => r !== 'ROLE_CAN_CREATE_ORDERS'),
    });
    await rowOf('W00001');

    expect(
      await screen.findByRole('button', {name: 'Delete Order W00001'}),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Sync Orders'}),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', {name: 'Create an Order'}),
    ).not.toBeInTheDocument();
  });

  it('removes a deleted order from the list and says so', async () => {
    let rows = [CREATED, PARTIAL];
    renderTable({
      roles: MANAGE_ORDERS,
      routes: {
        'GET /orders': () => [200, rows],
        'DELETE /orders/1': () => {
          rows = [PARTIAL];
          return [204];
        },
      },
    });

    await userEvent.click(
      await screen.findByRole('button', {name: 'Delete Order W00001'}),
    );
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {name: 'Delete'}),
    );

    expect(await screen.findByRole('status')).toHaveTextContent(
      'The order was deleted.',
    );
    await waitFor(() =>
      expect(screen.queryByText('W00001')).not.toBeInTheDocument(),
    );
    expect(screen.getByText('W00004')).toBeInTheDocument();
  });

  it('reloads the list after a sync and says what it imported', async () => {
    let rows: unknown[] = [CREATED];
    const {api} = renderTable({
      roles: MANAGE_ORDERS,
      routes: {
        'GET /orders': () => [200, rows],
        'POST /orders/sync': () => {
          rows = [CREATED, PARTIAL];
          return [202, {imported: 1, skipped: 4}];
        },
      },
    });
    await rowOf('W00001');

    await userEvent.click(screen.getByRole('button', {name: 'Sync Orders'}));

    expect(await screen.findByRole('status')).toHaveTextContent(
      '1 orders imported, 4 skipped.',
    );
    expect(await screen.findByText('W00004')).toBeInTheDocument();
    expect(listCalls(api)).toHaveLength(2);
  });

  it('says why a sync failed, by its code, and keeps the list', async () => {
    renderTable({
      roles: MANAGE_ORDERS,
      routes: {
        'POST /orders/sync': [
          501,
          {error: 'order_sync_unavailable', message: 'Not implemented'},
        ],
      },
    });
    await rowOf('W00001');

    await userEvent.click(screen.getByRole('button', {name: 'Sync Orders'}));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Pulling orders from the shops is not available yet.',
    );
    expect(screen.getByText('W00001')).toBeInTheDocument();
  });

  it('opens an order’s detail from its Order Detail button, and its comments from the comments count', async () => {
    const {onOpenDetail} = renderTable();
    const row = await rowOf('W00001');

    await userEvent.click(
      within(row).getByRole('button', {name: 'Order Detail of W00001'}),
    );
    expect(onOpenDetail).toHaveBeenLastCalledWith(1, 'products');

    const count = within(row).getByRole('button', {
      name: 'Comments of order W00001: 2',
    });
    expect(count).toHaveTextContent('2');
    await userEvent.click(count);
    expect(onOpenDetail).toHaveBeenLastCalledWith(1, 'comments');
  });

  it('shows an order without a customer (a webhook order may have none)', async () => {
    renderTable({orders: {1: [order(8, 'W00008', 1, {customer: null})]}});

    const row = await rowOf('W00008');
    expect(within(row).getByText('No customer')).toBeInTheDocument();
  });

  it('says what the list is for when the warehouse has no orders', async () => {
    renderTable({orders: {}});

    expect(
      await screen.findByText(
        'This warehouse has no orders yet. Create one, or sync the orders of the shops.',
      ),
    ).toBeInTheDocument();
  });

  it('says so when the person may not see the orders', async () => {
    renderTable({
      routes: {
        'GET /orders': [403, {error: 'forbidden', message: 'Forbidden'}],
      },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'You do not have permission to do this.',
    );
  });
});
