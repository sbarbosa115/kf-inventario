import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {fakeApi} from '@/shared/test/fakeApi';
import {ToastProvider} from '@/shared/ui';
import {OrderGettingReadyPage} from './OrderGettingReadyPage';

const PARTIALS = {
  order_id: 7,
  code: 'W00001',
  status: 1,
  products: [
    {
      uuid: 'u1',
      quantity: 2,
      product: {code: 'KF-01', title: 'KF-01', detail: null},
    },
  ],
  products_aggregate: [],
  pending: [{uuid: 'u1', quantity: 2}],
  inventory: [
    {
      id: 1,
      status: 1,
      quantity: 5,
      product_id: 1,
      uuid: 'u1',
      code: 'KF-01',
      title: 'KF-01',
      warehouse: {id: 1, name: 'Colombia'},
    },
  ],
};

function OrdersList() {
  return <p>orders list</p>;
}

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <Routes>
          <Route path="/admin/orders" element={<OrdersList />} />
          <Route
            path="/admin/orders/:id/getting-ready"
            element={<OrderGettingReadyPage />}
          />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('OrderGettingReadyPage', () => {
  it('titles the screen with the order code and its status, then returns to the list with a toast after shipping', async () => {
    const api = fakeApi({
      'GET /orders/7/partials': [200, PARTIALS],
      'POST /orders/7/partials': [200, {...PARTIALS, status: 4}],
    });
    renderAt('/admin/orders/7/getting-ready');

    const heading = await screen.findByRole('heading', {
      name: 'Getting ready · W00001',
    });
    expect(heading).toBeInTheDocument();
    expect(document.title).toBe('Getting ready · W00001 · KF Inventory');
    expect(screen.getByText('Created'), 'the status badge').toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Barcode'), 'KF-01{Enter}');
    await userEvent.click(screen.getByRole('button', {name: 'Ship 1 product'}));

    expect(await screen.findByText('orders list')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Shipment saved: order W00001 is partial.',
    );
    expect(api.calls.at(-1)?.body).toEqual({
      items: [{uuid: 'u1', quantity: 1}],
    });
    expect(
      api.calls.map((call) => `${call.method} ${call.path}`),
      'the legacy page needed only ROLE_USER: the screen reads nothing behind an order role (GET /orders/7)',
    ).toEqual(['GET /orders/7/partials', 'POST /orders/7/partials']);
  });

  it('says the order is sent when the shipment completed it', async () => {
    fakeApi({
      'GET /orders/7/partials': [200, PARTIALS],
      'POST /orders/7/partials': [200, {...PARTIALS, status: 5}],
    });
    renderAt('/admin/orders/7/getting-ready');

    await userEvent.type(
      await screen.findByLabelText('Barcode'),
      'KF-01{Enter}',
    );
    await new Promise((resolve) => setTimeout(resolve, 60));
    await userEvent.type(screen.getByLabelText('Barcode'), 'KF-01{Enter}');
    await userEvent.click(
      screen.getByRole('button', {name: 'Ship 2 products'}),
    );

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Shipment saved: order W00001 is sent.',
    );
  });

  it('says so when the order no longer exists', async () => {
    fakeApi({
      'GET /orders/9/partials': [
        404,
        {error: 'order_not_found', message: 'Gone'},
      ],
    });
    renderAt('/admin/orders/9/getting-ready');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This order no longer exists.',
    );
    expect(
      screen.getByRole('link', {name: 'Back to the orders'}),
    ).toBeInTheDocument();
  });

  it('offers to try again when the load failed', async () => {
    fakeApi({
      'GET /orders/7/partials': [500, {error: 'server', message: 'Boom'}],
    });
    renderAt('/admin/orders/7/getting-ready');

    expect(
      await screen.findByRole('button', {name: 'Try again'}),
    ).toBeInTheDocument();
  });
});
