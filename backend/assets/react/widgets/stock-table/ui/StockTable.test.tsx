import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import type {StockItem} from '@/entities/product';
import {fakeApi} from '@/shared/test/fakeApi';
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

function stockRoutes() {
  return {
    'GET /warehouses': [200, WAREHOUSES] as [number, unknown],
    'GET /warehouses/1/stock': [200, COLOMBIA_STOCK] as [number, unknown],
    'GET /warehouses/2/stock': [200, USA_STOCK] as [number, unknown],
  };
}

const rowOf = (code: string) => screen.getByText(code).closest('tr')!;

beforeEach(() => localStorage.clear());

describe('StockTable', () => {
  it("opens on the first warehouse's stock without a Warehouse column", async () => {
    const api = fakeApi(stockRoutes());
    renderTable();

    const row = (await screen.findByText('KF-01')).closest('tr')!;
    expect(within(row).getByText('Detail KF-01')).toHaveAttribute(
      'title',
      'Detail KF-01',
    );
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

    await userEvent.type(screen.getByRole('searchbox'), 'kf-02');
    expect(screen.getByText('KF-02')).toBeInTheDocument();
    expect(screen.queryByText('KF-01')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: /Out of stock/}));
    expect(
      screen.getByText('Nothing matches these filters.'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Show all'}));
    expect(screen.getByText('KF-01')).toBeInTheDocument();
    expect(screen.getByText('KF-04')).toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toHaveValue('');
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
      'GET /warehouses/1/stock': () => {
        loads += 1;
        return [200, loads === 1 ? COLOMBIA_STOCK : COLOMBIA_STOCK.slice(1)];
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
    fakeApi({...stockRoutes(), 'GET /warehouses/1/stock': [200, []]});
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
});
