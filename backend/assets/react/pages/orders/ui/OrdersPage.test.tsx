import {render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import {SessionProvider} from '@/entities/session';
import {fakeApi} from '@/shared/test/fakeApi';
import {ToastProvider} from '@/shared/ui';
import {OrdersPage} from './OrdersPage';

const ORDER = {
  id: 1,
  code: 'W00001',
  status: 1,
  source: 2,
  created_at: '2026-10-05T10:15:00-05:00',
  warehouse: {id: 1, name: 'Colombia'},
  customer: null,
  comments_count: 0,
};

function renderPage(roles: string[], routes: Parameters<typeof fakeApi>[0]) {
  const api = fakeApi({
    'GET /auth/me': [
      200,
      {id: 1, username: 'a', name: 'A', email: 'a@kf.test', roles},
    ],
    'GET /warehouses': [200, [{id: 1, name: 'Colombia', urls: []}]],
    ...routes,
  });
  render(
    <SessionProvider>
      <ToastProvider>
        <MemoryRouter>
          <OrdersPage />
        </MemoryRouter>
      </ToastProvider>
    </SessionProvider>,
  );
  return api;
}

const listCalls = (api: ReturnType<typeof fakeApi>) =>
  api.calls.filter((c) => c.path === '/orders');

describe('OrdersPage', () => {
  it('is titled Orders, with Create order as its one primary action and Sync shop orders beside it', async () => {
    renderPage(
      ['ROLE_USER', 'ROLE_CAN_CREATE_ORDERS', 'ROLE_CAN_SYNC_ORDERS'],
      {'GET /orders': [200, [ORDER]]},
    );

    expect(
      await screen.findByRole('heading', {level: 1, name: 'Orders'}),
    ).toBeInTheDocument();
    const create = await screen.findByRole('link', {name: 'Create order'});
    expect(create).toHaveAttribute('href', '/admin/orders/new');
    expect(create).toHaveClass('kf-btn--primary');
    expect(screen.getByRole('button', {name: 'Sync shop orders'})).toHaveClass(
      'kf-btn--secondary',
    );
  });

  it('shows neither create nor sync without their roles', async () => {
    renderPage(['ROLE_USER', 'ROLE_CAN_READ_ORDERS'], {
      'GET /orders': [200, [ORDER]],
    });

    await screen.findByRole('row', {name: /W00001/}, {timeout: 3000});
    expect(
      screen.queryByRole('link', {name: 'Create order'}),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Sync shop orders'}),
    ).not.toBeInTheDocument();
  });

  it('reloads the list after a sync', async () => {
    let rows = [ORDER];
    const api = renderPage(['ROLE_USER', 'ROLE_CAN_SYNC_ORDERS'], {
      'GET /orders': () => [200, rows],
      'POST /orders/sync': () => {
        rows = [ORDER, {...ORDER, id: 2, code: 'W00002'}];
        return [202, {imported: 1, skipped: 0}];
      },
    });
    await screen.findByRole('row', {name: /W00001/}, {timeout: 3000});

    await userEvent.click(
      screen.getByRole('button', {name: 'Sync shop orders'}),
    );

    expect(
      await screen.findByRole('row', {name: /W00002/}),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      '1 orders imported, 0 skipped.',
    );
    expect(listCalls(api)).toHaveLength(2);
  });

  it('opens an order’s detail beside the list, and the list counts a comment saved there', async () => {
    let comments: {id: number; content: string}[] = [];
    const api = renderPage(['ROLE_USER'], {
      'GET /orders': () => [200, [{...ORDER, comments_count: comments.length}]],
      'GET /orders/1': () => [200, {...ORDER, comments, products: []}],
      'PUT /orders/1/comments': () => {
        comments = [{id: 5, content: 'Ring twice'}];
        return [200, {comments}];
      },
    });

    await userEvent.click(
      await screen.findByRole(
        'button',
        {name: 'Comments of order W00001: 0'},
        {timeout: 3000},
      ),
    );
    const detail = await screen.findByRole('dialog', {name: 'Order W00001'});
    await userEvent.click(
      await within(detail).findByRole('button', {name: 'Add a comment'}),
    );
    await userEvent.type(
      within(detail).getByLabelText('Comment 1'),
      'Ring twice',
    );
    await userEvent.click(
      within(detail).getByRole('button', {name: 'Save comment 1'}),
    );

    expect(
      await screen.findByRole('button', {name: 'Comments of order W00001: 1'}),
    ).toBeInTheDocument();
    await userEvent.click(within(detail).getByRole('button', {name: 'Close'}));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(listCalls(api)).toHaveLength(2));
  });
});
