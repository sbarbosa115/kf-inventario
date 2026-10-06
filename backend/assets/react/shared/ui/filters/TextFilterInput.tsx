import {useEffect, useRef, useState} from 'react';
import {useTranslation} from '@/shared/i18n';

/**
 * A text column's filter: applied 300 ms after the last key, at once on Enter; Escape empties it. Follows the value
 * from outside (a chip removed, Clear filters).
 */
export function TextFilterInput({
  label,
  value,
  onChange,
  delay = 300,
}: {
  /** The column's header: the input is named "Filter by <label>". */
  label: string;
  value: string;
  onChange: (value: string) => void;
  delay?: number;
}) {
  const {t} = useTranslation();
  const [text, setText] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef(onChange);
  useEffect(() => {
    latest.current = onChange;
  });
  // Follows the value from outside (a chip removed, Clear filters), dropping a pending change.
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setText(value);
  }
  useEffect(() => () => clearTimeout(timer.current), [value]);

  const apply = (next: string) => {
    clearTimeout(timer.current);
    if (next.trim() !== value.trim()) latest.current(next.trim());
  };

  return (
    <input
      type="search"
      className="form-control kf-filter-text"
      aria-label={t('filters.filterBy', {label})}
      placeholder={label}
      value={text}
      onChange={(event) => {
        const next = event.target.value;
        setText(next);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => apply(next), delay);
      }}
      onBlur={() => apply(text)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          apply(text);
        } else if (event.key === 'Escape' && text !== '') {
          event.preventDefault();
          event.stopPropagation();
          setText('');
          apply('');
        }
      }}
    />
  );
}
