// The list-query contract of every list endpoint (docs/pdr/prd-shops-settings.md, "List query contract"):
// page, per_page, sort, q, filter[<field>] by type, facets. The answer is a Page of the endpoint's Output.

/** A date range: Bogotá days, YYYY-MM-DD, both included; either end may be empty. */
export interface DateRangeValue {
  from?: string;
  to?: string;
}

/** A number or money range: decimal strings, both included; either end may be empty. */
export interface NumberRangeValue {
  min?: string;
  max?: string;
}

/** One column's filter: text (contains), a list of values (any of), a date range or a number range. */
export type FilterValue = string | string[] | DateRangeValue | NumberRangeValue;

export interface ListQuery {
  /** 1-based. */
  page?: number;
  /** 25 by default, 100 at most; 0 = every row (the stock list only). */
  perPage?: number;
  /** `field` or `-field`, from the endpoint's allow-list. */
  sort?: string;
  /** One text over the endpoint's search columns. */
  q?: string;
  filters?: Record<string, FilterValue>;
  /** Enum columns whose counts to answer. */
  facets?: string[];
}

export interface FacetCount {
  value: string;
  count: number;
}

/** What every list endpoint answers. */
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  facets?: Record<string, FacetCount[]>;
}

/** Whether a filter value filters anything (an emptied control does not). */
export function isActiveFilter(value: FilterValue | undefined): boolean {
  if (value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  return Object.values(value).some(
    (part) => typeof part === 'string' && part !== '',
  );
}

/** The filters that filter something. */
export function activeFilters(
  filters: Record<string, FilterValue> | undefined,
): Record<string, FilterValue> {
  return Object.fromEntries(
    Object.entries(filters ?? {}).filter(([, value]) => isActiveFilter(value)),
  );
}

/** The query as URL parameters, in the API's shape (`filter[status][]=1`). Empty parts are left out. */
export function listParams(query: ListQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.page !== undefined && query.page > 1) {
    params.set('page', String(query.page));
  }
  if (query.perPage !== undefined) {
    params.set('per_page', String(query.perPage));
  }
  if (query.sort) params.set('sort', query.sort);
  if (query.q && query.q.trim() !== '') params.set('q', query.q.trim());
  for (const [field, value] of Object.entries(activeFilters(query.filters))) {
    if (typeof value === 'string') {
      params.set(`filter[${field}]`, value.trim());
    } else if (Array.isArray(value)) {
      value.forEach((v) => params.append(`filter[${field}][]`, v));
    } else {
      for (const [part, v] of Object.entries(value)) {
        if (typeof v === 'string' && v !== '') {
          params.set(`filter[${field}][${part}]`, v);
        }
      }
    }
  }
  if (query.facets && query.facets.length > 0) {
    params.set('facets', query.facets.join(','));
  }
  return params;
}

/** `?page=2&filter[status][]=1…` (empty when nothing is asked), to append to a list endpoint's path. */
export function listQueryString(query: ListQuery): string {
  const text = listParams(query).toString();
  return text === '' ? '' : `?${text}`;
}

/** Reads a ListQuery back from URL parameters (the inverse of listParams; other parameters are ignored). */
export function parseListParams(params: URLSearchParams): ListQuery {
  const query: ListQuery = {};
  const filters: Record<string, FilterValue> = {};
  params.forEach((value, key) => {
    if (key === 'page') {
      const page = Number.parseInt(value, 10);
      if (page > 0) query.page = page;
    } else if (key === 'per_page') {
      const perPage = Number.parseInt(value, 10);
      if (perPage >= 0) query.perPage = perPage;
    } else if (key === 'sort') {
      query.sort = value;
    } else if (key === 'q') {
      query.q = value;
    } else if (key === 'facets') {
      query.facets = value.split(',').filter(Boolean);
    } else {
      const match = /^filter\[([^\]]+)\](?:\[([^\]]*)\])?$/.exec(key);
      if (!match) return;
      const [, field, part] = match as unknown as [string, string, string?];
      if (part === undefined) {
        filters[field] = value;
      } else if (part === '') {
        const list = filters[field];
        filters[field] = [...(Array.isArray(list) ? list : []), value];
      } else {
        const range = filters[field];
        filters[field] = {
          ...(typeof range === 'object' && !Array.isArray(range) ? range : {}),
          [part]: value,
        };
      }
    }
  });
  if (Object.keys(filters).length > 0) query.filters = filters;
  return query;
}
