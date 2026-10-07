import {useId, type FormEventHandler, type ReactNode} from 'react';

/** A form's frame: a readable width (720 px, 640 narrow), two columns from 1280 px with columns={2}. */
export function FormLayout({
  columns = 1,
  narrow = false,
  onSubmit,
  children,
  label,
}: {
  columns?: 1 | 2;
  narrow?: boolean;
  /** With onSubmit the layout is the <form>. */
  onSubmit?: FormEventHandler<HTMLFormElement>;
  label?: string;
  children: ReactNode;
}) {
  const className = [
    'kf-form',
    columns === 2 ? 'kf-form--two' : null,
    narrow ? 'kf-form--narrow' : null,
  ]
    .filter(Boolean)
    .join(' ');
  return onSubmit ? (
    <form
      className={className}
      onSubmit={onSubmit}
      noValidate
      aria-label={label}
    >
      {children}
    </form>
  ) : (
    <div className={className}>{children}</div>
  );
}

/** A titled group of fields. */
export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section className="kf-form-section" aria-labelledby={id}>
      <header className="kf-form-section__header">
        <h2 className="kf-form-section__title" id={id}>
          {title}
        </h2>
        {description && (
          <p className="kf-form-section__description">{description}</p>
        )}
      </header>
      <div className="kf-form-section__body">{children}</div>
    </section>
  );
}

/**
 * The form's actions, sticky at the bottom (above the tab bar on phones): what is missing, Cancel, the main action.
 * `sticky={false}` leaves it in the page's flow while it has nothing to do, so it covers nothing (the scan screen
 * before the first scan: its box sits just above the bar).
 */
export function ActionBar({
  primary,
  secondary,
  status,
  sticky = true,
}: {
  primary: ReactNode;
  secondary?: ReactNode;
  status?: ReactNode;
  sticky?: boolean;
}) {
  return (
    <div className={`kf-action-bar${sticky ? '' : ' kf-action-bar--static'}`}>
      {status && (
        <div className="kf-action-bar__status" aria-live="polite">
          {status}
        </div>
      )}
      <div className="kf-action-bar__buttons">
        {secondary}
        {primary}
      </div>
    </div>
  );
}
