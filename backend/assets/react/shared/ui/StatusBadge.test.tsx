import {render, screen} from '@testing-library/react';
import {StatusBadge} from './StatusBadge';

describe('StatusBadge', () => {
  it('says the status in words, in its tone', () => {
    render(
      <>
        <StatusBadge tone="warning">Partial</StatusBadge>
        <StatusBadge tone="accent" filled icon="fa-check">
          Delivered
        </StatusBadge>
      </>,
    );

    expect(screen.getByText('Partial')).toHaveClass('kf-badge--warning');
    expect(screen.getByText('Delivered')).toHaveClass(
      'kf-badge--accent',
      'kf-badge--filled',
    );
  });
});
