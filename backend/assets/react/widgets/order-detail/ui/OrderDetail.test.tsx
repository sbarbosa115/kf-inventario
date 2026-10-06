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
            comments={(order, changed) => (
              <button type="button" onClick={changed}>
                {`Timeline of ${order.code}: ${order.comments.length}`}
              </button>
            )}
          />
        </MemoryRouter>
      </ToastProvider>
    </SessionProvider>,
  );
  return {api, onClose, onChanged};
}

const panel = () => screen.findByRole('dialog', {name: 'Order W00004'});

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
    expect(
      within(detail).getByRole('button', {name: 'Timeline of W00004: 2'}),
      'the comments section holds what the page gives it (the comment timeline)',
    ).toBeInTheDocument();
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

  it('reloads the order and tells the list when its comments change', async () => {
    let gets = 0;
    const {onChanged} = renderDetail({
      routes: {
        'GET /orders/4': () => {
          gets += 1;
          return [200, ORDER];
        },
      },
    });
    const detail = await panel();

    await userEvent.click(
      await within(detail).findByRole('button', {
        name: 'Timeline of W00004: 2',
      }),
    );

    await waitFor(() => expect(gets).toBe(2));
    expect(onChanged).toHaveBeenCalled();
  });

  it('shows the pinned comment at the top of the order, and goes to the comments from it', async () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    renderDetail({
      routes: {
        'GET /orders/4': [
          200,
          {
            ...ORDER,
            pinned_comment: {
              id: 12,
              content: 'Gift wrap',
              created_at: '2026-10-05T10:15:00-05:00',
            },
          },
        ],
      },
    });
    const detail = await panel();

    const pinned = await within(detail).findByRole('button', {
      name: 'Pinned: Gift wrap',
    });
    await userEvent.click(pinned);
    expect(scroll, 'the comments come into view').toHaveBeenCalled();
  });

  it('names the shop an order came from in its header', async () => {
    renderDetail({
      routes: {
        'GET /orders/4': [
          200,
          {
            ...ORDER,
            source: 1,
            shop: {id: 2, name: 'Kfvintage', takes_notes: true},
          },
        ],
      },
    });
    const detail = await panel();

    expect(await within(detail).findByText('Kfvintage')).toBeInTheDocument();
  });

  it('says so when the order has no customer', async () => {
    renderDetail({
      routes: {
        'GET /orders/4': [200, {...ORDER, customer: null, comments: []}],
      },
    });
    const detail = await panel();

    expect(await within(detail).findByText('No customer')).toBeInTheDocument();
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
