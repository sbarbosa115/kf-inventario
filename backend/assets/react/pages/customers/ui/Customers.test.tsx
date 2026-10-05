import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {fakeApi} from '@/shared/test/fakeApi';
import {CustomersPage} from './CustomersPage';

const customer = (id: number, first: string, last: string) => ({
  id,
  first_name: first,
  last_name: last,
  email: `${first.toLowerCase()}@kf.test`,
  phone: `300${id}`,
  addresses: [],
});

const ANA = customer(1, 'Ana', 'Gomez');
const BEN = customer(2, 'Ben', 'Ruiz');

const page = (items: unknown[], total = items.length, n = 1) => ({
  items,
  total,
  page: n,
  per_page: 100,
});

function renderPage(url = '/admin/customers', state?: unknown) {
  render(
    <MemoryRouter
      initialEntries={[
        {
          pathname: url.split('?')[0],
          search: url.includes('?') ? `?${url.split('?')[1]}` : '',
          state,
        },
      ]}
    >
      <Routes>
        <Route path="/admin/customers" element={<CustomersPage />} />
        <Route path="/admin/customers/new" element={<p>new customer form</p>} />
        <Route
          path="/admin/customers/:id/edit"
          element={<p>edit customer form</p>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CustomersPage', () => {
  it('lists the customers of the page with a way to edit each and to create another', async () => {
    const api = fakeApi({'GET /customers': [200, page([ANA, BEN])]});
    renderPage();

    const row = (await screen.findByText('Ana Gomez')).closest('tr')!;
    expect(within(row).getByText('ana@kf.test')).toBeInTheDocument();
    expect(within(row).getByText('3001')).toBeInTheDocument();
    expect(
      within(row).getByRole('link', {name: /Edit this customer/}),
    ).toHaveAttribute('href', '/admin/customers/1/edit');
    expect(screen.getByRole('link', {name: 'Create Customer'})).toHaveAttribute(
      'href',
      '/admin/customers/new',
    );
    expect(api.calls[0]?.url.search).toBe('?page=1&per_page=100');
  });

  it('asks the server for the page in the address and links to the other pages', async () => {
    const api = fakeApi({
      'GET /customers': [200, page([BEN], 101, 2)],
    });
    renderPage('/admin/customers?page=2');

    await screen.findByText('Ben Ruiz');
    expect(api.calls[0]?.url.search).toBe('?page=2&per_page=100');
    expect(screen.getByText('Page 2 of 2 (101 customers)')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Previous'})).toHaveAttribute(
      'href',
      '/admin/customers?page=1',
    );
    expect(screen.getByRole('link', {name: 'Page 1'})).toHaveAttribute(
      'href',
      '/admin/customers?page=1',
    );
    expect(screen.queryByRole('link', {name: 'Next'})).not.toBeInTheDocument();
  });

  it('shows no page links when everything fits in one page', async () => {
    fakeApi({'GET /customers': [200, page([ANA])]});
    renderPage();

    await screen.findByText('Ana Gomez');
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('asks before deleting, deletes the customer and reloads the list', async () => {
    let rows = [ANA, BEN];
    const api = fakeApi({
      'GET /customers': () => [200, page(rows)],
      'DELETE /customers/1': () => {
        rows = [BEN];
        return [204];
      },
    });
    renderPage();

    await userEvent.click(
      await screen.findByRole('button', {name: /Delete Customer: Ana Gomez/}),
    );
    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByText('Are you sure to delete this Customer?'),
    ).toBeInTheDocument();
    expect(api.calls.some((call) => call.method === 'DELETE')).toBe(false);
    await userEvent.click(within(dialog).getByRole('button', {name: 'Delete'}));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'The customer was deleted.',
    );
    expect(screen.queryByText('Ana Gomez')).not.toBeInTheDocument();
    expect(screen.getByText('Ben Ruiz')).toBeInTheDocument();
    expect(api.calls.filter((call) => call.method === 'DELETE')).toHaveLength(
      1,
    );
  });

  it('keeps the customer when the question is cancelled', async () => {
    const api = fakeApi({'GET /customers': [200, page([ANA])]});
    renderPage();

    await userEvent.click(
      await screen.findByRole('button', {name: /Delete Customer: Ana Gomez/}),
    );
    await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Ana Gomez')).toBeInTheDocument();
    expect(api.calls.some((call) => call.method === 'DELETE')).toBe(false);
  });

  it('says why a delete failed and keeps the question open', async () => {
    fakeApi({
      'GET /customers': [200, page([ANA])],
      'DELETE /customers/1': [500, {error: 'internal_error'}],
    });
    renderPage();

    await userEvent.click(
      await screen.findByRole('button', {name: /Delete Customer: Ana Gomez/}),
    );
    await userEvent.click(screen.getByRole('button', {name: 'Delete'}));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong on our side',
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('says what the section is for when there are no customers', async () => {
    fakeApi({'GET /customers': [200, page([])]});
    renderPage();

    expect(
      await screen.findByText(
        'There are no customers yet. Create the first one.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', {name: 'Create Customer'}),
    ).toBeInTheDocument();
  });

  it('finds a customer by name, email or phone in the page', async () => {
    fakeApi({'GET /customers': [200, page([ANA, BEN])]});
    renderPage();

    await userEvent.type(await screen.findByRole('searchbox'), 'ruiz');

    expect(screen.getByText('Ben Ruiz')).toBeInTheDocument();
    expect(screen.queryByText('Ana Gomez')).not.toBeInTheDocument();
  });

  it('says so when the person may not see the customers', async () => {
    fakeApi({
      'GET /customers': [403, {error: 'forbidden', message: 'Forbidden'}],
    });
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'You do not have permission to do this.',
    );
  });

  it('confirms a save the form just made', async () => {
    fakeApi({'GET /customers': [200, page([ANA])]});
    renderPage('/admin/customers', {saved: 'updated'});

    expect(await screen.findByRole('status')).toHaveTextContent(
      'The customer was updated successfully.',
    );
  });
});
