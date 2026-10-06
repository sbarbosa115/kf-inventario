import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {vi} from 'vitest';
import {fakeApi} from '@/shared/test/fakeApi';
import {ToastProvider} from '@/shared/ui';
import {SyncOrdersButton} from './SyncOrdersButton';

function renderButton() {
  const onSynced = vi.fn();
  render(
    <ToastProvider>
      <SyncOrdersButton onSynced={onSynced} />
    </ToastProvider>,
  );
  return onSynced;
}

const sync = () =>
  userEvent.click(screen.getByRole('button', {name: 'Sync shop orders'}));

describe('SyncOrdersButton', () => {
  it('is a labelled button, not an icon alone', () => {
    fakeApi({});
    renderButton();

    expect(
      screen.getByRole('button', {name: 'Sync shop orders'}),
    ).toHaveTextContent('Sync shop orders');
  });

  it('pulls the shops’ orders, says how many were imported and skipped in a toast, and tells the list', async () => {
    const api = fakeApi({
      'POST /orders/sync': [202, {imported: 3, skipped: 2}],
    });
    const onSynced = renderButton();

    await sync();

    expect(await screen.findByRole('status')).toHaveTextContent(
      '3 orders imported, 2 skipped.',
    );
    expect(onSynced).toHaveBeenCalledTimes(1);
    expect(api.calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'POST /orders/sync',
    ]);
  });

  it('is busy while it runs and cannot be pressed twice', async () => {
    let answer: (value: Response) => void = () => {};
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>((resolve) => (answer = resolve))),
    );
    renderButton();

    await sync();

    const button = screen.getByRole('button', {name: 'Syncing shop orders…'});
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    answer(
      new Response(JSON.stringify({imported: 0, skipped: 0}), {status: 202}),
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', {name: 'Sync shop orders'}),
      ).toBeEnabled(),
    );
  });

  it('says the shops could not be reached when the pull failed (502), in a toast that stays', async () => {
    fakeApi({
      'POST /orders/sync': [
        502,
        {error: 'order_sync_failed', message: 'Bad gateway'},
      ],
    });
    const onSynced = renderButton();

    await sync();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The shops could not be reached, so no order was imported. Try again in a moment.',
    );
    expect(onSynced).not.toHaveBeenCalled();
  });

  it('says the pull is not available while the server cannot do it (501)', async () => {
    fakeApi({
      'POST /orders/sync': [
        501,
        {error: 'order_sync_unavailable', message: 'Not implemented'},
      ],
    });
    renderButton();

    await sync();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Pulling orders from the shops is not available yet.',
    );
  });

  it('says it is our side for any other failure', async () => {
    fakeApi({'POST /orders/sync': [500, {error: 'internal_error'}]});
    renderButton();

    await sync();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong on our side. Try again in a moment.',
    );
  });
});
