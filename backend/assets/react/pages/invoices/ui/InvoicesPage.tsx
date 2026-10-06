import {useState} from 'react';
import {
  customerName,
  invoicePdfUrl,
  listInvoices,
  type Invoice,
} from '@/entities/invoice';
import {useCan} from '@/entities/session';
import {InvoiceDetail} from '@/widgets/invoice-detail';
import {ApiError, type DateRangeValue} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {useDebouncedText, useFormat, useListQuery, useLoad} from '@/shared/lib';
import {
  Button,
  ClearFilters,
  DataTable,
  Money,
  PageHeader,
  SearchBox,
  Toolbar,
  type Column,
  type RowAction,
} from '@/shared/ui';
import {invoiceSearch} from '../lib/invoiceSearch';
import './invoices.css';

/**
 * Invoices (/admin/invoices): newest first, searched by customer or number and filtered by a date range on the
 * server (the query in the address). A row opens the invoice in a slide-over; its menu has the detail and the PDF.
 */
export function InvoicesPage() {
  const {t} = useTranslation();
  const {date} = useFormat();
  const canCreate = useCan('ROLE_CAN_CREATE_INVOICES');
  const list = useListQuery({sort: '-created_at'});
  const walkIn = t('invoices.posClient');
  const key = JSON.stringify([list.query, walkIn]);
  const {data, loading, error, reload} = useLoad(
    () => listInvoices(invoiceSearch(list.query, walkIn)),
    [key],
  );
  const [detail, setDetail] = useState<Invoice | null>(null);
  const [search, setSearch] = useDebouncedText(list.query.q ?? '', (q) =>
    list.update({q: q === '' ? undefined : q}),
  );
  const created = (list.query.filters?.created_at ?? {}) as DateRangeValue;
  const setCreated = (range: DateRangeValue) =>
    list.setFilter('created_at', range);

  const nameOf = (invoice: Invoice) => customerName(invoice.customer) ?? walkIn;
  const filtered = list.activeCount > 0;
  const forbidden = error instanceof ApiError && error.status === 403;

  const columns: Column<Invoice>[] = [
    {
      key: 'code',
      header: t('invoices.columns.code'),
      render: (invoice) => invoice.code,
      sortField: 'code',
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
      sortField: 'customer',
    },
    {
      key: 'total',
      header: t('invoices.columns.total'),
      render: (invoice) => <Money amount={invoice.total} />,
      sortField: 'total',
      numeric: true,
    },
    {
      key: 'date',
      header: t('invoices.columns.date'),
      render: (invoice) => date(invoice.created_at),
      sortField: 'created_at',
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
            : t('invoices.count', {count: data.total})
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
            value={search}
            onChange={setSearch}
          />
        </div>
        <DateField
          label={t('invoices.filters.from')}
          value={created.from ?? ''}
          max={created.to || undefined}
          onChange={(from) => setCreated({...created, from})}
        />
        <DateField
          label={t('invoices.filters.to')}
          value={created.to ?? ''}
          min={created.from || undefined}
          onChange={(to) => setCreated({...created, to})}
        />
        {filtered && <ClearFilters onClick={list.clearFilters} />}
      </Toolbar>
      {forbidden ? (
        <div className="alert alert-warning" role="alert">
          {t('errors.forbidden')}
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={data?.items}
          query={list.query}
          onQueryChange={list.update}
          total={data?.total}
          rowKey={(invoice) => invoice.id}
          rowLabel={(invoice) => invoice.code ?? String(invoice.id)}
          loading={loading && data === undefined}
          error={error}
          onRetry={reload}
          emptyMessage={t('invoices.empty')}
          searchable={false}
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
