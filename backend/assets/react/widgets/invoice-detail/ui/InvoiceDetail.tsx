import {
  customerLabel,
  formatInvoiceDate,
  getInvoice,
  invoicePdfUrl,
} from '@/entities/invoice';
import {ApiError} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {useLoad} from '@/shared/lib';
import {ErrorState, Loader, Modal} from '@/shared/ui';

/** The Invoice Detail dialog: the invoice's lines and totals, and the link to its PDF. */
export function InvoiceDetail({
  invoiceId,
  onClose,
}: {
  invoiceId: number;
  onClose: () => void;
}) {
  const {t} = useTranslation();
  const {
    data: invoice,
    error,
    reload,
  } = useLoad(() => getInvoice(invoiceId), [invoiceId]);
  const gone = error instanceof ApiError && error.status === 404;

  return (
    <Modal
      title={t('invoices.detail.title')}
      size="lg"
      onClose={onClose}
      footer={
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          {t('common.close')}
        </button>
      }
    >
      {gone ? (
        <div className="alert alert-warning" role="alert">
          {t('invoices.detail.gone')}
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : invoice === undefined ? (
        <Loader />
      ) : (
        <>
          <div className="row mb-2">
            <div className="col-md-6">
              <p className="mb-1">
                <strong>{t('invoices.columns.code')}:</strong> {invoice.code}
              </p>
              <p className="mb-1">
                <strong>{t('invoices.columns.customer')}:</strong>{' '}
                {customerLabel(invoice.customer) ?? t('invoices.posClient')}
              </p>
              <p className="mb-1">
                <strong>{t('invoices.columns.date')}:</strong>{' '}
                {formatInvoiceDate(invoice.created_at)}
              </p>
              {invoice.comment && (
                <p className="mb-1">
                  <strong>{t('invoices.form.comment')}:</strong>{' '}
                  {invoice.comment}
                </p>
              )}
            </div>
            <div className="col-md-6 text-right">
              <a
                href={invoicePdfUrl(invoice.id)}
                className="btn btn-sm btn-success"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('invoices.detail.viewPdf')}
              </a>
            </div>
          </div>
          <div className="table-responsive">
            <table className="table table-sm table-striped">
              <thead>
                <tr>
                  <th scope="col">{t('invoices.detail.productCode')}</th>
                  <th scope="col">{t('invoices.detail.description')}</th>
                  <th scope="col" className="text-right">
                    {t('invoices.detail.quantity')}
                  </th>
                  <th scope="col" className="text-right">
                    {t('invoices.detail.unitPrice')}
                  </th>
                  <th scope="col" className="text-right">
                    {t('invoices.columns.total')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.product?.code ?? ''}</td>
                    <td>{item.description}</td>
                    <td className="text-right">{item.quantity}</td>
                    <td className="text-right">{item.unit_price}</td>
                    <td className="text-right">{item.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-right">
            {invoice.tax_amount !== null &&
              invoice.tax_amount !== undefined && (
                <>
                  <div>
                    <strong>{t('invoices.form.subtotal')}:</strong>{' '}
                    {invoice.subtotal}
                  </div>
                  <div>
                    <strong>
                      {t('invoices.form.tax', {rate: Number(invoice.tax_rate)})}
                      :
                    </strong>{' '}
                    {invoice.tax_amount}
                  </div>
                </>
              )}
            <div>
              <strong>{t('invoices.columns.total')}:</strong> {invoice.total}
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
