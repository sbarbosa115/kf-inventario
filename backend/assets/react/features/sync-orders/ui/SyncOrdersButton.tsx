import {useState} from 'react';
import {ApiError, failureMessage} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {Button, useToast} from '@/shared/ui';
import {syncOrders} from '../api/syncOrdersApi';

const KNOWN_ERRORS = ['order_sync_failed', 'order_sync_unavailable'];

/**
 * "Sync shop orders" (ROLE_CAN_SYNC_ORDERS): pulls the shops' new orders and says what happened in a toast;
 * `onSynced` runs after a pull so the list reloads.
 */
export function SyncOrdersButton({onSynced}: {onSynced: () => void}) {
  const {t} = useTranslation();
  const toast = useToast();
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    try {
      const result = await syncOrders();
      toast.success(t('orders.sync.done', {...result}));
      onSynced();
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
