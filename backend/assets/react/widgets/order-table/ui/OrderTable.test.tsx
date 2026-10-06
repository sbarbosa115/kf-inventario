import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {vi} from 'vitest';
import {SessionProvider} from '@/entities/session';
import {fakeApi} from '@/shared/test/fakeApi';
import {fakeList, pageOf} from '@/shared/test/fakeList';
import {ToastProvider} from '@/shared/ui';
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
const PARTIAL = order(4, 'W00004', 4, {
  source: 1,
  comments_count: 0,
  created_at: '2026-10-01T09:00:00-05:00',
});
const DELIVERED = order(6, 'W00006', 6, {
  customer: {id: 3, first_name: 'Ben', last_name: 'Ruiz', email: 'ben@kf.test'},
  created_at: '2026-09-20T09:00:00-05:00',
});
const USA_ORDER = order(20, 'U00020', 2, {warehouse: {id: 2, name: 'Usa'}});

type Row = ReturnType<typeof order>;

/** The orders list's contract, in memory: q over code and customer, status, created_at, the status facet. */
const ORDER_LIST = {
  fields: {
    code: (o: Row) => o.code,
    status: (o: Row) => String(o.status),
    created_at: (o: Row) => o.created_at,
    customer: (o: Row) => `${o.customer.first_name} ${o.customer.last_name}`,
  },
  search: [
    (o: Row) => o.code,
    (o: Row) => `${o.customer.first_name} ${o.customer.last_name}`,
    (o: Row) => o.customer.email,
  ],
};

const READ_ORDERS = ['ROLE_USER', 'ROLE_CAN_READ_ORDERS'];
/** ROLE_UPDATE_ORDERS and what it reaches (the Orders entry of the sidebar). */
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

function renderTable({
  roles = UPDATE_ORDERS,
  routes = {},
  orders = {1: [CREATED, PARTIAL, DELIVERED], 2: [USA_ORDER]},
}: {
  roles?: string[];
  routes?: Parameters<typeof fakeApi>[0];
  orders?: Record<number, Row[]>;
} = {}) {
  localStorage.clear();
  const api = fakeApi({
    'GET /auth/me': [
      200,
      {id: 1, username: 'ana', name: 'Ana', email: 'ana@kf.test', roles},
    ],
    'GET /warehouses': [200, WAREHOUSES],
    'GET /orders': (body, url) =>
      fakeList(
        orders[Number(url.searchParams.get('warehouse_id'))] ?? [],
        ORDER_LIST,
      )(body, url),
    ...routes,
  });
  const onOpenDetail = vi.fn();
  render(
    <SessionProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={['/admin/orders']}>
          <Routes>
            <Route
              path="/admin/orders"
              element={
                <OrderTable onOpenDetail={onOpenDetail} refreshKey={0} />
              }
            />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </SessionProvider>,
  );
  return {api, onOpenDetail};
}

// The first render of a file also compiles the kit: give the first answer more than the default second.
const rowOf = async (code: string) =>
  screen.findByRole('row', {name: new RegExp(code)}, {timeout: 3000});
const codes = () =>
  screen
    .queryAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[1]?.textContent);
const chip = (name: RegExp) =>
  within(screen.getByRole('group', {name: 'Status'})).getByRole('button', {
    name,
  });
const listCalls = (api: ReturnType<typeof fakeApi>) =>
  api.calls.filter((c) => c.method === 'GET' && c.path === '/orders');
const openRowMenu = async (code: string) =>
  userEvent.click(
    within(await rowOf(code)).getByRole('button', {
      name: `Actions for ${code}`,
    }),
  );

