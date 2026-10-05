import type {ReactNode} from 'react';

/** A list with nothing to show: why, and (when filters hide everything) the way back. */
export function EmptyState({
  message,
  action,
}: {
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="text-center text-muted py-4">
      <p className="mb-2">{message}</p>
      {action}
    </div>
  );
}
