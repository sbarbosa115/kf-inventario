import './filters.css';
import type {DateRangeValue, FilterValue, NumberRangeValue} from '@/shared/api';
import {DateRangeFields, DateRangeFilter} from './DateRangeFilter';
import {EnumChecklist, FilterDropdown} from './FilterDropdown';
import {RangeFields, RangeFilter} from './RangeFilter';
import {TextFilterInput} from './TextFilterInput';
import type {Facets, FilterColumn} from './types';

export const asText = (value: FilterValue | undefined): string =>
  typeof value === 'string' ? value : '';
export const asList = (value: FilterValue | undefined): string[] =>
  Array.isArray(value) ? value : [];
export const asRange = <T extends DateRangeValue | NumberRangeValue>(
  value: FilterValue | undefined,
): T => (typeof value === 'object' && !Array.isArray(value) ? value : {}) as T;

/** The counts of one enum column's values, from the page's facets. */
export function countsOf(
  facets: Facets | undefined,
  field: string,
): Record<string, number> | undefined {
  const list = facets?.[field];
  return list
    ? Object.fromEntries(list.map((facet) => [facet.value, facet.count]))
    : undefined;
}

/**
 * The control of one column's filter, by its type: compact in the filter row (a text input, or a button opening a
 * panel), open in the phone sheet (the checkbox list, the dates, the range, stacked).
 */
export function FilterControl({
  column,
  value,
  facets,
  layout,
  onChange,
}: {
  column: FilterColumn;
  value: FilterValue | undefined;
  facets?: Facets;
  layout: 'row' | 'sheet';
  onChange: (value: FilterValue) => void;
}) {
  const {label, filter} = column;
  switch (filter.type) {
    case 'text':
      return (
        <TextFilterInput
          label={label}
          value={asText(value)}
          onChange={onChange}
        />
      );
    case 'enum': {
      const props = {
        label,
        options: filter.options,
        counts: countsOf(facets, filter.field),
        value: asList(value),
        onChange,
      };
      return layout === 'row' ? (
        <FilterDropdown {...props} />
      ) : (
        <EnumChecklist {...props} />
      );
    }
    case 'date': {
      const props = {label, value: asRange<DateRangeValue>(value), onChange};
      return layout === 'row' ? (
        <DateRangeFilter {...props} />
      ) : (
        <DateRangeFields {...props} />
      );
    }
    case 'money':
    case 'number': {
      const props = {
        label,
        kind: filter.type,
        value: asRange<NumberRangeValue>(value),
        onChange,
      };
      return layout === 'row' ? (
        <RangeFilter {...props} />
      ) : (
        <RangeFields {...props} />
      );
    }
  }
}
