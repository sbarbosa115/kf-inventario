import {useState} from 'react';
import {addOrderComment, type OrderComment} from '@/entities/comment';
import {listQuickPhrases, type QuickPhrase} from '@/entities/settings';
import {ApiError, failureMessage} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {useLoad} from '@/shared/lib';
import {useToast} from '@/shared/ui';
import './quick-phrases.css';

const EXPLAINED = ['quick_phrase_not_found', 'order_not_found'];

/**
 * The comment box's phrase bar: the active quick phrases (Settings › Quick phrases) as chips in their order, scrolling
 * sideways; one tap adds that phrase to the order as a dated comment. Nothing shows while there are none.
 */
export function QuickPhrases({
  orderId,
  onAdded,
}: {
  orderId: number;
  onAdded: (comment: OrderComment) => void;
}) {
  const {t} = useTranslation();
  const toast = useToast();
  const {data} = useLoad(() => listQuickPhrases(), []);
  const [busy, setBusy] = useState<number | null>(null);

  if (!data || data.length === 0) return null;

  const add = async (phrase: QuickPhrase) => {
    setBusy(phrase.id);
    try {
      onAdded(
        await addOrderComment(orderId, {
          content: phrase.text,
          phrase_id: phrase.id,
        }),
      );
    } catch (error) {
      toast.error(
        error instanceof ApiError && EXPLAINED.includes(error.code)
          ? t(`comments.errors.${error.code}`)
          : failureMessage(error, t),
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className="kf-phrase-bar"
      role="group"
      aria-label={t('comments.phrases.label')}
    >
      {data.map((phrase) => (
        <button
          key={phrase.id}
          type="button"
          className="kf-chip kf-phrase-bar__chip"
          aria-label={t('comments.phrases.add', {text: phrase.text})}
          disabled={busy !== null}
          aria-busy={busy === phrase.id || undefined}
          onClick={() => void add(phrase)}
        >
          {phrase.text}
        </button>
      ))}
    </div>
  );
}
