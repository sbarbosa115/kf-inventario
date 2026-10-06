import {useId, useRef, useState, type KeyboardEvent} from 'react';
import {addOrderComment, type OrderComment} from '@/entities/comment';
import {ApiError, failureMessage} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {Button} from '@/shared/ui';
import './add-comment.css';

const MAX_ROWS = 5;

/** The codes the comments endpoint answers that the box can explain (comments.errors.*). */
const KNOWN = [
  'shop_note_unavailable',
  'quick_phrase_not_found',
  'order_not_found',
  'validation_failed',
];

/** What to say when a comment could not be added: the API's reason when it has one, else the connection or our side. */
export function commentFailure(
  error: unknown,
  t: (key: string) => string,
): string {
  if (error instanceof ApiError && KNOWN.includes(error.code)) {
    return t(`comments.errors.${error.code}`);
  }
  return failureMessage(error, t);
}

/**
 * The order's write box: a text area that grows to five lines (Enter sends, Shift+Enter starts a line; on a phone the
 * keyboard's key says Send, and the Send button is there), and, for an order from a shop, "Also send to <shop> as an
 * order note". After a send the box empties and keeps the focus; a failure is said here and keeps the text.
 */
export function AddComment({
  orderId,
  shop,
  onAdded,
}: {
  orderId: number;
  /** The shop the order came from; null for an order typed here. `takes_notes` false: the connection is off or
   * does not take order notes, so there is nothing to offer. */
  shop: {id: number; name: string; takes_notes?: boolean} | null;
  onAdded: (comment: OrderComment) => void;
}) {
  const {t} = useTranslation();
  const hintId = useId();
  const field = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState('');
  const [toShop, setToShop] = useState(false);
  // The shop said it takes no notes (connection off, or notes switched off): the checkbox would only fail again.
  const [shopRefused, setShopRefused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const content = text.trim();
  const offerShop = shop !== null && shop.takes_notes !== false && !shopRefused;

  const send = async () => {
    if (content === '' || busy) return;
    setBusy(true);
    setFailure(null);
    try {
      const comment = await addOrderComment(orderId, {
        content,
        ...(offerShop && toShop ? {send_to_shop: true} : {}),
      });
      setText('');
      setToShop(false);
      onAdded(comment);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'shop_note_unavailable') {
        setShopRefused(true);
        setToShop(false);
      }
      setFailure(commentFailure(error, t));
    } finally {
      setBusy(false);
      field.current?.focus();
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key !== 'Enter' ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    ) {
      return;
    }
    event.preventDefault();
    void send();
  };

  const rows = Math.min(MAX_ROWS, Math.max(1, text.split('\n').length));

  return (
    <div className="kf-add-comment">
      {failure && (
        <div className="alert alert-danger kf-add-comment__alert" role="alert">
          {failure}
        </div>
      )}
      <div className="kf-add-comment__row">
        <textarea
          ref={field}
          className="form-control kf-add-comment__field"
          rows={rows}
          value={text}
          aria-label={t('comments.box.label')}
          aria-describedby={hintId}
          placeholder={t('comments.box.placeholder')}
          enterKeyHint="send"
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <Button
          variant="primary"
          icon="fa-paper-plane"
          loading={busy}
          disabled={content === ''}
          onClick={() => void send()}
        >
          {t('comments.box.send')}
        </Button>
      </div>
      <div className="kf-add-comment__extras">
        {shop && offerShop && (
          <label className="kf-add-comment__shop">
            <input
              type="checkbox"
              checked={toShop}
              onChange={(event) => setToShop(event.target.checked)}
            />
            <span>{t('comments.box.alsoToShop', {shop: shop.name})}</span>
          </label>
        )}
        <span id={hintId} className="kf-add-comment__hint">
          {t('comments.box.hint')}
        </span>
      </div>
    </div>
  );
}
