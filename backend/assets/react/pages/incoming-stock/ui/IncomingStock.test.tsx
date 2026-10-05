import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {fakeApi} from '@/shared/test/fakeApi';
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

describe('IncomingStockPage', () => {
  it('lists the first warehouse incoming rows: code, description, quantity and warehouse', async () => {
    const api = fakeApi({
      'GET /warehouses': [200, [COLOMBIA, USA]],
      'GET /warehouses/1/stock': [200, [row('KF-01', 5)]],
    });
    render(<IncomingStockPage />);

    const line = (await screen.findByText('KF-01')).closest('tr')!;
    expect(within(line).getByText('Title KF-01')).toBeInTheDocument();
    expect(within(line).getByText('5')).toBeInTheDocument();
    expect(within(line).getByText('Colombia')).toBeInTheDocument();
    expect(
      api.calls.find((c) => c.path === '/warehouses/1/stock')?.url.search,
    ).toBe('?status=0');
  });

  it('loads the rows of the warehouse that is picked', async () => {
    fakeApi({
      'GET /warehouses': [200, [COLOMBIA, USA]],
      'GET /warehouses/1/stock': [200, [row('KF-01', 5)]],
      'GET /warehouses/2/stock': [200, [row('KF-09', 7, USA)]],
    });
    render(<IncomingStockPage />);

    await screen.findByText('KF-01');
    await userEvent.selectOptions(screen.getByLabelText('Warehouse'), 'Usa');

    expect(await screen.findByText('KF-09')).toBeInTheDocument();
    expect(screen.queryByText('KF-01')).not.toBeInTheDocument();
  });

  it('approves everything incoming and reloads the (now empty) list', async () => {
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
    render(<IncomingStockPage />);

    await screen.findByText('KF-01');
    await userEvent.click(screen.getByRole('button', {name: /Approve all/}));

    expect(await screen.findByRole('status')).toHaveTextContent(
      '2 incoming products were approved.',
    );
    expect(
      await screen.findByText(
        'Nothing is waiting for approval in this warehouse.',
      ),
    ).toBeInTheDocument();
    expect(
      api.calls.filter(
        (c) => c.method === 'POST' && c.path.endsWith('/approve'),
      ),
    ).toHaveLength(1);
  });

  it('cannot approve when nothing is incoming', async () => {
    fakeApi({
      'GET /warehouses': [200, [COLOMBIA]],
      'GET /warehouses/1/stock': [200, []],
    });
    render(<IncomingStockPage />);

    await screen.findByText(
      'Nothing is waiting for approval in this warehouse.',
    );
    expect(screen.getByRole('button', {name: /Approve all/})).toBeDisabled();
  });

  it('says so when the person may not manage the inventory', async () => {
    fakeApi({
      'GET /warehouses': [200, [COLOMBIA]],
      'GET /warehouses/1/stock': [403, {error: 'forbidden'}],
    });
    render(<IncomingStockPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'You do not have permission to do this.',
    );
  });
});
