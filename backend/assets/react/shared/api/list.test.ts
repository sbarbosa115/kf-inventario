import {
  activeFilters,
  listQueryString,
  parseListParams,
  type ListQuery,
} from './list';

describe('the list query in a URL', () => {
  it('writes every part in the API shape and leaves the empty ones out', () => {
    const query: ListQuery = {
      page: 2,
      perPage: 50,
      sort: '-created_at',
      q: ' W00 ',
      filters: {
        code: 'KF',
        status: ['1', '3'],
        created_at: {from: '2026-10-01', to: ''},
        total: {min: '100'},
        empty: '',
        none: [],
      },
      facets: ['status', 'source'],
    };

    expect(decodeURIComponent(listQueryString(query))).toBe(
      '?page=2&per_page=50&sort=-created_at&q=W00&filter[code]=KF&filter[status][]=1&filter[status][]=3' +
        '&filter[created_at][from]=2026-10-01&filter[total][min]=100&facets=status,source',
    );
  });

  it('asks nothing for an empty query, and page 1 is not written', () => {
    expect(listQueryString({})).toBe('');
    expect(listQueryString({page: 1})).toBe('');
  });

  it('reads back what it wrote, ignoring other parameters', () => {
    const query: ListQuery = {
      page: 3,
      sort: 'code',
      q: 'jose',
      filters: {
        status: ['2'],
        created_at: {from: '2026-10-01', to: '2026-10-06'},
        code: 'W0',
      },
    };
    const params = new URLSearchParams(listQueryString(query));
    params.set('warehouse', '2');

    expect(parseListParams(params)).toEqual(query);
  });

  it('keeps only the filters that filter something', () => {
    expect(
      activeFilters({a: '', b: [], c: {from: ''}, d: 'x', e: {max: '5'}}),
    ).toEqual({d: 'x', e: {max: '5'}});
  });
});
