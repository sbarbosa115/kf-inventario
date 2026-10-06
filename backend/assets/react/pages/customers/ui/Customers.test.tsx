import {render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {fakeApi} from '@/shared/test/fakeApi';
import {fakeList} from '@/shared/test/fakeList';
import {ToastProvider} from '@/shared/ui';
import {CustomersPage} from './CustomersPage';

const customer = (id: number, first: string, last: string, city?: string) => ({
  id,
  first_name: first,
  last_name: last,
  email: `${first.toLowerCase()}@kf.test`,
  phone: `300${id}`,
  addresses: city
    ? [
        {
          id: id * 10,
          address: '1 Main St',
          zip_code: '050021',
          address_type: null,
          city: {
            id: id * 100,
            name: city,
            state: {
              id: 10,
              name: 'Antioquia',
              code: 'ANT',
              country: {id: 1, name: 'Colombia', code: 'CO'},
            },
          },
        },
      ]
    : [],
});

const ANA = customer(1, 'Ana', 'Gomez', 'Medellin');
const BEN = customer(2, 'Ben', 'Ruiz');

const page = (items: unknown[], total = items.length, n = 1) => ({
  items,
  total,
  page: n,
  per_page: 25,
});

type Row = ReturnType<typeof customer>;

/** The customers list's contract, in memory: q over name, email, phone and city; the text filters; country[]. */
const customers = (rows: Row[]) =>
  fakeList(rows, {
    fields: {
      name: (c) => `${c.first_name} ${c.last_name}`,
      email: (c) => c.email,
      phone: (c) => c.phone,
      city: (c) => c.addresses[0]?.city.name,
      country: (c) => c.addresses.map((a) => String(a.city.state.country.id)),
    },
    search: [
      (c) => `${c.first_name} ${c.last_name}`,
      (c) => c.email,
      (c) => c.phone,
      (c) => c.addresses[0]?.city.name,
    ],
  });

function renderPage(url = '/admin/customers') {
  render(
    <MemoryRouter
      initialEntries={[
        {
          pathname: url.split('?')[0],
          search: url.includes('?') ? `?${url.split('?')[1]}` : '',
        },
      ]}
    >
      <ToastProvider>
        <Routes>
          <Route path="/admin/customers" element={<CustomersPage />} />
          <Route
            path="/admin/customers/new"
            element={<p>new customer form</p>}
          />
          <Route
            path="/admin/customers/:id/edit"
            element={<p>edit customer form</p>}
          />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}

const listCalls = (api: ReturnType<typeof fakeApi>) =>
  api.calls.filter((c) => c.path === '/customers');

const LOCATIONS = [
  {id: 1, name: 'Colombia', code: 'CO', states: []},
  {id: 2, name: 'USA', code: 'US', states: []},
];

describe('CustomersPage', () => {
  it('lists the customers with name, email, phone and the city of the first address', async () => {
    const api = fakeApi({'GET /customers': [200, page([ANA, BEN])]});
    renderPage();

    const row = await screen.findByRole('row', {name: /ana@kf\.test/});
    expect(within(row).getAllByText('Ana Gomez').length).toBeGreaterThan(0);
    expect(within(row).getByText('3001')).toBeInTheDocument();
    expect(within(row).getByText('Medellin')).toBeInTheDocument();
    expect(
      screen.getAllByRole('columnheader').map((header) => header.textContent),
    ).toEqual(expect.arrayContaining(['Email', 'Phone', 'City']));
    expect(screen.getByRole('link', {name: 'Create customer'})).toHaveAttribute(
      'href',
      '/admin/customers/new',
    );
    expect(
      listCalls(api)[0]?.url.search,
      '25 a page, as every list, newest first, the countries counted',
    ).toBe('?per_page=25&facets=country');
  });

  it('keeps edit and delete in the row menu, not as visible buttons', async () => {
    fakeApi({'GET /customers': [200, page([ANA])]});
    renderPage();

    const row = await screen.findByRole('row', {name: /ana@kf\.test/});
    expect(within(row).queryByRole('link', {name: 'Edit'})).toBeNull();
    await userEvent.click(
      within(row).getByRole('button', {name: 'Actions for Ana Gomez'}),
    );

    expect(screen.getByRole('menuitem', {name: 'Edit'})).toHaveAttribute(
      'href',
      '/admin/customers/1/edit',
    );
    expect(screen.getByRole('menuitem', {name: 'Delete'})).toBeInTheDocument();
  });

  it('opens the edit form when a row is clicked', async () => {
    fakeApi({'GET /customers': [200, page([ANA])]});
    renderPage();

    const row = await screen.findByRole('row', {name: /ana@kf\.test/});
    await userEvent.click(within(row).getByText('3001'));

    expect(await screen.findByText('edit customer form')).toBeInTheDocument();
  });

  it('says which customers of how many the page shows, in the header', async () => {
    fakeApi({'GET /customers': [200, page([ANA, BEN], 1240, 1)]});
    renderPage();

    await screen.findByRole('row', {name: /ana@kf\.test/});
    expect(screen.getByText('1–2 of 1,240')).toBeInTheDocument();
  });

  it('counts the range from the page asked for', async () => {
    const items = Array.from({length: 25}, (_, i) =>
      customer(i + 1, `C${i}`, 'X'),
    );
    fakeApi({'GET /customers': [200, page(items, 1240, 2)]});
    renderPage('/admin/customers?page=2');

    await screen.findAllByText('C0 X');
    expect(screen.getByText('26–50 of 1,240')).toBeInTheDocument();
    expect(screen.getByRole('navigation', {name: 'Pages'})).toHaveTextContent(
      '26 – 50 of 1,240',
    );
  });

  it('gives every row and cell its table role, for the card layout on a phone', async () => {
    fakeApi({'GET /customers': [200, page([ANA])]});
    renderPage();

    const row = await screen.findByRole('row', {name: /ana@kf\.test/});
    const email = within(row).getByRole('cell', {name: 'ana@kf.test'});
    expect(email).toHaveAttribute('data-label', 'Email');
    expect(
      row.querySelector('.kf-table__card-title'),
      'the card shows the name as its title',
    ).toHaveTextContent('Ana Gomez');
    expect(
      row.querySelector('[data-label="Name"]'),
      'the name is not repeated among the card facts',
    ).toHaveClass('kf-table__card-hidden');
  });

  it('pages on the server, the page in the address', async () => {
    const api = fakeApi({
      'GET /customers': (_body, url) =>
        url.searchParams.get('page') === '2'
          ? [200, page([BEN], 26, 2)]
          : [200, page([ANA], 26, 1)],
    });
    renderPage('/admin/customers?page=2');

    await screen.findAllByText('Ben Ruiz');
    expect(listCalls(api)[0]?.url.search).toBe(
      '?page=2&per_page=25&facets=country',
    );
    expect(screen.getByRole('navigation', {name: 'Pages'})).toHaveTextContent(
      '26 – 26 of 26',
    );
    expect(screen.getByRole('button', {name: 'Next'})).toBeDisabled();
    await userEvent.click(screen.getByRole('button', {name: 'Previous'}));
    expect((await screen.findAllByText('Ana Gomez')).length).toBeGreaterThan(0);
    expect(listCalls(api).at(-1)?.url.search).toBe(
      '?per_page=25&facets=country',
    );
  });

  it('shows no pager when everything fits in one page', async () => {
    fakeApi({'GET /customers': [200, page([ANA])]});
    renderPage();

    await screen.findAllByText('Ana Gomez');
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('asks before deleting, deletes the customer, reloads the list and says so', async () => {
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
      await screen.findByRole('button', {name: 'Actions for Ana Gomez'}),
    );
    await userEvent.click(screen.getByRole('menuitem', {name: 'Delete'}));
    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByText(
        'Delete Ana Gomez? Their orders will be removed too.',
      ),
    ).toBeInTheDocument();
    expect(api.calls.some((call) => call.method === 'DELETE')).toBe(false);
    await userEvent.click(within(dialog).getByRole('button', {name: 'Delete'}));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'The customer was deleted.',
    );
    expect(screen.queryAllByText('Ana Gomez')).toHaveLength(0);
    expect(screen.getAllByText('Ben Ruiz').length).toBeGreaterThan(0);
    expect(api.calls.filter((call) => call.method === 'DELETE')).toHaveLength(
      1,
    );
  });

  it('keeps the customer when the question is cancelled', async () => {
    const api = fakeApi({'GET /customers': [200, page([ANA])]});
    renderPage();

    await userEvent.click(
      await screen.findByRole('button', {name: 'Actions for Ana Gomez'}),
    );
    await userEvent.click(screen.getByRole('menuitem', {name: 'Delete'}));
    await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getAllByText('Ana Gomez').length).toBeGreaterThan(0);
    expect(api.calls.some((call) => call.method === 'DELETE')).toBe(false);
  });

  it('says why a delete failed and keeps the question open', async () => {
    fakeApi({
      'GET /customers': [200, page([ANA])],
      'DELETE /customers/1': [500, {error: 'internal_error'}],
    });
    renderPage();

    await userEvent.click(
      await screen.findByRole('button', {name: 'Actions for Ana Gomez'}),
    );
    await userEvent.click(screen.getByRole('menuitem', {name: 'Delete'}));
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {name: 'Delete'}),
    );

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
      screen.getByRole('link', {name: 'Create customer'}),
    ).toBeInTheDocument();
  });

  it('searches every customer on the server, by name, email, phone or city', async () => {
    fakeApi({'GET /customers': customers([ANA, BEN])});
    renderPage();

    const box = await screen.findByRole('searchbox', {
      name: 'Search customers',
    });
    await userEvent.type(box, 'ruiz');
    await waitFor(() =>
      expect(screen.queryAllByText('Ana Gomez')).toHaveLength(0),
    );
    expect(screen.getAllByText('Ben Ruiz').length).toBeGreaterThan(0);

    await userEvent.clear(box);
    await userEvent.type(box, 'medellin');
    await waitFor(() =>
      expect(screen.queryAllByText('Ben Ruiz')).toHaveLength(0),
    );
    expect(screen.getAllByText('Ana Gomez').length).toBeGreaterThan(0);
  });

  it('offers to show everything again when the search finds nothing', async () => {
    fakeApi({'GET /customers': customers([ANA])});
    renderPage();

    await userEvent.type(
      await screen.findByRole('searchbox', {name: 'Search customers'}),
      'zzz',
    );
    expect(
      await screen.findByText('Nothing matches these filters.'),
    ).toBeVisible();
    await userEvent.click(screen.getByRole('button', {name: 'Show all'}));

    expect((await screen.findAllByText('Ana Gomez')).length).toBeGreaterThan(0);
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

  it('filters under the headers: name, email, phone and city as text, the country from a list with its counts', async () => {
    const api = fakeApi({
      'GET /customers': customers([ANA, BEN]),
      'GET /locations': [200, LOCATIONS],
    });
    renderPage();
    await screen.findByRole('row', {name: /ana@kf\.test/});
    const filters = within(
      within(screen.getAllByRole('rowgroup')[0]!).getAllByRole('row')[1]!,
    );

    for (const name of ['Name', 'Email', 'Phone', 'City']) {
      expect(
        filters.getByRole('searchbox', {name: `Filter by ${name}`}),
      ).toBeInTheDocument();
    }
    await userEvent.type(
      filters.getByRole('searchbox', {name: 'Filter by Email'}),
      'ben@{Enter}',
    );
    await waitFor(() =>
      expect(screen.queryAllByText('Ana Gomez')).toHaveLength(0),
    );
    expect(listCalls(api).at(-1)?.url.searchParams.get('filter[email]')).toBe(
      'ben@',
    );
    await userEvent.click(
      screen.getByRole('button', {name: 'Remove the filter Email: ben@'}),
    );

    await userEvent.click(filters.getByRole('button', {name: 'Country'}));
    const panel = screen.getByRole('dialog', {name: 'Country'});
    expect(
      within(panel)
        .getAllByRole('checkbox')
        .map((box) => box.closest('label')?.textContent),
    ).toEqual(['Colombia1', 'USA0']);
    await userEvent.click(
      within(panel).getByRole('checkbox', {name: /Colombia/}),
    );
    await waitFor(() =>
      expect(screen.queryAllByText('Ben Ruiz')).toHaveLength(0),
    );
    expect(
      listCalls(api).at(-1)?.url.searchParams.getAll('filter[country][]'),
    ).toEqual(['1']);
    expect(
      screen.getByText('Country: Colombia', {
        selector: '.kf-active-filters__text',
      }),
    ).toBeInTheDocument();
  });

  it('shows the country of the first address in its column', async () => {
    fakeApi({'GET /customers': [200, page([ANA])]});
    renderPage();

    const row = await screen.findByRole('row', {name: /ana@kf\.test/});
    expect(within(row).getByRole('cell', {name: 'Colombia'})).toHaveAttribute(
      'data-label',
      'Country',
    );
  });
});
