import {apiPost, type Schema} from '@/shared/api';

export type SyncResult = Schema<'SyncResultOutput'>;

/** Pulls the new orders of the WooCommerce shops (202); 502 order_sync_failed, 501 order_sync_unavailable. */
export function syncOrders(): Promise<SyncResult> {
  return apiPost<SyncResult>('/orders/sync', {});
}
