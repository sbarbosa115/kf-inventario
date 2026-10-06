import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import {Button} from './Button';

describe('Button', () => {
  it('draws each variant and size', () => {
    render(
      <>
        <Button variant="primary">Save</Button>
        <Button variant="danger" size="lg">
          Delete
        </Button>
        <Button variant="ghost" size="sm">
          Cancel
        </Button>
        <Button>Export</Button>
      </>,
    );

    expect(screen.getByRole('button', {name: 'Save'})).toHaveClass(
      'kf-btn--primary',
      'kf-btn--md',
    );
    expect(screen.getByRole('button', {name: 'Delete'})).toHaveClass(
      'kf-btn--danger',
      'kf-btn--lg',
    );
    expect(screen.getByRole('button', {name: 'Cancel'})).toHaveClass(
      'kf-btn--ghost',
    );
    expect(screen.getByRole('button', {name: 'Export'})).toHaveClass(
      'kf-btn--secondary',
    );
  });

  it('while loading keeps its label, is busy and cannot be pressed again', async () => {
    const onClick = vi.fn();
    render(
      <Button variant="primary" loading onClick={onClick}>
        Save
      </Button>,
    );

    const button = screen.getByRole('button', {name: 'Save'});
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('icon-only takes its name from aria-label and shows it as a tooltip', () => {
    render(<Button icon="fa-sync" aria-label="Sync shop orders" />);

    expect(
      screen.getByRole('button', {name: 'Sync shop orders'}),
    ).toHaveAttribute('title', 'Sync shop orders');
  });

  it('navigates as a link with `to` or `href`', () => {
    render(
      <MemoryRouter>
        <Button variant="primary" to="/admin/products/new" icon="fa-plus">
          Create product
        </Button>
        <Button href="/api/v1/orders/1/pdf">PDF</Button>
        <Button href="/api/v1/invoices/1/pdf" target="_blank">
          Open PDF
        </Button>
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', {name: 'Create product'})).toHaveAttribute(
      'href',
      '/admin/products/new',
    );
    expect(screen.getByRole('link', {name: 'PDF'})).toHaveAttribute(
      'href',
      '/api/v1/orders/1/pdf',
    );
    expect(screen.getByRole('link', {name: 'PDF'})).not.toHaveAttribute('rel');
    expect(screen.getByRole('link', {name: 'Open PDF'})).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
  });
});
