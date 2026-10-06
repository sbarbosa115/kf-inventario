import {parseListParams, type FacetCount} from '@/shared/api';

type Value = string | number | boolean | null | undefined | string[];

export interface FakeListSpec<T> {
  /** Each filterable or sortable column's value(s), as the API names them (`status` → '1'; `roles` → [...]). */
  fields?: Record<string, (row: T) => Value>;
  /** The texts `q` looks in. */
  search?: ((row: T) => string | null | undefined)[];
  /** Extra keys of the page over every filtered row (the stock list's `totals`). */
  extra?: (rows: T[]) => Record<string, unknown>;
}

const asList = (value: Value): string[] =>
  Array.isArray(value)
    ? value
    : value === null || value === undefined
      ? []
      : [typeof value === 'boolean' ? (value ? '1' : '0') : String(value)];

/**
 * A fake list endpoint for fakeApi: answers the list contract (docs/pdr/prd-shops-settings.md, "List query
 * contract") over `rows` in memory — q, filter[…] by shape, sort, page/per_page (0 = all), facets — the way the API
 * does, so a screen's test drives it through its URL parameters.
 *
 *     fakeApi({'GET /users': fakeList([ANA, BEN], {fields: {enabled: (u) => (u.enabled ? 'yes' : 'no')}})});
 */
export function fakeList<T>(rows: T[], spec: FakeListSpec<T> = {}) {
  const fields = spec.fields ?? {};
  return (_body: unknown, url: URL): [number, unknown] => {
    const query = parseListParams(url.searchParams);
    const matches = (row: T, skip?: string) =>
      Object.entries(query.filters ?? {}).every(([field, filter]) => {
        if (field === skip) return true;
        const read = fields[field];
        if (!read) return true;
        const value = read(row);
        if (typeof filter === 'string') {
          return asList(value)
            .join(' ')
            .toLowerCase()
            .includes(filter.toLowerCase());
        }
        if (Array.isArray(filter)) {
          return asList(value).some((v) => filter.includes(v));
        }
        const text = asList(value)[0] ?? '';
        const range = filter as Record<string, string | undefined>;
        if ('from' in range || 'to' in range) {
          const day = text.slice(0, 10);
          return (
            day !== '' &&
            (!range.from || day >= range.from) &&
            (!range.to || day <= range.to)
          );
        }
        const n = Number(text);
        return (
          text !== '' &&
          (!range.min || n >= Number(range.min)) &&
          (!range.max || n <= Number(range.max))
        );
      }) &&
      (!query.q ||
        (spec.search ?? []).some((read) =>
          String(read(row) ?? '')
            .toLowerCase()
            .includes(query.q!.toLowerCase()),
        ));

    let kept = rows.filter((row) => matches(row));
    if (query.sort) {
      const desc = query.sort.startsWith('-');
      const read = fields[query.sort.replace(/^-/, '')];
      if (read) {
        kept = [...kept].sort((a, b) => {
          const [x, y] = [asList(read(a))[0] ?? '', asList(read(b))[0] ?? ''];
          const order = x.localeCompare(y, 'en', {numeric: true});
          return desc ? -order : order;
        });
      }
    }
    const facets: Record<string, FacetCount[]> = {};
    for (const field of query.facets ?? []) {
      const counts = new Map<string, number>();
      rows
        .filter((row) => matches(row, field))
        .forEach((row) =>
          asList(fields[field]?.(row)).forEach((v) =>
            counts.set(v, (counts.get(v) ?? 0) + 1),
          ),
        );
      facets[field] = [...counts]
        .sort(([a], [b]) => a.localeCompare(b, 'en', {numeric: true}))
        .map(([value, count]) => ({value, count}));
    }
    const perPage = query.perPage ?? 25;
    const page = query.page ?? 1;
    const items =
      perPage === 0 ? kept : kept.slice((page - 1) * perPage, page * perPage);
    return [
      200,
      {
        items,
        total: kept.length,
        page,
        per_page: perPage,
        ...(query.facets ? {facets} : {}),
        ...(spec.extra?.(kept) ?? {}),
      },
    ];
  };
}

/** A page holding these rows, for a fake that does not filter. */
export function pageOf<T>(items: T[], extra: Record<string, unknown> = {}) {
  return {items, total: items.length, page: 1, per_page: 25, ...extra};
}
