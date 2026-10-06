import {useEffect, useRef, useState} from 'react';
import type {OrderComment} from '@/entities/comment';
import {AddComment, commentFailure} from '@/features/add-comment';
import {
  editOrderComment,
  removeOrderComment,
} from '@/features/edit-order-comments';
import {usePinComment} from '@/features/pin-comment';
import {QuickPhrases} from '@/features/quick-phrase';
import {useTranslation} from '@/shared/i18n';
import {useFormat} from '@/shared/lib';
import {
  Button,
  ConfirmModal,
  RowMenu,
  useToast,
  type RowAction,
} from '@/shared/ui';
import './comment-timeline.css';

/** What the timeline needs of the order. */
export interface TimelineOrder {
  id: number;
  code?: string | null;
  /** The shop the order came from (its notes can go there). */
  shop?: {id: number; name: string} | null;
  /** Oldest first, as the API answers them. */
  comments: OrderComment[];
}

/** The order's comments with the pin moved to `saved` (one pinned comment per order). */
function withPin(
  comments: OrderComment[],
  saved: OrderComment,
): OrderComment[] {
  return comments.map((comment) =>
    comment.id === saved.id
      ? saved
      : saved.pinned && comment.pinned
        ? {...comment, pinned: false, pinned_at: null, pinned_by: null}
        : comment,
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join('');
}

/**
 * An order's comments as a conversation: the pinned one first in its own card (with Unpin), then every comment oldest
 * to newest — who wrote it (a shop's note names the shop), when (≈ and a title when the date is the order's, for
 * comments written before they had dates), the text as typed, "Sent to the shop" — each with a ⋯ menu (Pin / Unpin;
 * Edit and Remove for those written here). At the bottom, kept in view, the quick phrases and the write box. A new
 * comment appears at the end with a flash. `onChanged` runs after every change, so the list's Notes column follows.
 */
export function CommentTimeline({
  order,
  onChanged,
}: {
  order: TimelineOrder;
  onChanged?: () => void;
}) {
  const {t} = useTranslation();
  const toast = useToast();
  const [comments, setComments] = useState(order.comments);
  const [fresh, setFresh] = useState<number | null>(null);
  const [editing, setEditing] = useState<{id: number; text: string} | null>(
    null,
  );
  const [editError, setEditError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<OrderComment | null>(null);
  const [saving, setSaving] = useState(false);
  const pin = usePinComment(order.id);
  const list = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (fresh === null) return;
    list.current
      ?.querySelector(`[data-comment="${fresh}"]`)
      ?.scrollIntoView?.({block: 'nearest'});
  }, [fresh]);

  const changed = (next: OrderComment[]) => {
    setComments(next);
    onChanged?.();
  };

  const added = (comment: OrderComment) => {
    setFresh(comment.id);
    changed([...comments, comment]);
  };

  const togglePin = async (comment: OrderComment) => {
    const saved = await pin.toggle(comment);
    if (saved) changed(withPin(comments, saved));
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (editing.text.trim() === '') {
      setEditError(t('comments.blank'));
      return;
    }
    setSaving(true);
    setEditError(null);
    try {
      changed(
        await editOrderComment(order.id, comments, editing.id, editing.text),
      );
      setEditing(null);
      toast.success(t('comments.saved'));
    } catch (error) {
      setEditError(commentFailure(error, t));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!removing) return;
    setSaving(true);
    try {
      changed(await removeOrderComment(order.id, comments, removing.id));
      toast.success(t('comments.removed'));
    } catch (error) {
      toast.error(commentFailure(error, t));
    } finally {
      setSaving(false);
      setRemoving(null);
    }
  };

  const pinned = comments.find((comment) => comment.pinned);

  return (
    <div className="kf-timeline">
      {pinned && (
        <section
          className="kf-timeline__pinned"
          aria-label={t('comments.pinned')}
        >
          <div className="kf-timeline__pinned-head">
            <span className="kf-timeline__pinned-label">
              <i className="fas fa-thumbtack" aria-hidden="true" />
              {t('comments.pinned')}
            </span>
            <Button
              size="sm"
              variant="ghost"
              icon="fa-times"
              disabled={pin.busy}
              onClick={() => void togglePin(pinned)}
            >
              {t('comments.unpin')}
            </Button>
          </div>
          <p className="kf-timeline__text">{pinned.content}</p>
          {pinned.pinned_by && (
            <p className="kf-timeline__muted">
              {t('comments.pinnedBy', {name: pinned.pinned_by.name})}
            </p>
          )}
        </section>
      )}

      {comments.length === 0 ? (
        <p className="kf-timeline__muted kf-timeline__empty">
          {t('comments.empty')}
        </p>
      ) : (
        <ol
          ref={list}
          className="kf-timeline__list"
          aria-label={t('comments.timeline', {
            code: order.code ?? String(order.id),
          })}
        >
          {comments.map((comment, index) => (
            <Entry
              key={comment.id}
              comment={comment}
              number={index + 1}
              fresh={comment.id === fresh}
              editing={editing?.id === comment.id ? editing.text : null}
              editError={editing?.id === comment.id ? editError : null}
              busy={saving || pin.busy}
              onEdit={(text) => setEditing({id: comment.id, text})}
              onCancelEdit={() => {
                setEditing(null);
                setEditError(null);
              }}
              onSaveEdit={() => void saveEdit()}
              onPin={() => void togglePin(comment)}
              onRemove={() => setRemoving(comment)}
            />
          ))}
        </ol>
      )}

      <div className="kf-timeline__box">
        <QuickPhrases orderId={order.id} onAdded={added} />
        <AddComment
          orderId={order.id}
          shop={order.shop ?? null}
          onAdded={added}
        />
      </div>

      {removing && (
        <ConfirmModal
          title={t('comments.removeTitle')}
          confirmLabel={t('comments.remove')}
          danger
          busy={saving}
          onConfirm={() => void remove()}
          onCancel={() => setRemoving(null)}
        >
          {t('comments.removeBody')}
        </ConfirmModal>
      )}
    </div>
  );
}

