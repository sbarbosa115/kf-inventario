import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {vi} from 'vitest';
import {fakeApi} from '@/shared/test/fakeApi';
import {ToastProvider} from '@/shared/ui';
import {CheckNowButton} from './CheckNowButton';

function renderButton() {
  const onChecked = vi.fn();
  render(
    <ToastProvider>
      <CheckNowButton onChecked={onChecked} />
    </ToastProvider>,
  );
  return onChecked;
}

const check = () =>
  userEvent.click(screen.getByRole('button', {name: 'Check now'}));

const row = (
  id: number,
  name: string,
  imported: number,
  skipped: number,
  error: string | null = null,
) => ({id, name, imported, skipped, error});

describe('CheckNowButton', () => {
  it('is a labelled secondary button', () => {
    fakeApi({});
    renderButton();

    const button = screen.getByRole('button', {name: 'Check now'});
    expect(button).toHaveTextContent('Check now');
    expect(button).toHaveClass('kf-btn--secondary');
  });

  it('says what every shop brought in, in one toast, and tells the list', async () => {
    const api = fakeApi({
      'POST /orders/sync': [
        202,
        {
          imported: 3,
          skipped: 1,
          failed: 0,
          connections: [row(1, 'Kfvintage', 2, 1), row(2, 'Klassicfab', 1, 0)],
        },
      ],
    });
    const onChecked = renderButton();

    await check();

    expect(await screen.findByRole('status')).toHaveTextContent(
      '3 orders imported from 2 shops, 1 skipped.',
    );
    expect(onChecked).toHaveBeenCalledTimes(1);
    expect(api.calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'POST /orders/sync',
    ]);
  });

  it('counts one order and one shop in the singular', async () => {
    fakeApi({
      'POST /orders/sync': [
        202,
        {
          imported: 1,
          skipped: 0,
          failed: 0,
          connections: [row(1, 'Kfvintage', 1, 0)],
        },
      ],
    });
    renderButton();

    await check();

    expect(await screen.findByRole('status')).toHaveTextContent(
      '1 order imported from 1 shop, 0 skipped.',
    );
  });

  it('names the shops that could not be read, in a toast that stays, and still reloads the list', async () => {
    fakeApi({
      'POST /orders/sync': [
        202,
        {
          imported: 3,
          skipped: 1,
          failed: 2,
          connections: [
            row(1, 'Klassicfab', 3, 1),
            row(2, 'Kfvintage', 0, 0, 'Consumer key is invalid.'),
            row(3, 'Kfoutlet', 0, 0, 'Timed out'),
          ],
        },
      ],
    });
    const onChecked = renderButton();

    await check();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '3 orders imported from 1 shop, 1 skipped; Kfvintage, Kfoutlet could not be read.',
    );
    expect(onChecked).toHaveBeenCalledTimes(1);
  });

  it('says there is nothing to check without an active connection', async () => {
    fakeApi({
      'POST /orders/sync': [
        202,
        {imported: 0, skipped: 0, failed: 0, connections: []},
      ],
    });
    renderButton();

    await check();

    expect(await screen.findByRole('status')).toHaveTextContent(
      'No shop connection is active, so there was nothing to check.',
    );
  });

  it('is busy while it runs and cannot be pressed twice', async () => {
    let answer: (value: Response) => void = () => {};
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>((resolve) => (answer = resolve))),
    );
    renderButton();

    await check();

    const button = screen.getByRole('button', {name: 'Checking the shops…'});
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    answer(
      new Response(
        JSON.stringify({imported: 0, skipped: 0, failed: 0, connections: []}),
        {status: 202},
      ),
    );
    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'Check now'})).toBeEnabled(),
    );
  });

  it('says no shop could be read when every one failed (502)', async () => {
    fakeApi({
      'POST /orders/sync': [
        502,
        {error: 'order_sync_failed', message: 'Kfvintage'},
      ],
    });
    const onChecked = renderButton();

    await check();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The shops could not be reached, so no order was imported. Try again in a moment.',
    );
    expect(onChecked).not.toHaveBeenCalled();
  });

  it('says it is our side for any other failure', async () => {
    fakeApi({'POST /orders/sync': [500, {error: 'internal_error'}]});
    renderButton();

    await check();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong on our side. Try again in a moment.',
    );
  });
});
