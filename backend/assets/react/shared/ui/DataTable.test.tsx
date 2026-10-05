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
