import {useId, type ReactElement, cloneElement} from 'react';

/**
 * A labelled form control with its error under it. The control (an input, a select, a textarea) gets the id, the
 * Bootstrap class for an invalid value, and aria-describedby pointing at the error.
 */
export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | null;
  children: ReactElement<{
    'id'?: string;
    'className'?: string;
    'aria-invalid'?: boolean;
    'aria-describedby'?: string;
  }>;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const control = cloneElement(children, {
    'id': id,
    'className': `${children.props.className ?? 'form-control'}${error ? ' is-invalid' : ''}`,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? errorId : undefined,
  });
  return (
    <div className="form-group">
      <label htmlFor={id}>{label}</label>
      {control}
      {error && (
        <div className="invalid-feedback" id={errorId}>
          {error}
        </div>
      )}
    </div>
  );
}
