import {API_BASE, ApiError, NetworkError, type Schema} from '@/shared/api';

export const TEMPLATE_URL = `${API_BASE}/products/template.xls`;
export const TEMPLATE_ALL_URL = `${API_BASE}/products/template.xls?all=1`;

/**
 * Sends the spreadsheet and the warehouse as multipart/form-data. The shared client only speaks JSON, and the
 * Content-Type of a multipart body carries a boundary the browser must set itself, so this one call uses fetch.
 */
export async function uploadProducts(
  file: File,
  warehouseId: number,
): Promise<Schema<'UploadResultOutput'>> {
  const body = new FormData();
  body.append('file', file);
  body.append('warehouse_id', String(warehouseId));
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/products/upload`, {
      method: 'POST',
      headers: {Accept: 'application/json'},
      body,
    });
  } catch (cause) {
    throw new NetworkError(cause);
  }
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text === '' ? null : JSON.parse(text);
  } catch {
    // An answer that is not JSON (a proxy error page): reported as a server failure below.
  }
  if (!response.ok) {
    const error = (data ?? {}) as {error?: string; message?: string};
    throw new ApiError(
      response.status,
      error.error ?? 'http_error',
      error.message ?? response.statusText,
      data,
    );
  }
  return data as Schema<'UploadResultOutput'>;
}
