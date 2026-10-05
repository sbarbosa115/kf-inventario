import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {fakeApi} from '@/shared/test/fakeApi';
import {UsersPage} from './UsersPage';

const ANA = {
  id: 1,
  name: 'Ana Gomez',
  username: 'ana',
  email: 'ana@kf.test',
  roles: ['ROLE_USER', 'ROLE_ADMIN', 'ROLE_MANAGE_USERS'],
  enabled: true,
};
const BEN = {
  id: 2,
  name: 'Ben Ruiz',
  username: 'ben',
  email: null,
  roles: ['ROLE_MANAGE_INVENTORY', 'ROLE_UPDATE_INVOICES'],
  enabled: false,
};

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/admin/users']}>
      <Routes>
        <Route path="/admin/users" element={<UsersPage />} />
        <Route path="/admin/users/new" element={<p>new user form</p>} />
        <Route path="/admin/users/:id/edit" element={<p>edit user form</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('UsersPage', () => {
  it('names the roles in plain words, never as ROLE_ constants, and leaves out ROLE_USER', async () => {
    fakeApi({'GET /users': [200, [ANA, BEN]]});
    renderPage();

    const ana = (await screen.findByRole('row', {name: /ana@kf\.test/}))!;
    expect(within(ana).getByText('Admin')).toHaveClass('kf-badge');
    expect(within(ana).getByText('Users')).toBeInTheDocument();
    const ben = screen.getByRole('row', {name: /Ben Ruiz/});
    expect(within(ben).getByText('Inventory')).toBeInTheDocument();
    expect(within(ben).getByText('Invoices: update')).toBeInTheDocument();
    expect(screen.queryByText(/ROLE_/)).not.toBeInTheDocument();
  });

  it('titles the page "Users" with the count, and the column is "Roles"', async () => {
    fakeApi({'GET /users': [200, [ANA, BEN]]});
    renderPage();

    expect(
      await screen.findByRole('heading', {name: 'Users'}),
    ).toBeInTheDocument();
    expect(screen.getByText('2 users')).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', {name: 'Roles'}),
    ).toBeInTheDocument();
  });

  it('says in words, not in colour alone, who is inactive', async () => {
    fakeApi({'GET /users': [200, [ANA, BEN]]});
    renderPage();

    const ben = await screen.findByRole('row', {name: /Ben Ruiz/});
    expect(within(ben).getByText('Inactive')).toBeInTheDocument();
    const ana = screen.getByRole('row', {name: /Ana Gomez/});
    expect(within(ana).getByText('Active')).toBeInTheDocument();
  });

  it('keeps one action in the row menu, Edit, and opens the form from it', async () => {
    fakeApi({'GET /users': [200, [ANA]]});
    renderPage();

    const row = await screen.findByRole('row', {name: /Ana Gomez/});
    expect(within(row).queryByRole('link', {name: /Edit/})).toBeNull();
    await userEvent.click(
      within(row).getByRole('button', {name: 'Actions for Ana Gomez'}),
    );
    const edit = screen.getByRole('menuitem', {name: 'Edit'});
    expect(edit).toHaveAttribute('href', '/admin/users/1/edit');
    await userEvent.click(edit);

    expect(screen.getByText('edit user form')).toBeInTheDocument();
  });

  it('opens the edit form when a row is clicked', async () => {
    fakeApi({'GET /users': [200, [ANA]]});
    renderPage();

    await userEvent.click(await screen.findByText('ana@kf.test'));

    expect(screen.getByText('edit user form')).toBeInTheDocument();
  });

  it('filters by status with the count on each chip', async () => {
    fakeApi({'GET /users': [200, [ANA, BEN]]});
    renderPage();

    await screen.findByText('Ana Gomez');
    const inactive = screen.getByRole('button', {name: /Inactive/});
    expect(inactive).toHaveTextContent('1');
    await userEvent.click(inactive);

    expect(screen.queryByText('Ana Gomez')).not.toBeInTheDocument();
    expect(screen.getByText('Ben Ruiz')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: /^All/}));
    expect(screen.getByText('Ana Gomez')).toBeInTheDocument();
  });

  it('finds a user by the plain name of a role', async () => {
    fakeApi({'GET /users': [200, [ANA, BEN]]});
    renderPage();

    await userEvent.type(await screen.findByRole('searchbox'), 'Invoices');

    expect(screen.queryByText('Ana Gomez')).not.toBeInTheDocument();
    expect(screen.getByText('Ben Ruiz')).toBeInTheDocument();
  });

  it('opens the new user form from Create user', async () => {
    fakeApi({'GET /users': [200, [ANA]]});
    renderPage();

    await userEvent.click(
      await screen.findByRole('link', {name: /Create user/}),
    );

    expect(screen.getByText('new user form')).toBeInTheDocument();
  });

  it('says what the section is for when there are no users, and still offers Create user', async () => {
    fakeApi({'GET /users': [200, []]});
    renderPage();

    expect(
      await screen.findByText('There are no users yet. Create the first one.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', {name: /Create user/})).toBeInTheDocument();
  });

  it('offers a way back when the search matches nobody', async () => {
    fakeApi({'GET /users': [200, [ANA, BEN]]});
    renderPage();

    await userEvent.type(await screen.findByRole('searchbox'), 'zzz');
    expect(
      screen.getByText('Nothing matches these filters.'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Show all'}));

    expect(screen.getByText('Ben Ruiz')).toBeInTheDocument();
  });

  it('shows the failure with a retry when the list cannot be loaded', async () => {
    const api = fakeApi({'GET /users': [500, {error: 'internal_error'}]});
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong on our side',
    );
    expect(api.calls).toHaveLength(1);
    expect(screen.getByRole('button', {name: 'Try again'})).toBeInTheDocument();
  });

  it('says so when the person may not see the users', async () => {
    fakeApi({'GET /users': [403, {error: 'forbidden', message: 'Forbidden'}]});
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'You do not have permission to do this.',
    );
  });
});
