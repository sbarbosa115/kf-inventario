import {apiDelete} from '@/shared/api';

/** Deletes an order: its product lines and comments, then the order itself (soft delete). 204. */
export function deleteOrder(id: number): Promise<null> {
  return apiDelete(`/orders/${id}`);
}
