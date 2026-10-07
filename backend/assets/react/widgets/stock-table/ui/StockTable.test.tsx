import {render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {vi} from 'vitest';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import type {StockItem} from '@/entities/product';
import {fakeApi} from '@/shared/test/fakeApi';
import {fakeList} from '@/shared/test/fakeList';
import {ToastProvider} from '@/shared/ui';
import {StockTable} from './StockTable';

const WAREHOUSES = [
  {id: 1, name: 'Colombia', urls: ['https://colombia.test']},
  {id: 2, name: 'Usa', urls: []},
];

function stock(
  id: number,
  code: string,
  quantity: number,
  price = 100,
  warehouse = WAREHOUSES[0]!,
): StockItem {
  return {
    id,
    status: 1,
    quantity,
    product_id: id,
    uuid: `uuid-${code}`,
    code,
    title: `Title ${code}`,
    detail: `Detail ${code}`,
    price,
    warehouse: {id: warehouse.id, name: warehouse.name},
  };
}

// 4 products, 157 units, 100*100 + 50*20.5 + 7*10 = 11,095 of stock value; KF-04 is out of stock.
const COLOMBIA_STOCK = [
  stock(1, 'KF-01', 100, 100),
  stock(2, 'KF-02', 50, 20.5),
  stock(3, 'KF-03', 7, 10),
  stock(4, 'KF-04', 0, 5),
];
const USA_STOCK = [stock(9, 'US-77', 3, 40, WAREHOUSES[1])];

function renderTable(address = '/admin/products') {
  render(
    <MemoryRouter initialEntries={[address]}>
      <ToastProvider>
        <Routes>
          <Route path="/admin/products" element={<StockTable />} />
          <Route
            path="/admin/products/:uuid/edit"
            element={<p>the edit form</p>}
          />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}

/** The stock list's contract, in memory (filters, q, sort, pages, the in_stock facet and the totals). */
const STOCK_LIST = {
  fields: {
    code: (r: StockItem) => r.code,
    title: (r: StockItem) => r.title,
    detail: (r: StockItem) => r.detail,
    quantity: (r: StockItem) => r.quantity,
    price: (r: StockItem) => r.price,
    in_stock: (r: StockItem) => (r.quantity > 0 ? 'yes' : 'no'),
  },
  search: [
    (r: StockItem) => r.code,
    (r: StockItem) => r.title,
    (r: StockItem) => r.detail,
  ],
  extra: (rows: StockItem[]) => ({
    totals: {
      units: rows.reduce((sum, r) => sum + r.quantity, 0),
      value: rows.reduce((sum, r) => sum + r.quantity * (r.price ?? 0), 0),
    },
  }),
};

function stockRoutes() {
  return {
    'GET /warehouses': [200, WAREHOUSES] as [number, unknown],
    'GET /warehouses/1/stock': fakeList(COLOMBIA_STOCK, STOCK_LIST),
    'GET /warehouses/2/stock': fakeList(USA_STOCK, STOCK_LIST),
  };
}

const rowOf = (code: string) => screen.getByText(code).closest('tr')!;
/** The codes of the rows shown. */
const rows = () =>
  screen
    .queryAllByRole('row')
    .filter((row) => row.closest('tbody'))
    .map((row) => row.querySelector('.kf-table__mono')?.textContent);
/** A chip of the active filters above the table. */
const chipText = (text: string) =>
  screen.getByText(text, {selector: '.kf-active-filters__text'});
const stockCalls = (api: ReturnType<typeof fakeApi>) =>
  api.calls.filter((c) => c.path === '/warehouses/1/stock');

beforeEach(() => localStorage.clear());

describe('StockTable', () => {
  it("opens on the first warehouse's stock without a Warehouse column", async () => {
    const api = fakeApi(stockRoutes());
    renderTable();

    const row = (await screen.findByText('KF-01')).closest('tr')!;
    expect(within(row).getByText('Detail KF-01')).toBeInTheDocument();
    expect(within(row).getAllByText('Title KF-01').length).toBeGreaterThan(0);
    expect(within(row).getByText('100')).toBeInTheDocument();
    expect(within(row).getByText('$100.00')).toBeInTheDocument();
    expect(
      screen.queryByRole('columnheader', {name: 'Warehouse'}),
    ).not.toBeInTheDocument();
    const colombia = screen.getByRole('radio', {name: 'Colombia'});
    expect(colombia).toBeChecked();
    expect(screen.getByRole('radiogroup', {name: 'Warehouse'})).toBeVisible();
    const stockCall = api.calls.find((c) => c.path === '/warehouses/1/stock')!;
    expect(stockCall.url.searchParams.get('status')).toBe('1');
  });

  it('shows the whole detail, on the phone cards too, and keeps the stock value', async () => {
    const long =
      'Front lip spoiler, matte black, fits the 2016 – 2021 models with the factory bumper';
    fakeApi({
      ...stockRoutes(),
      'GET /warehouses/1/stock': fakeList(
        [{...stock(1, 'KF-01', 100, 100), detail: long}],
        STOCK_LIST,
      ),
    });
    renderTable();

    const detail = await screen.findByText(long);
    // The whole text, not a clipped line with the rest in a tooltip: it wraps.
    expect(detail).not.toHaveAttribute('title');
    expect(detail.textContent, 'the detail is not shortened').toBe(long);
    const cell = detail.closest('td')!;
    expect(cell, 'the detail is one of the phone card facts').not.toHaveClass(
      'kf-table__card-hidden',
    );
    expect(cell).toHaveAttribute('data-label', 'Detail');
    expect(await screen.findByText('Stock value')).toBeInTheDocument();
  });

  it('computes the products, units and stock value from the loaded list', async () => {
    fakeApi(stockRoutes());
    renderTable();
    await screen.findByText('KF-01');

    const figure = (label: string) =>
      screen.getByText(label, {selector: 'dt'}).nextElementSibling;
    expect(figure('Products')).toHaveTextContent('4');
    expect(figure('Units')).toHaveTextContent('157');
    expect(figure('Stock value')).toHaveTextContent('$11,095.00');
  });

  it('filters by In stock and Out of stock chips that count the list, and the figures stay', async () => {
    fakeApi(stockRoutes());
    renderTable();
    await screen.findByText('KF-01');

    expect(screen.getByRole('button', {name: 'All 4'})).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', {name: 'In stock 3'})).toBeVisible();
    await userEvent.click(screen.getByRole('button', {name: 'Out of stock 1'}));

    expect(screen.getByText('KF-04')).toBeInTheDocument();
    expect(screen.queryByText('KF-01')).not.toBeInTheDocument();
    expect(
      screen.getByText('Units', {selector: 'dt'}).nextSibling,
    ).toHaveTextContent('157');
    await userEvent.click(screen.getByRole('button', {name: 'In stock 3'}));
    expect(screen.queryByText('KF-04')).not.toBeInTheDocument();
    expect(screen.getByText('KF-03')).toBeInTheDocument();
  });

  it('narrows by search together with the chip, and Show all brings back every row', async () => {
    fakeApi(stockRoutes());
    renderTable();
    await screen.findByText('KF-01');

    await userEvent.type(
      screen.getByRole('searchbox', {name: 'Search products'}),
      'kf-02',
    );
    await vi.waitFor(() =>
      expect(screen.queryByText('KF-01')).not.toBeInTheDocument(),
    );
    expect(screen.getByText('KF-02')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: /Out of stock/}));
    expect(
      await screen.findByText('Nothing matches these filters.'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Show all'}));
    expect(await screen.findByText('KF-01')).toBeInTheDocument();
    expect(screen.getByText('KF-04')).toBeInTheDocument();
    expect(
      screen.getByRole('searchbox', {name: 'Search products'}),
    ).toHaveValue('');
  });

  it('reloads for another warehouse, forgets the selection and remembers the choice', async () => {
    const api = fakeApi(stockRoutes());
    renderTable();
    await screen.findByText('KF-01');
    await userEvent.click(
      within(rowOf('KF-01')).getByRole('checkbox', {name: 'Select row'}),
    );
    expect(screen.getByText('1 selected')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', {name: 'Usa'}));

    expect(await screen.findByText('US-77')).toBeInTheDocument();
    expect(screen.queryByText('KF-01')).not.toBeInTheDocument();
    expect(api.calls.map((c) => c.path)).toContain('/warehouses/2/stock');
    expect(screen.queryByText('1 selected')).not.toBeInTheDocument();
    expect(localStorage.getItem('kf.warehouse')).toBe('2');
  });

  it('opens on the warehouse the address names', async () => {
    fakeApi(stockRoutes());
    renderTable('/admin/products?warehouse=2');

    expect(await screen.findByText('US-77')).toBeInTheDocument();
    expect(screen.getByRole('radio', {name: 'Usa'})).toBeChecked();
  });

  it('opens on the warehouse last chosen in this browser', async () => {
    localStorage.setItem('kf.warehouse', '2');
    fakeApi(stockRoutes());
    renderTable();

    expect(await screen.findByText('US-77')).toBeInTheDocument();
    expect(screen.getByRole('radio', {name: 'Usa'})).toBeChecked();
  });

  it('offers the selection a bar: how many, Move to warehouse, Download stock sheet and Clear', async () => {
    fakeApi(stockRoutes());
    renderTable();
    await screen.findByText('KF-01');
    expect(
      screen.queryByRole('button', {name: 'Move to warehouse'}),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('checkbox', {name: 'Select all'}));

    expect(screen.getByText('4 selected')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Move to warehouse'}),
    ).toBeEnabled();
    const download = screen.getByRole('link', {name: 'Download stock sheet'});
    const url = new URL(download.getAttribute('href')!, 'http://localhost');
    expect(url.pathname).toBe('/api/v1/products/template.xls');
    expect(url.searchParams.getAll('uuid[]')).toEqual([
      'uuid-KF-01',
      'uuid-KF-02',
      'uuid-KF-03',
      'uuid-KF-04',
    ]);
    await userEvent.click(screen.getByRole('button', {name: 'Clear'}));
    expect(screen.queryByText('4 selected')).not.toBeInTheDocument();
  });

  it('keeps one menu per row with Edit and the stock sheet of that product', async () => {
    fakeApi(stockRoutes());
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    renderTable();
    await screen.findByText('KF-01');

    await userEvent.click(
      screen.getByRole('button', {name: 'Actions for KF-02'}),
    );
    const menu = screen.getByRole('menu');
    expect(within(menu).getByRole('menuitem', {name: 'Edit'})).toHaveAttribute(
      'href',
      '/admin/products/uuid-KF-02/edit',
    );
    await userEvent.click(
      within(menu).getByRole('menuitem', {name: 'Download stock sheet'}),
    );

    expect(click).toHaveBeenCalledTimes(1);
    click.mockRestore();
  });

  it('opens the edit form when a row is clicked', async () => {
    fakeApi(stockRoutes());
    renderTable();

    await userEvent.click((await screen.findAllByText('Title KF-03'))[0]!);

    expect(await screen.findByText('the edit form')).toBeInTheDocument();
  });

  it('moves the selected products in a slide-over, says so in a toast and reloads the list', async () => {
    let loads = 0;
    const api = fakeApi({
      ...stockRoutes(),
      'GET /warehouses/1/stock': (body: unknown, url: URL) => {
        if (url.searchParams.get('per_page') !== '1') loads += 1;
        return fakeList(
          loads <= 1 ? COLOMBIA_STOCK : COLOMBIA_STOCK.slice(1),
          STOCK_LIST,
        )(body, url);
      },
      'POST /warehouses/1/moves/2': [204],
    });
    renderTable();
    await screen.findByText('KF-01');
    await userEvent.click(
      within(rowOf('KF-01')).getByRole('checkbox', {name: 'Select row'}),
    );

    await userEvent.click(
      screen.getByRole('button', {name: 'Move to warehouse'}),
    );
    const panel = screen.getByRole('dialog', {name: 'Move to warehouse'});
    await userEvent.click(within(panel).getByRole('button', {name: 'Move'}));

    expect(
      await screen.findByText(
        'Moved to Usa. The products arrive there as incoming.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.calls.find((c) => c.method === 'POST')!.body).toEqual({
      items: [{uuid: 'uuid-KF-01', quantity: 1}],
    });
    await vi.waitFor(() =>
      expect(screen.queryByText('KF-01')).not.toBeInTheDocument(),
    );
    expect(screen.queryByText('1 selected')).not.toBeInTheDocument();
  });

  it('says so when the warehouse holds nothing', async () => {
    fakeApi({
      ...stockRoutes(),
      'GET /warehouses/1/stock': fakeList([] as StockItem[], STOCK_LIST),
    });
    renderTable();

    expect(
      await screen.findByText(/This warehouse has no products in stock/),
    ).toBeInTheDocument();
  });

  it('says so when there is no warehouse at all', async () => {
    fakeApi({'GET /warehouses': [200, []]});
    renderTable();

    expect(
      await screen.findByText(/There are no warehouses yet/),
    ).toBeInTheDocument();
  });

  it('says so when the person may not manage stock', async () => {
    fakeApi({
      ...stockRoutes(),
      'GET /warehouses/1/stock': [403, {error: 'forbidden'}],
    });
    renderTable();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'You do not have permission to do this.',
    );
  });

  it('shows the failure with a retry when the stock cannot be loaded', async () => {
    fakeApi({
      ...stockRoutes(),
      'GET /warehouses/1/stock': [500, {error: 'internal_error'}],
    });
    renderTable();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong on our side',
    );
    expect(screen.getByRole('button', {name: 'Try again'})).toBeInTheDocument();
  });

  it('puts text filters under code, title and detail, and ranges under quantity and price', async () => {
    const api = fakeApi(stockRoutes());
    renderTable();
    await screen.findByText('KF-01');
    const filters = within(
      within(screen.getAllByRole('rowgroup')[0]!).getAllByRole('row')[1]!,
    );

    for (const name of ['Code', 'Title', 'Detail']) {
      expect(
        filters.getByRole('searchbox', {name: `Filter by ${name}`}),
      ).toBeInTheDocument();
    }
    await userEvent.click(filters.getByRole('button', {name: 'Price'}));
    await userEvent.click(screen.getByRole('button', {name: 'Under $100'}));
    await waitFor(() =>
      expect(screen.queryByText('KF-01')).not.toBeInTheDocument(),
    );
    await userEvent.keyboard('{Escape}');
    await userEvent.click(filters.getByRole('button', {name: 'Quantity'}));
    await userEvent.click(screen.getByRole('button', {name: '1 – 10'}));
    await userEvent.keyboard('{Escape}');

    await waitFor(() => expect(rows()).toEqual(['KF-03']));
    const asked = stockCalls(api).at(-1)!.url.searchParams;
    expect(asked.get('filter[price][max]')).toBe('99.99');
    expect(asked.get('filter[quantity][min]')).toBe('1');
    expect(asked.get('filter[quantity][max]')).toBe('10');
    expect(chipText('Price: Under $100')).toBeInTheDocument();
    expect(chipText('Quantity: 1 – 10')).toBeInTheDocument();
    const figure = (label: string) =>
      screen.getByText(label, {selector: 'dt'}).nextElementSibling;
    expect(
      figure('Products'),
      "the figures are the warehouse's, from the server's totals, whatever the filters",
    ).toHaveTextContent('4');
    expect(figure('Stock value')).toHaveTextContent('$11,095.00');
  });

  it('says the stock chip on a chip above the table, and offers it in the phone sheet', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query.includes('max-width: 599.98px'),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    try {
      const api = fakeApi(stockRoutes());
      renderTable();
      await screen.findByText('KF-01');

      await userEvent.click(screen.getByRole('button', {name: 'Filters · 0'}));
      const sheet = screen.getByRole('dialog', {name: 'Filters'});
      await userEvent.click(
        within(sheet).getByRole('button', {name: /^Stock/}),
      );
      await userEvent.click(
        within(sheet).getByRole('checkbox', {name: /Out of stock/}),
      );
      await userEvent.click(
        await within(sheet).findByRole('button', {name: 'Show 1 result'}),
      );

      await waitFor(() => expect(rows()).toEqual(['KF-04']));
      expect(chipText('Stock: Out of stock')).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Out of stock 1'}),
        'the toolbar chip is the same filter',
      ).toHaveAttribute('aria-pressed', 'true');
      expect(
        stockCalls(api).some(
          (c) =>
            c.url.searchParams.get('per_page') === '1' &&
            c.url.searchParams.get('filter[in_stock][]') === 'no',
        ),
        'the sheet counted its draft with one row asked',
      ).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
