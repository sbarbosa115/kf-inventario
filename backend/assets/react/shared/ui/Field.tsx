import {useId, type ReactElement, type ReactNode, cloneElement} from 'react';

/**
 * A labelled form control with its hint and its error under it. The control (an input, a select, a textarea) gets
 * the id, the Bootstrap class for an invalid value, and aria-describedby pointing at the hint and the error.
 */
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  /** A note under the control that a screen reader reads with it (why it is locked, what it expects). */
  hint?: ReactNode;
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
  const hintId = `${id}-hint`;
  const describedBy = [
    children.props['aria-describedby'],
    hint ? hintId : null,
    error ? errorId : null,
  ]
    .filter(Boolean)
    .join(' ');
  const control = cloneElement(children, {
    'id': id,
    'className': `${children.props.className ?? 'form-control'}${error ? ' is-invalid' : ''}`,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy || undefined,
  });
  return (
    <div className="form-group">
      <label htmlFor={id}>{label}</label>
      {control}
      {hint && (
        <small className="form-text" id={hintId}>
          {hint}
        </small>
      )}
      {error && (
        <div className="invalid-feedback" id={errorId}>
          {error}
        </div>
      )}
    </div>
  );
}
