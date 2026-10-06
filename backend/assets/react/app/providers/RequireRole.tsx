import type {ReactNode} from 'react';
import {useCan} from '@/entities/session';
import {NotFoundPage} from '@/pages/not-found';

/**
 * A page only a role opens: anyone else gets the not-found page, as for an address that does not exist (the API
 * refuses them all the same). Settings: ROLE_ADMIN (docs/pdr/prd-shops-settings.md, SET-01).
 */
export function RequireRole({
  role,
  children,
}: {
  role: string;
  children: ReactNode;
}) {
  return useCan(role) ? <>{children}</> : <NotFoundPage />;
}
