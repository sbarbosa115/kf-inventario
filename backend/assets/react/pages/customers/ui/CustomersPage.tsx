import {useState} from 'react';
import {Link, useLocation, useSearchParams} from 'react-router-dom';
import {listCustomers, PAGE_SIZE, type Customer} from '@/entities/customer';
import {DeleteCustomerButton} from '@/features/delete-customer';
import {ApiError} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {useLoad} from '@/shared/lib';
import {DataTable, PageCard, type Column} from '@/shared/ui';

const fullName = (customer: Customer) =>
  `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim();

/** View Customers: 100 a page, paged on the server (/admin/customers?page=2), and the way into the form (ROLE_MANAGE_CUSTOMERS). */
export function CustomersPage() {
  const {t} = useTranslation();
  const saved = (useLocation().state as {saved?: 'created' | 'updated'} | null)
    ?.saved;
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);
  const {data, loading, error, reload} = useLoad(
    () => listCustomers(page),
    [page],
  );
  const [deleted, setDeleted] = useState(false);

  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  const afterDelete = () => {
    setDeleted(true);
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
      render: fullName,
      sortValue: (customer) => fullName(customer).toLowerCase(),
      searchValue: fullName,
    },
    {
      key: 'email',
      header: t('customers.columns.email'),
      render: (customer) => customer.email,
      sortValue: (customer) => customer.email ?? '',
      searchValue: (customer) => customer.email ?? null,
    },
    {
      key: 'phone',
      header: t('customers.columns.phone'),
      render: (customer) => customer.phone,
      sortValue: (customer) => customer.phone ?? '',
      searchValue: (customer) => customer.phone ?? null,
    },
    {
      key: 'options',
      header: t('customers.columns.options'),
      render: (customer) => (
        <>
          <Link
            to={`/admin/customers/${customer.id}/edit`}
            className="btn btn-sm btn-success"
            title={t('customers.edit')}
            aria-label={`${t('customers.edit')}: ${fullName(customer) || customer.email || customer.id}`}
          >
            <i className="fas fa-pencil-alt" aria-hidden="true" />
          </Link>{' '}
          <DeleteCustomerButton customer={customer} onDeleted={afterDelete} />
        </>
      ),
    },
  ];

  return (
    <PageCard
      title={t('customers.title')}
      actions={
        <Link to="/admin/customers/new" className="btn btn-sm btn-success">
          {t('customers.create')}
        </Link>
      }
    >
      {saved && !deleted && (
        <div className="alert alert-success" role="status">
          {t(`customers.${saved}`)}
        </div>
      )}
      {deleted && (
        <div className="alert alert-success" role="status">
          {t('customers.deleted')}
        </div>
      )}
      {error instanceof ApiError && error.status === 403 ? (
        <div className="alert alert-warning" role="alert">
          {t('errors.forbidden')}
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={data?.items}
          rowKey={(customer) => customer.id}
          loading={loading && data === undefined}
          error={error}
          onRetry={reload}
          emptyMessage={t('customers.empty')}
          pageSize={0}
        />
      )}
      {data && pages > 1 && (
        <nav aria-label={t('customers.pages')} className="mt-3">
          <p className="text-muted small mb-2">
            {t('customers.pageOf', {page, pages, total: data.total})}
          </p>
          <ul className="pagination mb-0">
            <li className={`page-item${page <= 1 ? ' disabled' : ''}`}>
              {page <= 1 ? (
                <span className="page-link">{t('customers.previous')}</span>
              ) : (
                <Link className="page-link" to={`?page=${page - 1}`}>
                  {t('customers.previous')}
                </Link>
              )}
            </li>
            {Array.from({length: pages}, (_, index) => index + 1).map((n) => (
              <li key={n} className={`page-item${n === page ? ' active' : ''}`}>
                <Link
                  className="page-link"
                  to={`?page=${n}`}
                  aria-label={t('customers.page', {page: n})}
                  aria-current={n === page ? 'page' : undefined}
                >
                  {n}
                </Link>
              </li>
            ))}
            <li className={`page-item${page >= pages ? ' disabled' : ''}`}>
              {page >= pages ? (
                <span className="page-link">{t('customers.next')}</span>
              ) : (
                <Link className="page-link" to={`?page=${page + 1}`}>
                  {t('customers.next')}
                </Link>
              )}
            </li>
          </ul>
        </nav>
      )}
    </PageCard>
  );
}
