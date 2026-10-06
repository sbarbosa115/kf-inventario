import {useId} from 'react';
import {useTranslation} from '@/shared/i18n';
import {useFormat} from '@/shared/lib';
import {FilterPopover} from './FilterPopover';
import type {FilterOption} from './types';

/** The checkbox list of an enum column, each value with how many rows hold it (the facets). */
export function EnumChecklist({
  label,
  options,
  counts,
  value,
  onChange,
}: {
  label: string;
  options: FilterOption[];
  counts?: Record<string, number>;
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const {t} = useTranslation();
  const {num} = useFormat();
  const name = useId();
  if (options.length === 0) {
    return <p className="kf-filter-empty">{t('filters.noValues')}</p>;
  }
  return (
    <fieldset className="kf-filter-checklist">
      <legend className="sr-only">{label}</legend>
      {options.map((option) => {
        const checked = value.includes(option.value);
        const count = counts?.[option.value];
        return (
          <label key={option.value} className="kf-filter-checklist__option">
            <input
              type="checkbox"
              name={name}
              value={option.value}
              checked={checked}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...value, option.value]
                    : value.filter((v) => v !== option.value),
                )
              }
            />
            <span className="kf-filter-checklist__label">{option.label}</span>
            {counts && (
              <span className="kf-filter-checklist__count">
                {num(count ?? 0)}
              </span>
            )}
          </label>
        );
      })}
    </fieldset>
  );
}

/**
 * An enum column's filter in the filter row: a button ("Status", "Status · 2" when two values are ticked) opening the
 * checkbox list with counts and Clear. Every tick applies at once.
 */
export function FilterDropdown({
  label,
  options,
  counts,
  value,
  onChange,
}: {
  label: string;
  options: FilterOption[];
  counts?: Record<string, number>;
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const {t} = useTranslation();
  return (
    <FilterPopover
      label={
        value.length > 0
          ? t('filters.withCount', {label, n: value.length})
          : label
      }
      active={value.length > 0}
    >
      <div className="kf-filter-panel">
          <EnumChecklist
            label={label}
            options={options}
            counts={counts}
            value={value}
            onChange={onChange}
          />
          <div className="kf-filter-panel__footer">
            <button
              type="button"
              className="kf-btn kf-btn--ghost kf-btn--sm"
              disabled={value.length === 0}
              onClick={() => onChange([])}
            >
              <span className="kf-btn__label">{t('filters.clearOne')}</span>
            </button>
          </div>
      </div>
    </FilterPopover>
  );
}
