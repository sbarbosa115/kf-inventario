import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter, Route, Routes, useLocation} from 'react-router-dom';
import {fakeApi} from '@/shared/test/fakeApi';
import {ProductFormPage} from './ProductFormPage';

const UUID = '6f1c1a52-1111-4a8e-9a55-0123456789ab';

function ListStub() {
  const state = useLocation().state as {saved?: string} | null;
  return <p>products list, saved: {state?.saved ?? 'nothing'}</p>;
}

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/products" element={<ListStub />} />
        <Route path="/admin/products/new" element={<ProductFormPage />} />
        <Route path="/admin/products/:uuid/edit" element={<ProductFormPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const CHAIR = {
  id: 4,
  uuid: UUID,
  code: 'KF-04',
  title: 'Chair',
  detail: 'Oak, 45 cm',
  status: 1,
  price: 120.5,
  stock: [{warehouse_id: 1, quantity: 3, status: 1}],
};

describe('ProductForm', () => {
  it('creates an active product and goes back to the list with a confirmation', async () => {
    const api = fakeApi({'POST /products': [201, CHAIR]});
    renderAt('/admin/products/new');

    expect(
      await screen.findByRole('heading', {name: 'Create product'}),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "This product won't be shown on the product list until you add quantities using Excel.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Status')).toHaveValue('1');
    await userEvent.type(screen.getByLabelText('Code'), 'KF-04');
    await userEvent.type(screen.getByLabelText('Title'), 'Chair');
    await userEvent.type(screen.getByLabelText('Detail'), 'Oak, 45 cm');
    await userEvent.type(screen.getByLabelText('Price'), '120.50');
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    expect(
      await screen.findByText('products list, saved: created'),
    ).toBeInTheDocument();
    expect(api.calls[0]!.body).toEqual({
      code: 'KF-04',
      title: 'Chair',
      detail: 'Oak, 45 cm',
      status: 1,
      price: 120.5,
    });
  });

  it('does not ask the server while the code or title is missing or a template placeholder', async () => {
    const api = fakeApi({});
    renderAt('/admin/products/new');
    await userEvent.type(await screen.findByLabelText('Code'), 'CODE');
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    expect(screen.getByLabelText('Code')).toBeInvalid();
    expect(
      screen.getByText('This value should not be equal to "CODE".'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toBeInvalid();
    expect(screen.getByLabelText('Price')).toBeValid();
    expect(api.calls).toHaveLength(0);
  });

  it('shows what the server refused on the field it belongs to', async () => {
    fakeApi({
      'POST /products': [
        422,
        {
          error: 'validation_failed',
          message: 'Validation error',
          violations: [
            {field: 'title', message: 'This value is too long.'},
          ],
        },
      ],
    });
    renderAt('/admin/products/new');
    await userEvent.type(await screen.findByLabelText('Code'), 'KF-05');
    await userEvent.type(screen.getByLabelText('Title'), 'Lamp');
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    expect(
      await screen.findByText('This value is too long.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toBeInvalid();
    expect(screen.getByRole('button', {name: 'Save'})).toBeEnabled();
  });

  it('fills an edit from the product and saves the changes to it', async () => {
    const api = fakeApi({
      [`GET /products/${UUID}`]: [200, CHAIR],
      [`PUT /products/${UUID}`]: [200, {...CHAIR, status: 0}],
    });
    renderAt(`/admin/products/${UUID}/edit`);

    expect(
      await screen.findByRole('heading', {name: 'Edit product'}),
    ).toBeInTheDocument();
    const code = await screen.findByLabelText('Code');
    expect(code).toHaveValue('KF-04');
    expect(screen.getByLabelText('Title')).toHaveValue('Chair');
    expect(screen.getByLabelText('Detail')).toHaveValue('Oak, 45 cm');
    expect(screen.getByLabelText('Price')).toHaveValue(120.5);
    expect(
      screen.queryByText(/won't be shown on the product list/),
    ).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'Inactive');
    await userEvent.clear(screen.getByLabelText('Price'));
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    expect(
      await screen.findByText('products list, saved: updated'),
    ).toBeInTheDocument();
    expect(api.calls.find((call) => call.method === 'PUT')!.body).toEqual({
      code: 'KF-04',
      title: 'Chair',
      detail: 'Oak, 45 cm',
      status: 0,
      price: null,
    });
  });

  it('says so when the product no longer exists', async () => {
    fakeApi({
      [`GET /products/${UUID}`]: [
        404,
        {error: 'product_not_found', message: 'Product not found.'},
      ],
    });
    renderAt(`/admin/products/${UUID}/edit`);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This product no longer exists.',
    );
    expect(
      screen.getByRole('link', {name: 'Back to the products'}),
    ).toHaveAttribute('href', '/admin/products');
  });

  it('cancels back to the list without saving', async () => {
    const api = fakeApi({});
    renderAt('/admin/products/new');
    await userEvent.click(await screen.findByRole('link', {name: 'Cancel'}));

    expect(
      screen.getByText('products list, saved: nothing'),
    ).toBeInTheDocument();
    expect(api.calls).toHaveLength(0);
  });
});
