import type {ReactNode} from 'react';
import {Navigate, useLocation} from 'react-router-dom';
import {useSession} from '@/entities/session';
import {ErrorState, Loader} from '@/shared/ui';

/** A signed-in page: nobody signed in goes to the sign-in page, and comes back here after it. */
export function RequireSession({children}: {children: ReactNode}) {
  const {session, error, refresh} = useSession();
  const location = useLocation();

  if (error) return <ErrorState error={error} onRetry={refresh} />;
  if (session === undefined) return <Loader />;
  if (session === null) {
    return (
      <Navigate
        to="/admin/login"
        replace
        state={{from: location.pathname + location.search}}
      />
    );
  }
  return <>{children}</>;
}
