import {act, render, renderHook, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter, useLocation} from 'react-router-dom';
import {useRememberedWarehouse} from './useRememberedWarehouse';
import {useViewport} from './useViewport';

const WAREHOUSES = [
  {id: 1, name: 'Colombia'},
  {id: 2, name: 'Usa'},
];

function Probe() {
  const [current, pick] = useRememberedWarehouse(WAREHOUSES);
  const {search} = useLocation();
  return (
    <>
      <output>{`${current?.name}|${search}`}</output>
      <button type="button" onClick={() => pick(2)}>
        Usa
      </button>
    </>
  );
}

describe('useRememberedWarehouse', () => {
  afterEach(() => localStorage.clear());

  it('starts on the first, remembers a choice for next time', async () => {
    const {unmount} = render(
      <MemoryRouter>
        <Probe />
      </MemoryRouter>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Colombia|');
    await userEvent.click(screen.getByRole('button', {name: 'Usa'}));
    expect(localStorage.getItem('kf.warehouse')).toBe('2');
    unmount();

    render(
      <MemoryRouter>
        <Probe />
      </MemoryRouter>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Usa|');
  });

  it('lets ?warehouse= win, and remembers it', () => {
    localStorage.setItem('kf.warehouse', '2');
    render(
      <MemoryRouter initialEntries={['/admin/products?warehouse=1']}>
        <Probe />
      </MemoryRouter>,
    );

    expect(screen.getByRole('status')).toHaveTextContent(
      'Colombia|?warehouse=1',
    );
    expect(localStorage.getItem('kf.warehouse')).toBe('1');
  });

  it('ignores a remembered warehouse that no longer exists', () => {
    localStorage.setItem('kf.warehouse', '99');
    render(
      <MemoryRouter>
        <Probe />
      </MemoryRouter>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Colombia|');
  });
});

describe('useViewport', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is compact under 1024 px and follows the window', () => {
    let listener: () => void = () => undefined;
    const media = {
      matches: false,
      addEventListener: (_: string, l: () => void) => (listener = l),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => media),
    );

    const {result} = renderHook(() => useViewport());
    expect(result.current).toBe('compact');
    media.matches = true;
    act(() => listener());
    expect(result.current).toBe('desktop');
  });
});
