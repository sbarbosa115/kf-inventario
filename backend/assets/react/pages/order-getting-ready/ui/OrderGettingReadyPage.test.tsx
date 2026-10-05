import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter, Route, Routes, useLocation} from 'react-router-dom';
import {fakeApi} from '@/shared/test/fakeApi';
import {OrderGettingReadyPage} from './OrderGettingReadyPage';

const ORDER = {
  id: 7,
  code: 'W00001',
  status: 1,
  source: 2,
  payment_method: 1,
  comment: null,
  created_at: '2026-10-05T10:00:00-05:00',
  warehouse: {id: 1, name: 'Colombia'},
  customer: null,
  comments: [],
  products: [
    {uuid: 'u1', quantity: 2, product: {code: 'KF-01', title: 'KF-01', detail: null}},
  ],
};

const PARTIALS = {
  order_id: 7,
  status: 1,
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
  const state = useLocation().state as {saved?: string} | null;
  return <p>orders list {state?.saved}</p>;
}

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/orders" element={<OrdersList />} />
        <Route
          path="/admin/orders/:id/getting-ready"
          element={<OrderGettingReadyPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('OrderGettingReadyPage', () => {
  it('titles the screen with the order code, then returns to the list after a save', async () => {
    const api = fakeApi({
      'GET /orders/7': [200, ORDER],
      'GET /orders/7/partials': [200, PARTIALS],
      'POST /orders/7/partials': [200, {...PARTIALS, status: 4}],
    });
    renderAt('/admin/orders/7/getting-ready');

    expect(
      await screen.findByRole('heading', {name: 'Getting ready order #W00001'}),
    ).toBeInTheDocument();
    await userEvent.type(await screen.findByLabelText('Bar Code'), 'KF-01{Enter}');
    await userEvent.click(screen.getByRole('button', {name: 'Save Current'}));

    expect(await screen.findByText('orders list partial')).toBeInTheDocument();
    expect(api.calls.at(-1)?.body).toEqual({items: [{uuid: 'u1', quantity: 1}]});
  });

  it('says so when the order no longer exists', async () => {
    fakeApi({
      'GET /orders/9': [404, {error: 'order_not_found', message: 'Gone'}],
      'GET /orders/9/partials': [404, {error: 'order_not_found', message: 'Gone'}],
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
      'GET /orders/7': [500, {error: 'server', message: 'Boom'}],
      'GET /orders/7/partials': [200, PARTIALS],
    });
    renderAt('/admin/orders/7/getting-ready');

    expect(
      await screen.findByRole('button', {name: 'Try again'}),
    ).toBeInTheDocument();
  });
});
