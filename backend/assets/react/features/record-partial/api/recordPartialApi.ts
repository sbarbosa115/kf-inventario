import {apiGet, apiPost, type Schema} from '@/shared/api';

/**
 * Everything the getting-ready screen shows: the order's code, status and lines, what was shipped so far, what is
 * left, and the warehouse's stock of its products. One ROLE_USER endpoint, as the legacy page needed.
 */
export type OrderPartials = Schema<'OrderPartialsOutput'>;

/** One product of this shipment (the request bodies are not in the OpenAPI schema). */
export interface PartialItem {
  uuid: string;
  quantity: number;
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
