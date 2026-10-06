import type {ReactNode} from 'react';
import {
  customerName,
  getInvoice,
  invoicePdfUrl,
  type Invoice,
  type InvoiceItem,
} from '@/entities/invoice';
import {ApiError} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {useFormat, useLoad} from '@/shared/lib';
import {
  Button,
  DataTable,
  ErrorState,
  Money,
  Num,
  Skeleton,
  SlideOver,
  type Column,
} from '@/shared/ui';
import './invoice-detail.css';

/**
 * An invoice in a slide-over beside the list: who and when, its lines, the totals and the way to its PDF. The title
 * is right before the invoice loads when the list passes its code.
 */
export function InvoiceDetail({
  invoiceId,
  code,
  onClose,
}: {
  invoiceId: number;
  code?: string | null;
  onClose: () => void;
}) {
  const {t} = useTranslation();
  const {
    data: invoice,
    error,
    reload,
  } = useLoad(() => getInvoice(invoiceId), [invoiceId]);
  const gone = error instanceof ApiError && error.status === 404;
  const title = t('invoices.detail.title', {
    code: invoice?.code ?? code ?? String(invoiceId),
  });

  return (
    <SlideOver
      title={title}
      width="lg"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.close')}
          </Button>
          <Button
            variant="primary"
            icon="fa-file-pdf"
            href={invoicePdfUrl(invoiceId)}
            target="_blank"
          >
            {t('invoices.detail.viewPdf')}
          </Button>
        </>
      }
    >
      {gone ? (
        <div className="alert alert-warning" role="alert">
          {t('invoices.detail.gone')}
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : invoice === undefined ? (
        <Skeleton variant="form" />
      ) : (
        <Body invoice={invoice} />
      )}
    </SlideOver>
  );
}

function Body({invoice}: {invoice: Invoice}) {
  const {t} = useTranslation();
  const {date} = useFormat();
  const name = customerName(invoice.customer);
  const hasTax =
    invoice.tax_amount !== null && invoice.tax_amount !== undefined;

  const columns: Column<InvoiceItem>[] = [
    {
      key: 'code',
      header: t('invoices.detail.productCode'),
      render: (item) => item.product?.code ?? '',
      mono: true,
    },
    {
      key: 'description',
      header: t('invoices.detail.description'),
      render: (item) => item.description,
    },
    {
      key: 'quantity',
      header: t('invoices.detail.quantity'),
      render: (item) => <Num value={item.quantity} />,
      numeric: true,
    },
    {
      key: 'unit_price',
      header: t('invoices.detail.unitPrice'),
      render: (item) => <Money amount={item.unit_price} />,
      numeric: true,
    },
    {
      key: 'total',
      header: t('invoices.detail.lineTotal'),
      render: (item) => <Money amount={item.total} />,
      numeric: true,
    },
  ];

  return (
    <>
      <dl className="kf-invoice-detail__facts">
        <Fact label={t('invoices.columns.customer')}>
          {name ?? t('invoices.posClient')}
          {invoice.customer?.email && (
            <span className="kf-invoice-detail__muted">
              {' '}
              · {invoice.customer.email}
            </span>
          )}
        </Fact>
        <Fact label={t('invoices.columns.date')}>
          {date(invoice.created_at)}
        </Fact>
        {invoice.comment && (
          <Fact label={t('invoices.form.comment')}>{invoice.comment}</Fact>
        )}
      </dl>
      <DataTable
        columns={columns}
        rows={invoice.items}
        rowKey={(item) => item.id}
        rowLabel={(item) => item.description ?? String(item.id)}
        searchable={false}
        pageSize={0}
        cardTitle={(item) => item.description}
        cardFacts={['quantity', 'unit_price', 'total']}
      />
      <dl className="kf-invoice-detail__totals">
        {hasTax && (
          <>
            <Total
              label={t('invoices.form.subtotal')}
              amount={invoice.subtotal}
            />
            <Total
              label={t('invoices.form.tax', {rate: Number(invoice.tax_rate)})}
              amount={invoice.tax_amount}
            />
          </>
        )}
        <Total
          label={t('invoices.columns.total')}
          amount={invoice.total}
          large
        />
      </dl>
    </>
  );
}

function Fact({label, children}: {label: string; children: ReactNode}) {
  return (
    <div className="kf-invoice-detail__fact">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Total({
  label,
  amount,
  large = false,
}: {
  label: string;
  amount: string | number | null | undefined;
  large?: boolean;
}) {
  return (
    <div
      className={`kf-invoice-detail__total${large ? ' kf-invoice-detail__total--large' : ''}`}
    >
      <dt>{label}</dt>
      <dd>
        <Money amount={amount} />
      </dd>
    </div>
  );
}
