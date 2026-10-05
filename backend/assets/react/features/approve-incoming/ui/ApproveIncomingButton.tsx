import {useState} from 'react';
import {ApiError, failureMessage} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {approveIncoming} from '../api/approveIncomingApi';

/** "Approve all": moves every incoming row of the warehouse into its stock. */
export function ApproveIncomingButton({
  warehouseId,
  disabled = false,
  onApproved,
}: {
  warehouseId: number;
  disabled?: boolean;
  onApproved: (approved: number) => void;
}) {
  const {t} = useTranslation();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const approve = async () => {
    setBusy(true);
    setFailure(null);
    try {
      onApproved((await approveIncoming(warehouseId)).approved);
    } catch (error) {
      setFailure(
        error instanceof ApiError && error.status === 403
          ? t('stock.errors.forbidden')
          : error instanceof ApiError && error.status === 404
            ? t('stock.errors.warehouse_not_found')
            : failureMessage(error, t),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="btn btn-sm btn-success"
        disabled={disabled || busy}
        onClick={approve}
      >
        <i className="fas fa-check" aria-hidden="true" />{' '}
        {busy ? t('stock.incoming.approving') : t('stock.incoming.approveAll')}
      </button>
      {failure && (
        <div className="alert alert-danger mt-2" role="alert">
          {failure}
        </div>
      )}
    </>
  );
}
