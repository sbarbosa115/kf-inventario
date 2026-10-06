import {useCallback, useMemo} from 'react';
import {useSearchParams} from 'react-router-dom';
import {
  activeFilters,
  listParams,
  parseListParams,
  type FilterValue,
  type ListQuery,
} from '@/shared/api';

export interface ListQueryDefaults {
  sort?: string;
  /** 25 when not given. */
  perPage?: number;
}

/** The query with its defaults filled in: what the table shows and what the API is asked. */
export type ResolvedListQuery = ListQuery & {page: number; perPage: number};

export interface ListQueryState {
  query: ResolvedListQuery;
  /** Merges a change; a change of anything but the page goes back to page 1. */
  update: (patch: Partial<ListQuery>) => void;
  /** One column's filter; undefined (or an emptied value) removes it. Back to page 1. */
  setFilter: (field: string, value: FilterValue | undefined) => void;
  /** Every filter and `q`. Back to page 1. */
  clearFilters: () => void;
  /** How many columns filter something, `q` included. */
  activeCount: number;
}

const LIST_KEYS = /^(page|per_page|sort|q|facets|filter\[.*)$/;

/**
 * A list's query kept in the address (docs/pdr/prd-shops-settings.md, Decisions 13): `?q=&sort=-created_at&
 * filter[status][]=1&page=2`, so a reload or a shared link shows the same rows. Defaults are not written; the
 * address's other parameters (the warehouse) are kept. Nothing goes to localStorage.
 */
export function useListQuery(defaults: ListQueryDefaults = {}): ListQueryState {
  const [params, setParams] = useSearchParams();
  const defaultPerPage = defaults.perPage ?? 25;
  const defaultSort = defaults.sort;

  const query = useMemo<ResolvedListQuery>(() => {
    const read = parseListParams(params);
    return {
      ...read,
      page: read.page ?? 1,
      perPage: read.perPage ?? defaultPerPage,
      sort: read.sort ?? defaultSort,
      filters: activeFilters(read.filters),
    };
  }, [params, defaultPerPage, defaultSort]);

  const write = useCallback(
    (next: ListQuery) => {
      setParams(
        (current) => {
          const kept = new URLSearchParams();
          current.forEach((value, key) => {
            if (!LIST_KEYS.test(key)) kept.append(key, value);
          });
          const list = listParams({
            ...next,
            perPage: next.perPage === defaultPerPage ? undefined : next.perPage,
            sort: next.sort === defaultSort ? undefined : next.sort,
            facets: undefined,
          });
          list.forEach((value, key) => kept.append(key, value));
          return kept;
        },
        {replace: true},
      );
    },
    [setParams, defaultPerPage, defaultSort],
  );

  const update = useCallback(
    (patch: Partial<ListQuery>) =>
      write({...query, ...patch, page: patch.page ?? 1}),
    [query, write],
  );

  const setFilter = useCallback(
    (field: string, value: FilterValue | undefined) => {
      const filters = {...query.filters};
      if (value === undefined) delete filters[field];
      else filters[field] = value;
      write({...query, filters: activeFilters(filters), page: 1});
    },
    [query, write],
  );

  const clearFilters = useCallback(
    () => write({...query, filters: {}, q: undefined, page: 1}),
    [query, write],
  );

  const activeCount =
    Object.keys(query.filters ?? {}).length +
    (query.q && query.q.trim() !== '' ? 1 : 0);

  return {query, update, setFilter, clearFilters, activeCount};
}
