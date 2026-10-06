import {render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import {SessionProvider} from '@/entities/session';
import {fakeApi} from '@/shared/test/fakeApi';
import {pageOf} from '@/shared/test/fakeList';
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
      {'GET /orders': [200, pageOf([ORDER])]},
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
      'GET /orders': [200, pageOf([ORDER])],
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
      'GET /orders': () => [200, pageOf(rows)],
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

  it('opens an order’s detail beside the list with its comment timeline, and the list counts a comment added there', async () => {
    let comments: unknown[] = [];
    const api = renderPage(['ROLE_USER'], {
      'GET /orders': () => [
        200,
        pageOf([{...ORDER, comments_count: comments.length}]),
      ],
      'GET /orders/1': () => [200, {...ORDER, comments, products: []}],
      'GET /settings/quick-phrases': [200, []],
      'POST /orders/1/comments': (body) => {
        const added = {
          id: 5,
          content: (body as {content: string}).content,
          created_at: '2026-10-06T09:00:00-05:00',
          approximate: false,
          author: {id: 1, name: 'Ana'},
          origin: 'app',
          shop: null,
          pinned: false,
          pinned_at: null,
          pinned_by: null,
          sent_to_shop: false,
        };
        comments = [added];
        return [201, added];
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
    await userEvent.type(
      await within(detail).findByRole('textbox', {name: 'Write a note…'}),
      'Ring twice{Enter}',
    );

    expect(
      await within(detail).findByText('Ring twice'),
      'the timeline shows it',
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('button', {name: 'Comments of order W00001: 1'}),
    ).toBeInTheDocument();
    await userEvent.click(within(detail).getByRole('button', {name: 'Close'}));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(listCalls(api)).toHaveLength(2));
  });
});
