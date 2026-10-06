import {useMemo, useState, type MouseEvent, type ReactNode} from 'react';
import {activeFilters, type FilterValue, type ListQuery} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {useDebouncedText, usePhone} from '@/shared/lib';
import {EmptyState} from './EmptyState';
import {ErrorState} from './ErrorState';
import {ActiveFilters} from './filters/ActiveFilters';
import {FilterRow} from './filters/FilterRow';
import {
  FilterSheet,
  FiltersButton,
  type SheetDraft,
} from './filters/FilterSheet';
import {Pager, PER_PAGE_OPTIONS} from './filters/Pager';
import type {ColumnFilter, Facets, FilterColumn} from './filters/types';
import {RowMenu, type RowAction} from './RowMenu';
import {SearchBox} from './Toolbar';

export interface Column<Row> {
  /** Unique within the table. */
  key: string;
  header: string;
  render: (row: Row) => ReactNode;
  /** What the column sorts by; without it the column does not sort. */
  sortValue?: (row: Row) => string | number | null;
  /** The text the search box matches in this column. */
  searchValue?: (row: Row) => string | number | null;
  /** Right-aligned and tabular (numbers, money). */
  numeric?: boolean;
  /** Codes, SKUs, order numbers: Geist Mono. */
  mono?: boolean;
  /** Server mode: what the column sorts by on the server (`sort=field` / `-field`); without it, it does not sort. */
  sortField?: string;
  /** Server mode: the column's filter (a text, a list of values, a date or money range) in the filter row and sheet. */
  filter?: ColumnFilter;
}

/** A server-paged list's query as the table drives it: the page, the sort, `q` and the filters. */
export type TableQuery = ListQuery & {page: number; perPage: number};

interface Props<Row> {
  columns: Column<Row>[];
  rows: Row[] | undefined;
  rowKey: (row: Row) => string | number;
  /** How a row is named in "Actions for …" (the code, the name); the rowKey by default. */
  rowLabel?: (row: Row) => string;
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
  /** The row's secondary actions, in one "⋯" menu (at most one visible action per row: primaryAction). */
  rowActions?: (row: Row) => RowAction[];
  /** The one visible action of a row. */
  primaryAction?: (row: Row) => ReactNode;
  /** Clicking a row (not one of its controls) opens it. */
  onRowClick?: (row: Row) => void;
  /** Appears with "N selected" while rows are selected, sticky: what to do with them. */
  selectionBar?: (rows: Row[]) => ReactNode;
  /** 44 px rows by default; 52 px comfortable. */
  density?: 'default' | 'comfortable';
  /** Skeleton rows while loading. */
  skeletonRows?: number;
  /** Under 600 px rows become cards: their title… */
  cardTitle?: (row: Row) => ReactNode;
  /** …and the columns shown on them (every column when not given). */
  cardFacts?: string[];
  /** The header stays in view while the page scrolls. */
  stickyHeader?: boolean;
  /**
   * Server mode (docs/pdr/prd-shops-settings.md, "Screen proposals" 1): `rows` are one page the server filtered,
   * sorted and paged; the table shows `query` and asks for changes through `onQueryChange` (header sort, filter row,
   * the phone's sheet, the pager). Without it the table filters, sorts and pages `rows` in the browser.
   */
  query?: TableQuery;
  onQueryChange?: (query: TableQuery) => void;
  /** Server mode: how many rows the query keeps in all. */
  total?: number;
  /** Server mode: the counts of the enum columns' values (the filter dropdowns show them). */
  facets?: Facets;
  /** Server mode, phones: how many rows a draft of the sheet keeps ("Show N results"). */
  countFor?: (query: TableQuery) => Promise<number>;
  /** Server mode: the rows-per-page choices (25, 50, 100). */
  perPageOptions?: number[];
  /**
   * Server mode: filters with no column of their own (in stock, walk-in, country): on the chips and in the phone's
   * sheet, after the columns' filters; never in the filter row (the page offers them as toolbar chips, if at all).
   */
  extraFilters?: FilterColumn[];
}

const INTERACTIVE = 'a, button, input, select, textarea, label, [role="menu"]';

/**
 * Every list's table: search, sort by a header, pages, row selection with its bar, a row menu, and its loading
 * (skeleton rows), error, empty and "filtered to nothing" states. Data is filtered and paged in the browser, or, in
 * server mode (`query` + `onQueryChange`), by the API: then the columns' `filter`s make a filter row under the
 * header (a "Filters · N" button and a bottom sheet under 600 px), the active filters show as chips, and a pager
 * says "1 – 25 of 1,240".
 * Under 600 px the rows become cards in CSS; the elements carry explicit table roles so locators by role work at
 * every width.
 */
