import {apiPost, type Schema} from '@/shared/api';

/** Moves an order to another status (a status history row; stock is not touched). */
export function changeOrderStatus(
  id: number,
  status: number,
): Promise<Schema<'OrderDetailOutput'>> {
  return apiPost(`/orders/${id}/status`, {status});
}
