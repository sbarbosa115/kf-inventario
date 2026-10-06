import {useMemo, useState} from 'react';
import {
  customerName,
  invoiceDay,
  invoicePdfUrl,
  listInvoices,
  type Invoice,
} from '@/entities/invoice';
import {useCan} from '@/entities/session';
import {InvoiceDetail} from '@/widgets/invoice-detail';
import {ApiError} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {useFormat, useLoad} from '@/shared/lib';
import {
  Button,
  ClearFilters,
  DataTable,
  EmptyState,
  Money,
  PageHeader,
  SearchBox,
  Toolbar,
  type Column,
  type RowAction,
} from '@/shared/ui';
import './invoices.css';

const NO_FILTER = {query: '', from: '', to: ''};

/**
 * Invoices (/admin/invoices): every invoice, newest first, filtered in the browser by customer or number and by a
 * date range. A row opens the invoice in a slide-over; its menu has the detail and the PDF.
 */
export function InvoicesPage() {
  const {t} = useTranslation();
  const {date} = useFormat();
  const canCreate = useCan('ROLE_CAN_CREATE_INVOICES');
  const {data, loading, error, reload} = useLoad(listInvoices, []);
  const [detail, setDetail] = useState<Invoice | null>(null);
  const [filter, setFilter] = useState(NO_FILTER);

  const walkIn = t('invoices.posClient');
  const nameOf = (invoice: Invoice) => customerName(invoice.customer) ?? walkIn;

  const rows = useMemo(() => {
    const needle = filter.query.trim().toLowerCase();
    return data?.filter((invoice) => {
      const day = invoiceDay(invoice.created_at);
      if (filter.from !== '' && day < filter.from) return false;
      if (filter.to !== '' && day > filter.to) return false;
      if (needle === '') return true;
      const text = [
        invoice.code,
        customerName(invoice.customer) ?? walkIn,
        invoice.customer?.email,
        invoice.total,
      ];
      return text.some((part) =>
        String(part ?? '')
          .toLowerCase()
          .includes(needle),
      );
    });
  }, [data, filter, walkIn]);

  const filtered =
    filter.query !== '' || filter.from !== '' || filter.to !== '';
  const nothingLeft =
    data !== undefined && data.length > 0 && rows?.length === 0;
  const forbidden = error instanceof ApiError && error.status === 403;

  const columns: Column<Invoice>[] = [
    {
      key: 'code',
      header: t('invoices.columns.code'),
      render: (invoice) => invoice.code,
      sortValue: (invoice) => invoice.code ?? '',
      mono: true,
    },
    {
      key: 'customer',
      header: t('invoices.columns.customer'),
      render: (invoice) => (
        <span className="kf-invoices__customer">
          <span>{nameOf(invoice)}</span>
          {invoice.customer?.email && (
            <span className="kf-invoices__muted">{invoice.customer.email}</span>
          )}
        </span>
      ),
      sortValue: (invoice) => nameOf(invoice).toLowerCase(),
    },
    {
      key: 'total',
      header: t('invoices.columns.total'),
      render: (invoice) => <Money amount={invoice.total} />,
      sortValue: (invoice) => Number(invoice.total ?? 0),
      numeric: true,
    },
    {
      key: 'date',
      header: t('invoices.columns.date'),
      render: (invoice) => date(invoice.created_at),
      sortValue: (invoice) => invoice.created_at ?? '',
    },
  ];

  const actions = (invoice: Invoice): RowAction[] => [
    {
      label: t('invoices.actions.detail'),
      icon: 'fa-receipt',
      onSelect: () => setDetail(invoice),
    },
    {
      label: t('invoices.actions.pdf'),
      icon: 'fa-file-pdf',
      href: invoicePdfUrl(invoice.id),
      external: true,
    },
  ];

  return (
    <>
      <PageHeader
        title={t('invoices.title')}
        subtitle={
          data === undefined
            ? undefined
            : t('invoices.count', {count: data.length})
        }
        primary={
          canCreate && (
            <Button variant="primary" icon="fa-plus" to="/admin/invoices/new">
              {t('invoices.create')}
            </Button>
          )
        }
      />
      <Toolbar label={t('invoices.filters.label')}>
        <div className="kf-invoices__search">
          <SearchBox
            label={t('invoices.filters.search')}
            value={filter.query}
            onChange={(query) => setFilter((now) => ({...now, query}))}
          />
        </div>
        <DateField
          label={t('invoices.filters.from')}
          value={filter.from}
          max={filter.to || undefined}
          onChange={(from) => setFilter((now) => ({...now, from}))}
        />
        <DateField
          label={t('invoices.filters.to')}
          value={filter.to}
          min={filter.from || undefined}
          onChange={(to) => setFilter((now) => ({...now, to}))}
        />
        {filtered && <ClearFilters onClick={() => setFilter(NO_FILTER)} />}
      </Toolbar>
      {forbidden ? (
        <div className="alert alert-warning" role="alert">
          {t('errors.forbidden')}
        </div>
      ) : nothingLeft ? (
        <EmptyState
          icon="fa-filter"
          message={t('common.filteredEmpty')}
          action={
            <Button size="sm" onClick={() => setFilter(NO_FILTER)}>
              {t('common.showAll')}
            </Button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(invoice) => invoice.id}
          rowLabel={(invoice) => invoice.code ?? String(invoice.id)}
          loading={loading && data === undefined}
          error={error}
          onRetry={reload}
          emptyMessage={t('invoices.empty')}
          searchable={false}
          pageSize={20}
          rowActions={actions}
          onRowClick={setDetail}
          cardTitle={(invoice) => (
            <>
              <span className="kf-mono">{invoice.code}</span> ·{' '}
              {nameOf(invoice)}
            </>
          )}
          cardFacts={['total', 'date']}
        />
      )}
      {detail && (
        <InvoiceDetail
          key={detail.id}
          invoiceId={detail.id}
          code={detail.code}
          onClose={() => setDetail(null)}
        />
      )}
    </>
  );
}

function DateField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: string;
  min?: string;
  max?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="kf-invoices__date">
      <span className="kf-invoices__date-label">{label}</span>
      <input
        type="date"
        className="form-control"
        value={value}
        min={min}
        max={max}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
