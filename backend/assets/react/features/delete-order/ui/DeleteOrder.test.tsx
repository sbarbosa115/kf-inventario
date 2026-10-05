import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {vi} from 'vitest';
import {fakeApi} from '@/shared/test/fakeApi';
import {DeleteOrderButton} from './DeleteOrderButton';

const ORDER = {id: 7, code: 'W00007'};

function renderButton() {
  const onDeleted = vi.fn();
  render(<DeleteOrderButton order={ORDER} onDeleted={onDeleted} />);
  return onDeleted;
}

const open = () =>
  userEvent.click(screen.getByRole('button', {name: 'Delete Order W00007'}));

describe('DeleteOrderButton', () => {
  it('asks before deleting, then deletes the order and says so to the list', async () => {
    const api = fakeApi({'DELETE /orders/7': [204]});
    const onDeleted = renderButton();

    await open();
    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByText(
        'Are you sure that you want to delete this order?',
      ),
    ).toBeInTheDocument();
    expect(
      api.calls,
      'nothing is deleted before the question is answered',
    ).toHaveLength(0);
    await userEvent.click(within(dialog).getByRole('button', {name: 'Delete'}));

    expect(api.calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'DELETE /orders/7',
    ]);
    expect(onDeleted).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps the order when the question is cancelled', async () => {
    const api = fakeApi({});
    const onDeleted = renderButton();

    await open();
    await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.calls).toHaveLength(0);
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('counts an order somebody else already deleted as deleted', async () => {
    fakeApi({
      'DELETE /orders/7': [
        404,
        {error: 'order_not_found', message: 'Not found'},
      ],
    });
    const onDeleted = renderButton();

    await open();
    await userEvent.click(screen.getByRole('button', {name: 'Delete'}));

    expect(onDeleted).toHaveBeenCalledTimes(1);
  });

  it('says why a delete failed and keeps the question open', async () => {
    fakeApi({'DELETE /orders/7': [500, {error: 'internal_error'}]});
    const onDeleted = renderButton();

    await open();
    await userEvent.click(screen.getByRole('button', {name: 'Delete'}));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong on our side',
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('says so when the person may not delete orders', async () => {
    fakeApi({
      'DELETE /orders/7': [403, {error: 'forbidden', message: 'Forbidden'}],
    });
    renderButton();

    await open();
    await userEvent.click(screen.getByRole('button', {name: 'Delete'}));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'You do not have permission to do this.',
    );
  });
});
