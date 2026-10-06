import {render, screen, within} from '@testing-library/react';
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
        {legacy_hits: 0, legacy_last_hit_at: null},
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

  it('shows the old webhook URL as retired, with no switch', async () => {
    fakeApi({
      'GET /settings/email': [200, EMAIL],
      'GET /settings/webhooks': [
        200,
        {legacy_hits: 0, legacy_last_hit_at: null},
      ],
    });
    renderAt('/admin/settings');

    expect(
      await screen.findByText('Nothing reached it since the deploy.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/answers 410 and places nothing/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: /old webhook URL/})).toBeNull();
  });

  it('counts what still reaches the old webhook URL', async () => {
    fakeApi({
      'GET /settings/email': [200, EMAIL],
      'GET /settings/webhooks': [
        200,
        {legacy_hits: 3, legacy_last_hit_at: '2026-10-06T10:00:00-05:00'},
      ],
    });
    renderAt('/admin/settings');

    expect(
      await screen.findByText(
        /^3 deliveries reached it since the deploy, the last on /,
      ),
    ).toHaveTextContent(/a shop still points at it\.$/);
  });

  it('shows the shop connections on their tab', async () => {
    fakeApi({
      'GET /shops': [200, []],
      'GET /settings/webhooks': [
        200,
        {legacy_hits: 0, legacy_last_hit_at: null},
      ],
    });
    renderAt('/admin/settings/shops');

    expect(
      await screen.findByText('No shop connection yet'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', {name: 'Shop connections'}),
    ).toHaveAttribute('aria-current', 'page');
  });
});
