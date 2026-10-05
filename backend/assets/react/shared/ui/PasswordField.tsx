import {useId, useState, type KeyboardEvent, type Ref} from 'react';
import {useTranslation} from '@/shared/i18n';

/** A password input with show/hide and a Caps Lock hint. */
export function PasswordField({
  label,
  value,
  onChange,
  autoComplete = 'current-password',
  error,
  required,
  name,
  inputRef,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  error?: string | null;
  required?: boolean;
  name?: string;
  inputRef?: Ref<HTMLInputElement>;
}) {
  const {t} = useTranslation();
  const id = useId();
  const [shown, setShown] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const onKey = (event: KeyboardEvent<HTMLInputElement>) =>
    setCapsLock(event.getModifierState?.('CapsLock') ?? false);
  const describedBy = [error ? `${id}-error` : null, `${id}-caps`]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="form-group kf-password">
      <label htmlFor={id}>{label}</label>
      <div className="kf-password__control">
        <input
          ref={inputRef}
          id={id}
          name={name}
          type={shown ? 'text' : 'password'}
          className={`form-control${error ? ' is-invalid' : ''}`}
          autoComplete={autoComplete}
          autoCapitalize="off"
          spellCheck={false}
          required={required}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKey}
          onKeyUp={onKey}
          onBlur={() => setCapsLock(false)}
        />
        <button
          type="button"
          className="kf-password__toggle"
          aria-pressed={shown}
          aria-label={
            shown ? t('common.password.hide') : t('common.password.show')
          }
          title={shown ? t('common.password.hide') : t('common.password.show')}
          onClick={() => setShown((now) => !now)}
        >
          <i
            className={`fas ${shown ? 'fa-eye-slash' : 'fa-eye'}`}
            aria-hidden="true"
          />
        </button>
      </div>
      <div id={`${id}-caps`} className="kf-password__caps" aria-live="polite">
        {capsLock && (
          <>
            <i className="fas fa-arrow-up" aria-hidden="true" />{' '}
            {t('common.password.capsLock')}
          </>
        )}
      </div>
      {error && (
        <div className="invalid-feedback d-block" id={`${id}-error`}>
          {error}
        </div>
      )}
    </div>
  );
}
