import {useEffect, useRef, useState} from 'react';

/**
 * A text the person types, handed on 300 ms after the last key (a list's search: one request per pause, not per
 * key). Follows the value from outside (Clear filters, a reload with ?q=). `flush` hands on a pending change at once
 * (Enter, or the field losing the focus: nothing is left pending when the person clicks elsewhere, so a late commit
 * never runs after they moved on, e.g. to another page).
 */
export function useDebouncedText(
  value: string,
  onCommit: (text: string) => void,
  delay = 300,
): [text: string, setText: (text: string) => void, flush: () => void] {
  const [text, setTextState] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pending = useRef(false);
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
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      pending.current = false;
    },
    [value],
  );

  const setText = (next: string) => {
    setTextState(next);
    clearTimeout(timer.current);
    pending.current = true;
    timer.current = setTimeout(() => {
      pending.current = false;
      latest.current.onCommit(next);
    }, delay);
  };
  const flush = () => {
    if (!pending.current) return;
    clearTimeout(timer.current);
    pending.current = false;
    latest.current.onCommit(latest.current.text);
  };
  return [text, setText, flush];
}
