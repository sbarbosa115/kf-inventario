/** A comment as the order already holds it (only what PUT /orders/{id}/comments needs). */
interface Saved {
  id: number;
  content?: string | null;
}

/** What PUT /orders/{id}/comments takes: the order's comments as they should be (one left out leaves the order). */
export interface CommentPayload {
  id: number;
  content: string;
}

const payload = (comment: Saved): CommentPayload => ({
  id: comment.id,
  content: comment.content ?? '',
});

/** Every comment as it is, with `id`'s text replaced. */
export function editedComments(
  comments: Saved[],
  id: number,
  content: string,
): CommentPayload[] {
  return comments.map((comment) =>
    comment.id === id ? {id, content} : payload(comment),
  );
}

/** Every comment but `id`. */
export function withoutComment(
  comments: Saved[],
  id: number,
): CommentPayload[] {
  return comments.filter((comment) => comment.id !== id).map(payload);
}
