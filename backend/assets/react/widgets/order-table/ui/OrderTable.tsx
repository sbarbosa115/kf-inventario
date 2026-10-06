import {useState} from 'react';
import {
  customerName,
  listOrders,
  orderPdfUrl,
  orderRemainingPdfUrl,
  orderXlsUrl,
  ORDER_STATUSES,
  OrderSource,
  type Order,
} from '@/entities/order';
import {useCan} from '@/entities/session';
import {listWarehouses, type Warehouse} from '@/entities/warehouse';
import {OrderStatusMenu} from '@/features/change-order-status';
import {DeleteOrderConfirm} from '@/features/delete-order';
import {ApiError} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import type {DateRangeValue} from '@/shared/api';
import {
  useDebouncedText,
  useFormat,
  useListQuery,
  useLoad,
  useRememberedWarehouse,
} from '@/shared/lib';
import {
  Button,
  ClearFilters,
  DataTable,
  EmptyState,
  ErrorState,
  FilterChips,
  SearchBox,
  Skeleton,
  Toolbar,
  WarehouseSwitch,
  type Column,
  type RowAction,
} from '@/shared/ui';
import './order-table.css';

export type OrderSection = 'products' | 'comments';

interface Props {
  /** Opens an order's detail (the page shows it), on a section. */
  onOpenDetail: (order: Order, section: OrderSection) => void;
  /** Changes when the list must reload (something changed in the detail, a sync). */
  refreshKey: number;
}

/**
 * One warehouse's orders (the remembered one, else the first): status chips counting what the other filters keep,
 * a search by number or customer and a creation-date range, filtered, sorted and paged on the server (the query in
 * the address); a row per order with its status menu and its ⋯ menu (edit, getting ready, documents, delete by
 * role). A row opens the order's detail.
 */
export function OrderTable(props: Props) {
  const {t} = useTranslation();
  const warehouses = useLoad(listWarehouses, []);
  const [current, pick] = useRememberedWarehouse(warehouses.data);

  if (warehouses.error) {
    return <ErrorState error={warehouses.error} onRetry={warehouses.reload} />;
  }
  if (warehouses.data === undefined)
    return <Skeleton variant="row" lines={6} />;
  if (current === undefined) {
    return (
      <EmptyState icon="fa-warehouse" message={t('orders.noWarehouses')} />
    );
  }
  return (
    <WarehouseOrders
      warehouse={current}
      warehouses={warehouses.data}
      onPick={pick}
      {...props}
    />
  );
}

