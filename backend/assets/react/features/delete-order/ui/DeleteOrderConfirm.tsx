import {useState} from 'react';
import {ApiError, failureMessage} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {ConfirmModal, useToast} from '@/shared/ui';
import {deleteOrder} from '../api/deleteOrderApi';

/**
 * The question asked before an order is deleted (ROLE_CAN_DELETE_ORDERS), and the delete itself. `onDeleted` runs
 * once the API has answered; an order already gone counts as deleted. A failure is said inside the question.
 */
export function DeleteOrderConfirm({
  order,
  onDeleted,
  onCancel,
}: {
  order: {id: number; code?: string | null};
  onDeleted: () => void;
  onCancel: () => void;
}) {
  const {t} = useTranslation();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const code = order.code ?? String(order.id);

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
    toast.success(t('orders.delete.done', {code}));
    onDeleted();
  };

  return (
    <ConfirmModal
      title={t('orders.delete.title', {code})}
      confirmLabel={t('orders.delete.confirm')}
      danger
      busy={busy}
      onConfirm={() => void confirm()}
      onCancel={onCancel}
    >
      <p className="mb-0">{t('orders.delete.body')}</p>
      {failure && (
        <div className="alert alert-danger mt-3 mb-0" role="alert">
          {failure}
        </div>
      )}
    </ConfirmModal>
  );
}
