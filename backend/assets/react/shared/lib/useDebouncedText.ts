import {useEffect, useRef, useState} from 'react';

/**
 * A text the person types, handed on 300 ms after the last key (a list's search: one request per pause, not per
 * key). Follows the value from outside (Clear filters, a reload with ?q=). `flush` hands it on at once (Enter).
 */
export function useDebouncedText(
  value: string,
  onCommit: (text: string) => void,
  delay = 300,
): [text: string, setText: (text: string) => void, flush: () => void] {
  const [text, setTextState] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef({onCommit, text});
  useEffect(() => {
    latest.current = {onCommit, text};
  });
  // Follows the value from outside (Clear filters, a reload), dropping a pending change.
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setTextState(value);
  }
  useEffect(() => () => clearTimeout(timer.current), [value]);

  const setText = (next: string) => {
    setTextState(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => latest.current.onCommit(next), delay);
  };
  const flush = () => {
    clearTimeout(timer.current);
    latest.current.onCommit(latest.current.text);
  };
  return [text, setText, flush];
}
