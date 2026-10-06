import {useEffect, useId, useRef, useState} from 'react';
import {useTranslation} from '@/shared/i18n';

/** A keyboard-wedge scanner may end a code with two keys (CR LF): an Enter this soon after a scan is the same scan. */
export const SCAN_BURST_MS = 50;

/**
 * Where a barcode is typed or a keyboard-wedge scanner types it: Enter reads the code, clears the field and keeps
 * the focus there for the next one. No capitalisation, no autocomplete; "done" on the phone's keyboard.
 */
export function ScanInput({
  label,
  onScan,
  size = 'md',
  autoFocus = false,
  placeholder,
  disabled = false,
}: {
  label?: string;
  onScan: (code: string) => void;
  size?: 'md' | 'lg';
  autoFocus?: boolean;
  placeholder?: string;
  disabled?: boolean;
}) {
  const {t} = useTranslation();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const lastScan = useRef(0);
  const [value, setValue] = useState('');

  useEffect(() => {
    if (autoFocus) input.current?.focus();
  }, [autoFocus]);

  const read = () => {
    const code = value.trim();
    const now = Date.now();
    if (code === '' || now - lastScan.current < SCAN_BURST_MS) return;
    lastScan.current = now;
    setValue('');
    onScan(code);
    input.current?.focus();
  };

  return (
    <div className={`kf-scan-input kf-scan-input--${size}`}>
      <label htmlFor={id}>{label ?? t('common.scan.label')}</label>
      <div className="kf-scan-input__control">
        <i className="fas fa-barcode kf-scan-input__icon" aria-hidden="true" />
        <input
          ref={input}
          id={id}
          className="form-control"
          type="text"
          inputMode="text"
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="done"
          placeholder={placeholder ?? t('common.scan.placeholder')}
          disabled={disabled}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              read();
            }
          }}
        />
      </div>
    </div>
  );
}
