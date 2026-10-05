import {useMemo, useState} from 'react';
import {useNavigate, useSearchParams} from 'react-router-dom';
import {listCustomers, PAGE_SIZE, type Customer} from '@/entities/customer';
import {customerName, DeleteCustomerDialog} from '@/features/delete-customer';
import {ApiError} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {useFormat, useLoad} from '@/shared/lib';
import {
  Button,
  DataTable,
  EmptyState,
  PageHeader,
  SearchBox,
  Toolbar,
  useToast,
  type Column,
  type RowAction,
} from '@/shared/ui';
import './customers.css';

const fullName = (customer: Customer) =>
  `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim();

/** The city of a customer's first address: the one the list shows. */
const cityOf = (customer: Customer) => customer.addresses[0]?.city?.name ?? '';

/** Customers: 100 a page, paged on the server (/admin/customers?page=2), and the way into the form (ROLE_MANAGE_CUSTOMERS). */
export function CustomersPage() {
  const {t} = useTranslation();
  const {num} = useFormat();
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);
  const {data, loading, error, reload} = useLoad(
    () => listCustomers(page),
    [page],
  );
  const [query, setQuery] = useState('');
  const [deleting, setDeleting] = useState<Customer | null>(null);

  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const from = (page - 1) * PAGE_SIZE + 1;
  const subtitle =
    data && data.items.length > 0
      ? t('customers.range', {
          from: num(from),
          to: num(from + data.items.length - 1),
          total: num(data.total),
        })
      : undefined;

  // The search covers the page that is loaded: the API pages without searching.
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!data || needle === '') return data?.items;
    return data.items.filter((customer) =>
      [fullName(customer), customer.email, customer.phone, cityOf(customer)]
        .join(' ')
        .toLowerCase()
        .includes(needle),
    );
  }, [data, query]);

  const afterDelete = () => {
    toast.success(t('customers.deleted'));
    if (page > 1 && data?.items.length === 1) {
      setParams({page: String(page - 1)});
    } else {
      reload();
    }
  };

  const columns: Column<Customer>[] = [
    {
      key: 'name',
      header: t('customers.columns.name'),
      render: (customer) => (
        <span className="customers-name">{fullName(customer)}</span>
      ),
      sortValue: (customer) => fullName(customer).toLowerCase(),
    },
    {
      key: 'email',
      header: t('customers.columns.email'),
      render: (customer) => customer.email,
      sortValue: (customer) => customer.email ?? '',
    },
    {
      key: 'phone',
      header: t('customers.columns.phone'),
      render: (customer) => customer.phone,
      sortValue: (customer) => customer.phone ?? '',
    },
    {
      key: 'city',
      header: t('customers.columns.city'),
      render: (customer) => cityOf(customer),
      sortValue: (customer) => cityOf(customer).toLowerCase(),
    },
  ];

  const rowActions = (customer: Customer): RowAction[] => [
    {
      label: t('customers.edit'),
      icon: 'fa-pencil-alt',
      href: `/admin/customers/${customer.id}/edit`,
    },
    {
      label: t('customers.delete'),
      icon: 'fa-trash',
      danger: true,
      onSelect: () => setDeleting(customer),
    },
  ];

  const forbidden = error instanceof ApiError && error.status === 403;
  const filteredOut =
    data !== undefined &&
    data.items.length > 0 &&
    rows?.length === 0 &&
    query.trim() !== '';

  return (
    <>
      <PageHeader
        title={t('customers.title')}
        subtitle={subtitle}
        primary={
          <Button variant="primary" icon="fa-plus" to="/admin/customers/new">
            {t('customers.create')}
          </Button>
        }
      />
      {forbidden ? (
        <div className="alert alert-warning" role="alert">
          {t('errors.forbidden')}
        </div>
      ) : (
        <>
          <Toolbar label={t('customers.title')}>
            <SearchBox
              value={query}
              onChange={setQuery}
              label={t('customers.search')}
            />
          </Toolbar>
          {filteredOut ? (
            <EmptyState
              message={t('common.filteredEmpty')}
              action={
                <Button size="sm" onClick={() => setQuery('')}>
                  {t('common.showAll')}
                </Button>
              }
            />
          ) : (
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(customer) => customer.id}
              rowLabel={customerName}
              loading={loading && data === undefined}
              error={error}
              onRetry={reload}
              emptyMessage={t('customers.empty')}
              pageSize={0}
              searchable={false}
              rowActions={rowActions}
              onRowClick={(customer) =>
                navigate(`/admin/customers/${customer.id}/edit`)
              }
              cardTitle={(customer) =>
                fullName(customer) || customer.email || customer.id
              }
              cardFacts={['email', 'phone', 'city']}
            />
          )}
          {data && pages > 1 && (
            <nav aria-label={t('customers.pages')} className="customers-pager">
              <Button
                size="sm"
                to={page <= 1 ? undefined : `?page=${page - 1}`}
                disabled={page <= 1}
              >
                {t('common.previous')}
              </Button>
              <span className="customers-pager__label">
                {t('common.pageOf', {page, pages})}
              </span>
              <Button
                size="sm"
                to={page >= pages ? undefined : `?page=${page + 1}`}
                disabled={page >= pages}
              >
                {t('common.next')}
              </Button>
            </nav>
          )}
        </>
      )}
      {deleting && (
        <DeleteCustomerDialog
          customer={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={afterDelete}
        />
      )}
    </>
  );
}
