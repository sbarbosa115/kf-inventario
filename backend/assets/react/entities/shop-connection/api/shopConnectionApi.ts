import {
  apiDelete,
  apiGet,
  apiPost,
  apiPut,
  listQueryString,
  type ListQuery,
  type Page,
  type Schema,
} from '@/shared/api';

// Shop connections (docs/pdr/prd-shops-settings.md, "API changes" › Shop connections): ROLE_ADMIN. Item 5a serves
// them, 5b the outbox (501 until then).

export type ShopConnection = Schema<'ShopConnectionOutput'>;
export type ShopHealth = Schema<'ShopHealthOutput'>;
export type ShopCapabilities = Schema<'ShopCapabilitiesOutput'>;
export type WebhookSecret = Schema<'WebhookSecretOutput'>;
export type ShopTestResult = Schema<'ShopTestResultOutput'>;
export type ShopDelivery = Schema<'ShopDeliveryOutput'>;
export type ShopDeliveryDetail = Schema<'ShopDeliveryDetailOutput'>;
export type ShopOutboxEntry = Schema<'ShopOutboxOutput'>;
export type ShopsSyncResult = Schema<'ShopsSyncResultOutput'>;

/** What the connection form sends. Blank keys keep the saved ones (PUT). */
export interface ShopConnectionPayload {
  name: string;
  site_url: string;
  consumer_key?: string;
  consumer_secret?: string;
  warehouse_id: number;
  email_printer: boolean;
  active: boolean;
  capabilities: {order_status: boolean; order_note: boolean};
}

/** "Test connection" with the fields as typed; empty: the saved ones. */
export interface ShopTestPayload {
  site_url?: string;
  consumer_key?: string;
  consumer_secret?: string;
}

export const listShops = () => apiGet<ShopConnection[]>('/shops');

export const getShop = (id: number) => apiGet<ShopConnection>(`/shops/${id}`);

/** Answers the webhook secret once, in `webhook_secret`. */
export const createShop = (payload: ShopConnectionPayload) =>
  apiPost<ShopConnection>('/shops', payload);

export const updateShop = (id: number, payload: ShopConnectionPayload) =>
  apiPut<ShopConnection>(`/shops/${id}`, payload);

/** 409 shop_has_orders when orders came from it: deactivate it instead. */
export const deleteShop = (id: number) => apiDelete(`/shops/${id}`);

export const getWebhookSecret = (id: number) =>
  apiGet<WebhookSecret>(`/shops/${id}/webhook-secret`);

export const rotateWebhookSecret = (id: number) =>
  apiPost<WebhookSecret>(`/shops/${id}/webhook-secret`, {});

export const testShop = (id: number, payload: ShopTestPayload = {}) =>
  apiPost<ShopTestResult>(`/shops/${id}/test`, payload);

/** A page of the connection's inbox (the list contract; `status` failed by default on the server). */
export function listDeliveries(
  id: number,
  query: ListQuery = {},
  status = 'failed',
): Promise<Page<ShopDelivery>> {
  const params = new URLSearchParams(listQueryString(query));
  params.set('status', status);
  return apiGet<Page<ShopDelivery>>(`/shops/${id}/deliveries?${params}`);
}

export const getDelivery = (id: number, deliveryId: number) =>
  apiGet<ShopDeliveryDetail>(`/shops/${id}/deliveries/${deliveryId}`);

export const retryDelivery = (id: number, deliveryId: number) =>
  apiPost<ShopDelivery>(`/shops/${id}/deliveries/${deliveryId}/retry`, {});

export const discardDelivery = (id: number, deliveryId: number) =>
  apiPost<ShopDelivery>(`/shops/${id}/deliveries/${deliveryId}/discard`, {});

export const listOutbox = (id: number, status = 'failed') =>
  apiGet<ShopOutboxEntry[]>(`/shops/${id}/outbox?status=${status}`);

export const retryOutbox = (id: number, outboxId: number) =>
  apiPost<ShopOutboxEntry>(`/shops/${id}/outbox/${outboxId}/retry`, {});
