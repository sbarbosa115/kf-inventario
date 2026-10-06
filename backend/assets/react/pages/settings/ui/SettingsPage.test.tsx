import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {fakeApi} from '@/shared/test/fakeApi';
import {ToastProvider} from '@/shared/ui';
import {SettingsPage} from './SettingsPage';

const EMAIL = {
  dsn_host: null,
  dsn_port: null,
  dsn_user: null,
  has_password: false,
  encryption: 'tls',
  from_address: null,
  from_name: null,
  printer_address: null,
  cc: [],
  source: {dsn: 'env', from: 'env', printer: 'env', cc: 'env'},
  env_host: 'mailpit',
};

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <Routes>
          <Route path="/admin/settings/*" element={<SettingsPage />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('SettingsPage', () => {
  it('has the five tabs as links, General first and current', async () => {
    fakeApi({
      'GET /settings/email': [200, EMAIL],
      'GET /settings/webhooks': [
        200,
        {legacy_enabled: true, legacy_hits_since: 0, legacy_last_hit_at: null},
      ],
    });
    renderAt('/admin/settings');

    const tabs = screen.getByRole('navigation', {name: 'Settings sections'});
    expect(
      within(tabs)
        .getAllByRole('link')
        .map((link) => [link.textContent, link.getAttribute('href')]),
    ).toEqual([
      ['General', '/admin/settings'],
      ['Email', '/admin/settings/email'],
      ['Analytics', '/admin/settings/analytics'],
      ['Shop connections', '/admin/settings/shops'],
      ['Quick phrases', '/admin/settings/phrases'],
    ]);
    expect(within(tabs).getByRole('link', {name: 'General'})).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(
      await screen.findByText(/The server's MAILER_DSN/),
    ).toBeInTheDocument();
    expect(screen.getByText('(mailpit)')).toBeInTheDocument();
  });

  it('turns the old webhook URL off after asking, and shows what reached it since', async () => {
    const api = fakeApi({
      'GET /settings/email': [200, EMAIL],
      'GET /settings/webhooks': [
        200,
        {legacy_enabled: true, legacy_hits_since: 0, legacy_last_hit_at: null},
      ],
      'PUT /settings/webhooks': [
        200,
        {legacy_enabled: false, legacy_hits_since: 0, legacy_last_hit_at: null},
      ],
    });
    renderAt('/admin/settings');

    await userEvent.click(
      await screen.findByRole('button', {name: 'Turn off the old webhook URL'}),
    );
    const dialog = screen.getByRole('dialog', {
      name: 'Turn off the old webhook URL?',
    });
    expect(dialog).toHaveTextContent('Shops still posting there will get 410');
    await userEvent.click(
      within(dialog).getByRole('button', {
        name: 'Turn off the old webhook URL',
      }),
    );

    expect(
      await screen.findByText('Nothing reached it since it was turned off.'),
    ).toBeInTheDocument();
    expect(api.calls.at(-1)?.body).toEqual({legacy_enabled: false});
    expect(screen.getByRole('status')).toHaveTextContent(
      'The old webhook URL is off.',
    );
  });

  it('shows the tabs other items build as not ready yet', () => {
    fakeApi({});
    renderAt('/admin/settings/shops');

    expect(
      screen.getByText('This section is not ready yet.'),
    ).toBeInTheDocument();
  });
});
