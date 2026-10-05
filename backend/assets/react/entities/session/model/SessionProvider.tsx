import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {ApiError} from '@/shared/api';
import {
  fetchSession,
  signOut as apiSignOut,
  type Session,
} from '../api/sessionApi';

interface SessionState {
  /** undefined: still asking the server; null: nobody signed in. */
  session: Session | null | undefined;
  /** The error when asking failed for another reason than "nobody signed in". */
  error: unknown;
  setSession: (session: Session | null) => void;
  signOut: () => Promise<void>;
  refresh: () => void;
}

const SessionContext = createContext<SessionState | null>(null);

/** Who is signed in, asked once when the app starts (GET /api/v1/auth/me). */
export function SessionProvider({children}: {children: ReactNode}) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    fetchSession().then(
      (found) => current && setSession(found),
      (failure: unknown) => {
        if (!current) return;
        if (failure instanceof ApiError && failure.status === 401) {
          setSession(null);
        } else {
          setError(failure);
        }
      },
    );
    return () => {
      current = false;
    };
  }, [attempt]);

  const signOut = useCallback(async () => {
    await apiSignOut();
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({
      session,
      error,
      setSession,
      signOut,
      refresh: () => {
        setError(null);
        setSession(undefined);
        setAttempt((n) => n + 1);
      },
    }),
    [session, error, signOut],
  );
  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionState {
  const state = useContext(SessionContext);
  if (state === null) throw new Error('useSession needs a SessionProvider.');
  return state;
}

/**
 * Whether the signed-in person holds the role (directly or through the hierarchy: the server sends every reachable
 * role), as the legacy templates' is_granted() did.
 */
export function useCan(role: string): boolean {
  return useSession().session?.roles.includes(role) ?? false;
}
