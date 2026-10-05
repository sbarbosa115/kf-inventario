import {useEffect, useRef, useState} from 'react';
import type {OrderComment} from '@/entities/order';
import {ApiError, failureMessage} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
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

/**
 * An order's comments, edited in place (any signed-in user, as before): each one with its Save and Remove, and a
 * button that adds one. Every save sends the comments as they are on screen; `onSaved` runs after each one.
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
  const [rows, setRows] = useState<CommentRow[]>(() => rowsFrom(comments));
  const [busy, setBusy] = useState(false);
  const [blankKey, setBlankKey] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<{ok: boolean; text: string} | null>(
    null,
  );
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const fields = useRef(new Map<string, HTMLTextAreaElement>());

  useEffect(() => {
    if (focusKey) fields.current.get(focusKey)?.focus();
  }, [focusKey]);

  const send = async (except?: string) => {
    setBusy(true);
    setOutcome(null);
    try {
      const saved = await saveOrderComments(
        orderId,
        commentsPayload(rows, except),
      );
      setRows((now) => afterSave(now, saved.comments));
      setOutcome({ok: true, text: t('orders.comments.saved')});
      onSaved();
    } catch (error) {
      setOutcome({
        ok: false,
        text:
          error instanceof ApiError && error.status === 404
            ? t('orders.errors.order_not_found')
            : failureMessage(error, t),
      });
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
    <div className="pt-3">
      {outcome && (
        <div
          className={`alert ${outcome.ok ? 'alert-success' : 'alert-danger'}`}
          role={outcome.ok ? 'status' : 'alert'}
        >
          {outcome.text}
        </div>
      )}
      {rows.length === 0 && (
        <p className="text-muted">{t('orders.comments.empty')}</p>
      )}
      {rows.map((row, index) => {
        const number = index + 1;
        const errorId = `${row.key}-error`;
        const invalid = blankKey === row.key;
        return (
          <div className="d-flex align-items-start mb-2" key={row.key}>
            <div className="flex-grow-1">
              <textarea
                className={`form-control${invalid ? ' is-invalid' : ''}`}
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
            <button
              type="button"
              className="btn btn-sm btn-primary m-1"
              title={t('orders.comments.save', {number})}
              aria-label={t('orders.comments.save', {number})}
              disabled={busy}
              onClick={() => save(row)}
            >
              <i className="fas fa-save" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="btn btn-sm btn-danger m-1"
              title={t('orders.comments.remove', {number})}
              aria-label={t('orders.comments.remove', {number})}
              disabled={busy}
              onClick={() => remove(row)}
            >
              <i className="fas fa-times" aria-hidden="true" />
            </button>
          </div>
        );
      })}
      <button
        type="button"
        className="btn btn-sm btn-success"
        title={t('orders.comments.add')}
        aria-label={t('orders.comments.add')}
        disabled={busy}
        onClick={add}
      >
        <i className="fas fa-plus" aria-hidden="true" />
      </button>
    </div>
  );
}
