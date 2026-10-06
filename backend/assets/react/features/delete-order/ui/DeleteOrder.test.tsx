import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {vi} from 'vitest';
import {fakeApi} from '@/shared/test/fakeApi';
import {ToastProvider} from '@/shared/ui';
import {DeleteOrderConfirm} from './DeleteOrderConfirm';

const ORDER = {id: 7, code: 'W00007'};

function renderConfirm() {
  const onDeleted = vi.fn();
  const onCancel = vi.fn();
  render(
    <ToastProvider>
      <DeleteOrderConfirm
        order={ORDER}
        onDeleted={onDeleted}
        onCancel={onCancel}
      />
    </ToastProvider>,
  );
  return {onDeleted, onCancel};
}

const confirm = () =>
  userEvent.click(screen.getByRole('button', {name: 'Delete order'}));

describe('DeleteOrderConfirm', () => {
  it('names the order and what goes with it, then deletes it and says so', async () => {
    const api = fakeApi({'DELETE /orders/7': [204]});
    const {onDeleted} = renderConfirm();

    const dialog = screen.getByRole('dialog', {name: 'Delete order W00007?'});
    expect(dialog).toHaveTextContent(
      'Its products and comments are removed with it. This cannot be undone.',
    );
    expect(
      within(dialog).getByRole('button', {name: 'Cancel'}),
      'Cancel is never red',
    ).not.toHaveClass('kf-btn--danger');
    expect(
      within(dialog).getByRole('button', {name: 'Delete order'}),
    ).toHaveClass('kf-btn--danger');
    expect(api.calls, 'nothing is deleted before the answer').toHaveLength(0);
    await confirm();

    expect(api.calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'DELETE /orders/7',
    ]);
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Order W00007 was deleted.',
    );
    expect(onDeleted).toHaveBeenCalledTimes(1);
  });

  it('keeps the order when the question is cancelled', async () => {
    const api = fakeApi({});
    const {onDeleted, onCancel} = renderConfirm();

    await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

    expect(onCancel).toHaveBeenCalled();
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
    const {onDeleted} = renderConfirm();

    await confirm();

    expect(onDeleted).toHaveBeenCalledTimes(1);
  });

  it('says why a delete failed and keeps the question open', async () => {
    fakeApi({'DELETE /orders/7': [500, {error: 'internal_error'}]});
    const {onDeleted} = renderConfirm();

    await confirm();

    expect(
      await within(screen.getByRole('dialog')).findByRole('alert'),
    ).toHaveTextContent('Something went wrong on our side');
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('says so when the person may not delete orders', async () => {
    fakeApi({
      'DELETE /orders/7': [403, {error: 'forbidden', message: 'Forbidden'}],
    });
    renderConfirm();

    await confirm();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'You do not have permission to do this.',
    );
  });
});
