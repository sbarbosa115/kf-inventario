import {useMemo, useState, type ReactNode} from 'react';
import {useTranslation} from '@/shared/i18n';
import {EmptyState} from './EmptyState';
import {ErrorState} from './ErrorState';
import {Loader} from './Loader';

export interface Column<Row> {
  /** Unique within the table. */
  key: string;
  header: string;
  render: (row: Row) => ReactNode;
  /** What the column sorts by; without it the column does not sort. */
  sortValue?: (row: Row) => string | number | null;
  /** The text the search box matches in this column. */
  searchValue?: (row: Row) => string | number | null;
  /** Right-aligned (numbers, actions). */
  numeric?: boolean;
}

interface Props<Row> {
  columns: Column<Row>[];
  rows: Row[] | undefined;
  rowKey: (row: Row) => string | number;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  /** Shown when there are no rows at all. */
  emptyMessage?: string;
  /** Rows per page; 0 shows every row. */
  pageSize?: number;
  /** A search box over the columns' searchValue. */
  searchable?: boolean;
  /** Row selection with a checkbox per row and one for the page. */
  selected?: ReadonlySet<string | number>;
  onSelectedChange?: (selected: Set<string | number>) => void;
  /** Class of a row (the legacy screens tint rows by status). */
  rowClassName?: (row: Row) => string | undefined;
}

/**
 * Every list's table: search, sort by a header, pages, row selection, and its loading, error, empty and
 * "filtered to nothing" states. Data is filtered and paged in the browser (the lists hold one warehouse's rows).
 */
export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  loading = false,
  error,
  onRetry,
  emptyMessage,
  pageSize = 20,
  searchable = true,
  selected,
  onSelectedChange,
  rowClassName,
}: Props<Row>) {
  const {t} = useTranslation();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{key: string; desc: boolean} | null>(null);
  const [page, setPage] = useState(1);

  const visible = useMemo(() => {
    let list = rows ?? [];
    const needle = query.trim().toLowerCase();
    if (needle !== '') {
      list = list.filter((row) =>
        columns.some((column) =>
          String(column.searchValue?.(row) ?? '')
            .toLowerCase()
            .includes(needle),
        ),
      );
    }
    const column = columns.find((c) => c.key === sort?.key);
    if (column?.sortValue && sort) {
      const value = column.sortValue;
      list = [...list].sort((a, b) => {
        const [x, y] = [value(a) ?? '', value(b) ?? ''];
        const order = x < y ? -1 : x > y ? 1 : 0;
        return sort.desc ? -order : order;
      });
    }
    return list;
  }, [rows, columns, query, sort]);

  const pages =
    pageSize > 0 ? Math.max(1, Math.ceil(visible.length / pageSize)) : 1;
  const current = Math.min(page, pages);
  const shown =
    pageSize > 0
      ? visible.slice((current - 1) * pageSize, current * pageSize)
      : visible;

  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (loading || rows === undefined) return <Loader />;

  const selectable = selected !== undefined && onSelectedChange !== undefined;
  const allShownSelected =
    shown.length > 0 && shown.every((row) => selected?.has(rowKey(row)));
  const toggle = (keys: (string | number)[], on: boolean) => {
    const next = new Set(selected);
    keys.forEach((key) => (on ? next.add(key) : next.delete(key)));
    onSelectedChange?.(next);
  };

  return (
    <div>
      {searchable && (
        <div className="form-inline mb-2">
          <input
            type="search"
            className="form-control form-control-sm"
            placeholder={t('common.search')}
            aria-label={t('common.search')}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />
        </div>
      )}
      {rows.length === 0 ? (
        <EmptyState message={emptyMessage ?? t('common.empty')} />
      ) : visible.length === 0 ? (
        <EmptyState
          message={t('common.filteredEmpty')}
          action={
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => setQuery('')}
            >
              {t('common.showAll')}
            </button>
          }
        />
      ) : (
        <div className="table-responsive">
          <table className="table table-sm table-striped table-hover">
            <thead>
              <tr>
                {selectable && (
                  <th scope="col" style={{width: '2rem'}}>
                    <input
                      type="checkbox"
                      aria-label={t('common.selectAll')}
                      checked={allShownSelected}
                      onChange={(event) =>
                        toggle(shown.map(rowKey), event.target.checked)
                      }
                    />
                  </th>
                )}
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={column.numeric ? 'text-right' : undefined}
                    aria-sort={
                      sort?.key === column.key
                        ? sort.desc
                          ? 'descending'
                          : 'ascending'
                        : undefined
                    }
                  >
                    {column.sortValue ? (
                      <button
                        type="button"
                        className="btn btn-link btn-sm p-0 text-reset font-weight-bold"
                        onClick={() =>
                          setSort((now) => ({
                            key: column.key,
                            desc: now?.key === column.key ? !now.desc : false,
                          }))
                        }
                      >
                        {column.header}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => {
                const key = rowKey(row);
                return (
                  <tr key={key} className={rowClassName?.(row)}>
                    {selectable && (
                      <td>
                        <input
                          type="checkbox"
                          aria-label={t('common.selectRow')}
                          checked={selected.has(key)}
                          onChange={(event) =>
                            toggle([key], event.target.checked)
                          }
                        />
                      </td>
                    )}
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={column.numeric ? 'text-right' : undefined}
                      >
                        {column.render(row)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <nav className="d-flex align-items-center justify-content-end">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary mr-2"
            disabled={current <= 1}
            onClick={() => setPage(current - 1)}
          >
            {t('common.previous')}
          </button>
          <span className="small text-muted mr-2">
            {t('common.pageOf', {page: current, pages})}
          </span>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            disabled={current >= pages}
            onClick={() => setPage(current + 1)}
          >
            {t('common.next')}
          </button>
        </nav>
      )}
    </div>
  );
}
