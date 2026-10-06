import {
  API_BASE,
  apiGet,
  listQueryString,
  type ListQuery,
  type Page,
  type Schema,
} from '@/shared/api';

/** An order as the list shows it. */
export type Order = Schema<'OrderOutput'>;
/** An order with its customer (and addresses), products and comments. */
export type OrderDetail = Schema<'OrderDetailOutput'>;
export type OrderComment = Schema<'OrderCommentOutput'>;

/**
 * A page of a warehouse's orders, newest first: the list contract (q, filters code, customer, status[], source[],
 * created_at, pinned; sorts code, customer, status, created_at; facets status, source).
 */
export function listOrders(
  warehouseId: number,
  query: ListQuery = {},
): Promise<Page<Order>> {
  const params = new URLSearchParams(listQueryString(query));
  params.set('warehouse_id', String(warehouseId));
  return apiGet<Page<Order>>(`/orders?${params}`);
}

export function getOrder(id: number): Promise<OrderDetail> {
  return apiGet<OrderDetail>(`/orders/${id}`);
}

// The documents are opened in a new tab (the session cookie authenticates them).
export const orderPdfUrl = (id: number) => `${API_BASE}/orders/${id}/pdf`;
export const orderRemainingPdfUrl = (id: number) =>
  `${API_BASE}/orders/${id}/remaining-pdf`;
export const orderXlsUrl = (id: number) => `${API_BASE}/orders/${id}/xls`;
