import {API_BASE} from '@/shared/api';

/** The stock spreadsheet of these products (GET /products/template.xls?uuid[]=…): an xls attachment. */
export function stockSheetUrl(uuids: readonly string[]): string {
  const query = uuids
    .map((uuid) => `${encodeURIComponent('uuid[]')}=${encodeURIComponent(uuid)}`)
    .join('&');
  return `${API_BASE}/products/template.xls${query === '' ? '' : `?${query}`}`;
}
