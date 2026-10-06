import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState} from 'react';
import {DataTable, type Column} from './DataTable';

interface Row {
  id: number;
  code: string;
  quantity: number;
}

const columns: Column<Row>[] = [
  {
    key: 'code',
    header: 'Code',
    render: (r) => r.code,
    searchValue: (r) => r.code,
    sortValue: (r) => r.code,
  },
  {
    key: 'quantity',
    header: 'Quantity',
    render: (r) => r.quantity,
    sortValue: (r) => r.quantity,
    numeric: true,
  },
];
const rows: Row[] = [
  {id: 1, code: 'KF-02', quantity: 5},
  {id: 2, code: 'KF-01', quantity: 9},
  {id: 3, code: 'AB-77', quantity: 1},
];

function Selectable() {
  const [selected, setSelected] = useState<Set<string | number>>(new Set());
  return (
    <>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        selected={selected}
        onSelectedChange={setSelected}
      />
      <output>{[...selected].join(',')}</output>
    </>
  );
}

describe('DataTable', () => {
  it('filters by the search box and offers a way back when nothing matches', async () => {
    render(<DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />);

    await userEvent.type(screen.getByRole('searchbox', {name: 'Search'}), 'kf');
    expect(screen.getAllByRole('row')).toHaveLength(3);

    await userEvent.type(screen.getByRole('searchbox'), 'zzz');
    expect(
      screen.getByText('Nothing matches these filters.'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Show all'}));
    expect(screen.getAllByRole('row')).toHaveLength(4);
  });

  it('sorts by a header, then the other way', async () => {
    render(<DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />);

    await userEvent.click(screen.getByRole('button', {name: 'Code'}));
    expect(screen.getAllByRole('row')[1]).toHaveTextContent('AB-77');
    await userEvent.click(screen.getByRole('button', {name: 'Code'}));
    expect(screen.getAllByRole('row')[1]).toHaveTextContent('KF-02');
  });

  it('selects rows one by one or the whole page', async () => {
    render(<Selectable />);

    await userEvent.click(
      screen.getAllByRole('checkbox', {name: 'Select row'})[0]!,
    );
    expect(screen.getByRole('status')).toHaveTextContent('1');
    await userEvent.click(screen.getByRole('checkbox', {name: 'Select all'}));
    expect(screen.getByRole('status')).toHaveTextContent('1,2,3');
  });

  it('says so when there is nothing at all', () => {
    render(
      <DataTable
        columns={columns}
        rows={[]}
        rowKey={(r) => r.id}
        emptyMessage="No products yet."
      />,
    );

    expect(screen.getByText('No products yet.')).toBeInTheDocument();
  });

  it('shows the error with a retry instead of the table', async () => {
    const retry = vi.fn();
    render(
      <DataTable
        columns={columns}
        rows={undefined}
        rowKey={(r) => r.id}
        error={new Error('x')}
        onRetry={retry}
      />,
    );

    await userEvent.click(screen.getByRole('button', {name: 'Try again'}));
    expect(retry).toHaveBeenCalled();
  });
});

describe('DataTable, the kit additions', () => {
  it('puts the secondary actions of a row in one named menu', async () => {
    const onEdit = vi.fn();
    render(
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        rowLabel={(r) => r.code}
        rowActions={(r) => [
          {label: 'Edit', onSelect: () => onEdit(r.code)},
          {label: 'Delete', danger: true, onSelect: vi.fn()},
        ]}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', {name: 'Actions for KF-01'}),
    );
    await userEvent.click(screen.getByRole('menuitem', {name: 'Edit'}));
    expect(onEdit).toHaveBeenCalledWith('KF-01');
  });

  it('shows the selection bar with the count and the selected rows', async () => {
    function WithBar() {
      const [selected, setSelected] = useState<Set<string | number>>(new Set());
      return (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          selected={selected}
          onSelectedChange={setSelected}
          selectionBar={(picked) => (
            <button type="button">
              Move {picked.map((r) => r.code).join(' ')}
            </button>
          )}
        />
      );
    }
    render(<WithBar />);

    expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
    const boxes = screen.getAllByRole('checkbox', {name: 'Select row'});
    await userEvent.click(boxes[0]!);
    await userEvent.click(boxes[1]!);
    expect(screen.getByText('2 selected')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Move KF-02 KF-01'}),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Clear'}));
    expect(screen.queryByText('2 selected')).not.toBeInTheDocument();
  });

  it('loads as skeleton rows announced once, never a spinner', () => {
    const {container} = render(
      <DataTable
        columns={columns}
        rows={undefined}
        rowKey={(r: Row) => r.id}
        skeletonRows={4}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Loading');
    expect(container.querySelectorAll('tbody tr')).toHaveLength(4);
    expect(container.querySelector('.spinner-border')).toBeNull();
  });

  it('keeps table roles and labels every cell, so the phone cards read as a table', () => {
    render(
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        cardTitle={(r) => r.code}
        cardFacts={['quantity']}
      />,
    );

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(4);
    const cells = screen.getAllByRole('cell');
    expect(
      cells.find((c) => c.getAttribute('data-label') === 'Quantity'),
    ).toBeTruthy();
    expect(
      cells.filter((c) => c.getAttribute('data-label') === 'Code')[0],
    ).toHaveClass('kf-table__card-hidden');
    expect(screen.getAllByRole('cell', {name: 'KF-02'})[0]).toHaveClass(
      'kf-table__card-title',
    );
  });

  it('opens a row on click, but not when one of its controls is used', async () => {
    const onRowClick = vi.fn();
    render(
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        onRowClick={onRowClick}
        primaryAction={(r) => <button type="button">Open {r.code}</button>}
      />,
    );

    await userEvent.click(screen.getByRole('cell', {name: 'AB-77'}));
    expect(onRowClick).toHaveBeenCalledWith(rows[2]);
    await userEvent.click(screen.getByRole('button', {name: 'Open KF-01'}));
    expect(onRowClick).toHaveBeenCalledTimes(1);
  });

  it('selects a row from the whole box around its checkbox (a 44 px target on a phone) without opening it', async () => {
    const onRowClick = vi.fn();
    function Clickable() {
      const [selected, setSelected] = useState<Set<string | number>>(new Set());
      return (
        <>
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            selected={selected}
            onSelectedChange={setSelected}
            onRowClick={onRowClick}
          />
          <output>{[...selected].join(',')}</output>
        </>
      );
    }
    render(<Clickable />);

    const [box] = screen.getAllByRole('checkbox', {name: 'Select row'});
    const hit = box!.closest('label');
    expect(hit).toHaveClass('kf-table__select-hit');
    await userEvent.click(hit!);
    expect(box).toBeChecked();
    expect(screen.getByRole('status')).toHaveTextContent('1');
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('keeps room for the row menu on a card without a title: its first fact is the lead line', () => {
    render(
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        cardFacts={['quantity']}
        rowActions={() => [{label: 'Edit', onSelect: vi.fn()}]}
      />,
    );

    const row = screen.getAllByRole('row')[1]!;
    const quantity = [...row.querySelectorAll('td')].find(
      (c) => c.getAttribute('data-label') === 'Quantity',
    );
    expect(quantity).toHaveClass('kf-table__card-lead');
    expect(row.querySelectorAll('.kf-table__card-lead')).toHaveLength(1);
  });
});
