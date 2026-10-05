import {useState} from 'react';
import {ApiError, failureMessage} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {syncOrders} from '../api/syncOrdersApi';

const KNOWN_ERRORS = ['order_sync_failed', 'order_sync_unavailable'];

/**
 * The Sync Orders button (ROLE_CAN_SYNC_ORDERS): pulls the shops' new orders and tells `onResult` what happened, in
 * the person's words. The list reloads on success.
 */
export function SyncOrdersButton({
  onResult,
}: {
  onResult: (result: {ok: boolean; message: string}) => void;
}) {
  const {t} = useTranslation();
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    try {
      const result = await syncOrders();
      onResult({ok: true, message: t('orders.sync.done', {...result})});
    } catch (error) {
      onResult({
        ok: false,
        message:
          error instanceof ApiError && KNOWN_ERRORS.includes(error.code)
            ? t(`orders.errors.${error.code}`)
            : error instanceof ApiError && error.status === 403
              ? t('errors.forbidden')
              : failureMessage(error, t),
      });
    } finally {
      setRunning(false);
    }
  };

  const label = running ? t('orders.sync.running') : t('orders.sync.button');
  return (
    <button
      type="button"
      className="btn btn-secondary ml-1"
      title={label}
      aria-label={label}
      disabled={running}
      onClick={() => void run()}
    >
      <i
        className={`fas fa-sync${running ? ' fa-spin' : ''}`}
        aria-hidden="true"
      />
    </button>
  );
}
