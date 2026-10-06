import {act, renderHook} from '@testing-library/react';
import {vi} from 'vitest';
import {useDebouncedText} from './useDebouncedText';

describe('useDebouncedText', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('hands the text on 300 ms after the last key', () => {
    const commits: string[] = [];
    const {result} = renderHook(() =>
      useDebouncedText('', (text) => commits.push(text)),
    );

    act(() => result.current[1]('jo'));
    act(() => result.current[1]('jose'));
    act(() => vi.advanceTimersByTime(299));
    expect(commits).toEqual([]);
    act(() => vi.advanceTimersByTime(1));
    expect(commits).toEqual(['jose']);
  });

  it('flushes a pending change at once (the field lost the focus), and nothing later', () => {
    const commits: string[] = [];
    const {result} = renderHook(() =>
      useDebouncedText('', (text) => commits.push(text)),
    );

    act(() => result.current[1]('W00001'));
    act(() => result.current[2]());
    act(() => vi.advanceTimersByTime(1000));

    expect(commits).toEqual(['W00001']);
  });

  it('flushes nothing when nothing is pending (a blur does not reset the page)', () => {
    const commits: string[] = [];
    const {result} = renderHook(() =>
      useDebouncedText('kf', (text) => commits.push(text)),
    );

    act(() => result.current[2]());

    expect(commits).toEqual([]);
  });
});
