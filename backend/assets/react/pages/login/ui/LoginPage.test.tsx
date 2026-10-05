import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {SessionProvider} from '@/entities/session';
import {fakeApi} from '@/shared/test/fakeApi';
import {LoginPage} from './LoginPage';

function renderLogin() {
  render(
    <SessionProvider>
      <MemoryRouter initialEntries={['/admin/login']}>
        <Routes>
          <Route path="/admin/login" element={<LoginPage />} />
          <Route path="/admin/products" element={<p>products page</p>} />
        </Routes>
      </MemoryRouter>
    </SessionProvider>,
  );
}

describe('LoginPage', () => {
  it('signs in and opens the product list', async () => {
    const api = fakeApi({
      'GET /auth/me': [401, {error: 'unauthorized', message: 'Sign in first.'}],
      'POST /auth/login': [
        200,
        {
          id: 1,
          username: 'ana',
          name: 'Ana',
          email: 'ana@kf.test',
          roles: ['ROLE_USER'],
        },
      ],
    });
    renderLogin();

    await userEvent.type(await screen.findByLabelText('Username'), 'ana');
    await userEvent.type(screen.getByLabelText('Password'), 'secret');
    await userEvent.click(screen.getByLabelText('Remember me'));
    await userEvent.click(screen.getByRole('button', {name: 'Log In'}));

    expect(await screen.findByText('products page')).toBeInTheDocument();
    expect(api.calls.find((c) => c.method === 'POST')?.body).toEqual({
      username: 'ana',
      password: 'secret',
      remember_me: true,
    });
  });

  it('says the username or password is wrong, without saying which', async () => {
    fakeApi({
      'GET /auth/me': [401, {error: 'unauthorized', message: 'Sign in first.'}],
      'POST /auth/login': [
        401,
        {error: 'invalid_credentials', message: 'Wrong username or password.'},
      ],
    });
    renderLogin();

    await userEvent.type(await screen.findByLabelText('Username'), 'ana');
    await userEvent.type(screen.getByLabelText('Password'), 'nope');
    await userEvent.click(screen.getByRole('button', {name: 'Log In'}));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Wrong username or password.',
    );
  });

  it('keeps Log In disabled until both fields are filled', async () => {
    fakeApi({'GET /auth/me': [401, {error: 'unauthorized', message: ''}]});
    renderLogin();

    expect(await screen.findByRole('button', {name: 'Log In'})).toBeDisabled();
  });
});
