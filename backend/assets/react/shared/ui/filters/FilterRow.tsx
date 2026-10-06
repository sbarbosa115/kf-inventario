import type {FilterValue} from '@/shared/api';
import {FilterControl} from './FilterControl';
import type {Facets, FilterColumn, Filters} from './types';

/**
 * The row under a table's header with each column's filter (docs/pdr/prd-shops-settings.md, "Screen proposals" 1).
 * One cell per column, in the table's order; `null` for a column that does not filter, and empty cells where the
 * table has a selection or an actions column. Not rendered under 600 px: the sheet is the UI there.
 */
export function FilterRow({
  columns,
  filters,
  facets,
  onChange,
  leading = [],
  trailing = [],
}: {
  columns: (FilterColumn | null)[];
  filters: Filters;
  facets?: Facets;
  onChange: (field: string, value: FilterValue) => void;
  /** Empty cells before the columns, by the class of the header cell they sit under (selection, card title). */
  leading?: string[];
  /** Empty cells after them (actions). */
  trailing?: string[];
}) {
  return (
    <tr role="row" className="kf-table__filters">
      {leading.map((className) => (
        <td key={className} role="cell" className={className} />
      ))}
      {columns.map((column, index) => (
        <td key={column?.filter.field ?? `none-${index}`} role="cell">
          {column && (
            <FilterControl
              column={column}
              value={filters[column.filter.field]}
              facets={facets}
              layout="row"
              onChange={(value) => onChange(column.filter.field, value)}
            />
          )}
        </td>
      ))}
      {trailing.map((className) => (
        <td key={className} role="cell" className={className} />
      ))}
    </tr>
  );
}
