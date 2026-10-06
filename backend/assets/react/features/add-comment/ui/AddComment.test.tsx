import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {vi} from 'vitest';
import {fakeApi} from '@/shared/test/fakeApi';
import {AddComment} from './AddComment';

const SAVED = {
  id: 30,
  content: 'Call before delivering',
  created_at: '2026-10-06T09:00:00-05:00',
  approximate: false,
  author: {id: 1, name: 'Ana Gomez'},
  origin: 'app',
  shop: null,
  pinned: false,
  pinned_at: null,
  pinned_by: null,
  sent_to_shop: false,
};

function renderBox({
  shop = null,
  answer = [201, SAVED] as [number, unknown],
}: {
  shop?: {id: number; name: string; takes_notes?: boolean} | null;
  answer?: [number, unknown];
} = {}) {
  const api = fakeApi({'POST /orders/4/comments': answer});
  const onAdded = vi.fn();
  render(<AddComment orderId={4} shop={shop} onAdded={onAdded} />);
  const box = screen.getByRole('textbox', {name: 'Write a note…'});
  const posts = () => api.calls.filter((c) => c.method === 'POST');
  return {api, onAdded, box, posts};
}

describe('AddComment', () => {
  it('sends the note with Enter, clears the box and keeps the focus there for the next one', async () => {
    const {box, posts, onAdded} = renderBox();

    await userEvent.type(box, 'Call before delivering{Enter}');

    await waitFor(() => expect(onAdded).toHaveBeenCalledWith(SAVED));
    expect(posts()[0]?.body, 'only the text: no shop, no phrase').toEqual({
      content: 'Call before delivering',
    });
    expect(box, 'the box is ready for the next note').toHaveValue('');
    expect(box, 'the focus stays in the box after sending').toHaveFocus();
  });

  it('starts a new line with Shift+Enter and sends nothing', async () => {
    const {box, posts} = renderBox();

    await userEvent.type(box, 'First line{Shift>}{Enter}{/Shift}second line');

    expect(box).toHaveValue('First line\nsecond line');
    expect(posts(), 'Shift+Enter never sends').toHaveLength(0);
  });

  it('sends with the Send button too (the way on a phone), and never a blank note', async () => {
    const {box, posts, onAdded} = renderBox();
    const send = screen.getByRole('button', {name: 'Send'});

    expect(send, 'nothing to send yet').toBeDisabled();
    await userEvent.type(box, '   {Enter}');
    expect(posts(), 'a blank note is not sent').toHaveLength(0);

    await userEvent.type(box, 'Gift wrap');
    await userEvent.click(send);
    await waitFor(() => expect(onAdded).toHaveBeenCalled());
    expect(posts()[0]?.body, 'trimmed').toEqual({content: 'Gift wrap'});
    expect(box).toHaveAttribute('enterkeyhint', 'send');
  });

  it('says why it failed, in place, and keeps what was typed', async () => {
    const {box, onAdded} = renderBox({
      answer: [500, {error: 'internal_error'}],
    });

    await userEvent.type(box, 'Important note{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong on our side',
    );
    expect(box, 'nothing typed is lost').toHaveValue('Important note');
    expect(onAdded).not.toHaveBeenCalled();
  });

  it('offers to send the note to the shop only for an order from a shop, and sends it there when ticked', async () => {
    const {box, posts} = renderBox({
      shop: {id: 2, name: 'Fake shop', takes_notes: true},
    });

    const toShop = screen.getByRole('checkbox', {
      name: 'Also send to Fake shop as an order note',
    });
    expect(toShop, 'off unless asked').not.toBeChecked();
    await userEvent.click(toShop);
    await userEvent.type(box, 'Your order ships today{Enter}');

    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(posts()[0]?.body).toEqual({
      content: 'Your order ships today',
      send_to_shop: true,
    });
    await waitFor(() => expect(toShop, 'one note at a time').not.toBeChecked());
  });

  it('has no shop checkbox for an order typed here', () => {
    renderBox();

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('has no shop checkbox when the order’s shop takes no notes (switched off or inactive)', () => {
    renderBox({shop: {id: 2, name: 'Fake shop', takes_notes: false}});

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('when the shop cannot take notes, says so, keeps the text and drops the checkbox', async () => {
    const {box} = renderBox({
      shop: {id: 2, name: 'Fake shop'},
      answer: [422, {error: 'shop_note_unavailable', message: 'No'}],
    });

    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.type(box, 'To the shop{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This order cannot send notes to its shop now',
    );
    expect(box).toHaveValue('To the shop');
    expect(
      screen.queryByRole('checkbox'),
      'it would only fail again: send it without the shop',
    ).not.toBeInTheDocument();
  });
});
