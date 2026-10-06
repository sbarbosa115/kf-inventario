import './filters.css';
import {useEffect, useId, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {useTranslation} from '@/shared/i18n';
import {activeFilters, type FilterValue} from '@/shared/api';
import {useFormat} from '@/shared/lib';
import {useFocusTrap} from '../useFocusTrap';
import {useDescribeFilter} from './ActiveFilters';
import {FilterControl} from './FilterControl';
import type {Facets, FilterColumn, Filters} from './types';

export interface SheetDraft {
  filters: Filters;
  sort?: string;
}

/** The phone's way into the filters (< 600 px): "Filters · N", N the columns that filter something. */
export function FiltersButton({
  count,
  onClick,
}: {
  count: number;
  onClick: () => void;
}) {
  const {t} = useTranslation();
  return (
    <button
      type="button"
      className={`kf-btn kf-btn--secondary kf-btn--md kf-filters-button${count > 0 ? ' is-active' : ''}`}
      aria-haspopup="dialog"
      onClick={onClick}
    >
      <i className="fas fa-sliders kf-btn__icon" aria-hidden="true" />
      <span className="kf-btn__label">{t('filters.button', {n: count})}</span>
    </button>
  );
}

/**
 * The filters on a phone: a bottom sheet (a dialog: the focus stays inside, Escape closes it without applying) with a
 * section per filterable column — the same controls, stacked — a Sort choice, and a sticky footer: Clear, and
 * "Show N results", N counted on the server for what is ticked (debounced), which applies and closes.
 */
export function FilterSheet({
  columns,
  filters,
  sort,
  sortOptions,
  facets,
  count,
  onApply,
  onClose,
}: {
  columns: FilterColumn[];
  filters: Filters;
  sort?: string;
  /** `field` / `-field` with their labels; no Sort choice without them. */
  sortOptions?: {value: string; label: string}[];
  facets?: Facets;
  /** How many rows these filters keep (a request for the total only). */
  count: (draft: SheetDraft) => Promise<number>;
  onApply: (draft: SheetDraft) => void;
  onClose: () => void;
}) {
  const {t} = useTranslation();
  const {num} = useFormat();
  const describe = useDescribeFilter();
  const sheet = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [draft, setDraft] = useState<SheetDraft>({filters, sort});
  const [open, setOpen] = useState<string | null>(
    columns.find((c) => filters[c.filter.field] !== undefined)?.filter.field ??
      columns[0]?.filter.field ??
      null,
  );
  const [results, setResults] = useState<number | null>(null);
  useFocusTrap(sheet, onClose);

  const latest = useRef({count, draft});
  useEffect(() => {
    latest.current = {count, draft};
  });
  // The draft is compared by value: a new object with the same filters asks nothing again.
  const key = JSON.stringify(draft);
  useEffect(() => {
    let current = true;
    const timer = setTimeout(() => {
      latest.current.count(latest.current.draft).then(
        (n) => current && setResults(n),
        () => current && setResults(null),
      );
    }, 300);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [key]);

  const change = (field: string, value: FilterValue) =>
    setDraft((now) => ({
      ...now,
      filters: activeFilters({...now.filters, [field]: value}),
    }));

  return createPortal(
    <div className="kf-sheet">
      <div
        className="kf-sheet__backdrop"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        ref={sheet}
        className="kf-sheet__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div
          className="kf-sheet__handle"
          aria-hidden="true"
          title={t('filters.dragHandle')}
        />
        <header className="kf-sheet__header">
          <h2 id={titleId} className="kf-sheet__title">
            {t('filters.label')}
          </h2>
          <button
            type="button"
            className="kf-btn kf-btn--ghost kf-btn--md kf-btn--icon"
            aria-label={t('common.close')}
            title={t('common.close')}
            onClick={onClose}
          >
            <i className="fas fa-times" aria-hidden="true" />
          </button>
        </header>
        <div className="kf-sheet__body">
          {sortOptions && sortOptions.length > 0 && (
            <label className="kf-sheet__sort">
              <span className="kf-filter-field__label">
                {t('filters.sort')}
              </span>
              <select
                className="custom-select"
                value={draft.sort ?? ''}
                onChange={(event) =>
                  setDraft((now) => ({...now, sort: event.target.value}))
                }
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {columns.map((column) => {
            const field = column.filter.field;
            const value = draft.filters[field];
            const summary =
              value === undefined ? null : describe(column, value);
            const expanded = open === field;
            return (
              <section key={field} className="kf-sheet__section">
                <button
                  type="button"
                  className="kf-sheet__section-toggle"
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? null : field)}
                >
                  <span className="kf-sheet__section-label">
                    {column.label}
                  </span>
                  {summary && (
                    <span className="kf-sheet__section-summary">{summary}</span>
                  )}
                  <i
                    className={`fas fa-chevron-${expanded ? 'up' : 'down'}`}
                    aria-hidden="true"
                  />
                </button>
                {expanded && (
                  <div className="kf-sheet__section-body">
                    <FilterControl
                      column={column}
                      value={value}
                      facets={facets}
                      layout="sheet"
                      onChange={(next) => change(field, next)}
                    />
                  </div>
                )}
              </section>
            );
          })}
        </div>
        <footer className="kf-sheet__footer">
          <button
            type="button"
            className="kf-btn kf-btn--ghost kf-btn--lg"
            onClick={() => setDraft((now) => ({...now, filters: {}}))}
          >
            <span className="kf-btn__label">{t('filters.clear')}</span>
          </button>
          <button
            type="button"
            className="kf-btn kf-btn--primary kf-btn--lg kf-sheet__apply"
            onClick={() => onApply(draft)}
          >
            <span className="kf-btn__label">
              {results === null
                ? t('filters.label')
                : t('filters.show', {count: results, n: num(results)})}
            </span>
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