export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  rowLabel,
  loading = false,
  error,
  onRetry,
  emptyMessage,
  pageSize = 20,
  searchable = true,
  selected,
  onSelectedChange,
  rowClassName,
  rowActions,
  primaryAction,
  onRowClick,
  selectionBar,
  density = 'default',
  skeletonRows = 6,
  cardTitle,
  cardFacts,
  stickyHeader = false,
  query: serverQuery,
  onQueryChange,
  total,
  facets,
  countFor,
  perPageOptions = PER_PAGE_OPTIONS,
  extraFilters = [],
}: Props<Row>) {
  const {t} = useTranslation();
  const phone = usePhone();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{key: string; desc: boolean} | null>(null);
  const [page, setPage] = useState(1);
  const [sheetOpen, setSheetOpen] = useState(false);
  const serverMode = serverQuery !== undefined && onQueryChange !== undefined;
  const server = serverMode
    ? {query: serverQuery, change: onQueryChange}
    : null;

  // Server mode's own search box is `q`, handed on 300 ms after the last key.
  const [serverSearch, setServerSearch, flushServerSearch] = useDebouncedText(
    serverQuery?.q ?? '',
    (q) =>
      serverQuery &&
      onQueryChange?.({...serverQuery, page: 1, q: q === '' ? undefined : q}),
  );

  const visible = useMemo(() => {
    let list = rows ?? [];
    if (serverMode) return list;
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
  }, [rows, columns, query, sort, serverMode]);

  const pages =
    pageSize > 0 ? Math.max(1, Math.ceil(visible.length / pageSize)) : 1;
  const current = Math.min(page, pages);
  const shown =
    server || pageSize <= 0
      ? visible
      : visible.slice((current - 1) * pageSize, current * pageSize);

  if (error) return <ErrorState error={error} onRetry={onRetry} />;

  // Server mode: the filterable columns, how many filter something, and the ways to change the query.
  const filterColumns: FilterColumn[] = [
    ...columns.flatMap((column) =>
      column.filter ? [{label: column.header, filter: column.filter}] : [],
    ),
    ...extraFilters,
  ];
  const rowFilters = columns.some((column) => column.filter !== undefined);
  const serverFilters = server ? activeFilters(server.query.filters) : {};
  const activeCount = Object.keys(serverFilters).length;
  const searching = (server?.query.q ?? '').trim() !== '';
  const filtering = activeCount > 0 || searching;
  const change = (patch: Partial<TableQuery>) =>
    server?.change({...server.query, page: 1, ...patch});
  const setFilter = (field: string, value: FilterValue | undefined) =>
    change({filters: activeFilters({...serverFilters, [field]: value ?? ''})});
  const clearServerFilters = () => change({filters: {}, q: undefined});
  const sortOf = (column: Column<Row>) =>
    server && column.sortField
      ? server.query.sort === column.sortField
        ? 'ascending'
        : server.query.sort === `-${column.sortField}`
          ? 'descending'
          : undefined
      : sort?.key === column.key
        ? sort.desc
          ? 'descending'
          : 'ascending'
        : undefined;
  const sortable = (column: Column<Row>) =>
    server ? column.sortField !== undefined : column.sortValue !== undefined;
  const toggleSort = (column: Column<Row>) => {
    if (server && column.sortField) {
      change({
        sort:
          server.query.sort === column.sortField
            ? `-${column.sortField}`
            : column.sortField,
      });
    } else {
      setSort((now) => ({
        key: column.key,
        desc: now?.key === column.key ? !now.desc : false,
      }));
    }
  };
  const sortOptions = server
    ? columns.flatMap((column) =>
        column.sortField
          ? [
              {
                value: column.sortField,
                label: t('filters.sortAsc', {label: column.header}),
              },
              {
                value: `-${column.sortField}`,
                label: t('filters.sortDesc', {label: column.header}),
              },
            ]
          : [],
      )
    : [];
  const filterTools =
    server && filterColumns.length > 0 ? (
      <div className="kf-data-table__filters">
        {phone && (
          <FiltersButton
            count={activeCount}
            onClick={() => setSheetOpen(true)}
          />
        )}
        <ActiveFilters
          columns={filterColumns}
          filters={serverFilters}
          searching={searching}
          onRemove={(field) => setFilter(field, undefined)}
          onClear={clearServerFilters}
        />
        {sheetOpen && (
          <FilterSheet
            columns={filterColumns}
            filters={serverFilters}
            sort={server.query.sort}
            sortOptions={sortOptions}
            facets={facets}
            count={(draft: SheetDraft) =>
              countFor
                ? countFor({
                    ...server.query,
                    page: 1,
                    filters: draft.filters,
                    sort: draft.sort,
                  })
                : Promise.reject(new Error('No count'))
            }
            onApply={(draft) => {
              setSheetOpen(false);
              change({filters: draft.filters, sort: draft.sort});
            }}
            onClose={() => setSheetOpen(false)}
          />
        )}
      </div>
    ) : null;

  const selectable = selected !== undefined && onSelectedChange !== undefined;
  const hasActions = rowActions !== undefined || primaryAction !== undefined;
  const allShownSelected =
    shown.length > 0 && shown.every((row) => selected?.has(rowKey(row)));
  const toggle = (keys: (string | number)[], on: boolean) => {
    const next = new Set(selected);
    keys.forEach((key) => (on ? next.add(key) : next.delete(key)));
    onSelectedChange?.(next);
  };
  const selectedRows = (rows ?? []).filter((row) => selected?.has(rowKey(row)));
  const hiddenOnCard = (key: string) =>
    cardFacts !== undefined && !cardFacts.includes(key);
  // A card without a title shares its first line with the row's actions: that line keeps room for them.
  const cardLead =
    !cardTitle && hasActions
      ? columns.find((column) => !hiddenOnCard(column.key))?.key
      : undefined;
  const tableClass = [
    'kf-table',
    density === 'comfortable' ? 'kf-table--comfortable' : null,
    stickyHeader ? 'kf-table--sticky' : null,
    onRowClick ? 'kf-table--clickable' : null,
  ]
    .filter(Boolean)
    .join(' ');

  if (loading || rows === undefined) {
    return (
      <div className="kf-table-wrap" role="status" aria-busy="true">
        <span className="sr-only">{t('common.loading')}</span>
        <table
          className={`${tableClass} kf-table--skeleton`}
          aria-hidden="true"
        >
          <tbody>
            {Array.from({length: skeletonRows}, (_, i) => (
              <tr key={i}>
                {selectable && <td className="kf-table__select" />}
                {columns.map((column) => (
                  <td key={column.key}>
                    <span className="kf-skeleton__block" />
                  </td>
                ))}
                {hasActions && <td className="kf-table__actions" />}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const clickRow = (row: Row) => (event: MouseEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest(INTERACTIVE)) return;
    onRowClick?.(row);
  };

  return (
    <div className="kf-data-table">
      {searchable && (
        <div className="kf-data-table__search">
          {server ? (
            <SearchBox
              value={serverSearch}
              onChange={setServerSearch}
              onBlur={flushServerSearch}
            />
          ) : (
            <SearchBox
              value={query}
              onChange={(value) => {
                setQuery(value);
                setPage(1);
              }}
            />
          )}
        </div>
      )}
      {filterTools}
      {selectable && selectionBar && selectedRows.length > 0 && (
        <div className="kf-selection-bar">
          <span className="kf-selection-bar__count">
            {t('common.selected', {count: selectedRows.length})}
          </span>
          <div className="kf-selection-bar__actions">
            {selectionBar(selectedRows)}
          </div>
          <button
            type="button"
            className="kf-btn kf-btn--ghost kf-btn--sm"
            onClick={() => onSelectedChange(new Set())}
          >
            <span className="kf-btn__label">{t('common.clearSelection')}</span>
          </button>
        </div>
      )}
      {server && rows.length === 0 && filtering ? (
        <EmptyState
          icon="fa-filter"
          message={t('common.filteredEmpty')}
          action={
            <button
              type="button"
              className="kf-btn kf-btn--secondary kf-btn--sm"
              onClick={clearServerFilters}
            >
              <span className="kf-btn__label">{t('common.showAll')}</span>
            </button>
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState message={emptyMessage ?? t('common.empty')} />
      ) : visible.length === 0 ? (
        <EmptyState
          message={t('common.filteredEmpty')}
          action={
            <button
              type="button"
              className="kf-btn kf-btn--secondary kf-btn--sm"
              onClick={() => setQuery('')}
            >
              <span className="kf-btn__label">{t('common.showAll')}</span>
            </button>
          }
        />
      ) : (
        <div className="kf-table-wrap">
          <table className={tableClass} role="table">
            <thead role="rowgroup">
              <tr role="row">
                {selectable && (
                  <th
                    role="columnheader"
                    scope="col"
                    className="kf-table__select"
                  >
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
                {cardTitle && (
                  <th
                    role="columnheader"
                    scope="col"
                    className="kf-table__card-title"
                  />
                )}
                {columns.map((column) => (
                  <th
                    key={column.key}
                    role="columnheader"
                    scope="col"
                    className={column.numeric ? 'kf-table__num' : undefined}
                    aria-sort={sortOf(column)}
                  >
                    {sortable(column) ? (
                      <button
                        type="button"
                        className="kf-table__sort"
                        onClick={() => toggleSort(column)}
                      >
                        {column.header}
                        <i
                          className={`fas ${sortOf(column) === 'descending' ? 'fa-arrow-down' : sortOf(column) === 'ascending' ? 'fa-arrow-up' : 'fa-sort'} kf-table__sort-icon`}
                          aria-hidden="true"
                        />
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                ))}
                {hasActions && (
                  <th
                    role="columnheader"
                    scope="col"
                    className="kf-table__actions"
                  >
                    <span className="sr-only">{t('common.actions')}</span>
                  </th>
                )}
              </tr>
              {server && rowFilters && !phone && (
                <FilterRow
                  columns={columns.map((column) =>
                    column.filter
                      ? {label: column.header, filter: column.filter}
                      : null,
                  )}
                  filters={serverFilters}
                  facets={facets}
                  onChange={(field, value) => setFilter(field, value)}
                  leading={[
                    ...(selectable ? ['kf-table__select'] : []),
                    ...(cardTitle ? ['kf-table__card-title'] : []),
                  ]}
                  trailing={hasActions ? ['kf-table__actions'] : []}
                />
              )}
            </thead>
            <tbody role="rowgroup">
              {shown.map((row) => {
                const key = rowKey(row);
                const isSelected = selected?.has(key) ?? false;
                const actions = rowActions?.(row) ?? [];
                return (
                  <tr
                    key={key}
                    role="row"
                    className={
                      [rowClassName?.(row), isSelected ? 'is-selected' : null]
                        .filter(Boolean)
                        .join(' ') || undefined
                    }
                    onClick={onRowClick ? clickRow(row) : undefined}
                  >
                    {selectable && (
                      <td role="cell" className="kf-table__select">
                        <label className="kf-table__select-hit">
                          <input
                            type="checkbox"
                            aria-label={t('common.selectRow')}
                            checked={isSelected}
                            onChange={(event) =>
                              toggle([key], event.target.checked)
                            }
                          />
                        </label>
                      </td>
                    )}
                    {cardTitle && (
                      <td role="cell" className="kf-table__card-title">
                        {cardTitle(row)}
                      </td>
                    )}
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        role="cell"
                        data-label={column.header}
                        className={
                          [
                            column.numeric ? 'kf-table__num' : null,
                            column.mono ? 'kf-table__mono' : null,
                            hiddenOnCard(column.key)
                              ? 'kf-table__card-hidden'
                              : null,
                            column.key === cardLead
                              ? 'kf-table__card-lead'
                              : null,
                          ]
                            .filter(Boolean)
                            .join(' ') || undefined
                        }
                      >
                        {column.render(row)}
                      </td>
                    ))}
                    {hasActions && (
                      <td role="cell" className="kf-table__actions">
                        {primaryAction?.(row)}
                        {actions.length > 0 && (
                          <RowMenu
                            actions={actions}
                            label={t('common.actionsFor', {
                              name: rowLabel?.(row) ?? String(key),
                            })}
                          />
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {server &&
        total !== undefined &&
        (total > (perPageOptions[0] ?? 25) || server.query.page > 1) && (
          <Pager
            page={server.query.page}
            perPage={server.query.perPage}
            total={total}
            onPage={(next) => server.change({...server.query, page: next})}
            onPerPage={(perPage) => change({perPage})}
            perPageOptions={perPageOptions}
          />
        )}
      {!server && pages > 1 && (
        <nav className="kf-pager">
          <button
            type="button"
            className="kf-btn kf-btn--secondary kf-btn--sm"
            disabled={current <= 1}
            onClick={() => setPage(current - 1)}
          >
            <span className="kf-btn__label">{t('common.previous')}</span>
          </button>
          <span className="kf-pager__label">
            {t('common.pageOf', {page: current, pages})}
          </span>
          <button
            type="button"
            className="kf-btn kf-btn--secondary kf-btn--sm"
            disabled={current >= pages}
            onClick={() => setPage(current + 1)}
          >
            <span className="kf-btn__label">{t('common.next')}</span>
          </button>
        </nav>
      )}
    </div>
  );
}
