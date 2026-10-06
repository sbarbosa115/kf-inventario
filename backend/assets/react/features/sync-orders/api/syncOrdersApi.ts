import {apiPost, type Schema} from '@/shared/api';

// The counts the toast reads; "Check now" (item 6 of shops-settings) reads the per-connection rows too.
export type SyncResult = Pick<
  Schema<'ShopsSyncResultOutput'>,
  'imported' | 'skipped'
>;

/** Pulls the new orders of the WooCommerce shops (202); 502 order_sync_failed, 501 order_sync_unavailable. */
export function syncOrders(): Promise<SyncResult> {
  return apiPost<SyncResult>('/orders/sync', {});
}
