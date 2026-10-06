import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState} from 'react';
import {ClearFilters, FilterChips, SearchBox, Toolbar} from './Toolbar';

function Filters({onClear = vi.fn()}: {onClear?: () => void}) {
  const [status, setStatus] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  return (
    <Toolbar label="Filters">
      <FilterChips
        label="Status"
        allCount={12}
        options={[
          {key: 'created', label: 'Created', count: 2},
          {key: 'sent', label: 'Sent', count: 3},
        ]}
        value={status}
        onChange={setStatus}
      />
      <SearchBox value={query} onChange={setQuery} />
      <ClearFilters onClick={onClear} />
      <output>{`${status ?? 'all'}|${query}`}</output>
    </Toolbar>
  );
}

describe('Toolbar', () => {
  it('chips start on All and say how many rows each keeps', async () => {
    render(<Filters />);

    const chips = screen.getAllByRole('button', {pressed: false});
    expect(
      screen.getByRole('button', {name: 'All 12', pressed: true}),
    ).toBeVisible();
    expect(chips[0]).toHaveTextContent('Created 2');
    await userEvent.click(screen.getByRole('button', {name: 'Sent 3'}));
    expect(screen.getByRole('button', {name: 'Sent 3'})).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('status')).toHaveTextContent('sent|');
  });

  it('the search box is cleared by its button and by Escape', async () => {
    render(<Filters />);

    const search = screen.getByRole('searchbox', {name: 'Search'});
    await userEvent.type(search, 'KF');
    expect(screen.getByRole('status')).toHaveTextContent('all|KF');
    await userEvent.click(
      screen.getByRole('button', {name: 'Clear the search'}),
    );
    expect(search).toHaveValue('');
    await userEvent.type(search, 'x{Escape}');
    expect(search).toHaveValue('');
  });

  it('clears every filter', async () => {
    const onClear = vi.fn();
    render(<Filters onClear={onClear} />);

    await userEvent.click(screen.getByRole('button', {name: 'Clear filters'}));
    expect(onClear).toHaveBeenCalled();
  });
});
