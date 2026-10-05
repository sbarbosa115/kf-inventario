import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import {RowMenu} from './RowMenu';

function renderMenu(onDelete = vi.fn(), onEdit = vi.fn()) {
  render(
    <MemoryRouter>
      <RowMenu
        label="Actions for W00001"
        actions={[
          {label: 'Edit', icon: 'fa-pen', onSelect: onEdit},
          {label: 'Getting ready', href: '/admin/orders/1/getting-ready'},
          {label: 'Excel', disabled: true, onSelect: vi.fn()},
          {label: 'Delete', danger: true, onSelect: onDelete},
        ]}
      />
    </MemoryRouter>,
  );
}

describe('RowMenu', () => {
  it('opens on its button and runs the chosen action', async () => {
    const onEdit = vi.fn();
    renderMenu(vi.fn(), onEdit);

    const button = screen.getByRole('button', {name: 'Actions for W00001'});
    expect(button).toHaveAttribute('aria-haspopup', 'menu');
    await userEvent.click(button);
    expect(screen.getByRole('menu')).toBeVisible();
    expect(
      screen.getByRole('menuitem', {name: 'Getting ready'}),
    ).toHaveAttribute('href', '/admin/orders/1/getting-ready');
    expect(screen.getByRole('menuitem', {name: 'Delete'})).toHaveClass(
      'kf-menu__item--danger',
    );
    await userEvent.click(screen.getByRole('menuitem', {name: 'Edit'}));
    expect(onEdit).toHaveBeenCalled();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('moves with the arrow keys, skips what is disabled, and Escape goes back to the button', async () => {
    const onDelete = vi.fn();
    renderMenu(onDelete);

    const button = screen.getByRole('button', {name: 'Actions for W00001'});
    button.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', {name: 'Edit'})).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(screen.getByRole('menuitem', {name: 'Delete'})).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', {name: 'Edit'})).toHaveFocus();
    await userEvent.keyboard('{End}{Enter}');
    expect(onDelete).toHaveBeenCalled();

    await userEvent.click(button);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });
});
