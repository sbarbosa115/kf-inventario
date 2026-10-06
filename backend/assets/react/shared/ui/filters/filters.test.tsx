import {act, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState} from 'react';
import type {FilterValue} from '@/shared/api';
import {ActiveFilters} from './ActiveFilters';
import {DateRangeFilter} from './DateRangeFilter';
import {FilterDropdown} from './FilterDropdown';
import {Pager} from './Pager';
import {RangeFilter} from './RangeFilter';
import {TextFilterInput} from './TextFilterInput';
import {bogotaToday, quickRange} from './dates';
import type {FilterColumn} from './types';

const STATUS: FilterColumn = {
  label: 'Status',
  filter: {
    type: 'enum',
    field: 'status',
    options: [
      {value: '1', label: 'Created'},
      {value: '2', label: 'Processed'},
    ],
  },
};

describe('the filter controls', () => {
  it('FilterDropdown: a checkbox list with the counts; the button says how many are ticked', async () => {
    function Host() {
      const [value, setValue] = useState<string[]>([]);
      return (
        <FilterDropdown
          label="Status"
          options={[
            {value: '1', label: 'Created'},
            {value: '2', label: 'Processed'},
          ]}
          counts={{'1': 12, '2': 3}}
          value={value}
          onChange={setValue}
        />
      );
    }
    render(<Host />);

    await userEvent.click(screen.getByRole('button', {name: 'Status'}));
    const panel = screen.getByRole('dialog', {name: 'Status'});
    expect(panel).toHaveTextContent('Created12');
    await userEvent.click(screen.getByRole('checkbox', {name: /Created/}));
    await userEvent.click(screen.getByRole('checkbox', {name: /Processed/}));

    expect(
      screen.getByRole('button', {name: 'Status · 2', expanded: true}),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Clear'}));
    expect(screen.getByRole('checkbox', {name: /Created/})).not.toBeChecked();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Status'})).toHaveFocus();
  });

  it('DateRangeFilter: two days and the quick picks, in Bogotá days', async () => {
    const changes: unknown[] = [];
    render(
      <DateRangeFilter
        label="Created"
        value={{}}
        onChange={(v) => changes.push(v)}
      />,
    );

    await userEvent.click(screen.getByRole('button', {name: 'Created'}));
    await userEvent.click(screen.getByRole('button', {name: 'Last 7 days'}));

    expect(changes.at(-1)).toEqual(quickRange('last7'));
    expect(screen.getByLabelText('From')).toBeInTheDocument();
    expect(screen.getByLabelText('To')).toBeInTheDocument();
  });

  it('the quick picks end today in Bogotá, both ends included', () => {
    // 2026-10-07 03:00 UTC is still the 6th in Bogotá (UTC−5).
    const now = new Date('2026-10-07T03:00:00Z');
    expect(bogotaToday(now)).toBe('2026-10-06');
    expect(quickRange('today', now)).toEqual({
      from: '2026-10-06',
      to: '2026-10-06',
    });
    expect(quickRange('last7', now)).toEqual({
      from: '2026-09-30',
      to: '2026-10-06',
    });
    expect(quickRange('last30', now)).toEqual({
      from: '2026-09-07',
      to: '2026-10-06',
    });
    expect(quickRange('thisMonth', now)).toEqual({
      from: '2026-10-01',
      to: '2026-10-06',
    });
  });

  it('DateRangeFilter: the button reads the range', () => {
    render(
      <DateRangeFilter
        label="Created"
        value={{from: '2026-10-01', to: '2026-10-06'}}
        onChange={() => undefined}
      />,
    );
    expect(
      screen.getByRole('button', {name: 'Created: Oct 1, 2026 – Oct 6, 2026'}),
    ).toBeInTheDocument();
  });

  it('RangeFilter: money quick ranges and min/max typed', async () => {
    const changes: unknown[] = [];
    render(
      <RangeFilter
        label="Price"
        kind="money"
        value={{}}
        onChange={(v) => changes.push(v)}
      />,
    );

    await userEvent.click(screen.getByRole('button', {name: 'Price'}));
    await userEvent.click(screen.getByRole('button', {name: 'Over $500'}));
    expect(changes.at(-1)).toEqual({min: '500.01'});

    await userEvent.type(screen.getByLabelText('Min'), '20{Enter}');
    expect(changes.at(-1)).toEqual({min: '20'});
  });

  it('TextFilterInput: applies after a pause, at once on Enter', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const changes: string[] = [];
    render(
      <TextFilterInput
        label="Code"
        value=""
        onChange={(v) => changes.push(v)}
      />,
    );
    const input = screen.getByRole('searchbox', {name: 'Filter by Code'});

    await userEvent.type(input, 'W0');
    expect(changes).toEqual([]);
    act(() => vi.advanceTimersByTime(300));
    expect(changes).toEqual(['W0']);
    await userEvent.type(input, '7{Enter}');
    expect(changes).toEqual(['W0', 'W07']);
    vi.useRealTimers();
  });

  it('ActiveFilters: one removable chip per filter, and Clear filters', async () => {
    const removed: string[] = [];
    let cleared = false;
    const filters: Record<string, FilterValue> = {
      status: ['1', '2'],
      code: 'W0',
    };
    render(
      <ActiveFilters
        columns={[
          STATUS,
          {label: 'Order', filter: {type: 'text', field: 'code'}},
        ]}
        filters={filters}
        onRemove={(field) => removed.push(field)}
        onClear={() => (cleared = true)}
      />,
    );

    expect(screen.getByText('Status: Created, Processed')).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', {name: 'Remove the filter Order: W0'}),
    );
    expect(removed).toEqual(['code']);
    await userEvent.click(screen.getByRole('button', {name: 'Clear filters'}));
    expect(cleared).toBe(true);
  });

  it('ActiveFilters: nothing when no column filters', () => {
    const {container} = render(
      <ActiveFilters
        columns={[STATUS]}
        filters={{}}
        onRemove={() => undefined}
        onClear={() => undefined}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('Pager: the range of rows, Previous/Next and the rows per page', async () => {
    const pages: number[] = [];
    const sizes: number[] = [];
    render(
      <Pager
        page={2}
        perPage={25}
        total={1240}
        onPage={(p) => pages.push(p)}
        onPerPage={(s) => sizes.push(s)}
      />,
    );

    expect(screen.getByRole('navigation', {name: 'Pages'})).toHaveTextContent(
      '26 – 50 of 1,240',
    );
    await userEvent.click(screen.getByRole('button', {name: 'Next'}));
    await userEvent.click(screen.getByRole('button', {name: 'Previous'}));
    await userEvent.selectOptions(
      screen.getByLabelText('Rows per page'),
      '100',
    );
    expect(pages).toEqual([3, 1]);
    expect(sizes).toEqual([100]);
    await waitFor(() => expect(sizes).toHaveLength(1));
  });
});
