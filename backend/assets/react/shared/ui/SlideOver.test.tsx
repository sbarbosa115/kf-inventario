import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState} from 'react';
import {ConfirmModal} from './ConfirmModal';
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

  it('with a question asked over it, Escape cancels the question and leaves the panel open', async () => {
    const onClose = vi.fn();
    function Stacked() {
      const [asking, setAsking] = useState(true);
      return (
        <SlideOver title="Order W00001" onClose={onClose}>
          {asking && (
            <ConfirmModal
              title="Mark as shipped?"
              onConfirm={vi.fn()}
              onCancel={() => setAsking(false)}
            >
              W00001 goes to Shipped.
            </ConfirmModal>
          )}
        </SlideOver>
      );
    }
    render(<Stacked />);

    await userEvent.keyboard('{Escape}');
    expect(
      screen.queryByRole('dialog', {name: 'Mark as shipped?'}),
    ).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(document.body).toHaveClass('modal-open');

    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps the title and × apart from the facts under them, which share the scrolling part with the body', () => {
    render(
      <SlideOver
        title="Order W00001"
        onClose={vi.fn()}
        header={<p>Status: Created</p>}
      >
        <p>Customer: Jose Perez</p>
      </SlideOver>,
    );

    const facts = screen.getByText('Status: Created');
    const header = screen
      .getByRole('heading', {name: 'Order W00001'})
      .closest('header')!;
    expect(header).toContainElement(
      screen.getByRole('button', {name: 'Close'}),
    );
    expect(
      header,
      'the facts are not part of the fixed header: on a phone they would take half of its height',
    ).not.toContainElement(facts);
    // One scrolling part on a phone (the CSS makes it the scroller there); on a desktop the body alone scrolls.
    expect(facts.closest('.kf-slideover__scroll')).toContainElement(
      screen.getByText('Customer: Jose Perez'),
    );
  });
});
