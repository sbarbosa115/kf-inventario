import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {vi} from 'vitest';
import {fakeApi} from '@/shared/test/fakeApi';
import {pageOf} from '@/shared/test/fakeList';
import {ToastProvider} from '@/shared/ui';
import {InvoiceFormPage} from './InvoiceFormPage';

const stockRow = (id: number, title: string, price: number | null) => ({
  id: id * 10,
  status: 1,
  quantity: 5,
  product_id: id,
  uuid: `uuid-${id}`,
  code: `KF-0${id}`,
  title,
  detail: null,
  price,
  warehouse: {id: 1, name: 'Colombia'},
});

const STOCK = [
  stockRow(1, 'Chair', 11.11),
  stockRow(2, 'Table', 25),
  stockRow(3, 'Lamp', null),
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
      address_type: null,
      city: null,
    },
  ],
};

const CREATED = {
  id: 9,
  code: '20260002',
  status: 1,
  customer: null,
  items: [],
  total: '0.00',
};

const base = () => ({
  'GET /invoices/next-code': [200, {code: '20260002'}] as [number, unknown],
  'GET /customers/all': [200, [ANA]] as [number, unknown],
  'GET /locations': [200, []] as [number, unknown],
  'GET /warehouses': [200, [{id: 1, name: 'Colombia', urls: []}]] as [
    number,
    unknown,
  ],
  'GET /warehouses/1/stock': [200, pageOf(STOCK)] as [number, unknown],
});

function renderPage() {
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/admin/invoices/new']}>
        <Routes>
          <Route path="/admin/invoices" element={<p>invoices list</p>} />
          <Route path="/admin/invoices/new" element={<InvoiceFormPage />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );
}

const pickProduct = async (row: number, name: string) => {
  await userEvent.type(
    screen.getByLabelText(`Product ${row}`),
    `${name}{enter}`,
  );
};

