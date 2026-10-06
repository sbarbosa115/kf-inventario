// The JSON API client. Same origin: Symfony serves both the app and /api/v1.
export const API_BASE = '/api/v1';

/** An answer outside 2xx. `code` is the API's machine-readable "error". */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly body: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** The request never reached the server, or its answer never came back: the connection, not the API. */
export class NetworkError extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : 'Network error');
    this.name = 'NetworkError';
  }
}

/**
 * What to tell the person when a load failed: to check their connection only when it is their connection, that
 * it is our side otherwise (a 5xx, an answer that is not JSON). `t` is the i18n function.
 */
export function failureMessage(
  error: unknown,
  t: (key: string) => string,
): string {
  return t(
    error instanceof NetworkError ? 'common.loadFailed' : 'common.serverFailed',
  );
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : {'Content-Type': 'application/json'}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (cause) {
    throw new NetworkError(cause);
  }
  const text = await response.text();
  const data: unknown = text === '' ? null : JSON.parse(text);
  if (!response.ok) {
    const error = (data ?? {}) as {error?: string; message?: string};
    throw new ApiError(
      response.status,
      error.error ?? 'http_error',
      error.message ?? response.statusText,
      data,
    );
  }
  return data as T;
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>('GET', path);
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return request<T>('POST', path, body);
}

export function apiPut<T>(path: string, body: unknown): Promise<T> {
  return request<T>('PUT', path, body);
}

export function apiDelete<T = null>(path: string): Promise<T> {
  return request<T>('DELETE', path);
}
