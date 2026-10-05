import {useState} from 'react';
import {deleteCustomer, type Customer} from '@/entities/customer';
import {ApiError, failureMessage} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {ConfirmModal} from '@/shared/ui';

/**
 * The red button of a customer's row and the question it asks before deleting them (their orders go too: the API
 * soft-deletes both). `onDeleted` runs once the API has answered; a customer already gone counts as deleted.
 */
export function DeleteCustomerButton({
  customer,
  onDeleted,
}: {
  customer: Customer;
  onDeleted: () => void;
}) {
  const {t} = useTranslation();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const name =
    `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim();

  const close = () => {
    setAsking(false);
    setFailure(null);
  };

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
    close();
    onDeleted();
  };

  return (
    <>
      <button
        type="button"
        className="btn btn-sm btn-danger"
        title={t('customers.delete')}
        aria-label={`${t('customers.delete')}: ${name || customer.email || customer.id}`}
        onClick={() => setAsking(true)}
      >
        <i className="fas fa-times-circle" aria-hidden="true" />
      </button>
      {asking && (
        <ConfirmModal
          title={t('customers.delete')}
          confirmLabel={t('common.delete')}
          danger
          busy={busy}
          onConfirm={() => void confirm()}
          onCancel={close}
        >
          <p className="h5">{t('customers.confirmDelete')}</p>
          <p className="mb-0 text-muted">
            {t('customers.confirmDeleteDetail', {
              name: name || customer.email || String(customer.id),
            })}
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
