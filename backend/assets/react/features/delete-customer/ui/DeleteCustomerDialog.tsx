import {useState} from 'react';
import {deleteCustomer, type Customer} from '@/entities/customer';
import {ApiError, failureMessage} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {ConfirmModal} from '@/shared/ui';

/** What a customer is called in a sentence: their name, else their email, else their number. */
export const customerName = (customer: Customer) =>
  `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim() ||
  customer.email ||
  String(customer.id);

/**
 * The question asked before deleting a customer (their orders go too: the API soft-deletes both), opened from the
 * row's "⋯" menu. `onDeleted` runs once the API has answered; a customer already gone counts as deleted.
 */
export function DeleteCustomerDialog({
  customer,
  onClose,
  onDeleted,
}: {
  customer: Customer;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const {t} = useTranslation();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setFailure(null);
    try {
      await deleteCustomer(customer.id);
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
    onClose();
    onDeleted();
  };

  return (
    <ConfirmModal
      title={t('customers.deleteTitle')}
      confirmLabel={t('common.delete')}
      danger
      busy={busy}
      onConfirm={() => void confirm()}
      onCancel={onClose}
    >
      <p className="mb-0">
        {t('customers.confirmDelete', {name: customerName(customer)})}
      </p>
      {failure && (
        <div className="alert alert-danger mt-3 mb-0" role="alert">
          {failure}
        </div>
      )}
    </ConfirmModal>
  );
}
