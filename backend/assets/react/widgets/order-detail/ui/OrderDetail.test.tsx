import {render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {vi} from 'vitest';
import {fakeApi} from '@/shared/test/fakeApi';
import {OrderDetail} from './OrderDetail';

const ORDER = {
  id: 4,
  code: 'W00004',
  status: 4,
  source: 2,
  payment_method: 1,
  comment: null,
  created_at: '2026-10-05T10:15:00-05:00',
  warehouse: {id: 1, name: 'Colombia'},
  customer: {
    id: 9,
    first_name: 'Ana',
    last_name: 'Gomez',
    email: 'ana@kf.test',
    phone: '3001',
    addresses: [
      {
        id: 1,
        address: '742 Evergreen Terrace',
        zip_code: '05001',
        address_type: 1,
        city: {
          id: 3,
          name: 'Medellin',
          state: {
            id: 2,
            name: 'Antioquia',
            code: 'ANT',
            country: {id: 1, name: 'Colombia', code: 'CO'},
          },
        },
      },
    ],
  },
  comments: [
    {id: 11, content: 'Call before delivering'},
    {id: 12, content: 'Gift wrap'},
  ],
  products: [
    {
      uuid: 'u-1',
      quantity: 10,
      product: {code: 'KF-01', title: 'Chair', detail: null},
    },
    {
      uuid: 'u-2',
      quantity: 4,
      product: {code: 'KF-02', title: 'Table', detail: null},
    },
  ],
};

type Comment = {id: number | null; content: string};

/** The API's comments endpoint: what it receives becomes the order's comments (new ones get the next id). */
function commentsApi() {
  let nextId = 13;
  return (body: unknown) => {
    const sent = (body as {comments: Comment[]}).comments;
    return [
      200,
      {
        comments: sent.map((c) => ({
          id: c.id ?? nextId++,
          content: c.content,
        })),
      },
    ] as [number, unknown];
  };
}

function renderDetail(tab: 'products' | 'comments' = 'products') {
  const onClose = vi.fn();
  const onCommentsChanged = vi.fn();
  render(
    <OrderDetail
      orderId={4}
      initialTab={tab}
      onClose={onClose}
      onCommentsChanged={onCommentsChanged}
    />,
  );
  return {onClose, onCommentsChanged};
}

const puts = (api: ReturnType<typeof fakeApi>) =>
  api.calls.filter((c) => c.method === 'PUT');

describe('OrderDetail', () => {
  it('shows who ordered what, where it goes, and the products tab first', async () => {
    fakeApi({'GET /orders/4': [200, ORDER]});
    renderDetail();

    const dialog = await screen.findByRole('dialog', {name: 'Order Detail'});
    expect(await within(dialog).findByText('Ana Gomez')).toBeInTheDocument();
    for (const text of [
      'Phone',
      'Partial',
      'ana@kf.test',
      'W00004',
      'October 5, 2026',
      '742 Evergreen Terrace',
      '05001',
      'Medellin',
      'Antioquia',
    ]) {
      expect(within(dialog).getByText(text)).toBeInTheDocument();
    }
    expect(
      within(dialog).getByRole('tab', {name: 'Products Detail'}),
    ).toHaveAttribute('aria-selected', 'true');
    const row = within(dialog).getByText('KF-01').closest('tr')!;
    expect(within(row).getByText('Chair')).toBeInTheDocument();
    expect(within(row).getByText('10')).toBeInTheDocument();
  });

  it('links the order PDF and what is left to ship, and closes', async () => {
    fakeApi({'GET /orders/4': [200, ORDER]});
    const {onClose} = renderDetail();

    const remaining = await screen.findByRole('link', {
      name: /Remaining Products/,
    });
    expect(remaining).toHaveAttribute('href', '/api/v1/orders/4/remaining-pdf');
    expect(remaining).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('link', {name: /Download/})).toHaveAttribute(
      'href',
      '/api/v1/orders/4/pdf',
    );
    await userEvent.click(
      screen.getAllByRole('button', {name: 'Close'}).at(-1)!,
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('switches to the comments, each one editable', async () => {
    fakeApi({'GET /orders/4': [200, ORDER]});
    renderDetail();

    await userEvent.click(await screen.findByRole('tab', {name: 'Comments'}));

    expect(screen.getByRole('tab', {name: 'Comments'})).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByLabelText('Comment 1')).toHaveValue(
      'Call before delivering',
    );
    expect(screen.getByLabelText('Comment 2')).toHaveValue('Gift wrap');
  });

  it('saves an edited comment with the others as they are', async () => {
    const api = fakeApi({
      'GET /orders/4': [200, ORDER],
      'PUT /orders/4/comments': commentsApi(),
    });
    const {onCommentsChanged} = renderDetail('comments');

    const first = await screen.findByLabelText('Comment 1');
    await userEvent.clear(first);
    await userEvent.type(first, 'Call twice');
    await userEvent.click(screen.getByRole('button', {name: 'Save comment 1'}));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'The comments were saved.',
    );
    expect(puts(api)[0]?.body).toEqual({
      comments: [
        {id: 11, content: 'Call twice'},
        {id: 12, content: 'Gift wrap'},
      ],
    });
    expect(onCommentsChanged).toHaveBeenCalled();
  });

  it('adds a comment once it is written and saved', async () => {
    const api = fakeApi({
      'GET /orders/4': [200, ORDER],
      'PUT /orders/4/comments': commentsApi(),
    });
    renderDetail('comments');

    await userEvent.click(
      await screen.findByRole('button', {name: 'Add a comment'}),
    );
    const draft = screen.getByLabelText('Comment 3');
    expect(draft).toHaveValue('');
    expect(draft, 'the new comment is ready to type in').toHaveFocus();

    await userEvent.click(screen.getByRole('button', {name: 'Save comment 3'}));
    expect(
      screen.getByText('Write the comment, or remove it.'),
      'a blank comment is refused by the API: say so instead of sending it',
    ).toBeInTheDocument();
    expect(puts(api)).toHaveLength(0);

    await userEvent.type(draft, 'Leave at the door');
    await userEvent.click(screen.getByRole('button', {name: 'Save comment 3'}));

    await screen.findByRole('status');
    expect(puts(api)[0]?.body).toEqual({
      comments: [
        {id: 11, content: 'Call before delivering'},
        {id: 12, content: 'Gift wrap'},
        {id: null, content: 'Leave at the door'},
      ],
    });
    expect(screen.getByLabelText('Comment 3')).toHaveValue('Leave at the door');
  });

  it('removes a saved comment from the order', async () => {
    const api = fakeApi({
      'GET /orders/4': [200, ORDER],
      'PUT /orders/4/comments': commentsApi(),
    });
    const {onCommentsChanged} = renderDetail('comments');

    await userEvent.click(
      await screen.findByRole('button', {name: 'Remove comment 1'}),
    );

    await waitFor(() =>
      expect(screen.queryByDisplayValue('Call before delivering')).toBeNull(),
    );
    expect(puts(api)[0]?.body).toEqual({
      comments: [{id: 12, content: 'Gift wrap'}],
    });
    expect(screen.getByLabelText('Comment 1')).toHaveValue('Gift wrap');
    expect(onCommentsChanged).toHaveBeenCalled();
  });

  it('drops a comment never saved without asking the server', async () => {
    const api = fakeApi({'GET /orders/4': [200, ORDER]});
    renderDetail('comments');

    await userEvent.click(
      await screen.findByRole('button', {name: 'Add a comment'}),
    );
    await userEvent.click(
      screen.getByRole('button', {name: 'Remove comment 3'}),
    );

    expect(screen.queryByLabelText('Comment 3')).not.toBeInTheDocument();
    expect(puts(api)).toHaveLength(0);
  });

  it('says why a save failed and keeps what was typed', async () => {
    fakeApi({
      'GET /orders/4': [200, ORDER],
      'PUT /orders/4/comments': [500, {error: 'internal_error'}],
    });
    renderDetail('comments');

    const first = await screen.findByLabelText('Comment 1');
    await userEvent.type(first, '!');
    await userEvent.click(screen.getByRole('button', {name: 'Save comment 1'}));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong on our side',
    );
    expect(first).toHaveValue('Call before delivering!');
  });

  it('says so when the order has no comments, no customer or no address', async () => {
    fakeApi({
      'GET /orders/4': [200, {...ORDER, customer: null, comments: []}],
    });
    renderDetail('comments');

    expect(
      await screen.findByText('This order has no comments yet.'),
    ).toBeInTheDocument();
    expect(screen.getByText('No customer')).toBeInTheDocument();
  });

  it('says so when the order no longer exists', async () => {
    fakeApi({
      'GET /orders/4': [404, {error: 'order_not_found', message: 'Not found'}],
    });
    renderDetail();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This order no longer exists. Reload the list.',
    );
  });
});
