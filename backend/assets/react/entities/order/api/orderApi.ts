import {API_BASE, apiGet, type Schema} from '@/shared/api';

/** An order as the list shows it. */
export type Order = Schema<'OrderOutput'>;
/** An order with its customer (and addresses), products and comments. */
export type OrderDetail = Schema<'OrderDetailOutput'>;
export type OrderComment = Schema<'OrderCommentOutput'>;

/** A warehouse's orders, newest first (the list filters and pages them in the browser). */
export function listOrders(warehouseId: number): Promise<Order[]> {
  return apiGet<Order[]>(`/orders?warehouse_id=${warehouseId}`);
}

export function getOrder(id: number): Promise<OrderDetail> {
  return apiGet<OrderDetail>(`/orders/${id}`);
}

// The documents are opened in a new tab (the session cookie authenticates them).
export const orderPdfUrl = (id: number) => `${API_BASE}/orders/${id}/pdf`;
export const orderRemainingPdfUrl = (id: number) =>
  `${API_BASE}/orders/${id}/remaining-pdf`;
export const orderXlsUrl = (id: number) => `${API_BASE}/orders/${id}/xls`;
