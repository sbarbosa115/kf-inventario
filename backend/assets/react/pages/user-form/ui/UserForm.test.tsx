import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter, Route, Routes, useLocation} from 'react-router-dom';
import {fakeApi} from '@/shared/test/fakeApi';
import {UserFormPage} from './UserFormPage';

function ListStub() {
  const state = useLocation().state as {saved?: string} | null;
  return <p>users list, saved: {state?.saved ?? 'nothing'}</p>;
}

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/users" element={<ListStub />} />
        <Route path="/admin/users/new" element={<UserFormPage />} />
        <Route path="/admin/users/:id/edit" element={<UserFormPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const ANA = {
  id: 7,
  name: 'Ana Gomez',
  username: 'ana',
  email: 'ana@kf.test',
  roles: ['ROLE_MANAGE_ORDERS'],
  enabled: true,
};

async function fillNewUser() {
  await userEvent.type(await screen.findByLabelText('Name'), 'Nina Lopez');
  await userEvent.type(screen.getByLabelText('Email'), 'nina@kf.test');
  await userEvent.type(screen.getByLabelText('Username'), 'nina');
  await userEvent.type(screen.getByLabelText('Password'), 'first-pass');
}

describe('UserForm', () => {
  it('offers the nine roles of the legacy form as checkboxes', async () => {
    fakeApi({});
    renderAt('/admin/users/new');

    expect(
      await screen.findByRole('heading', {name: 'Add User'}),
    ).toBeInTheDocument();
    const roles = screen.getAllByRole('checkbox');
    expect(roles).toHaveLength(9);
    expect(
      screen.getByRole('checkbox', {name: 'ROLE_UPDATE_INVOICES'}),
    ).not.toBeChecked();
    expect(
      screen.queryByRole('checkbox', {name: 'ROLE_MANAGE_CUSTOMERS'}),
    ).not.toBeInTheDocument();
  });

  it('creates a user with the roles ticked and goes back to the list with a confirmation', async () => {
    const api = fakeApi({
      'POST /users': [201, {...ANA, id: 8, name: 'Nina Lopez'}],
    });
    renderAt('/admin/users/new');
    await fillNewUser();
    await userEvent.click(
      screen.getByRole('checkbox', {name: 'ROLE_MANAGE_ORDERS'}),
    );
    await userEvent.click(
      screen.getByRole('checkbox', {name: 'ROLE_CAN_READ_INVOICES'}),
    );
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'Disabled');
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    expect(
      await screen.findByText('users list, saved: created'),
    ).toBeInTheDocument();
    expect(api.calls[0]!.body).toEqual({
      name: 'Nina Lopez',
      username: 'nina',
      email: 'nina@kf.test',
      password: 'first-pass',
      roles: ['ROLE_MANAGE_ORDERS', 'ROLE_CAN_READ_INVOICES'],
      enabled: false,
    });
  });

  it('does not ask the server while a required field is empty, and says which', async () => {
    const api = fakeApi({});
    renderAt('/admin/users/new');
    await userEvent.type(await screen.findByLabelText('Name'), 'Nina');
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    expect(screen.getByLabelText('Email')).toBeInvalid();
    expect(screen.getByLabelText('Username')).toBeInvalid();
    expect(screen.getByLabelText('Password')).toBeInvalid();
    expect(screen.getByLabelText('Name')).toBeValid();
    expect(api.calls).toHaveLength(0);
  });

  it('shows what the server refused on the field it belongs to', async () => {
    fakeApi({
      'POST /users': [
        422,
        {
          error: 'validation_failed',
          message: 'Validation error',
          violations: [
            {
              field: 'email',
              message: 'This value is not a valid email address.',
            },
          ],
        },
      ],
    });
    renderAt('/admin/users/new');
    await fillNewUser();
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    expect(
      await screen.findByText('This value is not a valid email address.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInvalid();
    expect(screen.getByRole('button', {name: 'Save'})).toBeEnabled();
  });

  it('fills an edit from the user, leaves the password blank and keeps it when it stays blank', async () => {
    const api = fakeApi({
      'GET /users/7': [200, ANA],
      'PUT /users/7': [200, {...ANA, name: 'Ana Maria'}],
    });
    renderAt('/admin/users/7/edit');

    const name = await screen.findByLabelText('Name');
    expect(name).toHaveValue('Ana Gomez');
    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(
      screen.getByText('Leave blank to keep the current password.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', {name: 'ROLE_MANAGE_ORDERS'}),
    ).toBeChecked();
    await userEvent.clear(name);
    await userEvent.type(name, 'Ana Maria');
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    expect(
      await screen.findByText('users list, saved: updated'),
    ).toBeInTheDocument();
    const put = api.calls.find((call) => call.method === 'PUT')!;
    expect(put.body).not.toHaveProperty('password');
    expect(put.body).toMatchObject({
      name: 'Ana Maria',
      roles: ['ROLE_MANAGE_ORDERS'],
    });
  });

  it('sends a new password when one is typed on an edit', async () => {
    const api = fakeApi({
      'GET /users/7': [200, ANA],
      'PUT /users/7': [200, ANA],
    });
    renderAt('/admin/users/7/edit');
    await userEvent.type(await screen.findByLabelText('Password'), 'brand-new');
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    await screen.findByText('users list, saved: updated');
    expect(api.calls.find((call) => call.method === 'PUT')!.body).toMatchObject(
      {password: 'brand-new'},
    );
  });

  it('says so when the user no longer exists', async () => {
    fakeApi({
      'GET /users/99': [
        404,
        {error: 'user_not_found', message: 'User not found.'},
      ],
    });
    renderAt('/admin/users/99/edit');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This user no longer exists.',
    );
    expect(
      screen.getByRole('link', {name: 'Back to the users'}),
    ).toHaveAttribute('href', '/admin/users');
  });

  it('cancels back to the list without saving', async () => {
    const api = fakeApi({});
    renderAt('/admin/users/new');
    await userEvent.click(await screen.findByRole('link', {name: 'Cancel'}));

    expect(screen.getByText('users list, saved: nothing')).toBeInTheDocument();
    expect(api.calls).toHaveLength(0);
  });
});
