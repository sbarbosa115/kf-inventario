import {apiPut} from '@/shared/api';
import type {OrderComment} from '@/entities/order';
import type {CommentPayload} from '../model/commentRows';

/** The order's comments as they should be: no id adds one, an id edits it, one left out leaves the order. */
export function saveOrderComments(
  orderId: number,
  comments: CommentPayload[],
): Promise<{comments: OrderComment[]}> {
  return apiPut(`/orders/${orderId}/comments`, {comments});
}
