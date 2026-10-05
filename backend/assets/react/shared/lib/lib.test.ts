import {act, renderHook} from '@testing-library/react';
import {beep, setSoundOn, useSound} from './sound';
import {applyTheme, setThemePreference, useTheme} from './theme';
import {usePageTitle} from './usePageTitle';

function stubDarkSystem(dark: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({matches: dark, addEventListener: vi.fn()})),
  );
}

describe('theme', () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('follows the system until a theme is chosen, and remembers the choice', () => {
    stubDarkSystem(true);
    applyTheme();
    expect(document.documentElement.dataset.theme).toBe('dark');

    const {result} = renderHook(() => useTheme());
    expect(result.current[0]).toBe('system');
    act(() => result.current[1]('light'));
    expect(result.current[0]).toBe('light');
    expect(localStorage.getItem('kf.theme')).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');

    setThemePreference('system');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});

describe('sound', () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('plays a short tone, unless it was turned off', () => {
    const start = vi.fn();
    class FakeAudio {
      currentTime = 0;
      destination = {};
      createOscillator = () => ({
        type: '',
        frequency: {value: 0},
        connect: vi.fn(),
        start,
        stop: vi.fn(),
      });
      createGain = () => ({gain: {value: 0}, connect: vi.fn()});
    }
    vi.stubGlobal('AudioContext', FakeAudio);

    beep();
    expect(start).toHaveBeenCalledTimes(1);

    const {result} = renderHook(() => useSound());
    act(() => result.current[1](false));
    expect(result.current[0]).toBe(false);
    beep();
    expect(start).toHaveBeenCalledTimes(1);
    setSoundOn(true);
  });
});

describe('usePageTitle', () => {
  it('names the tab after the page', () => {
    const {unmount} = renderHook(() => usePageTitle('Orders'));
    expect(document.title).toBe('Orders · KF Inventory');
    unmount();
    expect(document.title).toBe('KF Inventory');
  });
});
