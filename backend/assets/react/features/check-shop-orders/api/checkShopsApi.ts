import {apiPost, type Schema} from '@/shared/api';

/** What "Check now" brought in: the totals and one row per active connection, by name. */
export type CheckResult = Schema<'ShopsSyncResultOutput'>;

/**
 * "Check now" (ROLE_CAN_SYNC_ORDERS): pulls every active connection, due or not → 202 with a row per connection;
 * 502 order_sync_failed only when every connection failed.
 */
export function checkShops(): Promise<CheckResult> {
  return apiPost<CheckResult>('/orders/sync', {});
}
