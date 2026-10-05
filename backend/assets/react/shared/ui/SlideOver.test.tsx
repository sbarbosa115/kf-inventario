import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState} from 'react';
import {SlideOver} from './SlideOver';

function Page({onClose = vi.fn()}: {onClose?: () => void}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open W00001
      </button>
      {open && (
        <SlideOver
          title="Order W00001"
          onClose={() => {
            onClose();
            setOpen(false);
          }}
          footer={<button type="button">Edit</button>}
        >
          <a href="#customer">Customer</a>
        </SlideOver>
      )}
    </>
  );
}

describe('SlideOver', () => {
  it('is a named dialog that keeps the focus inside and locks the page', async () => {
    render(<Page />);
    await userEvent.click(screen.getByRole('button', {name: 'Open W00001'}));

    const dialog = screen.getByRole('dialog', {name: 'Order W00001'});
    expect(dialog).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');
    await userEvent.tab();
    expect(screen.getByRole('button', {name: 'Close'})).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('link', {name: 'Customer'})).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', {name: 'Edit'})).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', {name: 'Close'})).toHaveFocus();
    await userEvent.tab({shift: true});
    expect(screen.getByRole('button', {name: 'Edit'})).toHaveFocus();
  });

  it('closes with Escape and gives the focus back', async () => {
    const onClose = vi.fn();
    render(<Page onClose={onClose} />);
    const opener = screen.getByRole('button', {name: 'Open W00001'});
    await userEvent.click(opener);

    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    expect(document.body.style.overflow).toBe('');
  });
});
