import {fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {SessionProvider} from '@/entities/session';
import {I18nProvider} from '@/shared/i18n';
import {fakeApi} from '@/shared/test/fakeApi';
import {LoginPage} from './LoginPage';

function renderLogin() {
  render(
    <I18nProvider locale="en">
      <SessionProvider>
        <MemoryRouter initialEntries={['/admin/login']}>
          <Routes>
            <Route path="/admin/login" element={<LoginPage />} />
            <Route path="/admin/products" element={<p>products page</p>} />
          </Routes>
        </MemoryRouter>
      </SessionProvider>
    </I18nProvider>,
  );
}

const signedOut: Record<string, [number, unknown]> = {
  'GET /auth/me': [401, {error: 'unauthorized', message: 'Sign in first.'}],
};

describe('LoginPage', () => {
  afterEach(() => localStorage.clear());

  it('signs in and opens the product list', async () => {
    const api = fakeApi({
      ...signedOut,
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

    expect(
      await screen.findByRole('heading', {level: 1, name: 'Sign in'}),
    ).toBeVisible();
    expect(document.title).toBe('Sign in · KF Inventory');
    await userEvent.type(screen.getByLabelText('Username'), 'ana');
    await userEvent.type(screen.getByLabelText('Password'), 'secret');
    await userEvent.click(screen.getByLabelText('Remember me'));
    await userEvent.click(screen.getByRole('button', {name: 'Sign in'}));

    expect(await screen.findByText('products page')).toBeInTheDocument();
    expect(api.calls.find((c) => c.method === 'POST')?.body).toEqual({
      username: 'ana',
      password: 'secret',
      remember_me: true,
    });
  });

  it('says the username or password is wrong, without saying which, above the button', async () => {
    fakeApi({
      ...signedOut,
      'POST /auth/login': [
        401,
        {error: 'invalid_credentials', message: 'Wrong username or password.'},
      ],
    });
    renderLogin();

    await userEvent.type(await screen.findByLabelText('Username'), 'ana');
    await userEvent.type(screen.getByLabelText('Password'), 'nope');
    await userEvent.click(screen.getByRole('button', {name: 'Sign in'}));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Wrong username or password.',
    );
    expect(screen.getByRole('button', {name: 'Sign in'})).toBeEnabled();
  });

  it('keeps the button usable and names what is missing instead', async () => {
    const api = fakeApi({...signedOut});
    renderLogin();

    const button = await screen.findByRole('button', {name: 'Sign in'});
    expect(button).toBeEnabled();
    await userEvent.click(button);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Type your username and password.',
    );
    expect(screen.getByLabelText('Username')).toHaveFocus();
    expect(api.calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('shows the password and warns about Caps Lock', async () => {
    fakeApi({...signedOut});
    renderLogin();

    const password = await screen.findByLabelText('Password');
    await userEvent.click(screen.getByRole('button', {name: 'Show password'}));
    expect(password).toHaveAttribute('type', 'text');
    fireEvent.keyDown(password, {key: 'A', modifierCapsLock: true});
    expect(screen.getByText('Caps Lock is on')).toBeInTheDocument();
  });

  it('switches to Spanish under the form', async () => {
    fakeApi({...signedOut});
    renderLogin();

    await userEvent.click(await screen.findByRole('radio', {name: 'Español'}));
    expect(
      screen.getByRole('heading', {level: 1, name: 'Iniciar sesión'}),
    ).toBeVisible();
    expect(screen.getByLabelText('Usuario')).toBeInTheDocument();
  });
});