describe('InvoiceFormPage', () => {
  it('lays the lines out as a table with a header per column, and an action bar under it', async () => {
    fakeApi(base());
    renderPage();
    await screen.findByLabelText('Invoice number');

    const table = screen.getByRole('table');
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual([
      'Product',
      'Description',
      'Qty',
      'Unit price',
      'Line total',
      'Actions',
    ]);
    expect(
      screen.getByRole('heading', {name: 'Customer', level: 2}),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {name: 'Invoice', level: 2}),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Cancel'})).toHaveAttribute(
      'href',
      '/admin/invoices',
    );
    expect(
      screen.getByRole('button', {name: 'Create invoice'}),
    ).toHaveAttribute('type', 'submit');
  });

  it('shows each line total, the subtotal, the sales tax and the total as money', async () => {
    fakeApi(base());
    renderPage();
    await screen.findByLabelText('Invoice number');
    await screen.findByText('Add all products from Colombia');
    await pickProduct(1, 'Tab');
    await userEvent.clear(screen.getByLabelText('Quantity 1'));
    await userEvent.type(screen.getByLabelText('Quantity 1'), '40');
    await userEvent.selectOptions(screen.getByLabelText('Sales tax'), '6%');

    const line = screen.getByRole('row', {name: 'Line 1'});
    expect(within(line).getByText('$1,000.00')).toBeInTheDocument();
    expect(screen.getByTestId('subtotal')).toHaveTextContent('$1,000.00');
    expect(screen.getByTestId('tax')).toHaveTextContent('$60.00');
    expect(screen.getByTestId('total')).toHaveTextContent('$1,060.00');
    expect(screen.getByText('Sales tax 6%')).toBeInTheDocument();
  });

  it('offers the next code and one empty item', async () => {
    fakeApi(base());
    renderPage();

    expect(await screen.findByLabelText('Invoice number')).toHaveValue(
      '20260002',
    );
    expect(screen.getByLabelText('Description 1')).toHaveValue('');
    expect(screen.queryByLabelText('Description 2')).not.toBeInTheDocument();
    expect(screen.getByTestId('total')).toHaveTextContent('$0.00');
  });

  it('fills the description and the price from the product picked', async () => {
    fakeApi(base());
    renderPage();
    await screen.findByLabelText('Invoice number');
    await screen.findByText('Add all products from Colombia');

    await pickProduct(1, 'Tab');

    expect(screen.getByLabelText('Description 1')).toHaveValue('Table');
    expect(screen.getByLabelText('Unit price 1')).toHaveValue('25');
  });

  it('adds every product of the warehouse that is not on the invoice yet', async () => {
    fakeApi(base());
    renderPage();
    await screen.findByLabelText('Invoice number');
    await pickProduct(1, 'Chair');

    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Add all products from Colombia',
      }),
    );

    expect(screen.getByLabelText('Description 1')).toHaveValue('Chair');
    expect(screen.getByLabelText('Description 2')).toHaveValue('Table');
    expect(screen.getByLabelText('Description 3')).toHaveValue('Lamp');
    expect(screen.queryByLabelText('Description 4')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Unit price 3')).toHaveValue('0');
  });

  it('works out the subtotal, the tax of the rate and the total as the items change', async () => {
    fakeApi(base());
    renderPage();
    await userEvent.type(await screen.findByLabelText('Description 1'), 'Part');
    await userEvent.clear(screen.getByLabelText('Quantity 1'));
    await userEvent.type(screen.getByLabelText('Quantity 1'), '3');
    await userEvent.clear(screen.getByLabelText('Unit price 1'));
    await userEvent.type(screen.getByLabelText('Unit price 1'), '11.11');

    expect(screen.getByTestId('subtotal')).toHaveTextContent('$33.33');
    expect(screen.getByTestId('total')).toHaveTextContent('$33.33');

    await userEvent.selectOptions(screen.getByLabelText('Sales tax'), '6%');

    expect(screen.getByTestId('tax')).toHaveTextContent('$2.00');
    expect(screen.getByTestId('total')).toHaveTextContent('$35.33');

    await userEvent.click(screen.getByRole('button', {name: 'Remove line 1'}));

    expect(screen.getByTestId('total')).toHaveTextContent('$0.00');
  });

  it('wants at least one item and sends nothing without it', async () => {
    const api = fakeApi(base());
    renderPage();

    await userEvent.click(
      await screen.findByRole('button', {name: 'Create invoice'}),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Please add at least one invoice item.',
    );
    expect(api.calls.some((call) => call.method === 'POST')).toBe(false);
  });

  it('fills the customer from the one picked and sends it by id', async () => {
    const api = fakeApi({
      ...base(),
      'POST /invoices': [201, CREATED],
    });
    vi.spyOn(window, 'open').mockReturnValue(null);
    renderPage();

    await userEvent.type(
      await screen.findByRole('combobox', {name: 'Customer'}),
      'ana{enter}',
    );

    expect(screen.getByLabelText('First name')).toHaveValue('Ana');
    expect(screen.getByLabelText('Email')).toHaveValue('ana@kf.test');
    expect(screen.getByLabelText('Address')).toHaveValue('1 Main St');

    await userEvent.type(screen.getByLabelText('Description 1'), 'Part');
    await userEvent.click(screen.getByRole('button', {name: 'Create invoice'}));

    await screen.findByText('invoices list');
    const sent = api.calls.find((call) => call.method === 'POST')!
      .body as Record<string, unknown>;
    expect(sent).toMatchObject({
      customer: {id: 7, email: 'ana@kf.test'},
      customer_address: '1 Main St',
    });
  });

  it('creates the invoice, opens its PDF in a new tab and goes to the list', async () => {
    const api = fakeApi({
      ...base(),
      'POST /invoices': [201, CREATED],
    });
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    renderPage();
    await screen.findByLabelText('Invoice number');
    await pickProduct(1, 'Chair');
    await userEvent.selectOptions(screen.getByLabelText('Sales tax'), '6%');
    await userEvent.selectOptions(
      screen.getByLabelText('Payment method'),
      'Credit card - Paypal',
    );
    await userEvent.type(screen.getByLabelText('Comments'), 'Paid');
    await userEvent.click(screen.getByRole('button', {name: 'Add line'}));

    await userEvent.click(screen.getByRole('button', {name: 'Create invoice'}));

    expect(await screen.findByText('invoices list')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Invoice created.');
    expect(open).toHaveBeenCalledWith('/api/v1/invoices/9/pdf', '_blank');
    expect(api.calls.find((call) => call.method === 'POST')!.body).toEqual({
      code: '20260002',
      payment_method: 'credit_card',
      customer: null,
      customer_address: null,
      tax_rate: '6',
      comment: 'Paid',
      items: [
        {
          product_id: 1,
          description: 'Chair',
          quantity: 1,
          unit_price: '11.11',
          discount: '0',
        },
      ],
    });
  });

  it('says the code is taken under the code and keeps the form', async () => {
    fakeApi({
      ...base(),
      'POST /invoices': [409, {error: 'invoice_code_taken'}],
    });
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    renderPage();
    await userEvent.type(await screen.findByLabelText('Description 1'), 'Part');

    await userEvent.click(screen.getByRole('button', {name: 'Create invoice'}));

    expect(
      await screen.findByText('An invoice with this code already exists.'),
    ).toBeInTheDocument();
    expect(open).not.toHaveBeenCalled();
    expect(screen.getByRole('button', {name: 'Create invoice'})).toBeEnabled();
  });
});
