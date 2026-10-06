import {act, renderHook} from '@testing-library/react';
import type {ReactNode} from 'react';
import {MemoryRouter, useLocation} from 'react-router-dom';
import {useListQuery} from './useListQuery';

function setup(url: string, defaults = {sort: '-created_at'}) {
  let location = '';
  function Spy() {
    const here = useLocation();
    location = decodeURIComponent(here.search);
    return null;
  }
  const wrapper = ({children}: {children: ReactNode}) => (
    <MemoryRouter initialEntries={[url]}>
      {children}
      <Spy />
    </MemoryRouter>
  );
  const hook = renderHook(() => useListQuery(defaults), {wrapper});
  return {hook, location: () => location};
}

describe('useListQuery', () => {
  it('reads the query from the address, with the defaults filled in', () => {
    const {hook} = setup(
      '/admin/orders?warehouse=2&page=3&q=jose&filter[status][]=1&filter[status][]=2',
    );

    expect(hook.result.current.query).toEqual({
      page: 3,
      perPage: 25,
      sort: '-created_at',
      q: 'jose',
      filters: {status: ['1', '2']},
    });
    expect(hook.result.current.activeCount).toBe(2);
  });

  it('writes a filter to the address, back on page 1, keeping the other parameters', () => {
    const {hook, location} = setup('/admin/orders?warehouse=2&page=4');

    act(() => hook.result.current.setFilter('status', ['5']));

    expect(location()).toBe('?warehouse=2&filter[status][]=5');
    expect(hook.result.current.query.page).toBe(1);
  });

  it('moves between pages without touching the filters', () => {
    const {hook, location} = setup('/x?q=kf');

    act(() => hook.result.current.update({page: 2}));

    expect(location()).toBe('?page=2&q=kf');
  });

  it('does not write the defaults, and Clear filters empties the filters and q', () => {
    const {hook, location} = setup('/x?sort=code&q=kf&filter[code]=W');

    act(() => hook.result.current.update({sort: '-created_at'}));
    expect(location()).toBe('?q=kf&filter[code]=W');

    act(() => hook.result.current.clearFilters());
    expect(location()).toBe('');
    expect(hook.result.current.activeCount).toBe(0);
  });

  it('drops a filter emptied in its control', () => {
    const {hook, location} = setup('/x?filter[code]=W');

    act(() => hook.result.current.setFilter('code', ''));

    expect(location()).toBe('');
  });
});
