import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {ConfirmModal} from './ConfirmModal';

describe('ConfirmModal', () => {
  it('names the consequence; the confirm is danger only when it destroys, Cancel never is', async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmModal
        title="Delete order W00001?"
        confirmLabel="Delete"
        danger
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      >
        Its products and comments are removed.
      </ConfirmModal>,
    );

    expect(
      screen.getByRole('dialog', {name: 'Delete order W00001?'}),
    ).toHaveTextContent('Its products and comments are removed.');
    expect(screen.getByRole('button', {name: 'Delete'})).toHaveClass(
      'kf-btn--danger',
    );
    expect(screen.getByRole('button', {name: 'Cancel'})).toHaveClass(
      'kf-btn--secondary',
    );
    await userEvent.click(screen.getByRole('button', {name: 'Delete'}));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('is cancelled by Escape, and busy while the action runs', async () => {
    const onCancel = vi.fn();
    render(
      <ConfirmModal
        title="Mark W00001 as Processed?"
        busy
        onConfirm={vi.fn()}
        onCancel={onCancel}
      >
        The status changes for everyone.
      </ConfirmModal>,
    );

    expect(screen.getByRole('button', {name: 'Confirm'})).toHaveClass(
      'kf-btn--primary',
    );
    expect(screen.getByRole('button', {name: 'Confirm'})).toHaveAttribute(
      'aria-busy',
      'true',
    );
    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalled();
  });
});
