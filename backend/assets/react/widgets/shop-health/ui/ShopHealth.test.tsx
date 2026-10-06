import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import type {ShopConnection} from '@/entities/shop-connection';
import {fakeApi} from '@/shared/test/fakeApi';
import {ShopHealth} from './ShopHealth';

const HEALTHY = {
  last_webhook_at: '2026-10-06T09:00:00-05:00',
  last_import_at: '2026-10-06T09:00:00-05:00',
  last_pull_at: '2026-10-06T09:15:00-05:00',
  last_pull_ok_at: '2026-10-06T09:15:00-05:00',
  last_failure_at: null,
  last_failure_code: null,
  last_failure: null,
  failed_deliveries: 0,
  failed_pushes: 0,
};

function aShop(
  id: number,
  name: string,
  health: Partial<ShopConnection['health']> = {},
  extra: Partial<ShopConnection> = {},
): ShopConnection {
  return {
    id,
    name,
    site_url: `https://${name.toLowerCase()}.example.com`,
    active: true,
    warehouse: {id: 1, name: 'Colombia'},
    email_printer: false,
    capabilities: {order_status: true, order_note: false},
    webhook_url: `https://kf.test/webhooks/shops/token${id}`,
    has_keys: true,
    health: {...HEALTHY, ...health},
    webhook_secret: null,
    ...extra,
  };
}

const NO_LEGACY_HITS = {
  legacy_hits: 0,
  legacy_last_hit_at: null,
};

function renderHealth(
  shops: ShopConnection[],
  webhooks: Record<string, unknown> = NO_LEGACY_HITS,
) {
  const api = fakeApi({
    'GET /shops': [200, shops],
    'GET /settings/webhooks': [200, webhooks],
  });
  const view = render(
    <MemoryRouter>
      <ShopHealth refreshKey={0} />
      <p>after</p>
    </MemoryRouter>,
  );
  return {api, view};
}

const settled = () => screen.findByText('after');

describe('ShopHealth', () => {
  it('shows nothing while every active connection is healthy', async () => {
    const {api} = renderHealth([
      aShop(1, 'Kfvintage'),
      // A failure older than the last success is over.
      aShop(2, 'Klassicfab', {
        last_failure_at: '2026-10-06T08:00:00-05:00',
        last_failure_code: 'pull_failed',
      }),
    ]);
    await settled();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(
      screen.queryByRole('region', {name: 'Shop connections'}),
    ).not.toBeInTheDocument();
    expect(api.calls.map((c) => c.path)).toEqual([
      '/shops',
      '/settings/webhooks',
    ]);
  });

  it('warns about the orders a connection could not place, with a link to its failed deliveries', async () => {
    renderHealth([aShop(4, 'Kfvintage', {failed_deliveries: 2})]);

    const region = await screen.findByRole('region', {
      name: 'Shop connections',
    });
    expect(region).toHaveTextContent('Kfvintage: 2 orders could not be placed');
    expect(
      within(region).getByRole('link', {name: 'Fix in Settings'}),
    ).toHaveAttribute('href', '/admin/settings/shops/4/deliveries');
  });

  it('warns about a failure newer than the last success, and updates that did not reach the shop', async () => {
    renderHealth([
      aShop(5, 'Klassicfab', {
        last_failure_at: '2026-10-06T10:00:00-05:00',
        last_failure_code: 'keys_read_only',
        last_failure: 'Sorry, you cannot edit this resource.',
        failed_pushes: 1,
      }),
    ]);

    const region = await screen.findByRole('region', {
      name: 'Shop connections',
    });
    expect(region).toHaveTextContent(
      'Klassicfab: 1 update did not reach the shop · Keys are read-only',
    );
    expect(
      within(region).getByRole('link', {name: 'Fix in Settings'}),
    ).toHaveAttribute('href', '/admin/settings/shops/5');
  });

  it('leaves inactive connections out', async () => {
    renderHealth([
      aShop(
        6,
        'Kfold',
        {failed_deliveries: 3, last_failure_code: 'inactive'},
        {active: false},
      ),
    ]);
    await settled();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(
      screen.queryByRole('region', {name: 'Shop connections'}),
    ).not.toBeInTheDocument();
  });

  it('warns when the old webhook URL is still reached', async () => {
    renderHealth([aShop(1, 'Kfvintage')], {
      legacy_hits: 2,
      legacy_last_hit_at: '2026-10-06T10:00:00-05:00',
    });

    const region = await screen.findByRole('region', {
      name: 'Shop connections',
    });
    expect(region).toHaveTextContent(
      'The old webhook URL received 2 deliveries since the deploy: a shop still points at it.',
    );
    expect(
      within(region).getByRole('link', {name: 'Fix in Settings'}),
    ).toHaveAttribute('href', '/admin/settings');
  });

  it('folds several problems into one line that opens', async () => {
    renderHealth([
      aShop(4, 'Kfvintage', {failed_deliveries: 2}),
      aShop(5, 'Klassicfab', {failed_pushes: 1}),
    ]);

    const region = await screen.findByRole('region', {
      name: 'Shop connections',
    });
    expect(region).toHaveTextContent('2 shop problems need attention.');
    expect(within(region).queryByRole('link')).not.toBeInTheDocument();

    const toggle = within(region).getByRole('button', {name: 'Show'});
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);

    expect(within(region).getByRole('button', {name: 'Hide'})).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    const links = within(region).getAllByRole('link', {
      name: 'Fix in Settings',
    });
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/admin/settings/shops/4/deliveries',
      '/admin/settings/shops/5',
    ]);
    expect(region).toHaveTextContent('Kfvintage: 2 orders could not be placed');
    expect(region).toHaveTextContent(
      'Klassicfab: 1 update did not reach the shop',
    );
  });

  it('stays silent when the connections cannot be read', async () => {
    fakeApi({
      'GET /shops': [500, {error: 'internal_error'}],
      'GET /settings/webhooks': [200, NO_LEGACY_HITS],
    });
    render(
      <MemoryRouter>
        <ShopHealth refreshKey={0} />
      </MemoryRouter>,
    );
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
