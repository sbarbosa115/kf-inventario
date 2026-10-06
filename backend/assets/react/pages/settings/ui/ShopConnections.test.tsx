import {render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import type {ShopConnection} from '@/entities/shop-connection';
import {fakeApi} from '@/shared/test/fakeApi';
import {ToastProvider} from '@/shared/ui';
import {ShopConnections} from './ShopConnections';

const NEVER = {
  last_webhook_at: null,
  last_import_at: null,
  last_pull_at: null,
  last_pull_ok_at: null,
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
    warehouse: {id: 2, name: 'Usa'},
    email_printer: false,
    capabilities: {order_status: true, order_note: false},
    webhook_url: `https://kf.test/webhooks/shops/token${id}`,
    has_keys: true,
    health: {...NEVER, ...health},
    webhook_secret: null,
    ...extra,
  };
}

const NO_LEGACY_HITS = {
  legacy_hits: 0,
  legacy_last_hit_at: null,
};

const KFVINTAGE = aShop(
  4,
  'Kfvintage',
  {
    last_webhook_at: '2026-10-06T09:00:00-05:00',
    last_import_at: '2026-10-06T09:00:00-05:00',
    last_failure_at: '2026-10-06T10:00:00-05:00',
    last_failure_code: 'unknown_product',
    last_failure: 'Unknown product KF-99',
    failed_deliveries: 2,
    failed_pushes: 1,
  },
  {email_printer: true},
);
const OLD = aShop(5, 'Kfold', {}, {active: false});

