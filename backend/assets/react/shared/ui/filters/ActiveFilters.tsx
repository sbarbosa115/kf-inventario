import './filters.css';
import {useTranslation} from '@/shared/i18n';
import type {DateRangeValue, FilterValue, NumberRangeValue} from '@/shared/api';
import {asList, asRange, asText} from './FilterControl';
import {useDescribeDates} from './DateRangeFilter';
import {useDescribeRange} from './RangeFilter';
import type {FilterColumn, Filters} from './types';

/** How a column's filter reads on a chip: "Created, Processed", "Oct 1 – Oct 6", "$100 – $500", the text. */
export function useDescribeFilter(): (
  column: FilterColumn,
  value: FilterValue,
) => string | null {
  const dates = useDescribeDates();
  const money = useDescribeRange('money');
  const number = useDescribeRange('number');
  return (column, value) => {
    const {filter} = column;
    switch (filter.type) {
      case 'text': {
        const text = asText(value);
        return text === '' ? null : text;
      }
      case 'enum': {
        const list = asList(value);
        return list.length === 0
          ? null
          : list
              .map((v) => filter.options.find((o) => o.value === v)?.label ?? v)
              .join(', ');
      }
      case 'date':
        return dates(asRange<DateRangeValue>(value));
      case 'money':
        return money(asRange<NumberRangeValue>(value));
      case 'number':
        return number(asRange<NumberRangeValue>(value));
    }
  };
}

/**
 * The active filters above a table, one removable chip each ("Status: Created, Processed ×"), and Clear filters.
 * Nothing when no column filters.
 */
export function ActiveFilters({
  columns,
  filters,
  onRemove,
  onClear,
}: {
  columns: FilterColumn[];
  filters: Filters;
  onRemove: (field: string) => void;
  onClear: () => void;
}) {
  const {t} = useTranslation();
  const describe = useDescribeFilter();
  const chips = columns.flatMap((column) => {
    const value = filters[column.filter.field];
    const text = value === undefined ? null : describe(column, value);
    return text === null ? [] : [{column, text}];
  });
  if (chips.length === 0) return null;
  return (
    <div
      className="kf-active-filters"
      role="group"
      aria-label={t('filters.label')}
    >
      {chips.map(({column, text}) => {
        const chip = t('filters.chip', {label: column.label, value: text});
        return (
          <span key={column.filter.field} className="kf-active-filters__chip">
            <span className="kf-active-filters__text">{chip}</span>
            <button
              type="button"
              className="kf-active-filters__remove"
              aria-label={t('filters.remove', {label: chip})}
              title={t('filters.remove', {label: chip})}
              onClick={() => onRemove(column.filter.field)}
            >
              <i className="fas fa-times" aria-hidden="true" />
            </button>
          </span>
        );
      })}
      <button
        type="button"
        className="kf-btn kf-btn--ghost kf-btn--sm"
        onClick={onClear}
      >
        <i className="fas fa-times kf-btn__icon" aria-hidden="true" />
        <span className="kf-btn__label">{t('filters.clear')}</span>
      </button>
    </div>
  );
}
