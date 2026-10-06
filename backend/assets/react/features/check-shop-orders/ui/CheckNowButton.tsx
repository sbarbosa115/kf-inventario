import {useState} from 'react';
import {ApiError, failureMessage} from '@/shared/api';
import {useTranslation, type Translate} from '@/shared/i18n';
import {Button, useToast} from '@/shared/ui';
import {checkShops, type CheckResult} from '../api/checkShopsApi';

const KNOWN_ERRORS = ['order_sync_failed', 'order_sync_unavailable'];

/** "3 orders imported from 2 shops, 1 skipped." (+ "; Kfvintage could not be read." when some failed). */
function summary(
  result: CheckResult,
  t: Translate,
): {
  text: string;
  failed: boolean;
} {
  if (result.connections.length === 0) {
    return {text: t('orders.sync.nothing'), failed: false};
  }
  const read = result.connections.filter((c) => !c.error);
  const unread = result.connections.filter((c) => c.error);
  const counts = t('orders.sync.summary', {
    imported: t('orders.sync.imported', {count: result.imported}),
    from: t('orders.sync.fromShops', {count: read.length}),
    skipped: t('orders.sync.skipped', {count: result.skipped}),
  });
  return unread.length === 0
    ? {text: t('orders.sync.done', {summary: counts}), failed: false}
    : {
        text: t('orders.sync.partly', {
          summary: counts,
          names: unread.map((c) => c.name).join(', '),
          count: unread.length,
        }),
        failed: true,
      };
}

/**
 * "Check now" (ROLE_CAN_SYNC_ORDERS; docs/pdr/prd-shops-settings.md, "Screen proposals" 3): pulls every active shop
 * connection at once and says what each brought in, in one toast; a shop that could not be read is named in a toast
 * that stays. `onChecked` runs after a check that reached any shop, so the list (and the health line) reload.
 */
export function CheckNowButton({onChecked}: {onChecked: () => void}) {
  const {t} = useTranslation();
  const toast = useToast();
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    try {
      const {text, failed} = summary(await checkShops(), t);
      if (failed) toast.error(text);
      else toast.success(text);
      onChecked();
    } catch (error) {
      toast.error(
        error instanceof ApiError && KNOWN_ERRORS.includes(error.code)
          ? t(`orders.errors.${error.code}`)
          : error instanceof ApiError && error.status === 403
            ? t('errors.forbidden')
            : failureMessage(error, t),
      );
    } finally {
      setRunning(false);
    }
  };

  return (
    <Button
      variant="secondary"
      icon="fa-sync"
      loading={running}
      onClick={() => void run()}
    >
      {running ? t('orders.sync.running') : t('orders.sync.button')}
    </Button>
  );
}
