import {render, screen} from '@testing-library/react';
import {EmptyState} from './EmptyState';
import {KpiStrip} from './KpiStrip';
import {Skeleton} from './Skeleton';

describe('Skeleton', () => {
  it('is announced once as Loading, its shapes hidden', () => {
    const {container} = render(<Skeleton variant="row" lines={4} />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading');
    expect(
      container.querySelectorAll('.kf-skeleton__block[aria-hidden="true"]'),
    ).toHaveLength(4);
  });
});

describe('KpiStrip', () => {
  it('lists each figure with its label', () => {
    render(
      <KpiStrip
        items={[
          {label: 'Products', value: 3},
          {label: 'Units', value: 300, tone: 'warning'},
        ]}
      />,
    );

    expect(screen.getByText('Products').nextSibling).toHaveTextContent('3');
    expect(screen.getByText('Units').parentElement).toHaveClass(
      'kf-kpi--warning',
    );
  });
});

describe('EmptyState', () => {
  it('says why and offers the way on', () => {
    render(
      <EmptyState
        icon="fa-box-open"
        title="Nothing waiting"
        message="Products moved here show up here."
        action={<button type="button">Show all</button>}
      />,
    );

    expect(screen.getByText('Nothing waiting')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Show all'})).toBeInTheDocument();
  });
});