function WarehouseOrders({
  warehouse,
  warehouses,
  onPick,
  onOpenDetail,
  refreshKey,
}: Props & {
  warehouse: Warehouse;
  warehouses: Warehouse[];
  onPick: (id: number) => void;
}) {
  const {t} = useTranslation();
  const {dateTime} = useFormat();
  const canEdit = useCan('ROLE_CAN_UPDATE_ORDERS');
  const canDelete = useCan('ROLE_CAN_DELETE_ORDERS');
  const list = useListQuery({sort: '-created_at'});
  const key = JSON.stringify(list.query);
  const {data, loading, error, reload} = useLoad(
    () => listOrders(warehouse.id, {...list.query, facets: ['status']}),
    [warehouse.id, key, refreshKey],
  );
  const [deleting, setDeleting] = useState<Order | null>(null);
  const [search, setSearch, flushSearch] = useDebouncedText(
    list.query.q ?? '',
    (q) => list.update({q: q === '' ? undefined : q}),
  );
  const statusFilter = list.query.filters?.status;
  const status = Array.isArray(statusFilter) ? (statusFilter[0] ?? null) : null;
  const created = (list.query.filters?.created_at ?? {}) as DateRangeValue;
  const setCreated = (range: DateRangeValue) =>
    list.setFilter('created_at', range);
  const filtered = list.activeCount > 0;

  // The chips count what the search and the dates keep (the status facet ignores the status filter itself).
  const facet = data?.facets?.status;
  const counts = Object.fromEntries(
    (facet ?? []).map((f) => [f.value, f.count]),
  );
  const allCount = facet?.reduce((sum, f) => sum + f.count, 0);

  const columns: Column<Order>[] = [
    {
      key: 'code',
      header: t('orders.columns.code'),
      render: (order) => (
        <button
          type="button"
          className="kf-order-table__code kf-mono"
          title={t('orders.openDetail', {code: order.code ?? order.id})}
          onClick={() => onOpenDetail(order, 'products')}
        >
          {order.code ?? order.id}
        </button>
      ),
      sortField: 'code',
    },
    {
      key: 'customer',
      header: t('orders.columns.customer'),
      render: (order) => <CustomerCell order={order} />,
      sortField: 'customer',
    },
    {
      key: 'source',
      header: t('orders.columns.source'),
      render: (order) => <OrderSource source={order.source} />,
    },
    {
      key: 'status',
      header: t('orders.columns.status'),
      render: (order) => <OrderStatusMenu order={order} onChanged={reload} />,
      sortField: 'status',
    },
    {
      key: 'created',
      header: t('orders.columns.created'),
      render: (order) => (
        <span className="text-nowrap">{dateTime(order.created_at)}</span>
      ),
      sortField: 'created_at',
    },
    {
      key: 'comments',
      header: t('orders.columns.comments'),
      render: (order) => (
        <Button
          size="sm"
          variant="ghost"
          icon="fa-comment"
          aria-label={t('orders.commentsOf', {
            code: order.code ?? order.id,
            count: order.comments_count,
          })}
          onClick={() => onOpenDetail(order, 'comments')}
        >
          {order.comments_count}
        </Button>
      ),
      numeric: true,
    },
  ];

  const actions = (order: Order): RowAction[] => [
    ...(canEdit
      ? [
          {
            label: t('orders.actions.edit'),
            icon: 'fa-pen',
            href: `/admin/orders/${order.id}/edit`,
          },
        ]
      : []),
    {
      label: t('orders.actions.gettingReady'),
      icon: 'fa-truck-loading',
      href: `/admin/orders/${order.id}/getting-ready`,
    },
    {
      label: t('orders.actions.pdf'),
      icon: 'fa-file-pdf',
      href: orderPdfUrl(order.id),
      external: true,
    },
    {
      label: t('orders.actions.remainingPdf'),
      icon: 'fa-file-pdf',
      href: orderRemainingPdfUrl(order.id),
      external: true,
    },
    {
      label: t('orders.actions.xls'),
      icon: 'fa-file-excel',
      href: orderXlsUrl(order.id),
      external: true,
    },
    ...(canDelete
      ? [
          {
            label: t('orders.actions.delete'),
            icon: 'fa-trash',
            danger: true,
            onSelect: () => setDeleting(order),
          },
        ]
      : []),
  ];

  const forbidden = error instanceof ApiError && error.status === 403;

  return (
    <div className="kf-order-table">
      <Toolbar label={t('orders.filters.label')}>
        <WarehouseSwitch
          warehouses={warehouses}
          value={warehouse.id}
          onChange={onPick}
        />
        <FilterChips
          label={t('orders.filters.status')}
          value={status}
          onChange={(key) =>
            list.setFilter('status', key === null ? undefined : [key])
          }
          allCount={allCount}
          options={ORDER_STATUSES.map((value) => ({
            key: String(value),
            label: t(`orders.statuses.${value}`),
            count: facet ? (counts[String(value)] ?? 0) : undefined,
          }))}
        />
        <div className="kf-order-table__search">
          <SearchBox
            label={t('orders.filters.search')}
            value={search}
            onChange={setSearch}
            onBlur={flushSearch}
          />
        </div>
        <DateField
          label={t('orders.filters.from')}
          value={created.from ?? ''}
          max={created.to || undefined}
          onChange={(from) => setCreated({...created, from})}
        />
        <DateField
          label={t('orders.filters.to')}
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
          rowKey={(order) => order.id}
          rowLabel={(order) => order.code ?? String(order.id)}
          loading={loading && data === undefined}
          error={error}
          onRetry={reload}
          emptyMessage={t('orders.empty')}
          searchable={false}
          rowActions={actions}
          onRowClick={(order) => onOpenDetail(order, 'products')}
          cardTitle={(order) => (
            <>
              <span className="kf-mono">{order.code ?? order.id}</span> ·{' '}
              {customerName(order.customer) ?? t('orders.noCustomer')}
            </>
          )}
          cardFacts={['source', 'status', 'created', 'comments']}
        />
      )}
      {deleting && (
        <DeleteOrderConfirm
          order={deleting}
          onCancel={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function CustomerCell({order}: {order: Order}) {
  const {t} = useTranslation();
  const name = customerName(order.customer);
  if (name === null) {
    return (
      <span className="kf-order-table__muted">{t('orders.noCustomer')}</span>
    );
  }
  const email = order.customer?.email;
  return (
    <span className="kf-order-table__customer">
      <span>{name}</span>
      {email && email !== name && (
        <span className="kf-order-table__muted">{email}</span>
      )}
    </span>
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
    <label className="kf-order-table__date">
      <span className="kf-order-table__date-label">{label}</span>
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
