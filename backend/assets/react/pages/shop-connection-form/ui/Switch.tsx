import {useId} from 'react';

/** An on/off setting as a switch (`role="switch"`), its label beside it and its help under it. */
export function Switch({
  label,
  help,
  checked,
  onChange,
}: {
  label: string;
  help?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="form-group kf-shop-switch-row">
      <label className="kf-shop-switch" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          role="switch"
          className="kf-shop-switch__input"
          checked={checked}
          aria-describedby={help ? `${id}-help` : undefined}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="kf-shop-switch__track" aria-hidden="true" />
        <span className="kf-shop-switch__label">{label}</span>
      </label>
      {help && (
        <p className="kf-shop-switch-row__help" id={`${id}-help`}>
          {help}
        </p>
      )}
    </div>
  );
}
