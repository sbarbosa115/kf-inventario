import {useState} from 'react';
import {ApiError, failureMessage, type Schema} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {Button, ConfirmModal, useToast} from '@/shared/ui';
import {approveIncoming} from '../api/approveIncomingApi';

/**
 * "Approve all (N)": asks first, naming the products, the units and the warehouse, then moves every incoming row of
 * the warehouse into its stock and says how many the API approved.
 */
export function ApproveIncomingButton({
  warehouse,
  rows,
  onApproved,
}: {
  warehouse: {id: number; name: string};
  /** The incoming rows the page shows: the figures of the label and the question. */
  rows: Schema<'StockOutput'>[];
  onApproved: (approved: number) => void;
}) {
  const {t} = useTranslation();
  const toast = useToast();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const units = rows.reduce((sum, row) => sum + row.quantity, 0);
  const products = t('stock.count.products', {count: rows.length});

  const approve = async () => {
    setBusy(true);
    try {
      const {approved} = await approveIncoming(warehouse.id);
      toast.success(t('stock.incoming.approved', {count: approved}));
      onApproved(approved);
    } catch (error) {
      toast.error(
        error instanceof ApiError && error.status === 403
          ? t('stock.errors.forbidden')
          : error instanceof ApiError && error.status === 404
            ? t('stock.errors.warehouse_not_found')
            : failureMessage(error, t),
      );
    } finally {
      setBusy(false);
      setAsking(false);
    }
  };

  return (
    <>
      <Button
        variant="primary"
        icon="fa-check"
        disabled={rows.length === 0}
        onClick={() => setAsking(true)}
      >
        {t('stock.incoming.approveAll', {count: rows.length})}
      </Button>
      {asking && (
        <ConfirmModal
          title={t('stock.incoming.confirmTitle')}
          confirmLabel={t('stock.incoming.confirm', {products})}
          busy={busy}
          onConfirm={approve}
          onCancel={() => setAsking(false)}
        >
          <p>
            {t('stock.incoming.confirmBody', {
              products,
              units: t('stock.count.units', {count: units}),
              warehouse: warehouse.name,
            })}
          </p>
        </ConfirmModal>
      )}
    </>
  );
}
