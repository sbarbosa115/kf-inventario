import type {OrderComment} from '@/entities/order';

/** A comment on screen: a saved one (id) or a draft not sent yet (id null), with the text being typed. */
export interface CommentRow {
  key: string;
  id: number | null;
  /** What the server holds (empty for a draft). */
  saved: string;
  text: string;
}

/** What PUT /orders/{id}/comments takes: the comments as they should be. */
export interface CommentPayload {
  id: number | null;
  content: string;
}

const blank = (text: string) => text.trim() === '';

export function rowsFrom(comments: OrderComment[]): CommentRow[] {
  return comments.map((comment) => ({
    key: `comment-${comment.id}`,
    id: comment.id,
    saved: comment.content ?? '',
    text: comment.content ?? '',
  }));
}

/** A new empty comment at the end, with a key no other row has. */
export function addDraft(rows: CommentRow[]): CommentRow[] {
  const used = rows
    .filter((row) => row.id === null)
    .map((row) => Number(row.key.replace('draft-', '')));
  const next = Math.max(0, ...used) + 1;
  return [...rows, {key: `draft-${next}`, id: null, saved: '', text: ''}];
}

export function editRow(
  rows: CommentRow[],
  key: string,
  text: string,
): CommentRow[] {
  return rows.map((row) => (row.key === key ? {...row, text} : row));
}

export function removeDraft(rows: CommentRow[], key: string): CommentRow[] {
  return rows.filter((row) => row.key !== key);
}

/**
 * Every comment as it is on screen, without `except` (the one being removed). The API refuses a blank comment: a
 * blank draft is not sent yet, and a saved comment emptied by mistake keeps its saved text.
 */
export function commentsPayload(
  rows: CommentRow[],
  except?: string,
): CommentPayload[] {
  return rows
    .filter((row) => row.key !== except)
    .filter((row) => row.id !== null || !blank(row.text))
    .map((row) => ({
      id: row.id,
      content: row.id !== null && blank(row.text) ? row.saved : row.text,
    }));
}

/** The server's comments after a save, then the blank drafts that were not sent. */
export function afterSave(
  rows: CommentRow[],
  comments: OrderComment[],
): CommentRow[] {
  return [
    ...rowsFrom(comments),
    ...rows.filter((row) => row.id === null && blank(row.text)),
  ];
}

export const isBlank = blank;
