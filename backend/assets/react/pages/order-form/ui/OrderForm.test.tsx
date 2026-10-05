import {render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter, Route, Routes, useLocation} from 'react-router-dom';
import {fakeApi} from '@/shared/test/fakeApi';
import {OrderFormPage} from './OrderFormPage';

const WAREHOUSES = [
  {id: 1, name: 'Colombia', urls: []},
  {id: 2, name: 'Usa', urls: []},
];

const LOCATIONS = [
  {
    id: 1,
    name: 'Colombia',
    code: 'CO',
    states: [
      {
        id: 10,
        name: 'Antioquia',
        code: 'ANT',
        cities: [{id: 100, name: 'Medellin'}],
      },
    ],
  },
];

const ANA = {
  id: 7,
  first_name: 'Ana',
  last_name: 'Gomez',
  email: 'ana@kf.test',
  phone: '3001',
  addresses: [
    {
      id: 70,
      address: '1 Main St',
      zip_code: '050021',
      address_type: 2,
      city: {
        id: 100,
        name: 'Medellin',
        state: {
          id: 10,
          name: 'Antioquia',
          code: 'ANT',
          country: {id: 1, name: 'Colombia', code: 'CO'},
        },
      },
    },
  ],
};

const stock = (warehouse: number, uuid: string, code: string) => ({
  id: 1,
  status: 1,
  quantity: 100,
  product_id: 1,
  uuid,
  code,
  title: `Title ${code}`,
  detail: null,
  price: 10,
  warehouse: {id: warehouse, name: 'W'},
});

const STOCK_1 = [stock(1, 'u-kf01', 'KF-01'), stock(1, 'u-kf02', 'KF-02')];
const STOCK_2 = [stock(2, 'u-us01', 'US-01')];

const ORDER = {
  id: 5,
  code: 'W00005',
  status: 2,
  source: 2,
  payment_method: 1,
  comment: 'Leave at the door',
  created_at: '2026-10-05T10:00:00-05:00',
  warehouse: {id: 1, name: 'Colombia'},
  customer: ANA,
  comments: [],
  products: [
    {
      uuid: 'u-kf02',
      quantity: 4,
      product: {code: 'KF-02', title: 'Title KF-02', detail: null},
    },
  ],
};

