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
  pinned_comment: null as {id: number; content: string} | null,
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
    source: (o: Row) => (o.source === 1 ? 'web' : 'phone'),
    pinned: (o: Row) => (o.pinned_comment ? '1' : null),
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
    .filter((row) => row.closest('tbody'))
    .map((row) => within(row).getAllByRole('cell')[1]?.textContent);
const chip = (name: RegExp) =>
  within(screen.getByRole('group', {name: 'Status'})).getByRole('button', {
    name,
  });
const search = () =>
  screen.getByRole('searchbox', {name: 'Order number or customer'});
/** A column's filter button in the row under the header. */
const filterButton = (name: string | RegExp) =>
  within(filterRow()).getByRole('button', {name});
const filterRow = () =>
  within(screen.getAllByRole('rowgroup')[0]!).getAllByRole('row')[1]!;
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

    await userEvent.click(filterButton('Created'));
    fireEvent.change(screen.getByLabelText('From'), {
      target: {value: '2026-10-01'},
    });
    await waitFor(() => expect(codes()).toEqual(['W00001', 'W00004']));
    fireEvent.change(screen.getByLabelText('To'), {
      target: {value: '2026-10-01'},
    });
    await waitFor(() => expect(codes()).toEqual(['W00004']));
    expect(
      screen.queryByLabelText('Created from'),
      'the toolbar has no date fields of its own: the column filters by date',
    ).not.toBeInTheDocument();
  });

  it('says when the filters leave nothing, and Show all clears every filter', async () => {
    renderTable();
    await rowOf('W00001');
    await userEvent.click(filterButton('Created'));
    fireEvent.change(screen.getByLabelText('From'), {
      target: {value: '2026-10-02'},
    });
    await waitFor(() => expect(codes()).toEqual(['W00001']));
    await userEvent.keyboard('{Escape}');
    await userEvent.click(chip(/^Partial/));
    await userEvent.type(search(), 'ruiz');

    expect(
      await screen.findByText('Nothing matches these filters.'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Show all'}));

    await waitFor(() =>
      expect(codes()).toEqual(['W00001', 'W00004', 'W00006']),
    );
    expect(search()).toHaveValue('');
    expect(filterButton('Created')).toHaveTextContent(/^Created$/);
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

  it('puts a filter under each header: number and customer as text, source, status and comments as lists, the date as a range', async () => {
    const {api} = renderTable();
    await rowOf('W00001');

    expect(
      within(filterRow()).getByRole('searchbox', {name: 'Filter by Order'}),
    ).toBeInTheDocument();
    expect(
      within(filterRow()).getByRole('searchbox', {name: 'Filter by Customer'}),
    ).toBeInTheDocument();
    for (const name of ['Source', 'Status', 'Created', 'Comments']) {
      expect(filterButton(name)).toHaveAttribute('aria-haspopup', 'dialog');
    }
    expect(
      listCalls(api)[0]?.url.searchParams.get('facets'),
      'the lists count their values over the other filters',
    ).toBe('status,source,pinned');
  });

  it('ticks statuses in the Status list, with their counts, and says so on a chip', async () => {
    const {api} = renderTable();
    await rowOf('W00001');

    await userEvent.click(filterButton('Status'));
    const panel = screen.getByRole('dialog', {name: 'Status'});
    expect(
      within(panel)
        .getAllByRole('checkbox')
        .map((box) => box.closest('label')?.textContent),
    ).toEqual([
      'Created1',
      'Processed0',
      'Completed0',
      'Partial1',
      'Sent0',
      'Delivered1',
    ]);
    await userEvent.click(within(panel).getByRole('checkbox', {name: /Created/}));
    await userEvent.click(within(panel).getByRole('checkbox', {name: /Partial/}));

    await waitFor(() => expect(codes()).toEqual(['W00001', 'W00004']));
    expect(listCalls(api).at(-1)?.url.searchParams.getAll('filter[status][]')).toEqual(
      ['1', '4'],
    );
    expect(screen.getByText('Status: Created, Partial')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(
      chip(/^All/),
      'two statuses are not one chip of the toolbar',
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('finds orders by the source and by the customer column, and keeps only pinned ones from Comments', async () => {
    const {api} = renderTable({
      orders: {
        1: [
          CREATED,
          PARTIAL,
          {...DELIVERED, pinned_comment: {id: 3, content: 'Call first'}},
        ],
      },
    });
    await rowOf('W00001');

    await userEvent.click(filterButton('Source'));
    await userEvent.click(screen.getByRole('checkbox', {name: /Web/}));
    await waitFor(() => expect(codes()).toEqual(['W00004']));
    await userEvent.keyboard('{Escape}');
    await userEvent.click(
      screen.getByRole('button', {name: 'Remove the filter Source: Web'}),
    );
    await waitFor(() => expect(codes()).toHaveLength(3));

    await userEvent.type(
      within(filterRow()).getByRole('searchbox', {name: 'Filter by Customer'}),
      'ruiz{Enter}',
    );
    await waitFor(() => expect(codes()).toEqual(['W00006']));
    expect(listCalls(api).at(-1)?.url.searchParams.get('filter[customer]')).toBe(
      'ruiz',
    );

    await userEvent.click(filterButton('Comments'));
    await userEvent.click(screen.getByRole('checkbox', {name: /Pinned only/}));
    expect(listCalls(api).at(-1)?.url.searchParams.getAll('filter[pinned][]')).toEqual(
      ['1'],
    );
  });

  it('on a phone, has no filter row: Filters · N opens the sheet, which counts its draft with one row asked', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query.includes('max-width: 599.98px'),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    try {
      const {api} = renderTable();
      await rowOf('W00001');
      expect(
        within(screen.getAllByRole('rowgroup')[0]!).getAllByRole('row'),
      ).toHaveLength(1);

      await userEvent.click(screen.getByRole('button', {name: 'Filters · 0'}));
      const sheet = screen.getByRole('dialog', {name: 'Filters'});
      await userEvent.click(within(sheet).getByRole('button', {name: /^Status/}));
      await userEvent.click(
        within(sheet).getByRole('checkbox', {name: /Delivered/}),
      );
      await userEvent.click(
        await within(sheet).findByRole('button', {name: 'Show 1 result'}),
      );

      await waitFor(() => expect(codes()).toEqual(['W00006']));
      const counted = listCalls(api).find(
        (c) => c.url.searchParams.get('per_page') === '1',
      );
      expect(counted?.url.searchParams.get('warehouse_id')).toBe('1');
      expect(screen.getByRole('button', {name: 'Filters · 1'})).toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