function Entry({
  comment,
  number,
  fresh,
  editing,
  editError,
  busy,
  onEdit,
  onCancelEdit,
  onSaveEdit,
  onPin,
  onRemove,
}: {
  comment: OrderComment;
  number: number;
  fresh: boolean;
  /** The text being edited, or null when the comment is not. */
  editing: string | null;
  editError: string | null;
  busy: boolean;
  onEdit: (text: string) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onPin: () => void;
  onRemove: () => void;
}) {
  const {t} = useTranslation();
  const {dateTime} = useFormat();
  const fromShop = comment.origin === 'shop';
  const author = fromShop
    ? t('comments.shopAuthor', {shop: comment.shop?.name ?? ''})
    : (comment.author?.name ?? t('comments.unknownAuthor'));
  const editId = `comment-edit-${comment.id}`;

  const actions: RowAction[] = [
    {
      label: t(comment.pinned ? 'comments.unpin' : 'comments.pin'),
      icon: 'fa-thumbtack',
      disabled: busy,
      onSelect: onPin,
    },
    // A shop's note is the shop's: it is pinned or not, never rewritten here.
    ...(fromShop
      ? []
      : [
          {
            label: t('comments.edit'),
            icon: 'fa-pen',
            disabled: busy,
            onSelect: () => onEdit(comment.content ?? ''),
          },
          {
            label: t('comments.remove'),
            icon: 'fa-trash',
            danger: true,
            disabled: busy,
            onSelect: onRemove,
          },
        ]),
  ];

  return (
    <li
      className={`kf-timeline__entry${fresh ? ' kf-timeline__entry--fresh' : ''}${
        comment.pinned ? ' kf-timeline__entry--pinned' : ''
      }`}
      data-comment={comment.id}
    >
      <span
        className={`kf-timeline__avatar${fromShop ? ' kf-timeline__avatar--shop' : ''}`}
        aria-hidden="true"
      >
        {fromShop ? <i className="fas fa-store" /> : initials(author)}
      </span>
      <div className="kf-timeline__body">
        <div className="kf-timeline__meta">
          <span className="kf-timeline__author">{author}</span>
          {fromShop && (
            <span className="kf-timeline__tag">{t('comments.shopNote')}</span>
          )}
          {comment.origin === 'phrase' && (
            <span className="kf-timeline__tag">{t('comments.phrase')}</span>
          )}
          {comment.pinned && (
            <span className="kf-timeline__tag kf-timeline__tag--pinned">
              <i className="fas fa-thumbtack" aria-hidden="true" />
              {t('comments.pinned')}
            </span>
          )}
          {comment.created_at && (
            <time
              className="kf-timeline__when"
              dateTime={comment.created_at}
              title={
                comment.approximate ? t('comments.approximate') : undefined
              }
            >
              {comment.approximate ? '≈ ' : ''}
              {dateTime(comment.created_at)}
            </time>
          )}
        </div>
        {editing === null ? (
          <p className="kf-timeline__text">{comment.content}</p>
        ) : (
          <div className="kf-timeline__edit">
            <textarea
              id={editId}
              className={`form-control${editError ? ' is-invalid' : ''}`}
              rows={3}
              value={editing}
              aria-label={t('comments.editLabel', {number})}
              aria-invalid={editError ? true : undefined}
              aria-describedby={editError ? `${editId}-error` : undefined}
              autoFocus
              onChange={(event) => onEdit(event.target.value)}
            />
            {editError && (
              <div className="invalid-feedback d-block" id={`${editId}-error`}>
                {editError}
              </div>
            )}
            <div className="kf-timeline__edit-actions">
              <Button
                size="sm"
                variant="primary"
                loading={busy}
                onClick={onSaveEdit}
              >
                {t('comments.save')}
              </Button>
              <Button size="sm" variant="ghost" onClick={onCancelEdit}>
                {t('comments.cancel')}
              </Button>
            </div>
          </div>
        )}
        {comment.sent_to_shop && (
          <span className="kf-timeline__sent">
            <i className="fas fa-check" aria-hidden="true" />
            {t('comments.sentToShop')}
          </span>
        )}
      </div>
      <RowMenu label={t('comments.actions', {number})} actions={actions} />
    </li>
  );
}
