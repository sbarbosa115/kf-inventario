import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import type {StockItem} from '@/entities/product';
import {fakeApi} from '@/shared/test/fakeApi';
import {StockTable} from './StockTable';

const WAREHOUSES = [
  {id: 1, name: 'Colombia', urls: ['https://colombia.test']},
  {id: 2, name: 'Usa', urls: []},
];

function stock(
  id: number,
  code: string,
  quantity: number,
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
    price: 100,
    warehouse: {id: warehouse.id, name: warehouse.name},
  };
}

const COLOMBIA_STOCK = [
  stock(1, 'KF-01', 100),
  stock(2, 'KF-02', 50),
  stock(3, 'KF-03', 7),
];
const USA_STOCK = [stock(9, 'US-77', 3, WAREHOUSES[1])];

function renderTable() {
  render(
    <MemoryRouter>
      <StockTable />
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

describe('StockTable', () => {
  it("opens on the first warehouse's stock, one row per product with a way to edit it", async () => {
    const api = fakeApi(stockRoutes());
    renderTable();

    const row = (await screen.findByText('KF-01')).closest('tr')!;
    expect(within(row).getByText('Detail KF-01')).toBeInTheDocument();
    expect(within(row).getByText('Title KF-01')).toBeInTheDocument();
    expect(within(row).getByText('100.00')).toBeInTheDocument();
    expect(within(row).getByText('Colombia')).toBeInTheDocument();
    expect(within(row).getByRole('link', {name: 'Edit KF-01'})).toHaveAttribute(
      'href',
      '/admin/products/uuid-KF-01/edit',
    );
    expect(screen.getByRole('combobox', {name: 'Warehouse'})).toHaveValue('1');
    const stockCall = api.calls.find((c) => c.path === '/warehouses/1/stock')!;
    expect(stockCall.url.searchParams.get('status')).toBe('1');
  });

  it('reloads the list when another warehouse is picked, and forgets the selection', async () => {
    const api = fakeApi(stockRoutes());
    renderTable();
    await screen.findByText('KF-01');
    await userEvent.click(
      screen.getAllByRole('checkbox', {name: 'Select row'})[0]!,
    );

    await userEvent.selectOptions(
      screen.getByRole('combobox', {name: 'Warehouse'}),
      'Usa',
    );

    expect(await screen.findByText('US-77')).toBeInTheDocument();
    expect(screen.queryByText('KF-01')).not.toBeInTheDocument();
    expect(api.calls.map((c) => c.path)).toContain('/warehouses/2/stock');
    expect(
      screen.getByRole('button', {name: /Move to Warehouse/}),
    ).toBeDisabled();
  });

  it('selects every row with Select all, and offers the selection to move and to download', async () => {
    fakeApi(stockRoutes());
    renderTable();
    await screen.findByText('KF-01');
    expect(
      screen.getByRole('button', {name: /Move to Warehouse/}),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', {name: /Update Selected Using Excel/}),
    ).toBeDisabled();

    await userEvent.click(screen.getByRole('checkbox', {name: 'Select all'}));

    expect(screen.getByText('3 products selected')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: /Move to Warehouse/}),
    ).toBeEnabled();
    const download = screen.getByRole('link', {
      name: /Update Selected Using Excel/,
    });
    const url = new URL(download.getAttribute('href')!, 'http://localhost');
    expect(url.pathname).toBe('/api/v1/products/template.xls');
    expect(url.searchParams.getAll('uuid[]')).toEqual([
      'uuid-KF-01',
      'uuid-KF-02',
      'uuid-KF-03',
    ]);
  });

  it('filters the rows by the search box and offers a way back when nothing matches', async () => {
    fakeApi(stockRoutes());
    renderTable();
    await screen.findByText('KF-01');

    await userEvent.type(screen.getByRole('searchbox'), 'kf-02');
    expect(screen.getByText('KF-02')).toBeInTheDocument();
    expect(screen.queryByText('KF-01')).not.toBeInTheDocument();

    await userEvent.type(screen.getByRole('searchbox'), 'zzz');
    expect(
      screen.getByText('Nothing matches these filters.'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Show all'}));
    expect(screen.getByText('KF-03')).toBeInTheDocument();
  });

  it('moves the selected products, says so, and reloads the list', async () => {
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
      screen.getAllByRole('checkbox', {name: 'Select row'})[0]!,
    );

    await userEvent.click(
      screen.getByRole('button', {name: /Move to Warehouse/}),
    );
    const dialog = screen.getByRole('dialog', {name: 'Move to Warehouse'});
    await userEvent.click(within(dialog).getByRole('button', {name: 'Move'}));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'The products were moved to Usa.',
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.calls.find((c) => c.method === 'POST')!.body).toEqual({
      items: [{uuid: 'uuid-KF-01', quantity: 1}],
    });
    await vi.waitFor(() =>
      expect(screen.queryByText('KF-01')).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole('button', {name: /Move to Warehouse/}),
    ).toBeDisabled();
  });

  it('offers Create Product, even when the warehouse holds nothing', async () => {
    fakeApi({...stockRoutes(), 'GET /warehouses/1/stock': [200, []]});
    renderTable();

    expect(
      await screen.findByText(/This warehouse has no products in stock/),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', {name: /Create Product/})).toHaveAttribute(
      'href',
      '/admin/products/new',
    );
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
