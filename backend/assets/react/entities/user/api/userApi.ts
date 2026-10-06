import {
  apiGet,
  apiPost,
  apiPut,
  listQueryString,
  type ListQuery,
  type Page,
  type Schema,
} from '@/shared/api';

export type User = Schema<'UserOutput'>;

/** What the form sends (the request bodies are not in the OpenAPI schema). A password left out keeps the current one. */
export interface UserPayload {
  name: string;
  username: string;
  email: string;
  password?: string;
  roles: string[];
  enabled: boolean;
}

/**
 * A page of users, by name: the list contract (q, filters name, username, email, roles[], enabled[]; sorts name,
 * username, email).
 */
export function listUsers(query: ListQuery = {}): Promise<Page<User>> {
  return apiGet<Page<User>>(`/users${listQueryString(query)}`);
}

export function getUser(id: number | string): Promise<User> {
  return apiGet<User>(`/users/${id}`);
}

export function createUser(payload: UserPayload): Promise<User> {
  return apiPost<User>('/users', payload);
}

export function updateUser(
  id: number | string,
  payload: UserPayload,
): Promise<User> {
  return apiPut<User>(`/users/${id}`, payload);
}
