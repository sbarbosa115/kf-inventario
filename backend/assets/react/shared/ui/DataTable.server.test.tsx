import {render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState} from 'react';
import {vi} from 'vitest';
import {DataTable, type Column, type TableQuery} from './DataTable';

interface Row {
  id: number;
  code: string;
  status: string;
}

const COLUMNS: Column<Row>[] = [
  {
    key: 'code',
    header: 'Order',
    render: (r) => r.code,
    sortField: 'code',
    filter: {type: 'text', field: 'code'},
  },
  {
    key: 'status',
    header: 'Status',
    render: (r) => r.status,
    filter: {
      type: 'enum',
      field: 'status',
      options: [
        {value: '1', label: 'Created'},
        {value: '2', label: 'Processed'},
      ],
    },
  },
];

/** A table in server mode whose rows the test gives, recording every query it asks for. */
function Server({
  rows,
  total,
  initial = {page: 1, perPage: 25},
  asked,
}: {
  rows: Row[];
  total: number;
  initial?: TableQuery;
  asked: TableQuery[];
}) {
  const [query, setQuery] = useState<TableQuery>(initial);
  return (
    <DataTable
      columns={COLUMNS}
      rows={rows}
      rowKey={(r) => r.id}
      query={query}
      onQueryChange={(next) => {
        asked.push(next);
        setQuery(next);
      }}
      total={total}
      facets={{status: [{value: '1', count: 7}, {value: '2', count: 3}]}}
      countFor={async () => 3}
    />
  );
}

const ROWS = [
  {id: 1, code: 'W00001', status: 'Created'},
  {id: 2, code: 'W00002', status: 'Processed'},
];

function phone(on: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query.includes('max-width: 599.98px') ? on : !on,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('DataTable in server mode', () => {
  it('shows the rows as given (no filtering or paging of its own) and sorts by asking the server', async () => {
    const asked: TableQuery[] = [];
    render(<Server rows={ROWS} total={2} asked={asked} />);

    expect(screen.getAllByRole('row').filter((r) => r.closest('tbody'))).toHaveLength(2);
    await userEvent.click(screen.getByRole('button', {name: /^Order/}));
    expect(asked.at(-1)).toMatchObject({sort: 'code', page: 1});
    expect(screen.getByRole('columnheader', {name: /^Order/})).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    await userEvent.click(screen.getByRole('button', {name: /^Order/}));
    expect(asked.at(-1)).toMatchObject({sort: '-code'});
    expect(
      screen.getByRole('button', {name: 'Status'}),
      'a column without sortField does not sort',
    ).toHaveAttribute('aria-haspopup', 'dialog');
  });

  it('puts a filter row under the header on a desktop, and the dropdown counts come from the facets', async () => {
    phone(false);
    const asked: TableQuery[] = [];
    render(<Server rows={ROWS} total={2} asked={asked} />);

    const thead = screen.getAllByRole('rowgroup')[0]!;
    expect(within(thead).getAllByRole('row')).toHaveLength(2);
    await userEvent.click(screen.getByRole('button', {name: 'Status'}));
    await userEvent.click(screen.getByRole('checkbox', {name: /Created/}));
    expect(screen.getByRole('dialog', {name: 'Status · 1'})).toHaveTextContent(
      'Created7',
    );

    expect(asked.at(-1)).toMatchObject({filters: {status: ['1']}, page: 1});
    expect(screen.getByText('Status: Created')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: /Filters ·/}),
    ).not.toBeInTheDocument();
  });

  it('on a phone, renders no filter row: a "Filters · N" button opens the sheet, which applies', async () => {
    phone(true);
    const asked: TableQuery[] = [];
    render(
      <Server
        rows={ROWS}
        total={2}
        asked={asked}
        initial={{page: 1, perPage: 25, filters: {code: 'W0'}}}
      />,
    );

    const thead = screen.getAllByRole('rowgroup')[0]!;
    expect(within(thead).getAllByRole('row')).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', {name: 'Filters · 1'}));
    const sheet = screen.getByRole('dialog', {name: 'Filters'});
    await userEvent.click(within(sheet).getByRole('button', {name: /^Status/}));
    await userEvent.click(within(sheet).getByRole('checkbox', {name: /Processed/}));
    await userEvent.click(
      await within(sheet).findByRole('button', {name: 'Show 3 results'}),
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(asked.at(-1)).toMatchObject({
      filters: {code: 'W0', status: ['2']},
      page: 1,
    });
  });

  it('pages with "1 – 25 of N" and keeps the filters while moving between pages', async () => {
    const asked: TableQuery[] = [];
    render(
      <Server
        rows={ROWS}
        total={1240}
        asked={asked}
        initial={{page: 1, perPage: 25, filters: {status: ['1']}}}
      />,
    );

    expect(screen.getByRole('navigation', {name: 'Pages'})).toHaveTextContent(
      '1 – 25 of 1,240',
    );
    await userEvent.click(screen.getByRole('button', {name: 'Next'}));
    expect(asked.at(-1)).toMatchObject({page: 2, filters: {status: ['1']}});
  });

  it('says when the filters keep nothing, and Show all clears them', async () => {
    const asked: TableQuery[] = [];
    render(
      <Server
        rows={[]}
        total={0}
        asked={asked}
        initial={{page: 1, perPage: 25, q: 'zzz', filters: {status: ['2']}}}
      />,
    );

    expect(screen.getByText('Nothing matches these filters.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Show all'}));
    await waitFor(() =>
      expect(asked.at(-1)).toMatchObject({filters: {}, q: undefined, page: 1}),
    );
  });
});
