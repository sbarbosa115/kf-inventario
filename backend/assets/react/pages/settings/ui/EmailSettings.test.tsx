import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import {SessionProvider} from '@/entities/session';
import {fakeApi} from '@/shared/test/fakeApi';
import {ToastProvider} from '@/shared/ui';
import {EmailSettings} from './EmailSettings';

const FROM_ENV = {
  dsn_host: null,
  dsn_port: null,
  dsn_user: null,
  has_password: false,
  encryption: 'tls',
  from_address: 'orders@klassicfab.com',
  from_name: 'KF Orders',
  printer_address: 'printer@klassicfab.com',
  cc: ['sales@klassicfab.com'],
  source: {dsn: 'env', from: 'env', printer: 'env', cc: 'env'},
  env_host: 'mailpit',
};

const FROM_SETTINGS = {
  ...FROM_ENV,
  dsn_host: 'smtp.example.com',
  dsn_port: 587,
  dsn_user: 'mailer',
  has_password: true,
  source: {dsn: 'settings', from: 'settings', printer: 'env', cc: 'settings'},
};

const ME: Record<string, [number, unknown]> = {
  'GET /auth/me': [
    200,
    {
      id: 1,
      username: 'admin',
      email: 'admin@example.com',
      roles: ['ROLE_ADMIN'],
    },
  ],
};

const serve = (routes: Record<string, [number, unknown?]>) =>
  fakeApi({...ME, ...routes});

function renderTab() {
  render(
    <MemoryRouter>
      <SessionProvider>
        <ToastProvider>
          <EmailSettings />
        </ToastProvider>
      </SessionProvider>
    </MemoryRouter>,
  );
}

describe('Settings › Email', () => {
  it('shows where each value comes from, with the server host while the env is used', async () => {
    serve({'GET /settings/email': [200, FROM_ENV]});
    renderTab();

    expect(
      await screen.findByText(/MAILER_DSN from the server is used \(mailpit\)/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Sender address')).toHaveValue(
      'orders@klassicfab.com',
    );
    // Sender, printer and cc each name their source.
    expect(screen.getAllByText("From the server's environment")).toHaveLength(
      3,
    );
  });

  it('shows the saved server and never a password, only that one is saved', async () => {
    serve({'GET /settings/email': [200, FROM_SETTINGS]});
    renderTab();

    expect(await screen.findByLabelText('Host')).toHaveValue(
      'smtp.example.com',
    );
    expect(screen.getByLabelText('Port')).toHaveValue(587);
    expect(screen.getByLabelText('User')).toHaveValue('mailer');
    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(screen.getByText('A password is saved')).toBeInTheDocument();
    expect(screen.getByText(/Leave blank to keep the current/)).toBeVisible();
  });

  it('keeps the password when it is left blank: it is not sent, and the toast says it saved', async () => {
    const api = serve({
      'GET /settings/email': [200, FROM_SETTINGS],
      'PUT /settings/email': [200, FROM_SETTINGS],
    });
    renderTab();

    const user = await screen.findByLabelText('User');
    await userEvent.clear(user);
    await userEvent.type(user, 'mailer2');
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Email settings saved.',
    );
    const put = api.calls.find((call) => call.method === 'PUT');
    expect(put?.body).toEqual({
      host: 'smtp.example.com',
      port: 587,
      user: 'mailer2',
      encryption: 'tls',
      from_address: 'orders@klassicfab.com',
      from_name: 'KF Orders',
      printer_address: 'printer@klassicfab.com',
      cc: ['sales@klassicfab.com'],
    });
    expect(put?.body).not.toHaveProperty('password');
    expect(screen.getByLabelText('Password')).toHaveValue('');
  });

  it('sends a typed password once and clears the field afterwards', async () => {
    const api = serve({
      'GET /settings/email': [200, FROM_ENV],
      'PUT /settings/email': [200, FROM_SETTINGS],
    });
    renderTab();

    await userEvent.type(
      await screen.findByLabelText('Host'),
      'smtp.example.com',
    );
    await userEvent.type(screen.getByLabelText('Port'), '587');
    await userEvent.type(screen.getByLabelText('Password'), 's3cret');
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    expect(await screen.findByText('A password is saved')).toBeInTheDocument();
    expect(api.calls.find((call) => call.method === 'PUT')?.body).toMatchObject(
      {host: 'smtp.example.com', port: 587, password: 's3cret'},
    );
    expect(screen.getByLabelText('Password')).toHaveValue('');
  });

  it('warns that a blank password saves none once the host is changed', async () => {
    serve({'GET /settings/email': [200, FROM_SETTINGS]});
    renderTab();

    const host = await screen.findByLabelText('Host');
    await userEvent.clear(host);
    await userEvent.type(host, 'other.example.com');

    expect(
      screen.getByText(/The host changed: a blank password saves none\./),
    ).toBeInTheDocument();
  });

  it('refuses a bad address or port in place, without calling the API', async () => {
    const api = serve({'GET /settings/email': [200, FROM_ENV]});
    renderTab();

    const from = await screen.findByLabelText('Sender address');
    await userEvent.clear(from);
    await userEvent.type(from, 'not-an-address');
    await userEvent.type(screen.getByLabelText('Port'), '70000');
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    expect(
      screen.getByText('Enter a valid email address.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('The port is a number from 1 to 65535.'),
    ).toBeInTheDocument();
    expect(api.calls.filter((call) => call.method === 'PUT')).toEqual([]);
  });

  it('shows the API’s own message on the field it names', async () => {
    serve({
      'GET /settings/email': [200, FROM_ENV],
      'PUT /settings/email': [
        422,
        {
          error: 'validation_failed',
          violations: [{field: 'printer_address', message: 'No es válida.'}],
        },
      ],
    });
    renderTab();

    await userEvent.click(await screen.findByRole('button', {name: 'Save'}));

    expect(await screen.findByText('No es válida.')).toBeInTheDocument();
  });

  it('adds and removes cc addresses as chips', async () => {
    const api = serve({
      'GET /settings/email': [200, FROM_ENV],
      'PUT /settings/email': [200, FROM_ENV],
    });
    renderTab();

    await userEvent.type(
      await screen.findByLabelText('Add address'),
      'boss@klassicfab.com{Enter}',
    );
    await userEvent.click(
      screen.getByRole('button', {name: 'Remove sales@klassicfab.com'}),
    );
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    await screen.findByRole('status');
    expect(api.calls.find((call) => call.method === 'PUT')?.body).toMatchObject(
      {cc: ['boss@klassicfab.com']},
    );
  });

  it('opens the test email panel from "Send test email"', async () => {
    serve({'GET /settings/email': [200, FROM_SETTINGS]});
    renderTab();

    await userEvent.click(
      await screen.findByRole('button', {name: 'Send test email'}),
    );

    const dialog = screen.getByRole('dialog', {name: 'Send test email'});
    expect(within(dialog).getByLabelText('Send to')).toHaveValue(
      'admin@example.com',
    );
  });
});
