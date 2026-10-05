import {render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter, Route, Routes, useParams} from 'react-router-dom';
import {vi} from 'vitest';
import {SessionProvider} from '@/entities/session';
import {fakeApi} from '@/shared/test/fakeApi';
import {ToastProvider} from '@/shared/ui';
import {OrderStatusMenu} from './OrderStatusMenu';

const ORDER = {id: 1, code: 'W00001', status: 1};

function GettingReady() {
  return <p>getting ready {useParams().id}</p>;
}

function renderMenu({
  roles = ['ROLE_USER', 'ROLE_UPDATE_ORDERS'],
  routes = {},
}: {
  roles?: string[];
  routes?: Parameters<typeof fakeApi>[0];
} = {}) {
  const api = fakeApi({
    'GET /auth/me': [
      200,
      {id: 1, username: 'ana', name: 'Ana', email: 'ana@kf.test', roles},
    ],
    ...routes,
  });
  const onChanged = vi.fn();
  render(
    <SessionProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={['/admin/orders']}>
          <Routes>
            <Route
              path="/admin/orders"
              element={<OrderStatusMenu order={ORDER} onChanged={onChanged} />}
            />
            <Route
              path="/admin/orders/:id/getting-ready"
              element={<GettingReady />}
            />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </SessionProvider>,
  );
  return {api, onChanged};
}

const openMenu = async () =>
  userEvent.click(
    await screen.findByRole('button', {name: 'Status of order W00001'}),
  );
const posts = (api: ReturnType<typeof fakeApi>) =>
  api.calls.filter((c) => c.method === 'POST');

describe('OrderStatusMenu', () => {
  it('shows the status as a badge that opens a menu of the six statuses, the current one checked', async () => {
    renderMenu();

    const button = await screen.findByRole('button', {
      name: 'Status of order W00001',
    });
    expect(button, 'the badge says the status in words').toHaveTextContent(
      'Created',
    );
    await openMenu();

    const menu = screen.getByRole('menu');
    const items = within(menu).getAllByRole('menuitemradio');
    expect(items.map((item) => item.textContent)).toEqual([
      'Created',
      'Processed',
      'Completed',
      'Partial',
      'Sent',
      'Delivered',
    ]);
    expect(
      within(menu).getByRole('menuitemradio', {name: 'Created'}),
    ).toHaveAttribute('aria-checked', 'true');
  });

  it('asks before changing the status, then posts it, says so and tells the list', async () => {
    const {api, onChanged} = renderMenu({
      routes: {'POST /orders/1/status': [200, {...ORDER, status: 2}]},
    });
    await openMenu();

    await userEvent.click(
      screen.getByRole('menuitemradio', {name: 'Processed'}),
    );

    const dialog = screen.getByRole('dialog', {
      name: 'Mark W00001 as Processed?',
    });
    expect(dialog).toHaveTextContent(
      'The order moves from Created to Processed. Its stock does not change.',
    );
    expect(
      posts(api),
      'nothing changes before the question is answered',
    ).toEqual([]);
    await userEvent.click(
      within(dialog).getByRole('button', {name: 'Mark as Processed'}),
    );

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Order W00001 is now Processed.',
    );
    expect(posts(api).map((c) => [c.path, c.body])).toEqual([
      ['/orders/1/status', {status: 2}],
    ]);
    expect(onChanged).toHaveBeenCalledWith(2);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('changes nothing when the question is cancelled', async () => {
    const {api, onChanged} = renderMenu();
    await openMenu();
    await userEvent.click(
      screen.getByRole('menuitemradio', {name: 'Completed'}),
    );

    await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(posts(api)).toEqual([]);
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('opens the getting-ready screen instead of marking an order Sent', async () => {
    const {api} = renderMenu();
    await openMenu();

    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Sent'}));

    expect(await screen.findByText('getting ready 1')).toBeInTheDocument();
    expect(
      posts(api),
      'Sent takes the stock out: only the getting-ready screen does that',
    ).toEqual([]);
  });

  it('does nothing when the current status is chosen again', async () => {
    const {api} = renderMenu();
    await openMenu();

    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Created'}));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(posts(api)).toEqual([]);
  });

  it('says why a change failed and keeps the status', async () => {
    const {onChanged} = renderMenu({
      routes: {
        'POST /orders/1/status': [
          404,
          {error: 'order_not_found', message: 'Not found'},
        ],
      },
    });
    await openMenu();
    await userEvent.click(
      screen.getByRole('menuitemradio', {name: 'Processed'}),
    );
    await userEvent.click(
      screen.getByRole('button', {name: 'Mark as Processed'}),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This order no longer exists. Reload the list.',
    );
    expect(onChanged).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
  });

  it('shows the status without a menu to whoever may not change it', async () => {
    renderMenu({roles: ['ROLE_USER', 'ROLE_CAN_READ_ORDERS']});

    expect(await screen.findByText('Created')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Status of order W00001'}),
    ).not.toBeInTheDocument();
  });
});
