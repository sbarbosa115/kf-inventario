import {useEffect, useRef, useState} from 'react';
import type {OrderComment} from '@/entities/order';
import {ApiError, failureMessage} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {Button, useToast} from '@/shared/ui';
import {saveOrderComments} from '../api/orderCommentsApi';
import {
  addDraft,
  afterSave,
  commentsPayload,
  editRow,
  isBlank,
  removeDraft,
  rowsFrom,
  type CommentRow,
} from '../model/commentRows';
import './order-comments.css';

/**
 * An order's comments, edited in place (any signed-in user, as before): each one with its Save and Remove, and a
 * button that adds one. Every save sends the comments as they are on screen and is confirmed by a toast; a failure is
 * said here and keeps what was typed. `onSaved` runs after each save.
 */
export function OrderComments({
  orderId,
  comments,
  onSaved,
}: {
  orderId: number;
  comments: OrderComment[];
  onSaved: () => void;
}) {
  const {t} = useTranslation();
  const toast = useToast();
  const [rows, setRows] = useState<CommentRow[]>(() => rowsFrom(comments));
  const [busy, setBusy] = useState(false);
  const [blankKey, setBlankKey] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const fields = useRef(new Map<string, HTMLTextAreaElement>());

  useEffect(() => {
    if (focusKey) fields.current.get(focusKey)?.focus();
  }, [focusKey]);

  const send = async (except?: string) => {
    setBusy(true);
    setFailure(null);
    try {
      const saved = await saveOrderComments(
        orderId,
        commentsPayload(rows, except),
      );
      setRows((now) => afterSave(now, saved.comments));
      toast.success(t('orders.comments.saved'));
      onSaved();
    } catch (error) {
      setFailure(
        error instanceof ApiError && error.status === 404
          ? t('orders.errors.order_not_found')
          : failureMessage(error, t),
      );
    } finally {
      setBusy(false);
    }
  };

  const save = (row: CommentRow) => {
    if (isBlank(row.text)) {
      setBlankKey(row.key);
      return;
    }
    setBlankKey(null);
    void send();
  };

  const remove = (row: CommentRow) => {
    setBlankKey(null);
    if (row.id === null) {
      setRows((now) => removeDraft(now, row.key));
      return;
    }
    void send(row.key);
  };

  const add = () => {
    const next = addDraft(rows);
    setRows(next);
    setFocusKey(next.at(-1)!.key);
  };

  return (
    <div className="kf-order-comments">
      {failure && (
        <div className="alert alert-danger" role="alert">
          {failure}
        </div>
      )}
      {rows.length === 0 && (
        <p className="kf-order-comments__empty">{t('orders.comments.empty')}</p>
      )}
      {rows.map((row, index) => {
        const number = index + 1;
        const errorId = `${row.key}-error`;
        const invalid = blankKey === row.key;
        return (
          <div className="kf-order-comments__row" key={row.key}>
            <div className="kf-order-comments__field">
              <textarea
                className={`form-control${invalid ? ' is-invalid' : ''}`}
                rows={2}
                aria-label={t('orders.comments.label', {number})}
                aria-invalid={invalid || undefined}
                aria-describedby={invalid ? errorId : undefined}
                value={row.text}
                ref={(element) => {
                  if (element) fields.current.set(row.key, element);
                  else fields.current.delete(row.key);
                }}
                onChange={(event) =>
                  setRows((now) => editRow(now, row.key, event.target.value))
                }
              />
              {invalid && (
                <div className="invalid-feedback" id={errorId}>
                  {t('orders.comments.blank')}
                </div>
              )}
            </div>
            <div className="kf-order-comments__actions">
              <Button
                size="sm"
                variant="secondary"
                icon="fa-save"
                aria-label={t('orders.comments.save', {number})}
                disabled={busy}
                onClick={() => save(row)}
              />
              <Button
                size="sm"
                variant="ghost"
                icon="fa-times"
                aria-label={t('orders.comments.remove', {number})}
                disabled={busy}
                onClick={() => remove(row)}
              />
            </div>
          </div>
        );
      })}
      <Button size="sm" icon="fa-plus" disabled={busy} onClick={add}>
        {t('orders.comments.add')}
      </Button>
    </div>
  );
}
