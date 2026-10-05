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
  roles: ['ROLE_ADMIN', 'ROLE_MANAGE_USERS'],
  enabled: true,
};
const BEN = {
  id: 2,
  name: 'Ben Ruiz',
  username: 'ben',
  email: null,
  roles: ['ROLE_MANAGE_INVENTORY'],
  enabled: false,
};

function renderPage(state?: unknown) {
  render(
    <MemoryRouter initialEntries={[{pathname: '/admin/users', state}]}>
      <Routes>
        <Route path="/admin/users" element={<UsersPage />} />
        <Route path="/admin/users/new" element={<p>new user form</p>} />
        <Route path="/admin/users/:id/edit" element={<p>edit user form</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('UsersPage', () => {
  it('lists every user with their roles as badges and a way to edit them', async () => {
    fakeApi({'GET /users': [200, [ANA, BEN]]});
    renderPage();

    const row = (await screen.findByText('Ana Gomez')).closest('tr')!;
    expect(within(row).getByText('ana@kf.test')).toBeInTheDocument();
    expect(within(row).getByText('ROLE_ADMIN')).toHaveClass('badge');
    expect(within(row).getByText('ROLE_MANAGE_USERS')).toBeInTheDocument();
    expect(within(row).getByRole('link', {name: /Edit/})).toHaveAttribute(
      'href',
      '/admin/users/1/edit',
    );
  });

  it('opens the new user form from Create User', async () => {
    fakeApi({'GET /users': [200, [ANA]]});
    renderPage();

    await userEvent.click(
      await screen.findByRole('link', {name: /Create User/}),
    );

    expect(screen.getByText('new user form')).toBeInTheDocument();
  });

  it('says what the section is for when there are no users, and still offers Create User', async () => {
    fakeApi({'GET /users': [200, []]});
    renderPage();

    expect(
      await screen.findByText('There are no users yet. Create the first one.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', {name: /Create User/})).toBeInTheDocument();
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

  it('confirms a save the form just made', async () => {
    fakeApi({'GET /users': [200, [ANA]]});
    renderPage({saved: 'created'});

    expect(await screen.findByRole('status')).toHaveTextContent(
      'The user was created successfully.',
    );
  });
});
