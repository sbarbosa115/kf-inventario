import {useMemo, useState, type MouseEvent, type ReactNode} from 'react';
import {useTranslation} from '@/shared/i18n';
import {EmptyState} from './EmptyState';
import {ErrorState} from './ErrorState';
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
}

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
}

const INTERACTIVE = 'a, button, input, select, textarea, label, [role="menu"]';

/**
 * Every list's table: search, sort by a header, pages, row selection with its bar, a row menu, and its loading
 * (skeleton rows), error, empty and "filtered to nothing" states. Data is filtered and paged in the browser.
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
          <SearchBox
            value={query}
            onChange={(value) => {
              setQuery(value);
              setPage(1);
            }}
          />
        </div>
      )}
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
      {rows.length === 0 ? (
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
                        className="kf-table__sort"
                        onClick={() =>
                          setSort((now) => ({
                            key: column.key,
                            desc: now?.key === column.key ? !now.desc : false,
                          }))
                        }
                      >
                        {column.header}
                        <i
                          className={`fas ${sort?.key === column.key ? (sort.desc ? 'fa-arrow-down' : 'fa-arrow-up') : 'fa-sort'} kf-table__sort-icon`}
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
      {pages > 1 && (
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
