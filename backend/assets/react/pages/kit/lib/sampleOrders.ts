import type {FacetCount, ListQuery} from '@/shared/api';

// The kit's server-mode table answers from these rows, filtered here as the API would (the kit has no endpoint).

export interface SampleOrder {
  id: number;
  code: string;
  customer: string;
  status: string;
  created: string;
  total: string;
}

const NAMES = ['Ana Gomez', 'Ben Ruiz', 'Carla Diaz', 'Dora Leon', 'Eli Mora'];

export const SAMPLE_ORDERS: SampleOrder[] = Array.from({length: 64}, (_, i) => ({
  id: i + 1,
  code: `W${String(i + 1).padStart(5, '0')}`,
  customer: NAMES[i % NAMES.length]!,
  status: String((i % 6) + 1),
  created: `2026-${String(9 + Math.floor(i / 32)).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
  total: ((i * 37) % 900).toFixed(2),
}));

const matches = (row: SampleOrder, query: ListQuery, skip?: string) =>
  Object.entries(query.filters ?? {}).every(([field, value]) => {
    if (field === skip) return true;
    const cell = String(row[field as keyof SampleOrder] ?? '');
    if (typeof value === 'string') {
      return cell.toLowerCase().includes(value.toLowerCase());
    }
    if (Array.isArray(value)) return value.includes(cell);
    const range = value as Record<string, string | undefined>;
    if ('from' in range || 'to' in range) {
      return (!range.from || cell >= range.from) && (!range.to || cell <= range.to);
    }
    return (
      (!range.min || Number(cell) >= Number(range.min)) &&
      (!range.max || Number(cell) <= Number(range.max))
    );
  }) &&
  (!query.q ||
    `${row.code} ${row.customer}`.toLowerCase().includes(query.q.toLowerCase()));

/** One page of the samples, its total and the status facet, as a list endpoint answers. */
export function samplePage(query: ListQuery & {page: number; perPage: number}) {
  let rows = SAMPLE_ORDERS.filter((row) => matches(row, query));
  if (query.sort) {
    const field = query.sort.replace(/^-/, '') as keyof SampleOrder;
    const desc = query.sort.startsWith('-');
    rows = [...rows].sort((a, b) => {
      const order = String(a[field]).localeCompare(String(b[field]), 'en', {
        numeric: true,
      });
      return desc ? -order : order;
    });
  }
  const counts = new Map<string, number>();
  SAMPLE_ORDERS.filter((row) => matches(row, query, 'status')).forEach((row) =>
    counts.set(row.status, (counts.get(row.status) ?? 0) + 1),
  );
  const status: FacetCount[] = [...counts]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([value, count]) => ({value, count}));
  const start = (query.page - 1) * query.perPage;
  return {
    items: rows.slice(start, start + query.perPage),
    total: rows.length,
    facets: {status},
  };
}
