import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import {Button} from './Button';
import {PageHeader} from './PageHeader';

describe('PageHeader', () => {
  it('titles the page and the browser tab, with its actions and the way back', async () => {
    render(
      <MemoryRouter>
        <PageHeader
          title="Orders"
          subtitle="12 orders"
          back="/admin"
          primary={<Button variant="primary">Create order</Button>}
          secondary={<Button>Sync shop orders</Button>}
        />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', {level: 1, name: 'Orders'}),
    ).toBeVisible();
    expect(document.title).toBe('Orders · KF Inventory');
    expect(screen.getByText('12 orders')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: /Back/})).toHaveAttribute(
      'href',
      '/admin',
    );
    expect(screen.getByRole('button', {name: 'Create order'})).toBeVisible();
    const more = screen.getByRole('button', {name: 'More'});
    await userEvent.click(more);
    expect(more).toHaveAttribute('aria-expanded', 'true');
  });
});
