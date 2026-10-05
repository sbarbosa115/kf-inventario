import {apiGet, apiPost, type Schema} from '@/shared/api';

export type Session = Schema<'SessionOutput'>;

export function fetchSession(): Promise<Session> {
  return apiGet<Session>('/auth/me');
}

export function signIn(
  username: string,
  password: string,
  rememberMe: boolean,
): Promise<Session> {
  return apiPost<Session>('/auth/login', {
    username,
    password,
    remember_me: rememberMe,
  });
}

export function signOut(): Promise<null> {
  return apiPost<null>('/auth/logout', {});
}
