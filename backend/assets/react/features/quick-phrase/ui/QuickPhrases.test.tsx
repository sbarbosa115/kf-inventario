import {render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {vi} from 'vitest';
import {fakeApi} from '@/shared/test/fakeApi';
import {ToastProvider} from '@/shared/ui';
import {QuickPhrases} from './QuickPhrases';

const PHRASES = [
  {id: 1, text: 'Called the customer', position: 1, active: true},
  {id: 2, text: 'Waiting for payment', position: 2, active: true},
];

const added = (content: string) => ({
  id: 40,
  content,
  created_at: '2026-10-06T09:00:00-05:00',
  approximate: false,
  author: {id: 1, name: 'Ana Gomez'},
  origin: 'phrase',
  shop: null,
  pinned: false,
  pinned_at: null,
  pinned_by: null,
  sent_to_shop: false,
});

function renderBar(routes: Parameters<typeof fakeApi>[0] = {}) {
  const api = fakeApi({
    'GET /settings/quick-phrases': [200, PHRASES],
    'POST /orders/4/comments': (body) => [
      201,
      added((body as {content: string}).content),
    ],
    ...routes,
  });
  const onAdded = vi.fn();
  render(
    <ToastProvider>
      <QuickPhrases orderId={4} onAdded={onAdded} />
    </ToastProvider>,
  );
  return {api, onAdded};
}

describe('QuickPhrases (the comment box’s bar)', () => {
  it('shows the active phrases in their order, as chips (the list without ?all=1)', async () => {
    const {api} = renderBar();

    const bar = await screen.findByRole('group', {name: 'Quick phrases'});
    expect(
      within(bar)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Called the customer', 'Waiting for payment']);
    expect(api.calls[0]?.url.search, 'only the active ones').toBe('');
  });

  it('posts a phrase as a dated comment in one tap, naming the phrase', async () => {
    const {api, onAdded} = renderBar();

    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Add “Waiting for payment” as a comment',
      }),
    );

    await waitFor(() =>
      expect(onAdded).toHaveBeenCalledWith(added('Waiting for payment')),
    );
    const post = api.calls.find((c) => c.method === 'POST');
    expect(post?.body, 'the phrase id marks it as a quick phrase').toEqual({
      content: 'Waiting for payment',
      phrase_id: 2,
    });
  });

  it('says so when the phrase could not be added', async () => {
    const {onAdded} = renderBar({
      'POST /orders/4/comments': [
        404,
        {error: 'quick_phrase_not_found', message: 'Gone'},
      ],
    });

    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Add “Called the customer” as a comment',
      }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That quick phrase no longer exists. Reload the order.',
    );
    expect(onAdded).not.toHaveBeenCalled();
  });

  it('shows nothing when there are no phrases', async () => {
    const {api} = renderBar({'GET /settings/quick-phrases': [200, []]});

    await waitFor(() => expect(api.calls).toHaveLength(1));
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });
});
