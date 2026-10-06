import {useMemo, useState} from 'react';
import {
  customerName,
  invoicePdfUrl,
  listInvoices,
  PAYMENT_METHODS,
  type Invoice,
} from '@/entities/invoice';
import {useCan} from '@/entities/session';
import {InvoiceDetail} from '@/widgets/invoice-detail';
import {ApiError} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {
  useDebouncedText,
  useFormat,
  useListQuery,
  useLoad,
  usePhone,
} from '@/shared/lib';
import {
  Button,
  DataTable,
  FilterDropdown,
  Money,
  PageHeader,
  SearchBox,
  Toolbar,
  type Column,
  type FilterColumn,
  type RowAction,
  type TableQuery,
} from '@/shared/ui';
import {invoiceSearch} from '../lib/invoiceSearch';
import './invoices.css';

/** The list columns whose values are counted (the Payment and Walk-in filters). */
const FACETS = ['payment_method', 'walk_in'];

/**
 * Invoices (/admin/invoices): newest first, searched by customer or number, filtered under the headers (number and
 * customer text, the payment method from a list, the total as a money range, a date range; a sheet on a phone) and
 * by walk-in from the toolbar, on the server (the query in the address). A row opens the invoice in a slide-over;
 * its menu has the detail and the PDF.
 */
export function InvoicesPage() {
  const {t} = useTranslation();
  const {date} = useFormat();
  const phone = usePhone();
  const canCreate = useCan('ROLE_CAN_CREATE_INVOICES');
  const list = useListQuery({sort: '-created_at'});
  const walkIn = t('invoices.posClient');
  const key = JSON.stringify([list.query, walkIn]);
  const {data, loading, error, reload} = useLoad(
    () => listInvoices({...invoiceSearch(list.query, walkIn), facets: FACETS}),
    [key],
  );
  // The phone's sheet: how many invoices a draft keeps, one row asked.
  const countFor = (query: TableQuery) =>
    listInvoices({
      ...invoiceSearch(query, walkIn),
      page: 1,
      perPage: 1,
    }).then((page) => page.total);
  const [detail, setDetail] = useState<Invoice | null>(null);
  const [search, setSearch, flushSearch] = useDebouncedText(
    list.query.q ?? '',
    (q) => list.update({q: q === '' ? undefined : q}),
  );
  // Walk-in has no column: a list in the toolbar on a desktop, a section of the sheet on a phone, a chip when set.
  const walkInOptions = useMemo(
    () => [
      {value: 'yes', label: t('invoices.posClient')},
      {value: 'no', label: t('invoices.filters.withCustomer')},
    ],
    [t],
  );
  const walkInFilter: FilterColumn = {
    label: t('invoices.filters.walkIn'),
    filter: {type: 'enum', field: 'walk_in', options: walkInOptions},
  };
  const walkInValue = list.query.filters?.walk_in;
  const walkInCounts = Object.fromEntries(
    (data?.facets?.walk_in ?? []).map((f) => [f.value, f.count]),
  );

  const nameOf = (invoice: Invoice) => customerName(invoice.customer) ?? walkIn;
  const forbidden = error instanceof ApiError && error.status === 403;

  const columns: Column<Invoice>[] = [
    {
      key: 'code',
      header: t('invoices.columns.code'),
      render: (invoice) => invoice.code,
      sortField: 'code',
      mono: true,
      filter: {type: 'text', field: 'code'},
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
      filter: {type: 'text', field: 'customer'},
    },
    {
      key: 'payment',
      header: t('invoices.columns.payment'),
      render: (invoice) =>
        invoice.payment_method
          ? t(`invoices.form.payment.${invoice.payment_method}`, {
              defaultValue: invoice.payment_method,
            })
          : null,
      filter: {
        type: 'enum',
        field: 'payment_method',
        options: PAYMENT_METHODS.map((method) => ({
          value: method,
          label: t(`invoices.form.payment.${method}`),
        })),
      },
    },
    {
      key: 'total',
      header: t('invoices.columns.total'),
      render: (invoice) => <Money amount={invoice.total} />,
      sortField: 'total',
      numeric: true,
      filter: {type: 'money', field: 'total'},
    },
    {
      key: 'date',
      header: t('invoices.columns.date'),
      render: (invoice) => date(invoice.created_at),
      sortField: 'created_at',
      filter: {type: 'date', field: 'created_at'},
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
            onBlur={flushSearch}
          />
        </div>
        {!phone && (
          <FilterDropdown
            label={walkInFilter.label}
            options={walkInOptions}
            counts={data?.facets ? walkInCounts : undefined}
            value={Array.isArray(walkInValue) ? walkInValue : []}
            onChange={(value) => list.setFilter('walk_in', value)}
          />
        )}
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
          facets={data?.facets}
          extraFilters={[walkInFilter]}
          countFor={countFor}
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
          cardFacts={['payment', 'total', 'date']}
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
