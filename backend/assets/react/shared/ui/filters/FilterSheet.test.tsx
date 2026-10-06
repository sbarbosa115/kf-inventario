import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {FilterSheet, type SheetDraft} from './FilterSheet';
import type {FilterColumn} from './types';

const COLUMNS: FilterColumn[] = [
  {
    label: 'Status',
    filter: {
      type: 'enum',
      field: 'status',
      options: [
        {value: '1', label: 'Created'},
        {value: '2', label: 'Processed'},
      ],
    },
  },
  {label: 'Created', filter: {type: 'date', field: 'created_at'}},
];

describe('FilterSheet (DS-16)', () => {
  it('counts what is ticked on the server and applies it with "Show N results"', async () => {
    const counted: SheetDraft[] = [];
    const applied: SheetDraft[] = [];
    render(
      <>
        <button type="button">Behind</button>
        <FilterSheet
          columns={COLUMNS}
          filters={{}}
          sort="-created_at"
          sortOptions={[
            {value: '-created_at', label: 'Created, descending'},
            {value: 'code', label: 'Order, ascending'},
          ]}
          facets={{status: [{value: '1', count: 4}]}}
          count={async (draft) => {
            counted.push(draft);
            return Object.keys(draft.filters).length === 0 ? 12 : 4;
          }}
          onApply={(draft) => applied.push(draft)}
          onClose={() => undefined}
        />
      </>,
    );

    const sheet = screen.getByRole('dialog', {name: 'Filters'});
    expect(sheet).toHaveAttribute('aria-modal', 'true');
    await waitFor(() =>
      expect(
        screen.getByRole('button', {name: 'Show 12 results'}),
      ).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole('checkbox', {name: /Created/}));
    await waitFor(() =>
      expect(
        screen.getByRole('button', {name: 'Show 4 results'}),
      ).toBeInTheDocument(),
    );
    await userEvent.selectOptions(screen.getByLabelText('Sort'), 'code');
    await userEvent.click(screen.getByRole('button', {name: /^Show/}));

    expect(applied).toEqual([{filters: {status: ['1']}, sort: 'code'}]);
    expect(counted).toContainEqual({
      filters: {status: ['1']},
      sort: '-created_at',
    });
  });

  it('keeps the focus inside, and Escape closes it without applying', async () => {
    let closed = false;
    const applied: SheetDraft[] = [];
    render(
      <>
        <button type="button">Behind</button>
        <FilterSheet
          columns={COLUMNS}
          filters={{status: ['2']}}
          count={async () => 1}
          onApply={(draft) => applied.push(draft)}
          onClose={() => (closed = true)}
        />
      </>,
    );
    const sheet = screen.getByRole('dialog', {name: 'Filters'});

    for (let i = 0; i < 8; i++) await userEvent.tab();
    expect(sheet).toContainElement(document.activeElement as HTMLElement);

    await userEvent.keyboard('{Escape}');
    expect(closed).toBe(true);
    expect(applied).toEqual([]);
  });

  it('opens on the first column that filters, and Clear empties the draft', async () => {
    const applied: SheetDraft[] = [];
    render(
      <FilterSheet
        columns={COLUMNS}
        filters={{created_at: {from: '2026-10-01'}}}
        count={async () => 3}
        onApply={(draft) => applied.push(draft)}
        onClose={() => undefined}
      />,
    );

    expect(
      screen.getByRole('button', {name: /^Created/, expanded: true}),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('From')).toHaveValue('2026-10-01');
    await userEvent.click(screen.getByRole('button', {name: 'Clear filters'}));
    await userEvent.click(
      screen.getByRole('button', {name: /^Show|^Filters$/}),
    );
    expect(applied).toEqual([{filters: {}, sort: undefined}]);
  });
});
