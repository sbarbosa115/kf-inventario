import {render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import {vi} from 'vitest';
import {SessionProvider} from '@/entities/session';
import {fakeApi} from '@/shared/test/fakeApi';
import {ToastProvider} from '@/shared/ui';
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

const UPDATE_ORDERS = [
  'ROLE_USER',
  'ROLE_UPDATE_ORDERS',
  'ROLE_CAN_READ_ORDERS',
  'ROLE_CAN_UPDATE_ORDERS',
];

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

function renderDetail({
  roles = UPDATE_ORDERS,
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
    'GET /orders/4': [200, ORDER],
    ...routes,
  });
  const onClose = vi.fn();
  const onChanged = vi.fn();
  render(
    <SessionProvider>
      <ToastProvider>
        <MemoryRouter>
          <OrderDetail
            orderId={4}
            code="W00004"
            onClose={onClose}
            onChanged={onChanged}
          />
        </MemoryRouter>
      </ToastProvider>
    </SessionProvider>,
  );
  return {api, onClose, onChanged};
}

const panel = () => screen.findByRole('dialog', {name: 'Order W00004'});
const puts = (api: ReturnType<typeof fakeApi>) =>
  api.calls.filter((c) => c.method === 'PUT');

describe('OrderDetail', () => {
  it('slides over the list with the order’s facts, then its customer, products and comments as sections', async () => {
    renderDetail();

    const detail = await panel();
    expect(await within(detail).findByText('Ana Gomez')).toBeInTheDocument();
    for (const text of [
      'Partial',
      'Phone',
      'Colombia',
      'Oct 5, 2026, 10:15 AM',
      'ana@kf.test',
      '3001',
    ]) {
      expect(within(detail).getAllByText(text)[0]).toBeInTheDocument();
    }
    expect(
      within(detail).getByText(
        '742 Evergreen Terrace, 05001, Medellin, Antioquia, Colombia',
      ),
    ).toBeInTheDocument();
    expect(
      within(detail)
        .getAllByRole('heading', {level: 3})
        .map((h) => h.textContent),
      'sections instead of tabs',
    ).toEqual(['Customer', 'Products', 'Comments']);
    expect(within(detail).queryByRole('tab')).not.toBeInTheDocument();
    const row = within(detail).getByRole('row', {name: /KF-01/});
    expect(within(row).getByText('Chair')).toBeInTheDocument();
    expect(within(row).getByText('10')).toBeInTheDocument();
    expect(within(detail).getByLabelText('Comment 1')).toHaveValue(
      'Call before delivering',
    );
    expect(within(detail).getByLabelText('Comment 2')).toHaveValue('Gift wrap');
  });

  it('acts from where the information is: status, edit, getting ready and the documents', async () => {
    renderDetail();
    const detail = await panel();

    expect(
      await within(detail).findByRole('button', {
        name: 'Status of order W00004',
      }),
    ).toBeInTheDocument();
    expect(within(detail).getByRole('link', {name: 'Edit'})).toHaveAttribute(
      'href',
      '/admin/orders/4/edit',
    );
    expect(
      within(detail).getByRole('link', {name: 'Getting ready'}),
    ).toHaveAttribute('href', '/admin/orders/4/getting-ready');

    await userEvent.click(
      within(detail).getByRole('button', {name: 'Documents'}),
    );
    const menu = screen.getByRole('menu', {name: 'Documents'});
    const link = (name: string) => within(menu).getByRole('menuitem', {name});
    expect(link('Order PDF')).toHaveAttribute('href', '/api/v1/orders/4/pdf');
    expect(link('Order PDF')).toHaveAttribute('target', '_blank');
    expect(link('Remaining products PDF')).toHaveAttribute(
      'href',
      '/api/v1/orders/4/remaining-pdf',
    );
    expect(link('Excel sheet')).toHaveAttribute('href', '/api/v1/orders/4/xls');
  });

  it('changes the status from the detail after asking, then shows the new one and tells the list', async () => {
    let status = 4;
    const {onChanged, onClose} = renderDetail({
      routes: {
        'GET /orders/4': () => [200, {...ORDER, status}],
        'POST /orders/4/status': (body) => {
          status = (body as {status: number}).status;
          return [200, {...ORDER, status}];
        },
      },
    });
    const detail = await panel();

    await userEvent.click(
      await within(detail).findByRole('button', {
        name: 'Status of order W00004',
      }),
    );
    await userEvent.click(
      screen.getByRole('menuitemradio', {name: 'Delivered'}),
    );
    await userEvent.keyboard('{Escape}');
    expect(
      screen.queryByRole('dialog', {name: 'Mark W00004 as Delivered?'}),
      'Escape cancels the question…',
    ).not.toBeInTheDocument();
    expect(onClose, '…and leaves the detail open').not.toHaveBeenCalled();

    await userEvent.click(
      within(detail).getByRole('button', {name: 'Status of order W00004'}),
    );
    await userEvent.click(
      screen.getByRole('menuitemradio', {name: 'Delivered'}),
    );
    await userEvent.click(
      screen.getByRole('button', {name: 'Mark as Delivered'}),
    );

    await waitFor(() =>
      expect(
        within(detail).getByRole('button', {name: 'Status of order W00004'}),
      ).toHaveTextContent('Delivered'),
    );
    expect(onChanged).toHaveBeenCalled();
  });

  it('shows the status without the menu, and no Edit, to whoever only reads orders', async () => {
    renderDetail({roles: ['ROLE_USER', 'ROLE_CAN_READ_ORDERS']});
    const detail = await panel();

    expect(await within(detail).findByText('Ana Gomez')).toBeInTheDocument();
    expect(within(detail).getAllByText('Partial')[0]).toBeInTheDocument();
    expect(
      within(detail).queryByRole('button', {name: 'Status of order W00004'}),
    ).not.toBeInTheDocument();
    expect(
      within(detail).queryByRole('link', {name: 'Edit'}),
    ).not.toBeInTheDocument();
  });

  it('saves an edited comment inline with the others as they are, and tells the list', async () => {
    const {api, onChanged} = renderDetail({
      routes: {'PUT /orders/4/comments': commentsApi()},
    });
    const detail = await panel();

    const first = await within(detail).findByLabelText('Comment 1');
    await userEvent.clear(first);
    await userEvent.type(first, 'Call twice');
    await userEvent.click(
      within(detail).getByRole('button', {name: 'Save comment 1'}),
    );

    expect(await screen.findByRole('status')).toHaveTextContent(
      'The comments were saved.',
    );
    expect(puts(api)[0]?.body).toEqual({
      comments: [
        {id: 11, content: 'Call twice'},
        {id: 12, content: 'Gift wrap'},
      ],
    });
    expect(onChanged).toHaveBeenCalled();
  });

  it('adds a comment once it is written, refusing a blank one in place', async () => {
    const {api} = renderDetail({
      routes: {'PUT /orders/4/comments': commentsApi()},
    });
    const detail = await panel();

    await userEvent.click(
      await within(detail).findByRole('button', {name: 'Add a comment'}),
    );
    const draft = within(detail).getByLabelText('Comment 3');
    expect(draft, 'the new comment is ready to type in').toHaveFocus();
    await userEvent.click(
      within(detail).getByRole('button', {name: 'Save comment 3'}),
    );
    expect(
      within(detail).getByText('Write the comment, or remove it.'),
      'a blank comment is refused by the API: say so instead of sending it',
    ).toBeInTheDocument();
    expect(puts(api)).toHaveLength(0);

    await userEvent.type(draft, 'Leave at the door');
    await userEvent.click(
      within(detail).getByRole('button', {name: 'Save comment 3'}),
    );

    await screen.findByRole('status');
    expect(puts(api)[0]?.body).toEqual({
      comments: [
        {id: 11, content: 'Call before delivering'},
        {id: 12, content: 'Gift wrap'},
        {id: null, content: 'Leave at the door'},
      ],
    });
  });

  it('removes a saved comment, and drops a draft without asking the server', async () => {
    const {api} = renderDetail({
      routes: {'PUT /orders/4/comments': commentsApi()},
    });
    const detail = await panel();

    await userEvent.click(
      await within(detail).findByRole('button', {name: 'Remove comment 1'}),
    );
    await waitFor(() =>
      expect(within(detail).getByLabelText('Comment 1')).toHaveValue(
        'Gift wrap',
      ),
    );
    expect(puts(api)[0]?.body).toEqual({
      comments: [{id: 12, content: 'Gift wrap'}],
    });

    await userEvent.click(
      within(detail).getByRole('button', {name: 'Add a comment'}),
    );
    await userEvent.click(
      within(detail).getByRole('button', {name: 'Remove comment 2'}),
    );
    expect(within(detail).queryByLabelText('Comment 2')).toBeNull();
    expect(puts(api)).toHaveLength(1);
  });

  it('says why a comment save failed, in place, and keeps what was typed', async () => {
    renderDetail({
      routes: {'PUT /orders/4/comments': [500, {error: 'internal_error'}]},
    });
    const detail = await panel();

    const first = await within(detail).findByLabelText('Comment 1');
    await userEvent.type(first, '!');
    await userEvent.click(
      within(detail).getByRole('button', {name: 'Save comment 1'}),
    );

    expect(await within(detail).findByRole('alert')).toHaveTextContent(
      'Something went wrong on our side',
    );
    expect(first).toHaveValue('Call before delivering!');
  });

  it('says so when the order has no customer, no address or no comments', async () => {
    renderDetail({
      routes: {
        'GET /orders/4': [200, {...ORDER, customer: null, comments: []}],
      },
    });
    const detail = await panel();

    expect(
      await within(detail).findByText('This order has no comments yet.'),
    ).toBeInTheDocument();
    expect(within(detail).getByText('No customer')).toBeInTheDocument();
  });

  it('closes with a neutral ×', async () => {
    const {onClose} = renderDetail();
    const detail = await panel();

    const close = within(detail).getByRole('button', {name: 'Close'});
    expect(close).not.toHaveClass('kf-btn--danger');
    await userEvent.click(close);

    expect(onClose).toHaveBeenCalled();
  });

  it('says so when the order no longer exists', async () => {
    renderDetail({
      routes: {
        'GET /orders/4': [
          404,
          {error: 'order_not_found', message: 'Not found'},
        ],
      },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This order no longer exists. Reload the list.',
    );
  });
});