describe('OrderTable', () => {
  it('lists the first warehouse’s orders, the order number first, then customer, source, status, date and comments', async () => {
    const {api} = renderTable();

    const row = await rowOf('W00001');
    expect(
      screen.getAllByRole('columnheader').map((h) => h.textContent),
    ).toEqual([
      '',
      'Order',
      'Customer',
      'Source',
      'Status',
      'Created',
      'Comments',
      'Actions',
    ]);
    expect(within(row).getByRole('button', {name: 'W00001'})).toHaveClass(
      'kf-mono',
    );
    expect(within(row).getByText('Ana Gomez')).toBeInTheDocument();
    expect(within(row).getByText('ana@kf.test')).toBeInTheDocument();
    expect(within(row).getByText('Phone')).toBeInTheDocument();
    expect(within(row).getByText('Oct 5, 2026, 10:15 AM')).toBeInTheDocument();
    expect(
      within(row).getByRole('button', {name: 'Status of order W00001'}),
    ).toHaveTextContent('Created');
    expect(within(await rowOf('W00004')).getByText('Web')).toBeInTheDocument();
    expect(listCalls(api)[0]?.url.searchParams.get('warehouse_id')).toBe('1');
  });

  it('loads another warehouse’s orders when it is picked, and remembers it', async () => {
    const {api} = renderTable();
    await rowOf('W00001');

    await userEvent.click(screen.getByRole('radio', {name: 'Usa'}));

    expect(await rowOf('U00020')).toBeInTheDocument();
    expect(screen.queryByRole('row', {name: /W00001/})).not.toBeInTheDocument();
    expect(listCalls(api).at(-1)?.url.searchParams.get('warehouse_id')).toBe(
      '2',
    );
    expect(localStorage.getItem('kf.warehouse')).toBe('2');
  });

  it('counts the orders of each status on its chip, and a chip keeps only that status', async () => {
    renderTable();
    await rowOf('W00001');

    expect(
      within(screen.getByRole('group', {name: 'Status'}))
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual([
      'All 3',
      'Created 1',
      'Processed 0',
      'Completed 0',
      'Partial 1',
      'Sent 0',
      'Delivered 1',
    ]);

    await userEvent.click(chip(/^Partial/));

    expect(chip(/^Partial/)).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(codes()).toEqual(['W00004']));
    await userEvent.click(chip(/^All/));
    await waitFor(() =>
      expect(codes()).toEqual(['W00001', 'W00004', 'W00006']),
    );
  });

  it('finds an order by its number or its customer, and the counts follow the search', async () => {
    renderTable();
    await rowOf('W00001');

    await userEvent.type(
      screen.getByRole('searchbox', {name: 'Order number or customer'}),
      'ruiz',
    );

    await waitFor(() => expect(codes()).toEqual(['W00006']));
    expect(chip(/^All/)).toHaveTextContent('All 1');
    expect(chip(/^Delivered/)).toHaveTextContent('Delivered 1');
    expect(chip(/^Created/)).toHaveTextContent('Created 0');
  });

  it('keeps the orders created within a date range, both days included', async () => {
    renderTable();
    await rowOf('W00001');

    fireEvent.change(screen.getByLabelText('Created from'), {
      target: {value: '2026-10-01'},
    });
    await waitFor(() => expect(codes()).toEqual(['W00001', 'W00004']));
    fireEvent.change(screen.getByLabelText('Created to'), {
      target: {value: '2026-10-01'},
    });
    await waitFor(() => expect(codes()).toEqual(['W00004']));
  });

  it('says when the filters leave nothing, and Show all clears every filter', async () => {
    renderTable();
    await rowOf('W00001');
    await userEvent.type(screen.getByRole('searchbox'), 'ruiz');
    await waitFor(() => expect(codes()).toEqual(['W00006']));
    await userEvent.click(chip(/^Partial/));
    fireEvent.change(screen.getByLabelText('Created from'), {
      target: {value: '2026-10-02'},
    });

    expect(
      await screen.findByText('Nothing matches these filters.'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Show all'}));

    await waitFor(() =>
      expect(codes()).toEqual(['W00001', 'W00004', 'W00006']),
    );
    expect(screen.getByRole('searchbox')).toHaveValue('');
    expect(screen.getByLabelText('Created from')).toHaveValue('');
    expect(chip(/^All/)).toHaveAttribute('aria-pressed', 'true');
  });

  it('puts the row’s other actions in its ⋯ menu: edit, getting ready and the documents, without delete for whoever only updates orders', async () => {
    renderTable({roles: UPDATE_ORDERS});
    await openRowMenu('W00001');

    const menu = screen.getByRole('menu');
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual([
      'Edit',
      'Getting ready',
      'Order PDF',
      'Remaining products PDF',
      'Excel sheet',
    ]);
    expect(within(menu).getByRole('menuitem', {name: 'Edit'})).toHaveAttribute(
      'href',
      '/admin/orders/1/edit',
    );
    expect(
      within(menu).getByRole('menuitem', {name: 'Getting ready'}),
    ).toHaveAttribute('href', '/admin/orders/1/getting-ready');
    const pdf = within(menu).getByRole('menuitem', {name: 'Order PDF'});
    expect(pdf).toHaveAttribute('href', '/api/v1/orders/1/pdf');
    expect(pdf).toHaveAttribute('target', '_blank');
    expect(
      within(menu).getByRole('menuitem', {name: 'Excel sheet'}),
    ).toHaveAttribute('href', '/api/v1/orders/1/xls');
  });

  it('adds Delete, in danger, for whoever may delete orders, and no Edit for whoever only reads them', async () => {
    renderTable({roles: MANAGE_ORDERS});
    await openRowMenu('W00001');
    expect(screen.getByRole('menuitem', {name: 'Delete'})).toHaveClass(
      'kf-menu__item--danger',
    );
    await userEvent.keyboard('{Escape}');
  });

  it('shows no Edit and no status menu to whoever only reads orders', async () => {
    renderTable({roles: READ_ORDERS});
    await openRowMenu('W00001');

    expect(
      screen.queryByRole('menuitem', {name: 'Edit'}),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', {name: 'Delete'}),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Status of order W00001'}),
    ).not.toBeInTheDocument();
  });

  it('deletes an order after asking, says so and drops its row', async () => {
    let rows = [CREATED, PARTIAL];
    renderTable({
      roles: MANAGE_ORDERS,
      routes: {
        'GET /orders': () => [200, pageOf(rows)],
        'DELETE /orders/1': () => {
          rows = [PARTIAL];
          return [204];
        },
      },
    });
    await openRowMenu('W00001');

    await userEvent.click(screen.getByRole('menuitem', {name: 'Delete'}));
    const dialog = screen.getByRole('dialog', {name: 'Delete order W00001?'});
    await userEvent.click(
      within(dialog).getByRole('button', {name: 'Delete order'}),
    );

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Order W00001 was deleted.',
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('row', {name: /W00001/}),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('row', {name: /W00004/})).toBeInTheDocument();
  });

  it('reloads the list after a status change in a row', async () => {
    let status = 1;
    const {api} = renderTable({
      routes: {
        'GET /orders': () => [200, pageOf([order(1, 'W00001', status)])],
        'POST /orders/1/status': (body) => {
          status = (body as {status: number}).status;
          return [200, {}];
        },
      },
    });
    const row = await rowOf('W00001');

    await userEvent.click(
      within(row).getByRole('button', {name: 'Status of order W00001'}),
    );
    await userEvent.click(
      screen.getByRole('menuitemradio', {name: 'Completed'}),
    );
    await userEvent.click(
      screen.getByRole('button', {name: 'Mark as Completed'}),
    );

    await waitFor(() =>
      expect(
        screen.getByRole('button', {name: 'Status of order W00001'}),
      ).toHaveTextContent('Completed'),
    );
    expect(listCalls(api)).toHaveLength(2);
  });

  it('opens the detail from a row, from the order number, and on its comments from the count', async () => {
    const {onOpenDetail} = renderTable();
    const row = await rowOf('W00001');

    await userEvent.click(within(row).getByText('Ana Gomez'));
    expect(onOpenDetail).toHaveBeenLastCalledWith(
      expect.objectContaining({id: 1}),
      'products',
    );

    onOpenDetail.mockClear();
    await userEvent.click(within(row).getByRole('button', {name: 'W00001'}));
    expect(onOpenDetail).toHaveBeenCalledTimes(1);

    const count = within(row).getByRole('button', {
      name: 'Comments of order W00001: 2',
    });
    expect(count).toHaveTextContent('2');
    await userEvent.click(count);
    expect(onOpenDetail).toHaveBeenLastCalledWith(
      expect.objectContaining({id: 1}),
      'comments',
    );
  });

  it('keeps table roles and labels on every cell, so the phone cards read as rows with labelled facts', async () => {
    renderTable();
    const row = await rowOf('W00001');

    const title = row.querySelector('.kf-table__card-title');
    expect(
      title,
      'the card is titled by the order and its customer',
    ).toHaveTextContent('W00001 · Ana Gomez');
    const labelled = within(row)
      .getAllByRole('cell')
      .filter((cell) => cell.dataset.label)
      .map((cell) => [
        cell.dataset.label,
        cell.classList.contains('kf-table__card-hidden'),
      ]);
    expect(labelled).toEqual([
      ['Order', true],
      ['Customer', true],
      ['Source', false],
      ['Status', false],
      ['Created', false],
      ['Comments', false],
    ]);
  });

  it('shows an order without a customer (a webhook order may have none)', async () => {
    renderTable({orders: {1: [order(8, 'W00008', 1, {customer: null})]}});

    const row = await rowOf('W00008');
    expect(within(row).getAllByText(/No customer/)[0]).toBeInTheDocument();
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
