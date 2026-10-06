import {apiPut} from '@/shared/api';
import type {OrderComment} from '@/entities/comment';
import {
  editedComments,
  withoutComment,
  type CommentPayload,
} from '../model/commentsPayload';

function saveOrderComments(
  orderId: number,
  comments: CommentPayload[],
): Promise<OrderComment[]> {
  return apiPut<{comments: OrderComment[]}>(`/orders/${orderId}/comments`, {
    comments,
  }).then((saved) => saved.comments);
}

/**
 * Changes one comment's text through the order's comments (PUT, the path the order form had): the others are sent as
 * they are. Answers the order's comments as saved.
 */
export const editOrderComment = (
  orderId: number,
  comments: OrderComment[],
  id: number,
  content: string,
) => saveOrderComments(orderId, editedComments(comments, id, content));

/** Takes one comment off the order (it loses its pin). Answers the order's comments as saved. */
export const removeOrderComment = (
  orderId: number,
  comments: OrderComment[],
  id: number,
) => saveOrderComments(orderId, withoutComment(comments, id));