const BASE_ROUTES: Record<string, [number, unknown]> = {
  'GET /warehouses': [200, WAREHOUSES],
  'GET /locations': [200, LOCATIONS],
  'GET /customers/all': [200, [ANA]],
  'GET /warehouses/1/stock': [200, STOCK_1],
  'GET /warehouses/2/stock': [200, STOCK_2],
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
        <Route path="/admin/orders/new" element={<OrderFormPage />} />
        <Route path="/admin/orders/:id/edit" element={<OrderFormPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function pickOption(label: string, option: string | RegExp) {
  await userEvent.click(screen.getByLabelText(label));
  await userEvent.click(
    await screen.findByText(option, {selector: '[class*=option]'}),
  );
}

async function fillCustomer() {
  await userEvent.type(screen.getByLabelText('First Name'), 'Luis');
  await userEvent.type(screen.getByLabelText('Last Name'), 'Diaz');
  await userEvent.type(screen.getByLabelText('Email'), 'luis@kf.test');
}

async function fillOrderDetail() {
  await userEvent.selectOptions(screen.getByLabelText('Warehouse'), 'Colombia');
  await pickOption('Product 1', 'Title KF-01 (KF-01)');
  await userEvent.type(screen.getByLabelText('Quantity of product 1'), '3');
  await userEvent.selectOptions(screen.getByLabelText('Source'), 'Phone');
  await userEvent.selectOptions(
    screen.getByLabelText('Payment Method'),
    'Paypal',
  );
  await userEvent.selectOptions(screen.getByLabelText('Status'), 'Created');
}

const saveButton = () => screen.getByRole('button', {name: /Create|Update/});

describe('OrderFormPage', () => {
  it('can be saved only with the customer, the warehouse, a filled product, the source, the payment and the status', async () => {
    fakeApi({...BASE_ROUTES});
    renderAt('/admin/orders/new');
    await screen.findByLabelText('Warehouse');

    expect(saveButton(), 'nothing filled').toBeDisabled();
    await fillOrderDetail();
    expect(saveButton(), 'no customer yet').toBeDisabled();

    await userEvent.type(screen.getByLabelText('First Name'), 'Luis');
    await userEvent.type(screen.getByLabelText('Last Name'), 'Diaz');
    expect(saveButton(), 'the email is still missing').toBeDisabled();
    await userEvent.type(screen.getByLabelText('Email'), 'luis@kf.test');
    expect(saveButton()).toBeEnabled();

    await userEvent.selectOptions(screen.getByLabelText('Status'), '');
    expect(saveButton(), 'the status is required').toBeDisabled();
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'Created');

    await userEvent.clear(screen.getByLabelText('Quantity of product 1'));
    expect(saveButton(), 'a product needs its quantity').toBeDisabled();
  });

  it('locks the warehouse once a product is filled, and unlocks it when the product goes', async () => {
    fakeApi({...BASE_ROUTES});
    renderAt('/admin/orders/new');
    await screen.findByLabelText('Warehouse');

    await userEvent.selectOptions(
      screen.getByLabelText('Warehouse'),
      'Colombia',
    );
    await pickOption('Product 1', 'Title KF-01 (KF-01)');
    expect(screen.getByLabelText('Warehouse')).toBeEnabled();
    await userEvent.type(screen.getByLabelText('Quantity of product 1'), '2');

    expect(screen.getByLabelText('Warehouse')).toBeDisabled();
    await userEvent.clear(screen.getByLabelText('Quantity of product 1'));
    expect(screen.getByLabelText('Warehouse')).toBeEnabled();
  });

  it('offers the products of the chosen warehouse, and reloads them when it changes', async () => {
    const api = fakeApi({...BASE_ROUTES});
    renderAt('/admin/orders/new');
    await screen.findByLabelText('Warehouse');

    await userEvent.selectOptions(
      screen.getByLabelText('Warehouse'),
      'Colombia',
    );
    await userEvent.click(screen.getByLabelText('Product 1'));
    expect(
      await screen.findByText('Title KF-02 (KF-02)', {
        selector: '[class*=option]',
      }),
    ).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');

    await userEvent.selectOptions(screen.getByLabelText('Warehouse'), 'Usa');
    await userEvent.click(screen.getByLabelText('Product 1'));
    expect(
      await screen.findByText('Title US-01 (US-01)', {
        selector: '[class*=option]',
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Title KF-02 (KF-02)')).not.toBeInTheDocument();
    expect(
      api.calls
        .filter((call) => call.path.endsWith('/stock'))
        .map((call) => call.url.pathname + call.url.search),
    ).toEqual([
      '/api/v1/warehouses/1/stock?status=1',
      '/api/v1/warehouses/2/stock?status=1',
    ]);
  });

  it('creates an order for a new customer with its filled products, then returns to the list', async () => {
    const api = fakeApi({
      ...BASE_ROUTES,
      'POST /orders': [201, {...ORDER, id: 9}],
    });
    renderAt('/admin/orders/new');
    await screen.findByLabelText('Warehouse');

    await fillCustomer();
    await userEvent.type(screen.getByLabelText('Address'), '5 Elm St');
    await userEvent.type(screen.getByLabelText('Zip Code'), '0500');
    await fillOrderDetail();
    await userEvent.click(screen.getByRole('button', {name: 'Add a product'}));
    await userEvent.type(screen.getByLabelText('Consecutive'), 'PH-1');
    await userEvent.type(screen.getByLabelText('Comment'), 'Call first');
    await userEvent.click(saveButton());

    expect(await screen.findByText('orders list created')).toBeInTheDocument();
    const post = api.calls.find((call) => call.method === 'POST');
    expect(post?.body).toEqual({
      code: 'PH-1',
      status: 1,
      source: 2,
      payment_method: 2,
      comment: 'Call first',
      warehouse_id: 1,
      customer: {
        id: null,
        first_name: 'Luis',
        last_name: 'Diaz',
        email: 'luis@kf.test',
        phone: '',
        addresses: [
          {
            id: null,
            address: '5 Elm St',
            zip_code: '0500',
            address_type: null,
            city: {
              id: null,
              name: null,
              state: {
                id: null,
                name: null,
                country: {id: null, name: null},
              },
            },
          },
        ],
      },
      // The empty second row is not sent.
      products: [{uuid: 'u-kf01', quantity: 3}],
      comments: [],
    });
  });

  it('fills the customer from an existing one and sends its id', async () => {
    const api = fakeApi({
      ...BASE_ROUTES,
      'POST /orders': [201, {...ORDER, id: 9}],
    });
    renderAt('/admin/orders/new');
    await screen.findByLabelText('Warehouse');

    await pickOption('Search Customer', 'Ana Gomez [ana@kf.test] [3001]');
    expect(screen.getByLabelText('First Name')).toHaveValue('Ana');
    expect(screen.getByLabelText('Email')).toHaveValue('ana@kf.test');
    expect(screen.getByLabelText('Address')).toHaveValue('1 Main St');
    await fillOrderDetail();
    await userEvent.click(saveButton());

    await screen.findByText('orders list created');
    const post = api.calls.find((call) => call.method === 'POST');
    expect(post?.body).toMatchObject({
      customer: {
        id: 7,
        first_name: 'Ana',
        addresses: [{city: {id: 100, name: 'Medellin'}}],
      },
    });
  });

  it('edits an order: shows what is saved, keeps the warehouse locked, and updates it', async () => {
    const api = fakeApi({
      ...BASE_ROUTES,
      'GET /orders/5': [200, ORDER],
      'PUT /orders/5': [200, ORDER],
    });
    renderAt('/admin/orders/5/edit');

    expect(
      await screen.findByRole('heading', {name: 'Editing Order'}),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByLabelText('First Name')).toHaveValue('Ana'),
    );
    expect(screen.getByLabelText('Warehouse')).toHaveValue('1');
    expect(screen.getByLabelText('Warehouse')).toBeDisabled();
    expect(screen.getByLabelText('Status')).toHaveValue('2');
    expect(screen.getByLabelText('Consecutive')).toHaveValue('W00005');
    expect(screen.getByLabelText('Comment')).toHaveValue('Leave at the door');
    expect(screen.getByLabelText('Quantity of product 1')).toHaveValue(4);
    expect(
      await screen.findByText('Title KF-02 (KF-02)'),
      'the saved product shows in its select',
    ).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText('Quantity of product 1'));
    await userEvent.type(screen.getByLabelText('Quantity of product 1'), '6');
    await userEvent.click(screen.getByRole('button', {name: 'Update'}));

    expect(await screen.findByText('orders list updated')).toBeInTheDocument();
    const put = api.calls.find((call) => call.method === 'PUT');
    expect(put?.path).toBe('/orders/5');
    expect(put?.body).toMatchObject({
      code: 'W00005',
      status: 2,
      warehouse_id: 1,
      customer: {id: 7},
      products: [{uuid: 'u-kf02', quantity: 6}],
    });
  });

  it('keeps a status above Completed when editing such an order', async () => {
    fakeApi({
      ...BASE_ROUTES,
      'GET /orders/5': [200, {...ORDER, status: 4}],
    });
    renderAt('/admin/orders/5/edit');

    await waitFor(() =>
      expect(screen.getByLabelText('Status')).toHaveValue('4'),
    );
    const options = within(screen.getByLabelText('Status'))
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(options).toEqual([
      'Select Order Status',
      'Created',
      'Processed',
      'Completed',
      'Partial',
    ]);
  });

  it('says why the server refused the order', async () => {
    fakeApi({
      ...BASE_ROUTES,
      'POST /orders': [
        422,
        {error: 'order_without_products', message: 'No products'},
      ],
    });
    renderAt('/admin/orders/new');
    await screen.findByLabelText('Warehouse');

    await fillCustomer();
    await fillOrderDetail();
    await userEvent.click(saveButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Add at least one product with its quantity.',
    );
    expect(saveButton()).toBeEnabled();
  });

  it('lets the order be typed when the existing customers cannot be listed', async () => {
    fakeApi({
      ...BASE_ROUTES,
      'GET /customers/all': [403, {error: 'forbidden', message: 'No'}],
    });
    renderAt('/admin/orders/new');

    expect(
      await screen.findByText(
        "The existing customers could not be loaded: type the customer's details.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('First Name')).toBeEnabled();
  });

  it('says so when the order to edit no longer exists', async () => {
    fakeApi({
      ...BASE_ROUTES,
      'GET /orders/404': [404, {error: 'order_not_found', message: 'Gone'}],
    });
    renderAt('/admin/orders/404/edit');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This order no longer exists.',
    );
  });
});
