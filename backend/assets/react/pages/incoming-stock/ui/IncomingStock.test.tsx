import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import {fakeApi} from '@/shared/test/fakeApi';
import {ToastProvider} from '@/shared/ui';
import {IncomingStockPage} from './IncomingStockPage';

const COLOMBIA = {id: 1, name: 'Colombia', urls: []};
const USA = {id: 2, name: 'Usa', urls: []};

function row(code: string, quantity: number, warehouse = COLOMBIA) {
  return {
    id: quantity,
    status: 0,
    quantity,
    product_id: quantity,
    uuid: `uuid-${code}`,
    code,
    title: `Title ${code}`,
    detail: null,
    price: 10,
    warehouse: {id: warehouse.id, name: warehouse.name},
  };
}

function renderPage(address = '/admin/products/incoming') {
  render(
    <MemoryRouter initialEntries={[address]}>
      <ToastProvider>
        <IncomingStockPage />
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('IncomingStockPage', () => {
  beforeEach(() => localStorage.clear());

  it('lists the incoming rows of the first warehouse, with their totals under the title', async () => {
    const api = fakeApi({
      'GET /warehouses': [200, [COLOMBIA, USA]],
      'GET /warehouses/1/stock': [200, [row('KF-01', 5), row('KF-02', 3)]],
    });
    renderPage();

    const line = (await screen.findByText('KF-01')).closest('tr')!;
    expect(within(line).getByText('Title KF-01')).toBeInTheDocument();
    expect(within(line).getByText('5')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {level: 1, name: 'Incoming'}),
    ).toBeInTheDocument();
    expect(
      screen.getByText('in Colombia · 2 products · 8 units'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Approve all (2)'}),
    ).toBeEnabled();
    expect(
      api.calls.find((c) => c.path === '/warehouses/1/stock')?.url.search,
    ).toBe('?status=0');
  });

  it('loads the warehouse that is picked, and the one the address names', async () => {
    fakeApi({
      'GET /warehouses': [200, [COLOMBIA, USA]],
      'GET /warehouses/1/stock': [200, [row('KF-01', 5)]],
      'GET /warehouses/2/stock': [200, [row('KF-09', 7, USA)]],
    });
    renderPage('/admin/products/incoming?warehouse=2');

    expect(await screen.findByText('KF-09')).toBeInTheDocument();
    expect(screen.getByRole('radio', {name: 'Usa'})).toBeChecked();

    await userEvent.click(screen.getByRole('radio', {name: 'Colombia'}));
    expect(await screen.findByText('KF-01')).toBeInTheDocument();
    expect(screen.queryByText('KF-09')).not.toBeInTheDocument();
  });

  it('approves everything after the confirmation and then shows that nothing waits', async () => {
    let approved = false;
    const api = fakeApi({
      'GET /warehouses': [200, [COLOMBIA]],
      'GET /warehouses/1/stock': () => [
        200,
        approved ? [] : [row('KF-01', 5), row('KF-02', 3)],
      ],
      'POST /warehouses/1/incoming/approve': () => {
        approved = true;
        return [200, {approved: 2}];
      },
    });
    renderPage();

    await screen.findByText('KF-01');
    await userEvent.click(screen.getByRole('button', {name: 'Approve all (2)'}));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent(
      "Approve 2 products, 8 units, into Colombia's stock?",
    );
    await userEvent.click(
      within(dialog).getByRole('button', {name: 'Approve 2 products'}),
    );

    expect(await screen.findByRole('status')).toHaveTextContent(
      '2 incoming products were approved.',
    );
    expect(await screen.findByText('Nothing waiting')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Products moved here from another warehouse show up here.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Approve all (0)'}),
    ).toBeDisabled();
    expect(
      api.calls.filter(
        (c) => c.method === 'POST' && c.path.endsWith('/approve'),
      ),
    ).toHaveLength(1);
  });

  it('says so when the person may not manage the inventory', async () => {
    fakeApi({
      'GET /warehouses': [200, [COLOMBIA]],
      'GET /warehouses/1/stock': [403, {error: 'forbidden'}],
    });
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'You do not have permission to do this.',
    );
    expect(screen.queryByRole('button', {name: /Approve all/})).toBeNull();
  });
});
