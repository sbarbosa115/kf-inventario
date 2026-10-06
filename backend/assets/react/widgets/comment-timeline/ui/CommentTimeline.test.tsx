import {render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {vi} from 'vitest';
import type {OrderComment} from '@/entities/comment';
import {fakeApi} from '@/shared/test/fakeApi';
import {ToastProvider} from '@/shared/ui';
import {CommentTimeline} from './CommentTimeline';

const comment = (
  id: number,
  content: string,
  extra: Partial<OrderComment> = {},
): OrderComment => ({
  id,
  content,
  created_at: '2026-10-05T10:15:00-05:00',
  approximate: false,
  author: {id: 1, name: 'Ana Gomez'},
  origin: 'app',
  shop: null,
  pinned: false,
  pinned_at: null,
  pinned_by: null,
  sent_to_shop: false,
  ...extra,
});

const LEGACY = comment(11, 'Old comment', {
  created_at: '2026-10-01T08:00:00-05:00',
  approximate: true,
  author: null,
});
const SHOP_NOTE = comment(12, 'Please leave it at the door', {
  created_at: '2026-10-02T09:30:00-05:00',
  author: null,
  origin: 'shop',
  shop: {id: 2, name: 'Fake shop'},
});
const PHRASE = comment(13, 'Called the customer', {
  created_at: '2026-10-03T11:00:00-05:00',
  origin: 'phrase',
});
const SENT = comment(14, 'Shipped today\nTracking 123', {
  created_at: '2026-10-04T16:45:00-05:00',
  author: {id: 2, name: 'Ben Ruiz'},
  sent_to_shop: true,
});

const ORDER = {
  id: 4,
  code: 'W00004',
  shop: {id: 2, name: 'Fake shop'},
  comments: [LEGACY, SHOP_NOTE, PHRASE, SENT],
};

function renderTimeline({
  comments = ORDER.comments,
  routes = {},
}: {
  comments?: OrderComment[];
  routes?: Parameters<typeof fakeApi>[0];
} = {}) {
  const api = fakeApi({
    'GET /settings/quick-phrases': [200, []],
    ...routes,
  });
  const onChanged = vi.fn();
  render(
    <ToastProvider>
      <CommentTimeline order={{...ORDER, comments}} onChanged={onChanged} />
    </ToastProvider>,
  );
  return {api, onChanged};
}

const timeline = () =>
  screen.getByRole('list', {name: 'Comments of order W00004'});
const entries = () => within(timeline()).getAllByRole('listitem');
const pinnedCard = () => screen.queryByRole('region', {name: 'Pinned'});

describe('CommentTimeline', () => {
  it('lists the comments oldest first, each with its author, date and time, and its text as written', () => {
    renderTimeline();

    const items = entries();
    expect(items).toHaveLength(4);
    const last = items[3]!;
    expect(within(last).getByText('Ben Ruiz')).toBeInTheDocument();
    expect(within(last).getByText('Oct 4, 2026, 4:45 PM')).toBeInTheDocument();
    expect(
      within(last).getByText(/Shipped today/).textContent,
      'line breaks are kept',
    ).toBe('Shipped today\nTracking 123');
    expect(
      within(last).getByText('Sent to the shop'),
      'a note that also went to the shop says so',
    ).toBeInTheDocument();
    expect(within(items[2]!).getByText('Quick phrase')).toBeInTheDocument();
  });

  it('marks a legacy comment’s date as approximate: it is the order’s date', () => {
    renderTimeline();

    const legacy = entries()[0]!;
    const when = within(legacy).getByTitle(
      "Approximate date (the order's): written before comments had dates",
    );
    expect(when).toHaveTextContent('≈ Oct 1, 2026, 8:00 AM');
    expect(within(legacy).getByText('Unknown author')).toBeInTheDocument();
  });

  it('marks a shop’s note with the shop, among the others, and offers no Edit or Remove for it', async () => {
    renderTimeline();

    const note = entries()[1]!;
    expect(within(note).getByText('Shop · Fake shop')).toBeInTheDocument();
    await userEvent.click(
      within(note).getByRole('button', {name: 'Actions for comment 2'}),
    );
    const menu = screen.getByRole('menu');
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Pin']);
  });

  it('shows the pinned comment first, in its own card, and unpins it from there', async () => {
    const pinned = {
      ...PHRASE,
      pinned: true,
      pinned_at: '2026-10-05T12:00:00-05:00',
      pinned_by: {id: 2, name: 'Ben Ruiz'},
    };
    const {api, onChanged} = renderTimeline({
      comments: [LEGACY, SHOP_NOTE, pinned, SENT],
      routes: {
        'DELETE /orders/4/comments/13/pin': [200, PHRASE],
      },
    });

    const card = pinnedCard()!;
    expect(card).toBeInTheDocument();
    expect(within(card).getByText('Called the customer')).toBeInTheDocument();
    expect(within(card).getByText('Pinned by Ben Ruiz')).toBeInTheDocument();
    expect(
      card.compareDocumentPosition(timeline()) &
        Node.DOCUMENT_POSITION_FOLLOWING,
      'the card comes before the timeline',
    ).toBeTruthy();

    await userEvent.click(within(card).getByRole('button', {name: 'Unpin'}));

    await waitFor(() => expect(pinnedCard()).not.toBeInTheDocument());
    expect(
      api.calls.some(
        (c) => c.method === 'DELETE' && c.path === '/orders/4/comments/13/pin',
      ),
    ).toBe(true);
    expect(onChanged, 'the list’s Notes column follows').toHaveBeenCalled();
  });

  it('pins a comment from its menu, which unpins the one pinned before', async () => {
    const pinnedBefore = {...PHRASE, pinned: true};
    const {onChanged} = renderTimeline({
      comments: [LEGACY, SHOP_NOTE, pinnedBefore, SENT],
      routes: {
        'POST /orders/4/comments/14/pin': [
          200,
          {...SENT, pinned: true, pinned_by: {id: 1, name: 'Ana Gomez'}},
        ],
      },
    });
    expect(within(pinnedCard()!).getByText('Called the customer'));

    await userEvent.click(
      within(entries()[3]!).getByRole('button', {
        name: 'Actions for comment 4',
      }),
    );
    await userEvent.click(screen.getByRole('menuitem', {name: 'Pin'}));

    await waitFor(() =>
      expect(within(pinnedCard()!).getByText(/Shipped today/)).toBeTruthy(),
    );
    expect(
      within(pinnedCard()!).queryByText('Called the customer'),
      'one pinned comment per order',
    ).not.toBeInTheDocument();
    await userEvent.click(
      within(entries()[2]!).getByRole('button', {
        name: 'Actions for comment 3',
      }),
    );
    expect(
      screen.getByRole('menuitem', {name: 'Pin'}),
      'the one pinned before can be pinned again',
    ).toBeInTheDocument();
    expect(onChanged).toHaveBeenCalled();
  });

  it('adds what is written in the box at the bottom of the timeline, and tells the list', async () => {
    const {onChanged} = renderTimeline({
      routes: {
        'POST /orders/4/comments': [
          201,
          comment(20, 'Brand new', {created_at: '2026-10-06T09:00:00-05:00'}),
        ],
      },
    });

    await userEvent.type(
      screen.getByRole('textbox', {name: 'Write a note…'}),
      'Brand new{Enter}',
    );

    await waitFor(() => expect(entries()).toHaveLength(5));
    expect(within(entries()[4]!).getByText('Brand new')).toBeInTheDocument();
    expect(onChanged).toHaveBeenCalled();
    expect(
      screen.getByRole('checkbox', {
        name: 'Also send to Fake shop as an order note',
      }),
      'the order came from a shop',
    ).toBeInTheDocument();
  });

  it('edits a comment written here through the order’s comments, keeping the others', async () => {
    const {api} = renderTimeline({
      routes: {
        'PUT /orders/4/comments': (body) => [
          200,
          {
            comments: (
              body as {comments: {id: number; content: string}[]}
            ).comments.map((c) => ({
              ...ORDER.comments.find((o) => o.id === c.id)!,
              content: c.content,
            })),
          },
        ],
      },
    });

    await userEvent.click(
      within(entries()[3]!).getByRole('button', {
        name: 'Actions for comment 4',
      }),
    );
    await userEvent.click(screen.getByRole('menuitem', {name: 'Edit'}));
    const field = screen.getByRole('textbox', {name: 'Edit comment 4'});
    await userEvent.clear(field);
    await userEvent.type(field, 'Shipped tomorrow');
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    await waitFor(() =>
      expect(within(entries()[3]!).getByText('Shipped tomorrow')).toBeTruthy(),
    );
    expect(api.calls.find((c) => c.method === 'PUT')?.body).toEqual({
      comments: [
        {id: 11, content: 'Old comment'},
        {id: 12, content: 'Please leave it at the door'},
        {id: 13, content: 'Called the customer'},
        {id: 14, content: 'Shipped tomorrow'},
      ],
    });
  });

  it('removes a comment written here after asking', async () => {
    const {api} = renderTimeline({
      routes: {
        'PUT /orders/4/comments': [
          200,
          {comments: [LEGACY, SHOP_NOTE, PHRASE]},
        ],
      },
    });

    await userEvent.click(
      within(entries()[3]!).getByRole('button', {
        name: 'Actions for comment 4',
      }),
    );
    await userEvent.click(screen.getByRole('menuitem', {name: 'Remove'}));
    const ask = screen.getByRole('dialog', {name: 'Remove this comment?'});
    await userEvent.click(within(ask).getByRole('button', {name: 'Remove'}));

    await waitFor(() => expect(entries()).toHaveLength(3));
    expect(api.calls.find((c) => c.method === 'PUT')?.body).toEqual({
      comments: [
        {id: 11, content: 'Old comment'},
        {id: 12, content: 'Please leave it at the door'},
        {id: 13, content: 'Called the customer'},
      ],
    });
  });

  it('says so when the order has no comments yet, and the box is still there', () => {
    renderTimeline({comments: []});

    expect(
      screen.getByText('No comments yet. Write the first one below.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', {name: 'Write a note…'}),
    ).toBeInTheDocument();
  });
});
