import {useId, type ReactNode} from 'react';
import {useTranslation} from '@/shared/i18n';

/** The row of filters under a page's header, sticky while the list scrolls; wraps on narrow screens. */
export function Toolbar({
  label,
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  return (
    <div className="kf-toolbar" role="toolbar" aria-label={label}>
      {children}
    </div>
  );
}

export interface ChipOption {
  key: string;
  label: string;
  count?: number;
}

/** Quick filters as chips, "All" first (value null). Each chip says how many rows it keeps when given a count. */
export function FilterChips({
  options,
  value,
  onChange,
  label,
  allCount,
}: {
  options: ChipOption[];
  value: string | null;
  onChange: (key: string | null) => void;
  label: string;
  allCount?: number;
}) {
  const {t} = useTranslation();
  const chips: {key: string | null; label: string; count?: number}[] = [
    {key: null, label: t('common.all'), count: allCount},
    ...options,
  ];
  return (
    <div className="kf-chips" role="group" aria-label={label}>
      {chips.map((chip) => (
        <button
          key={chip.key ?? '*'}
          type="button"
          className="kf-chip"
          aria-pressed={value === chip.key}
          onClick={() => onChange(chip.key)}
        >
          {chip.label}
          {chip.count !== undefined && (
            <>
              {' '}
              <span className="kf-chip__count">{chip.count}</span>
            </>
          )}
        </button>
      ))}
    </div>
  );
}

/** A search field with a clear button. */
export function SearchBox({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  /** The accessible name and placeholder ("Search" by default; "Search this page" where it searches one page). */
  label?: string;
  placeholder?: string;
}) {
  const {t} = useTranslation();
  const id = useId();
  const name = label ?? t('common.search');
  return (
    <div className="kf-search">
      <i className="fas fa-search kf-search__icon" aria-hidden="true" />
      <input
        id={id}
        type="search"
        role="searchbox"
        className="form-control kf-search__input"
        aria-label={name}
        placeholder={placeholder ?? name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && value !== '') {
            event.preventDefault();
            onChange('');
          }
        }}
      />
      {value !== '' && (
        <button
          type="button"
          className="kf-search__clear"
          aria-label={t('common.clearSearch')}
          title={t('common.clearSearch')}
          onClick={() => onChange('')}
        >
          <i className="fas fa-times" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/** Resets every filter of the toolbar. */
export function ClearFilters({onClick}: {onClick: () => void}) {
  const {t} = useTranslation();
  return (
    <button
      type="button"
      className="kf-btn kf-btn--ghost kf-btn--sm"
      onClick={onClick}
    >
      <i className="fas fa-times kf-btn__icon" aria-hidden="true" />
      <span className="kf-btn__label">{t('common.clearFilters')}</span>
    </button>
  );
}
