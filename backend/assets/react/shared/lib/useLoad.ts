import {useEffect, useRef, useState} from 'react';

type Key = string | number | boolean | null | undefined;

/**
 * Loads something when the component mounts and again when a key changes (the ids and filters it depends on, as
 * plain values): its data, whether it is loading, the error, and reload(). The previous data stays while a reload
 * runs, and an answer that comes back after the keys moved on is dropped.
 */
export function useLoad<T>(
  load: () => Promise<T>,
  keys: readonly Key[],
): {
  data: T | undefined;
  loading: boolean;
  error: unknown;
  reload: () => void;
} {
  const latest = useRef(load);
  useEffect(() => {
    latest.current = load;
  });
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify([...keys, attempt]);
  const [state, setState] = useState<{
    key: string | null;
    data: T | undefined;
    error: unknown;
  }>({key: null, data: undefined, error: null});

  useEffect(() => {
    let current = true;
    latest.current().then(
      (data) => current && setState({key, data, error: null}),
      (error: unknown) =>
        current && setState((now) => ({key, data: now.data, error})),
    );
    return () => {
      current = false;
    };
  }, [key]);

  const settled = state.key === key;
  return {
    data: state.data,
    loading: !settled,
    error: settled ? state.error : null,
    reload: () => setAttempt((n) => n + 1),
  };
}
