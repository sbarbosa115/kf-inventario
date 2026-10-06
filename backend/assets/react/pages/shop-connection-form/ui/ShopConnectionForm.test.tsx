import {render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {vi} from 'vitest';
import type {ShopConnection} from '@/entities/shop-connection';
import {fakeApi} from '@/shared/test/fakeApi';
import {ToastProvider} from '@/shared/ui';
import {ShopConnectionFormPage} from './ShopConnectionFormPage';

const WAREHOUSES = [
  {id: 1, name: 'Colombia', urls: []},
  {id: 2, name: 'Usa', urls: []},
];

const SAVED: ShopConnection = {
  id: 4,
  name: 'Kfvintage',
  site_url: 'https://kfvintage.example.com',
  active: true,
  warehouse: {id: 2, name: 'Usa'},
  email_printer: false,
  capabilities: {order_status: true, order_note: false},
  webhook_url: 'https://kf.test/webhooks/shops/abc123',
  has_keys: true,
  health: {
    last_webhook_at: null,
    last_import_at: null,
    last_pull_at: null,
    last_pull_ok_at: null,
    last_failure_at: null,
    last_failure_code: null,
    last_failure: null,
    failed_deliveries: 0,
    failed_pushes: 0,
  },
  webhook_secret: null,
};

const SECRET = {
  webhook_secret: 'f00dfeedf00dfeed',
  webhook_url: SAVED.webhook_url,
};

const OK_TEST = {
  rest: {
    ok: true,
    store_name: 'KF Vintage',
    wc_version: '8.9.0',
    can_write: null,
    error: null,
  },
  webhook_url: SAVED.webhook_url,
  webhook_secret_set: true,
};

function renderAt(path: string, routes: Parameters<typeof fakeApi>[0]) {
  const api = fakeApi({
    'GET /warehouses': [200, WAREHOUSES],
    'GET /shops/4/outbox': [200, []],
    ...routes,
  });
  render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <Routes>
          <Route path="/admin/settings/shops" element={<p>the cards</p>} />
          <Route
            path="/admin/settings/shops/new"
            element={<ShopConnectionFormPage />}
          />
          <Route
            path="/admin/settings/shops/:id"
            element={<ShopConnectionFormPage />}
          />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
  return api;
}

const section = (name: string) => screen.getByRole('region', {name});

let clipboard: ReturnType<typeof vi.fn>;
beforeEach(() => {
  clipboard = vi.fn(() => Promise.resolve());
  Object.defineProperty(navigator, 'clipboard', {
    value: {writeText: clipboard},
    configurable: true,
  });
});

describe('ShopConnectionForm', () => {
  it('asks for a new connection in four sections, without a webhook until it is saved', async () => {
    renderAt('/admin/settings/shops/new', {});

    expect(
      await screen.findByRole('heading', {level: 1, name: 'Add connection'}),
    ).toBeInTheDocument();
    await screen.findByRole('option', {name: 'Usa'});
    expect(
      within(section('Shop')).getByLabelText('Name'),
    ).toBeInTheDocument();
    expect(within(section('Shop')).getByLabelText('Site URL')).toBeVisible();
    expect(
      within(section('Shop')).getByRole('switch', {name: 'Active'}),
    ).toBeChecked();
    const rest = section('WooCommerce REST API');
    expect(rest).toHaveTextContent(
      'WooCommerce › Settings › Advanced › REST API',
    );
    expect(within(rest).getByLabelText('Consumer key')).toBeInTheDocument();
    expect(within(rest).getByLabelText('Consumer secret')).toHaveAttribute(
      'type',
      'password',
    );
    expect(
      within(section('Orders')).getByLabelText('Warehouse'),
    ).toBeInTheDocument();
    expect(
      within(section('Orders')).getByRole('switch', {
        name: 'Email the printer',
      }),
    ).not.toBeChecked();
    const capabilities = section('What this app may update on the shop');
    expect(
      within(capabilities).getByRole('switch', {name: /Order status/}),
    ).not.toBeChecked();
    expect(
      within(capabilities).getByRole('switch', {name: /Order notes/}),
    ).not.toBeChecked();
    expect(
      screen.queryByRole('region', {name: 'Webhook'}),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Test connection'}),
    ).toBeDisabled();
    expect(
      screen.getByText('Save the connection first to test it.'),
    ).toBeInTheDocument();
  });

  it('refuses an empty form in place, without a request', async () => {
    const api = renderAt('/admin/settings/shops/new', {});
    await screen.findByRole('option', {name: 'Usa'});

    await userEvent.click(
      screen.getByRole('button', {name: 'Save connection'}),
    );

    expect(
      within(section('Shop')).getAllByText('Fill this in.'),
    ).toHaveLength(2);
    expect(
      within(section('Orders')).getByText('Choose a warehouse.'),
    ).toBeInTheDocument();
    expect(api.calls.filter((c) => c.method !== 'GET')).toHaveLength(0);
  });

  it('creates the connection, then shows its webhook URL and secret to paste, each with Copy', async () => {
    const created = {...SAVED, webhook_secret: SECRET.webhook_secret};
    const api = renderAt('/admin/settings/shops/new', {
      'POST /shops': [201, created],
      'GET /shops/4': [200, SAVED],
    });
    await screen.findByRole('option', {name: 'Usa'});

    await userEvent.type(screen.getByLabelText('Name'), 'Kfvintage');
    await userEvent.type(
      screen.getByLabelText('Site URL'),
      'https://kfvintage.example.com',
    );
    await userEvent.type(screen.getByLabelText('Consumer key'), 'ck_1');
    await userEvent.type(screen.getByLabelText('Consumer secret'), 'cs_1');
    await userEvent.selectOptions(screen.getByLabelText('Warehouse'), 'Usa');
    await userEvent.click(screen.getByRole('switch', {name: /Order status/}));
    await userEvent.click(
      screen.getByRole('button', {name: 'Save connection'}),
    );

    expect(api.calls.find((c) => c.method === 'POST')?.body).toEqual({
      name: 'Kfvintage',
      site_url: 'https://kfvintage.example.com',
      consumer_key: 'ck_1',
      consumer_secret: 'cs_1',
      warehouse_id: 2,
      email_printer: false,
      active: true,
      capabilities: {order_status: true, order_note: false},
    });
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Connection Kfvintage created. Paste its webhook URL and secret in WooCommerce.',
    );
    const webhook = await screen.findByRole('region', {name: 'Webhook'});
    expect(within(webhook).getByLabelText('Webhook URL')).toHaveValue(
      SAVED.webhook_url,
    );
    // The secret of the create answer is shown at once, without another request.
    expect(within(webhook).getByLabelText('Signing secret')).toHaveValue(
      SECRET.webhook_secret,
    );
    expect(api.calls.some((c) => c.path === '/shops/4/webhook-secret')).toBe(
      false,
    );
    await userEvent.click(
      within(webhook).getByRole('button', {name: 'Copy signing secret'}),
    );
    expect(clipboard).toHaveBeenCalledWith(SECRET.webhook_secret);
    expect(webhook).toHaveTextContent('Topic Order created');
    expect(
      screen.getByRole('button', {name: 'Test connection'}),
    ).toBeEnabled();
  });

  it('edits a connection: blank keys are not sent, so the saved ones stay', async () => {
    const api = renderAt('/admin/settings/shops/4', {
      'GET /shops/4': [200, SAVED],
      'PUT /shops/4': (body) => [200, {...SAVED, ...(body as object)}],
    });

    expect(await screen.findByLabelText('Name')).toHaveValue('Kfvintage');
    expect(
      screen.getByRole('heading', {level: 1, name: 'Edit connection'}),
    ).toBeInTheDocument();
    expect(section('WooCommerce REST API')).toHaveTextContent(
      'Keys are saved. Leave both blank to keep them.',
    );
    expect(screen.getByLabelText('Consumer key')).toHaveValue('');
    await waitFor(() =>
      expect(screen.getByLabelText('Warehouse')).toHaveValue('2'),
    );
    expect(
      screen.getByRole('switch', {name: /Order status/}),
    ).toBeChecked();
    await userEvent.click(screen.getByRole('switch', {name: /Order notes/}));
    await userEvent.click(
      screen.getByRole('switch', {name: 'Email the printer'}),
    );
    await userEvent.click(
      screen.getByRole('button', {name: 'Save connection'}),
    );

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Connection Kfvintage saved.',
    );
    expect(api.calls.find((c) => c.method === 'PUT')?.body).toEqual({
      name: 'Kfvintage',
      site_url: 'https://kfvintage.example.com',
      warehouse_id: 2,
      email_printer: true,
      active: true,
      capabilities: {order_status: true, order_note: true},
    });
  });

  it('shows the server’s refusals under their fields', async () => {
    let answer: [number, unknown] = [
      422,
      {
        error: 'shop_url_invalid',
        message: 'x',
        detail: {
          reason:
            'The site URL points at a private or reserved address (10.0.0.1).',
        },
      },
    ];
    renderAt('/admin/settings/shops/4', {
      'GET /shops/4': [200, SAVED],
      'PUT /shops/4': () => answer,
    });
    await screen.findByLabelText('Name');

    await userEvent.click(
      screen.getByRole('button', {name: 'Save connection'}),
    );
    expect(
      await screen.findByText(
        'The site URL points at a private or reserved address (10.0.0.1).',
      ),
    ).toBeInTheDocument();

    answer = [409, {error: 'shop_name_taken', message: 'x'}];
    await userEvent.click(
      screen.getByRole('button', {name: 'Save connection'}),
    );
    expect(
      await screen.findByText('Another connection already has this name.'),
    ).toBeInTheDocument();
  });

  it('copies the webhook URL, and shows the secret only when asked', async () => {
    const api = renderAt('/admin/settings/shops/4', {
      'GET /shops/4': [200, SAVED],
      'GET /shops/4/webhook-secret': [200, SECRET],
    });

    const webhook = await screen.findByRole('region', {name: 'Webhook'});
    await userEvent.click(
      within(webhook).getByRole('button', {name: 'Copy webhook URL'}),
    );
    expect(clipboard).toHaveBeenCalledWith(SAVED.webhook_url);
    expect(await screen.findByRole('status')).toHaveTextContent('Copied.');

    const secret = within(webhook).getByLabelText('Signing secret');
    expect(secret).toHaveValue('');
    expect(api.calls.some((c) => c.path === '/shops/4/webhook-secret')).toBe(
      false,
    );
    await userEvent.click(
      within(webhook).getByRole('button', {name: 'Show the secret'}),
    );
    await waitFor(() => expect(secret).toHaveValue(SECRET.webhook_secret));

    await userEvent.click(
      within(webhook).getByRole('button', {name: 'Copy signing secret'}),
    );
    expect(clipboard).toHaveBeenLastCalledWith(SECRET.webhook_secret);
  });

  it('rotates the secret after asking', async () => {
    renderAt('/admin/settings/shops/4', {
      'GET /shops/4': [200, SAVED],
      'POST /shops/4/webhook-secret': [
        200,
        {...SECRET, webhook_secret: 'beefbeef'},
      ],
    });
    const webhook = await screen.findByRole('region', {name: 'Webhook'});

    await userEvent.click(
      within(webhook).getByRole('button', {name: 'Rotate secret'}),
    );
    const dialog = screen.getByRole('dialog', {
      name: 'Rotate the signing secret?',
    });
    expect(dialog).toHaveTextContent(
      'Deliveries signed with the current secret are refused from now on',
    );
    await userEvent.click(
      within(dialog).getByRole('button', {name: 'Rotate secret'}),
    );

    await waitFor(() =>
      expect(within(webhook).getByLabelText('Signing secret')).toHaveValue(
        'beefbeef',
      ),
    );
  });

  it('tests the connection with the fields as typed and shows the store in a result card', async () => {
    const api = renderAt('/admin/settings/shops/4', {
      'GET /shops/4': [200, SAVED],
      'POST /shops/4/test': [200, OK_TEST],
    });
    await screen.findByLabelText('Name');
    await userEvent.type(screen.getByLabelText('Consumer key'), 'ck_new');

    await userEvent.click(
      screen.getByRole('button', {name: 'Test connection'}),
    );

    const result = await screen.findByRole('region', {
      name: 'Test result',
    });
    expect(result).toHaveTextContent('Connected to KF Vintage');
    expect(result).toHaveTextContent('WooCommerce 8.9.0');
    expect(result).toHaveTextContent(
      'Write access is proven by the first update the app sends.',
    );
    expect(result).toHaveTextContent(
      'Webhook: paste the URL and secret above in WooCommerce.',
    );
    expect(api.calls.find((c) => c.path === '/shops/4/test')?.body).toEqual({
      site_url: 'https://kfvintage.example.com',
      consumer_key: 'ck_new',
    });
  });

  it('says why the test failed in the result card', async () => {
    renderAt('/admin/settings/shops/4', {
      'GET /shops/4': [200, SAVED],
      'POST /shops/4/test': [
        200,
        {
          ...OK_TEST,
          rest: {ok: false, error: 'Consumer key is invalid.', can_write: null},
        },
      ],
    });
    await screen.findByLabelText('Name');

    await userEvent.click(
      screen.getByRole('button', {name: 'Test connection'}),
    );

    const result = await screen.findByRole('region', {name: 'Test result'});
    expect(result).toHaveTextContent('The shop did not answer');
    expect(result).toHaveTextContent('Consumer key is invalid.');
    expect(result).toHaveClass('is-failed');
  });

  it('says the keys are read-only once a write was refused', async () => {
    renderAt('/admin/settings/shops/4', {
      'GET /shops/4': [200, SAVED],
      'POST /shops/4/test': [
        200,
        {...OK_TEST, rest: {...OK_TEST.rest, can_write: false}},
      ],
    });
    await screen.findByLabelText('Name');

    await userEvent.click(
      screen.getByRole('button', {name: 'Test connection'}),
    );

    expect(
      await screen.findByRole('region', {name: 'Test result'}),
    ).toHaveTextContent(
      'The keys are read-only: the shop refused an update. Create Read/Write keys.',
    );
  });

  it('lists the updates that did not reach the shop, with Retry', async () => {
    let failed = [
      {
        id: 9,
        capability: 'order_status',
        order: {id: 7, code: 'W00007'},
        payload: {status: 'processing'},
        status: 'failed',
        attempts: 3,
        last_error: 'Sorry, you cannot edit this resource.',
        created_at: '2026-10-06T10:00:00-05:00',
      },
    ];
    const api = renderAt('/admin/settings/shops/4', {
      'GET /shops/4': [
        200,
        {...SAVED, health: {...SAVED.health, failed_pushes: 1}},
      ],
      'GET /shops/4/outbox': () => [200, failed],
      'POST /shops/4/outbox/9/retry': () => {
        const row = {...failed[0]!, status: 'pending'};
        failed = [];
        return [200, row];
      },
    });

    const updates = await screen.findByRole('region', {
      name: 'Failed updates',
    });
    const row = await within(updates).findByRole('row', {name: /W00007/});
    expect(row).toHaveTextContent('Order status');
    expect(row).toHaveTextContent('Sorry, you cannot edit this resource.');
    await userEvent.click(within(row).getByRole('button', {name: 'Retry'}));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'The update of W00007 is queued again.',
    );
    expect(api.calls.some((c) => c.path === '/shops/4/outbox/9/retry')).toBe(
      true,
    );
  });

  it('says so when the connection no longer exists', async () => {
    renderAt('/admin/settings/shops/99', {
      'GET /shops/99': [404, {error: 'shop_not_found', message: 'x'}],
    });

    expect(
      await screen.findByText('This connection no longer exists.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', {name: 'Back to the connections'}),
    ).toHaveAttribute('href', '/admin/settings/shops');
  });
});
