import {useMemo, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {listCustomers, type Customer} from '@/entities/customer';
import {listLocations} from '@/entities/location';
import {customerName, DeleteCustomerDialog} from '@/features/delete-customer';
import {ApiError} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {useDebouncedText, useFormat, useListQuery, useLoad} from '@/shared/lib';
import {
  Button,
  DataTable,
  PageHeader,
  SearchBox,
  Toolbar,
  useToast,
  type Column,
  type RowAction,
  type TableQuery,
} from '@/shared/ui';
import './customers.css';

const fullName = (customer: Customer) =>
  `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim();

/** The city of a customer's first address: the one the list shows. */
const cityOf = (customer: Customer) => customer.addresses[0]?.city?.name ?? '';

/** The country of a customer's first address. */
const countryOf = (customer: Customer) =>
  customer.addresses[0]?.city?.state?.country?.name ?? '';

/** The list columns whose values are counted (the Country filter). */
const FACETS = ['country'];

/**
 * Customers: 25 a page (50 or 100 on request), newest first, searched, filtered under the headers (name, email,
 * phone and city text, the country from a list with its counts; a sheet on a phone), sorted and paged on the server
 * (the query in the address: /admin/customers?page=2&q=jose&filter[country][]=1), and the way into the form
 * (ROLE_MANAGE_CUSTOMERS).
 */
export function CustomersPage() {
  const {t} = useTranslation();
  const {num} = useFormat();
  const toast = useToast();
  const navigate = useNavigate();
  const list = useListQuery();
  const key = JSON.stringify(list.query);
  const {data, loading, error, reload} = useLoad(
    () => listCustomers({...list.query, facets: FACETS}),
    [key],
  );
  // The Country filter's choices; without them (a failed load) the list says there is nothing to choose.
  const locations = useLoad(listLocations, []);
  const countries = useMemo(
    () =>
      [...(locations.data ?? [])]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((country) => ({value: String(country.id), label: country.name})),
    [locations.data],
  );
  // The phone's sheet: how many customers a draft keeps, one row asked.
  const countFor = (query: TableQuery) =>
    listCustomers({...query, page: 1, perPage: 1}).then((page) => page.total);
  const [deleting, setDeleting] = useState<Customer | null>(null);
  const [search, setSearch, flushSearch] = useDebouncedText(
    list.query.q ?? '',
    (q) => list.update({q: q === '' ? undefined : q}),
  );
  const page = list.query.page;

  const from = (page - 1) * list.query.perPage + 1;
  const subtitle =
    data && data.items.length > 0
      ? t('customers.range', {
          from: num(from),
          to: num(from + data.items.length - 1),
          total: num(data.total),
        })
      : undefined;

  const afterDelete = () => {
    toast.success(t('customers.deleted'));
    if (page > 1 && data?.items.length === 1) {
      list.update({page: page - 1});
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
      sortField: 'name',
      filter: {type: 'text', field: 'name'},
    },
    {
      key: 'email',
      header: t('customers.columns.email'),
      render: (customer) => customer.email,
      sortField: 'email',
      filter: {type: 'text', field: 'email'},
    },
    {
      key: 'phone',
      header: t('customers.columns.phone'),
      render: (customer) => customer.phone,
      filter: {type: 'text', field: 'phone'},
    },
    {
      key: 'city',
      header: t('customers.columns.city'),
      render: (customer) => cityOf(customer),
      sortField: 'city',
      filter: {type: 'text', field: 'city'},
    },
    {
      key: 'country',
      header: t('customers.columns.country'),
      render: (customer) => countryOf(customer),
      filter: {type: 'enum', field: 'country', options: countries},
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
              value={search}
              onChange={setSearch}
              onBlur={flushSearch}
              label={t('customers.search')}
            />
          </Toolbar>
          <DataTable
            columns={columns}
            rows={data?.items}
            rowKey={(customer) => customer.id}
            rowLabel={customerName}
            loading={loading && data === undefined}
            error={error}
            onRetry={reload}
            emptyMessage={t('customers.empty')}
            searchable={false}
            query={list.query}
            onQueryChange={list.update}
            total={data?.total}
            facets={data?.facets}
            countFor={countFor}
            rowActions={rowActions}
            onRowClick={(customer) =>
              navigate(`/admin/customers/${customer.id}/edit`)
            }
            cardTitle={(customer) =>
              fullName(customer) || customer.email || customer.id
            }
            cardFacts={['email', 'phone', 'city']}
          />
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
