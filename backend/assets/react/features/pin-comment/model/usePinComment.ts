import {useState} from 'react';
import {pinComment, unpinComment, type OrderComment} from '@/entities/comment';
import {ApiError, failureMessage} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {useToast} from '@/shared/ui';

const EXPLAINED = ['comment_not_found', 'order_not_found'];

/**
 * Pins a comment to its order (the one pinned before is unpinned by the API) or unpins it: `toggle` answers the
 * comment as saved, or null after saying why it failed. A toast confirms each change.
 */
export function usePinComment(orderId: number) {
  const {t} = useTranslation();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const toggle = async (comment: OrderComment): Promise<OrderComment | null> => {
    setBusy(true);
    try {
      const saved = comment.pinned
        ? await unpinComment(orderId, comment.id)
        : await pinComment(orderId, comment.id);
      toast.success(
        t(saved.pinned ? 'comments.pinnedDone' : 'comments.unpinnedDone'),
      );
      return saved;
    } catch (error) {
      toast.error(
        error instanceof ApiError && EXPLAINED.includes(error.code)
          ? t(`comments.errors.${error.code}`)
          : failureMessage(error, t),
      );
      return null;
    } finally {
      setBusy(false);
    }
  };

  return {toggle, busy};
}
