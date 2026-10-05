import {useState} from 'react';
import {ApiError, failureMessage} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {ConfirmModal} from '@/shared/ui';
import {deleteOrder} from '../api/deleteOrderApi';

/**
 * The red button of an order's row and the question it asks before deleting it. `onDeleted` runs once the API has
 * answered; an order already gone counts as deleted.
 */
export function DeleteOrderButton({
  order,
  onDeleted,
}: {
  order: {id: number; code?: string | null};
  onDeleted: () => void;
}) {
  const {t} = useTranslation();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const code = order.code ?? String(order.id);

  const close = () => {
    setAsking(false);
    setFailure(null);
  };

  const confirm = async () => {
    setBusy(true);
    setFailure(null);
    try {
      await deleteOrder(order.id);
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 404)) {
        setFailure(
          error instanceof ApiError && error.status === 403
            ? t('errors.forbidden')
            : failureMessage(error, t),
        );
        setBusy(false);
        return;
      }
    }
    setBusy(false);
    close();
    onDeleted();
  };

  return (
    <>
      <button
        type="button"
        className="btn btn-sm btn-danger"
        title={t('orders.delete')}
        aria-label={t('orders.deleteOf', {code})}
        onClick={() => setAsking(true)}
      >
        <i className="fas fa-trash" aria-hidden="true" />
      </button>
      {asking && (
        <ConfirmModal
          title={t('orders.delete')}
          confirmLabel={t('common.delete')}
          danger
          busy={busy}
          onConfirm={() => void confirm()}
          onCancel={close}
        >
          <p className="h5">{t('orders.confirmDelete')}</p>
          <p className="mb-0 text-muted">
            {t('orders.confirmDeleteDetail', {code})}
          </p>
          {failure && (
            <div className="alert alert-danger mt-3 mb-0" role="alert">
              {failure}
            </div>
          )}
        </ConfirmModal>
      )}
    </>
  );
}
