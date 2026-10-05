import {render, screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {fakeApi} from '@/shared/test/fakeApi';
import {ProductsPage} from './ProductsPage';

function renderPage(state?: unknown) {
  fakeApi({
    'GET /warehouses': [200, [{id: 1, name: 'Colombia', urls: []}]],
    'GET /warehouses/1/stock': [200, []],
  });
  render(
    <MemoryRouter initialEntries={[{pathname: '/admin/products', state}]}>
      <ProductsPage />
    </MemoryRouter>,
  );
}

describe('ProductsPage', () => {
  it('is the View products screen', async () => {
    renderPage();

    expect(
      screen.getByRole('heading', {name: 'View products'}),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('combobox', {name: 'Warehouse'}),
    ).toBeInTheDocument();
  });

  it('confirms a save the product form just made', async () => {
    renderPage({saved: 'updated'});

    expect(screen.getByText('The product was updated successfully.')).toHaveAttribute(
      'role',
      'status',
    );
  });
});
