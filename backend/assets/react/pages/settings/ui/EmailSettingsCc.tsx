import {useId, useState, type KeyboardEvent} from 'react';
import {useTranslation} from '@/shared/i18n';
import {Button} from '@/shared/ui';
import {isEmailAddress} from '../lib/violations';

/**
 * The cc list as chips: type an address and press Enter or comma (or leave the field, or use the Add button); each
 * chip has its own remove button. An address that is not one stays in the box with its message.
 */
export function EmailSettingsCc({
  label,
  value,
  onChange,
  error,
  hint,
}: {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  error?: string | null;
  hint?: string;
}) {
  const {t} = useTranslation();
  const id = useId();
  const [pending, setPending] = useState('');
  const [local, setLocal] = useState<string | null>(null);

  const commit = () => {
    const address = pending.trim().replace(/,$/, '').trim();
    if (address === '') {
      setLocal(null);
      return;
    }
    if (!isEmailAddress(address)) {
      setLocal(t('settings.email.invalidAddress'));
      return;
    }
    if (!value.some((one) => one.toLowerCase() === address.toLowerCase())) {
      onChange([...value, address]);
    }
    setPending('');
    setLocal(null);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commit();
    }
  };

  const shown = local ?? error ?? null;
  return (
    <div className="form-group" role="group" aria-labelledby={`${id}-label`}>
      <span id={`${id}-label`} className="kf-settings__label">
        {label}
      </span>
      {value.length > 0 && (
        <ul className="kf-chips kf-settings__cc">
          {value.map((address) => (
            <li key={address} className="kf-chip kf-settings__cc-chip">
              <span className="kf-mono">{address}</span>
              <button
                type="button"
                className="kf-settings__cc-remove"
                aria-label={t('settings.email.ccRemove', {address})}
                title={t('settings.email.ccRemove', {address})}
                onClick={() => onChange(value.filter((one) => one !== address))}
              >
                <i className="fas fa-times" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="kf-settings__cc-add">
        <input
          type="email"
          className={`form-control${shown ? ' is-invalid' : ''}`}
          aria-label={t('settings.email.ccAdd')}
          aria-invalid={shown ? true : undefined}
          aria-describedby={shown ? `${id}-error` : undefined}
          placeholder={t('settings.email.ccPlaceholder')}
          autoComplete="off"
          value={pending}
          onChange={(event) => setPending(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={commit}
        />
        <Button
          icon="fa-plus"
          aria-label={t('settings.email.ccAddButton')}
          onMouseDown={(event) => event.preventDefault()}
          onClick={commit}
        />
      </div>
      {hint && <small className="form-text">{hint}</small>}
      {shown && (
        <div className="invalid-feedback d-block" id={`${id}-error`}>
          {shown}
        </div>
      )}
    </div>
  );
}
