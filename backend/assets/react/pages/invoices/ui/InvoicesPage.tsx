import {useState} from 'react';
import {Link, useLocation} from 'react-router-dom';
import {
  customerLabel,
  formatInvoiceDate,
  invoicePdfUrl,
  listInvoices,
  type Invoice,
} from '@/entities/invoice';
import {useCan} from '@/entities/session';
import {InvoiceDetail} from '@/widgets/invoice-detail';
import {ApiError} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {useLoad} from '@/shared/lib';
import {DataTable, PageCard, type Column} from '@/shared/ui';

/** Invoices (/admin/invoices): every invoice newest first, its detail in a dialog, its PDF, and the way to a new one. */
export function InvoicesPage() {
  const {t} = useTranslation();
  const canCreate = useCan('ROLE_CAN_CREATE_INVOICES');
  const created = (useLocation().state as {saved?: 'created'} | null)?.saved;
  const {data, loading, error, reload} = useLoad(listInvoices, []);
  const [detailId, setDetailId] = useState<number | null>(null);

  const label = (invoice: Invoice) =>
    customerLabel(invoice.customer) ?? t('invoices.posClient');

  const columns: Column<Invoice>[] = [
    {
      key: 'code',
      header: t('invoices.columns.code'),
      render: (invoice) => invoice.code,
      sortValue: (invoice) => invoice.code ?? '',
      searchValue: (invoice) => invoice.code ?? null,
    },
    {
      key: 'customer',
      header: t('invoices.columns.customer'),
      render: label,
      sortValue: (invoice) => label(invoice).toLowerCase(),
      searchValue: label,
    },
    {
      key: 'total',
      header: t('invoices.columns.total'),
      render: (invoice) => invoice.total,
      sortValue: (invoice) => Number(invoice.total ?? 0),
      searchValue: (invoice) => invoice.total ?? null,
      numeric: true,
    },
    {
      key: 'date',
      header: t('invoices.columns.date'),
      render: (invoice) => formatInvoiceDate(invoice.created_at),
      sortValue: (invoice) => invoice.created_at ?? '',
      searchValue: (invoice) => formatInvoiceDate(invoice.created_at),
    },
    {
      key: 'options',
      header: t('invoices.columns.options'),
      render: (invoice) => (
        <>
          <button
            type="button"
            className="btn btn-sm btn-success"
            aria-label={`${t('invoices.detail.title')}: ${invoice.code}`}
            onClick={() => setDetailId(invoice.id)}
          >
            {t('invoices.detail.title')}
          </button>{' '}
          <a
            href={invoicePdfUrl(invoice.id)}
            className="btn btn-sm btn-success"
            target="_blank"
            rel="noopener noreferrer"
            title={t('invoices.detail.viewPdf')}
            aria-label={`${t('invoices.detail.viewPdf')}: ${invoice.code}`}
          >
            <i className="fas fa-file-pdf" aria-hidden="true" />
          </a>
        </>
      ),
    },
  ];

  return (
    <PageCard
      title={t('invoices.title')}
      actions={
        canCreate && (
          <Link to="/admin/invoices/new" className="btn btn-sm btn-success">
            {t('invoices.create')}
          </Link>
        )
      }
    >
      {created && (
        <div className="alert alert-success" role="status">
          {t('invoices.created')}
        </div>
      )}
      {error instanceof ApiError && error.status === 403 ? (
        <div className="alert alert-warning" role="alert">
          {t('errors.forbidden')}
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={data}
          rowKey={(invoice) => invoice.id}
          loading={loading && data === undefined}
          error={error}
          onRetry={reload}
          emptyMessage={t('invoices.empty')}
          pageSize={10}
        />
      )}
      {detailId !== null && (
        <InvoiceDetail invoiceId={detailId} onClose={() => setDetailId(null)} />
      )}
    </PageCard>
  );
}
