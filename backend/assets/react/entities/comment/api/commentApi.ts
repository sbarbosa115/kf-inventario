import {apiDelete, apiGet, apiPost, type Schema} from '@/shared/api';

// An order's comment timeline (docs/pdr/prd-shops-settings.md, "API changes" › Comments). Item 7 serves it (501 until
// then); PUT /orders/{id}/comments (the order form's path) stays in features/edit-order-comments.

export type OrderComment = Schema<'OrderCommentOutput'>;
export type CommentAuthor = Schema<'CommentAuthorOutput'>;
export type PinnedComment = Schema<'PinnedCommentOutput'>;

/** What the write box sends. */
export interface AddCommentPayload {
  content: string;
  /** Also as an order note on the order's shop (linked orders whose connection has order_note on). */
  send_to_shop?: boolean;
  /** The quick phrase it came from. */
  phrase_id?: number;
}

/** The order's comments, oldest first. */
export async function listOrderComments(
  orderId: number,
): Promise<OrderComment[]> {
  return (
    await apiGet<{comments: OrderComment[]}>(`/orders/${orderId}/comments`)
  ).comments;
}

/** 422 shop_note_unavailable when it cannot go to the shop. */
export const addOrderComment = (orderId: number, payload: AddCommentPayload) =>
  apiPost<OrderComment>(`/orders/${orderId}/comments`, payload);

/** The order's only pinned comment from now on. */
export const pinComment = (orderId: number, commentId: number) =>
  apiPost<OrderComment>(`/orders/${orderId}/comments/${commentId}/pin`, {});

export const unpinComment = (orderId: number, commentId: number) =>
  apiDelete<OrderComment>(`/orders/${orderId}/comments/${commentId}/pin`);
