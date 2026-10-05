import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {vi} from 'vitest';
import {fakeApi} from '@/shared/test/fakeApi';
import {SyncOrdersButton} from './SyncOrdersButton';

function renderButton() {
  const onResult = vi.fn();
  render(<SyncOrdersButton onResult={onResult} />);
  return onResult;
}

const sync = () =>
  userEvent.click(screen.getByRole('button', {name: 'Sync Orders'}));

describe('SyncOrdersButton', () => {
  it('pulls the shops’ orders and says how many were imported and skipped', async () => {
    const api = fakeApi({
      'POST /orders/sync': [202, {imported: 3, skipped: 2}],
    });
    const onResult = renderButton();

    await sync();

    await waitFor(() =>
      expect(onResult).toHaveBeenCalledWith({
        ok: true,
        message: '3 orders imported, 2 skipped.',
      }),
    );
    expect(api.calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'POST /orders/sync',
    ]);
  });

  it('turns while it runs and cannot be pressed twice', async () => {
    let answer: (value: Response) => void = () => {};
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>((resolve) => (answer = resolve))),
    );
    renderButton();

    await sync();

    const button = screen.getByRole('button', {name: 'Syncing orders…'});
    expect(button).toBeDisabled();
    expect(button.querySelector('.fa-spin')).not.toBeNull();
    answer(
      new Response(JSON.stringify({imported: 0, skipped: 0}), {status: 202}),
    );
    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'Sync Orders'})).toBeEnabled(),
    );
  });

  it('says the shops could not be reached when the pull failed (502)', async () => {
    fakeApi({
      'POST /orders/sync': [
        502,
        {error: 'order_sync_failed', message: 'Bad gateway'},
      ],
    });
    const onResult = renderButton();

    await sync();

    await waitFor(() =>
      expect(onResult).toHaveBeenCalledWith({
        ok: false,
        message:
          'The shops could not be reached, so no order was imported. Try again in a moment.',
      }),
    );
  });

  it('says the pull is not available while the server cannot do it (501)', async () => {
    fakeApi({
      'POST /orders/sync': [
        501,
        {error: 'order_sync_unavailable', message: 'Not implemented'},
      ],
    });
    const onResult = renderButton();

    await sync();

    await waitFor(() =>
      expect(onResult).toHaveBeenCalledWith({
        ok: false,
        message: 'Pulling orders from the shops is not available yet.',
      }),
    );
  });

  it('says it is our side for any other failure', async () => {
    fakeApi({'POST /orders/sync': [500, {error: 'internal_error'}]});
    const onResult = renderButton();

    await sync();

    await waitFor(() =>
      expect(onResult).toHaveBeenCalledWith({
        ok: false,
        message: 'Something went wrong on our side. Try again in a moment.',
      }),
    );
  });
});
