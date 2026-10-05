import {apiGet, apiPost, type Schema} from '@/shared/api';

/** An order as the getting-ready screen needs it: its products and status. */
export type OrderDetail = Schema<'OrderDetailOutput'>;
export type PartialOrder = Pick<OrderDetail, 'id' | 'status' | 'products'>;

/** What was shipped so far, what is left, and the warehouse's stock of the order's products. */
export type OrderPartials = Schema<'OrderPartialsOutput'>;

/** One product of this shipment (the request bodies are not in the OpenAPI schema). */
export interface PartialItem {
  uuid: string;
  quantity: number;
}

export function getOrder(id: number | string): Promise<OrderDetail> {
  return apiGet<OrderDetail>(`/orders/${id}`);
}

export function getPartials(id: number | string): Promise<OrderPartials> {
  return apiGet<OrderPartials>(`/orders/${id}/partials`);
}

/** Ships these products now: the whole order (it is then sent, status 5) or a partial shipment (status 4). */
export function recordPartial(
  id: number,
  items: PartialItem[],
): Promise<OrderPartials> {
  return apiPost<OrderPartials>(`/orders/${id}/partials`, {items});
}
