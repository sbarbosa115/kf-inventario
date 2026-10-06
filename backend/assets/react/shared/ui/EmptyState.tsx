import type {ReactNode} from 'react';

/** A list with nothing to show: why, and (when filters hide everything) the way back. */
export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  /** A Font Awesome class, e.g. "fa-box-open". */
  icon?: string;
  title?: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="kf-empty">
      {icon && (
        <i className={`fas ${icon} kf-empty__icon`} aria-hidden="true" />
      )}
      {title && <p className="kf-empty__title">{title}</p>}
      <p className="kf-empty__message">{message}</p>
      {action && <div className="kf-empty__action">{action}</div>}
    </div>
  );
}
