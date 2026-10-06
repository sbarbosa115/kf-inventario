import type {ReactNode} from 'react';

export type Tone = 'neutral' | 'info' | 'accent' | 'warning' | 'danger';

/** A status as words in a coloured pill, never colour alone. Item-level maps (order status → tone) live in the items. */
export function StatusBadge({
  tone = 'neutral',
  filled = false,
  icon,
  children,
}: {
  tone?: Tone;
  filled?: boolean;
  icon?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`kf-badge kf-badge--${tone}${filled ? ' kf-badge--filled' : ''}`}
    >
      {icon && <i className={`fas ${icon}`} aria-hidden="true" />}
      {children}
    </span>
  );
}