function renderTab(routes: Parameters<typeof fakeApi>[0]) {
  const api = fakeApi({
    'GET /settings/webhooks': [200, NO_LEGACY_HITS],
    ...routes,
  });
  render(
    <MemoryRouter initialEntries={['/admin/settings/shops']}>
      <ToastProvider>
        <Routes>
          <Route path="/admin/settings/shops" element={<ShopConnections />} />
          <Route path="/admin/settings/shops/new" element={<p>new form</p>} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
  return api;
}

const card = async (name: string) =>
  (await screen.findByRole('heading', {name})).closest('article')!;

const openMenu = async (name: string) =>
  userEvent.click(
    await screen.findByRole('button', {name: `Actions for ${name}`}),
  );

describe('ShopConnections', () => {
  it('explains the cutover when there is no connection yet, with the way to add one', async () => {
    renderTab({'GET /shops': [200, []]});

    expect(
      await screen.findByText(/Create one connection per shop/),
    ).toHaveTextContent(
      'Create one connection per shop, paste its webhook URL and secret in WooCommerce, then test it.',
    );
    const links = screen.getAllByRole('link', {name: 'Add connection'});
    expect(links[0]).toHaveAttribute('href', '/admin/settings/shops/new');
  });

  it('shows a card per connection: its site, state, warehouse, printing and health', async () => {
    renderTab({'GET /shops': [200, [KFVINTAGE, OLD]]});

    const kfvintage = await card('Kfvintage');
    expect(
      within(kfvintage).getByText('https://kfvintage.example.com'),
    ).toHaveClass('kf-mono');
    expect(within(kfvintage).getByText('Active')).toHaveClass('kf-badge');
    expect(within(kfvintage).getByText('Usa')).toBeInTheDocument();
    expect(within(kfvintage).getByText('Prints orders')).toBeInTheDocument();
    const health = within(kfvintage).getByRole('list', {
      name: 'Connection health',
    });
    expect(within(health).getByText('Last webhook')).toBeInTheDocument();
    expect(within(health).getByText('Last order imported')).toBeInTheDocument();
    // Never checked: says so instead of a blank.
    expect(
      within(health).getByText('Last check').nextElementSibling,
    ).toHaveTextContent('Never');
    const failure = within(health).getByText('Last failure').parentElement!;
    expect(failure).toHaveClass('is-danger');
    expect(failure).toHaveTextContent('Unknown product');
    expect(failure).toHaveTextContent('Unknown product KF-99');

    const old = await card('Kfold');
    expect(within(old).getByText('Inactive')).toBeInTheDocument();
    expect(within(old).queryByText('Prints orders')).not.toBeInTheDocument();
    expect(
      within(old).getByText('Last failure').nextElementSibling,
    ).toHaveTextContent('None');
  });

  it('links the failed deliveries and updates counters to where they are fixed', async () => {
    renderTab({'GET /shops': [200, [KFVINTAGE, OLD]]});

    const kfvintage = await card('Kfvintage');
    expect(
      within(kfvintage).getByRole('link', {name: '2 failed deliveries'}),
    ).toHaveAttribute('href', '/admin/settings/shops/4/deliveries');
    expect(
      within(kfvintage).getByRole('link', {name: '1 failed update'}),
    ).toHaveAttribute('href', '/admin/settings/shops/4#failed-updates');
    const old = await card('Kfold');
    expect(within(old).queryByRole('link', {name: /failed/})).toBeNull();
  });

  it('has Add connection as the primary action', async () => {
    renderTab({'GET /shops': [200, [KFVINTAGE]]});
    await card('Kfvintage');

    const add = screen.getByRole('link', {name: 'Add connection'});
    expect(add).toHaveAttribute('href', '/admin/settings/shops/new');
    expect(add).toHaveClass('kf-btn--primary');
  });

  it('offers Edit, Test connection, Failed deliveries, Deactivate and Delete in the card menu', async () => {
    renderTab({'GET /shops': [200, [KFVINTAGE, OLD]]});

    await openMenu('Kfvintage');
    const items = screen.getAllByRole('menuitem');
    expect(items.map((item) => item.textContent?.trim())).toEqual([
      'Edit',
      'Test connection',
      'Failed deliveries',
      'Deactivate',
      'Delete',
    ]);
    expect(screen.getByRole('menuitem', {name: 'Edit'})).toHaveAttribute(
      'href',
      '/admin/settings/shops/4',
    );
    expect(
      screen.getByRole('menuitem', {name: 'Failed deliveries'}),
    ).toHaveAttribute('href', '/admin/settings/shops/4/deliveries');
    await userEvent.keyboard('{Escape}');

    await openMenu('Kfold');
    expect(
      screen.getByRole('menuitem', {name: 'Activate'}),
    ).toBeInTheDocument();
  });

  it('tests a connection with its saved keys and says what the shop answered', async () => {
    const api = renderTab({
      'GET /shops': [200, [KFVINTAGE]],
      'POST /shops/4/test': [
        200,
        {
          rest: {
            ok: true,
            store_name: 'KF Vintage',
            wc_version: '8.9.0',
            can_write: null,
            error: null,
          },
          webhook_url: KFVINTAGE.webhook_url,
          webhook_secret_set: true,
        },
      ],
    });

    await openMenu('Kfvintage');
    await userEvent.click(
      screen.getByRole('menuitem', {name: 'Test connection'}),
    );

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Kfvintage answered: KF Vintage, WooCommerce 8.9.0.',
    );
    expect(api.calls.find((c) => c.path === '/shops/4/test')?.body).toEqual({});
  });

  it('says why a test failed, in a toast that stays', async () => {
    renderTab({
      'GET /shops': [200, [KFVINTAGE]],
      'POST /shops/4/test': [
        200,
        {
          rest: {ok: false, error: 'Consumer key is invalid.'},
          webhook_url: KFVINTAGE.webhook_url,
          webhook_secret_set: true,
        },
      ],
    });

    await openMenu('Kfvintage');
    await userEvent.click(
      screen.getByRole('menuitem', {name: 'Test connection'}),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Kfvintage did not answer: Consumer key is invalid.',
    );
  });

  it('deactivates a connection keeping its keys, and reloads the cards', async () => {
    let shops = [KFVINTAGE];
    const api = renderTab({
      'GET /shops': () => [200, shops],
      'PUT /shops/4': (body) => {
        shops = [{...KFVINTAGE, active: false}];
        return [200, {...KFVINTAGE, ...(body as object), active: false}];
      },
    });

    await openMenu('Kfvintage');
    await userEvent.click(screen.getByRole('menuitem', {name: 'Deactivate'}));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Kfvintage is inactive. Its deliveries are kept in the failed deliveries.',
    );
    expect(api.calls.find((c) => c.method === 'PUT')?.body).toEqual({
      name: 'Kfvintage',
      site_url: 'https://kfvintage.example.com',
      warehouse_id: 2,
      email_printer: true,
      active: false,
      capabilities: {order_status: true, order_note: false},
    });
    const kfvintage = await card('Kfvintage');
    await waitFor(() =>
      expect(within(kfvintage).getByText('Inactive')).toBeInTheDocument(),
    );
  });

  it('deletes a connection after asking', async () => {
    let shops = [KFVINTAGE, OLD];
    renderTab({
      'GET /shops': () => [200, shops],
      'DELETE /shops/5': () => {
        shops = [KFVINTAGE];
        return [204];
      },
    });

    await openMenu('Kfold');
    await userEvent.click(screen.getByRole('menuitem', {name: 'Delete'}));
    const dialog = screen.getByRole('dialog', {name: 'Delete Kfold?'});
    await userEvent.click(
      within(dialog).getByRole('button', {name: 'Delete connection'}),
    );

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Connection Kfold deleted.',
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', {name: 'Kfold'}),
      ).not.toBeInTheDocument(),
    );
  });

  it('offers to deactivate a connection that orders came from instead of deleting it', async () => {
    const api = renderTab({
      'GET /shops': [200, [KFVINTAGE]],
      'DELETE /shops/4': [
        409,
        {error: 'shop_has_orders', message: 'Orders came from it'},
      ],
      'PUT /shops/4': [200, {...KFVINTAGE, active: false}],
    });

    await openMenu('Kfvintage');
    await userEvent.click(screen.getByRole('menuitem', {name: 'Delete'}));
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Delete connection',
      }),
    );

    const dialog = await screen.findByRole('dialog', {
      name: 'Kfvintage cannot be deleted',
    });
    expect(dialog).toHaveTextContent(
      'Orders came from this connection. Deactivate it instead: it stops receiving orders and its orders keep its name.',
    );
    await userEvent.click(
      within(dialog).getByRole('button', {name: 'Deactivate'}),
    );

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Kfvintage is inactive.',
    );
    expect(api.calls.find((c) => c.method === 'PUT')?.body).toMatchObject({
      active: false,
    });
  });

  it('warns when the old webhook URL is still reached', async () => {
    renderTab({
      'GET /shops': [200, [KFVINTAGE]],
      'GET /settings/webhooks': [
        200,
        {
          legacy_hits: 3,
          legacy_last_hit_at: '2026-10-06T10:00:00-05:00',
        },
      ],
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The old webhook URL received 3 deliveries since the deploy: a shop still points at it.',
    );
  });
});
