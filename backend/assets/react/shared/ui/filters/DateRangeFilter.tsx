import {useTranslation} from '@/shared/i18n';
import {useFormat} from '@/shared/lib';
import type {DateRangeValue} from '@/shared/api';
import {FilterPopover} from './FilterPopover';
import {QUICK_RANGES, quickRange} from './dates';

/** "Oct 1 – Oct 6", "From Oct 1", "Until Oct 6", or null for no range. */
export function useDescribeDates(): (value: DateRangeValue) => string | null {
  const {t} = useTranslation();
  const {date} = useFormat();
  return ({from, to}) => {
    if (from && to) {
      return from === to
        ? date(from)
        : t('filters.between', {from: date(from), to: date(to)});
    }
    if (from) return t('filters.since', {from: date(from)});
    if (to) return t('filters.until', {to: date(to)});
    return null;
  };
}

/** Two day inputs (From, To) and the quick picks: Today, Last 7 days, Last 30 days, This month. */
export function DateRangeFields({
  label,
  value,
  onChange,
}: {
  label: string;
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
}) {
  const {t} = useTranslation();
  return (
    <div className="kf-filter-dates" role="group" aria-label={label}>
      <div className="kf-filter-quick">
        {QUICK_RANGES.map((pick) => {
          const range = quickRange(pick);
          const on = value.from === range.from && value.to === range.to;
          return (
            <button
              key={pick}
              type="button"
              className="kf-chip"
              aria-pressed={on}
              onClick={() => onChange(on ? {} : range)}
            >
              {t(`filters.${pick}`)}
            </button>
          );
        })}
      </div>
      <div className="kf-filter-dates__fields">
        <label className="kf-filter-field">
          <span className="kf-filter-field__label">{t('filters.from')}</span>
          <input
            type="date"
            className="form-control"
            value={value.from ?? ''}
            max={value.to || undefined}
            onChange={(event) =>
              onChange({...value, from: event.target.value})
            }
          />
        </label>
        <label className="kf-filter-field">
          <span className="kf-filter-field__label">{t('filters.to')}</span>
          <input
            type="date"
            className="form-control"
            value={value.to ?? ''}
            min={value.from || undefined}
            onChange={(event) => onChange({...value, to: event.target.value})}
          />
        </label>
      </div>
    </div>
  );
}

/** A date column's filter in the filter row: a button with the range ("Created: Oct 1 – Oct 6") opening the fields. */
export function DateRangeFilter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
}) {
  const {t} = useTranslation();
  const describe = useDescribeDates();
  const text = describe(value);
  return (
    <FilterPopover
      label={text ? t('filters.chip', {label, value: text}) : label}
      active={text !== null}
    >
      <div className="kf-filter-panel">
          <DateRangeFields label={label} value={value} onChange={onChange} />
          <div className="kf-filter-panel__footer">
            <button
              type="button"
              className="kf-btn kf-btn--ghost kf-btn--sm"
              disabled={text === null}
              onClick={() => onChange({})}
            >
              <span className="kf-btn__label">{t('filters.clearOne')}</span>
            </button>
          </div>
      </div>
    </FilterPopover>
  );
}
