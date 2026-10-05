import {render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import {SessionProvider} from '@/entities/session';
import {fakeApi} from '@/shared/test/fakeApi';
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

describe('OrdersPage', () => {
  it('opens an order’s detail over the list, and the list counts a comment saved there once it closes', async () => {
    let comments: {id: number; content: string}[] = [];
    const api = fakeApi({
      'GET /auth/me': [
        200,
        {
          id: 1,
          username: 'a',
          name: 'A',
          email: 'a@kf.test',
          roles: ['ROLE_USER'],
        },
      ],
      'GET /warehouses': [200, [{id: 1, name: 'Colombia', urls: []}]],
      'GET /orders': () => [200, [{...ORDER, comments_count: comments.length}]],
      'GET /orders/1': () => [200, {...ORDER, comments, products: []}],
      'PUT /orders/1/comments': () => {
        comments = [{id: 5, content: 'Ring twice'}];
        return [200, {comments}];
      },
    });
    render(
      <SessionProvider>
        <MemoryRouter>
          <OrdersPage />
        </MemoryRouter>
      </SessionProvider>,
    );

    expect(
      await screen.findByRole('heading', {name: 'View Orders'}),
    ).toBeInTheDocument();
    await userEvent.click(
      await screen.findByRole('button', {name: 'Comments of order W00001: 0'}),
    );
    const dialog = await screen.findByRole('dialog', {name: 'Order Detail'});
    await userEvent.click(
      await within(dialog).findByRole('button', {name: 'Add a comment'}),
    );
    await userEvent.type(
      within(dialog).getByLabelText('Comment 1'),
      'Ring twice',
    );
    await userEvent.click(
      within(dialog).getByRole('button', {name: 'Save comment 1'}),
    );
    await within(dialog).findByText('The comments were saved.');
    await userEvent.click(
      within(dialog).getAllByRole('button', {name: 'Close'}).at(-1)!,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      await screen.findByRole('button', {name: 'Comments of order W00001: 1'}),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(api.calls.filter((c) => c.path === '/orders')).toHaveLength(2),
    );
  });
});
