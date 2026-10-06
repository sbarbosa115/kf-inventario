import type {FacetCount, FilterValue} from '@/shared/api';

export interface FilterOption {
  value: string;
  label: string;
}

/**
 * How a DataTable column filters on the server (docs/pdr/prd-shops-settings.md, "Screen proposals" 1): `field` is the
 * API's `filter[<field>]`. Text: contains; enum: any of the options (counts from the facets); date: a Bogotá day
 * range; money/number: a min–max range with quick ranges.
 */
export type ColumnFilter =
  | {type: 'text'; field: string}
  | {type: 'enum'; field: string; options: FilterOption[]}
  | {type: 'date'; field: string}
  | {type: 'money' | 'number'; field: string};

/** A filterable column as the filter controls need it: its filter and the column's header. */
export interface FilterColumn {
  label: string;
  filter: ColumnFilter;
}

export type Facets = Record<string, FacetCount[]>;
export type Filters = Record<string, FilterValue>;
