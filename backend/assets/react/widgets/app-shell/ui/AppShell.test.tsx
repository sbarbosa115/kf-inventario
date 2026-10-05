import {render, screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {SessionProvider} from '@/entities/session';
import {fakeApi} from '@/shared/test/fakeApi';
import {AppShell} from './AppShell';

function renderAs(roles: string[]) {
  fakeApi({
    'GET /auth/me': [
      200,
      {id: 1, username: 'ana', name: 'Ana', email: 'ana@kf.test', roles},
    ],
  });
  render(
    <SessionProvider>
      <MemoryRouter initialEntries={['/admin/products']}>
        <AppShell>
          <p>page</p>
        </AppShell>
      </MemoryRouter>
    </SessionProvider>,
  );
}

describe('AppShell', () => {
  it('shows an inventory person the products menu and nothing of sales or admin', async () => {
    renderAs(['ROLE_MANAGE_INVENTORY', 'ROLE_USER']);

    expect(await screen.findByText('ana@kf.test')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Product List'})).toHaveAttribute(
      'href',
      '/admin/products',
    );
    expect(
      screen.getByRole('link', {name: 'Barcode reader'}),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', {name: 'Orders'}),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('link', {name: 'Users'})).not.toBeInTheDocument();
  });

  it('shows the entries of every role an admin reaches, as the legacy sidebar did', async () => {
    renderAs([
      'ROLE_ADMIN',
      'ROLE_MANAGE_INVENTORY',
      'ROLE_MANAGE_WAREHOUSES',
      'ROLE_UPDATE_ORDERS',
      'ROLE_MANAGE_CUSTOMERS',
      'ROLE_MANAGE_USERS',
      'ROLE_USER',
    ]);

    for (const name of ['Warehouses', 'Orders', 'Customers', 'Users']) {
      expect(await screen.findByRole('link', {name})).toBeInTheDocument();
    }
    // Invoices need ROLE_UPDATE_INVOICES, which no role reaches through the hierarchy (unchanged from the legacy app).
    expect(
      screen.queryByRole('link', {name: 'Invoices'}),
    ).not.toBeInTheDocument();
  });
});
