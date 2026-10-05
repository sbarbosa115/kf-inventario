import {render, screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {fakeApi} from '@/shared/test/fakeApi';
import {ProductsPage} from './ProductsPage';

function renderPage(warehouses: unknown[]) {
  fakeApi({
    'GET /warehouses': [200, warehouses],
    'GET /warehouses/1/stock': [200, []],
  });
  render(
    <MemoryRouter>
      <ProductsPage />
    </MemoryRouter>,
  );
}

describe('ProductsPage', () => {
  it('is the Products screen, with Create product as its one primary action', async () => {
    renderPage([{id: 1, name: 'Colombia', urls: []}]);

    expect(screen.getByRole('heading', {name: 'Products'})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Create product'})).toHaveAttribute(
      'href',
      '/admin/products/new',
    );
    expect(
      await screen.findByRole('radiogroup', {name: 'Warehouse'}),
    ).toBeInTheDocument();
  });

  it('still offers Create product when there is no warehouse', async () => {
    renderPage([]);

    expect(
      await screen.findByText(/There are no warehouses yet/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', {name: 'Create product'}),
    ).toBeInTheDocument();
  });
});
