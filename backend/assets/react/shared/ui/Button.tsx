import type {ButtonHTMLAttributes, MouseEventHandler, ReactNode} from 'react';
import {Link} from 'react-router-dom';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface Props extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onClick'
> {
  variant?: ButtonVariant;
  /** lg is 48 px high: the warehouse screens. */
  size?: ButtonSize;
  /** A spinner inside, the width kept, the button busy and disabled. */
  loading?: boolean;
  /** A Font Awesome class, e.g. "fa-plus". Without children the button is icon-only and needs an aria-label. */
  icon?: string;
  /** Navigation inside the app (a router Link). */
  to?: string;
  /** Navigation outside the app (a download, a PDF): a plain link. */
  href?: string;
  target?: string;
  download?: boolean | string;
  onClick?: MouseEventHandler<HTMLElement>;
  children?: ReactNode;
}

export function buttonClass(
  variant: ButtonVariant = 'secondary',
  size: ButtonSize = 'md',
  extra?: string,
): string {
  return ['kf-btn', `kf-btn--${variant}`, `kf-btn--${size}`, extra]
    .filter(Boolean)
    .join(' ');
}

/**
 * The one button of the app. One primary per view; danger only for destructive actions; Cancel and Close are
 * secondary or ghost, never red.
 */
export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  to,
  href,
  target,
  download,
  className,
  children,
  type = 'button',
  disabled,
  onClick,
  ...rest
}: Props) {
  const iconOnly = children === undefined || children === null;
  const classes = buttonClass(
    variant,
    size,
    [iconOnly ? 'kf-btn--icon' : null, loading ? 'is-loading' : null, className]
      .filter(Boolean)
      .join(' '),
  );
  const label = rest['aria-label'];
  const content = (
    <>
      {icon && <i className={`fas ${icon} kf-btn__icon`} aria-hidden="true" />}
      {!iconOnly && <span className="kf-btn__label">{children}</span>}
      {loading && <span className="kf-btn__spinner" aria-hidden="true" />}
    </>
  );
  if (to !== undefined || href !== undefined) {
    const common = {
      'className': classes,
      'aria-label': label,
      'title': iconOnly ? label : undefined,
      onClick,
    };
    return to !== undefined ? (
      <Link to={to} {...common}>
        {content}
      </Link>
    ) : (
      <a href={href} target={target} download={download} {...common}>
        {content}
      </a>
    );
  }
  return (
    <button
      {...rest}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      title={iconOnly ? (rest.title ?? label) : rest.title}
      onClick={onClick}
    >
      {content}
    </button>
  );
}
