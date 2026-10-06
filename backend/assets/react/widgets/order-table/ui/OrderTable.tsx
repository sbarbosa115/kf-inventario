import {useMemo, useState} from 'react';
import {
  countByStatus,
  customerName,
  listOrders,
  matchesOrder,
  orderPdfUrl,
  orderRemainingPdfUrl,
  orderXlsUrl,
  ORDER_STATUSES,
  OrderSource,
  type Order,
  type OrderFilter,
} from '@/entities/order';
import {useCan} from '@/entities/session';
import {listWarehouses, type Warehouse} from '@/entities/warehouse';
import {OrderStatusMenu} from '@/features/change-order-status';
import {DeleteOrderConfirm} from '@/features/delete-order';
import {ApiError} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {useFormat, useLoad, useRememberedWarehouse} from '@/shared/lib';
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

const NO_FILTER = {status: null, query: '', from: '', to: ''};

/**
 * One warehouse's orders (the remembered one, else the first): status chips counting what the other filters keep,
 * a search by number or customer and a creation-date range, all over the loaded list; a row per order with its status
 * menu and its ⋯ menu (edit, getting ready, documents, delete by role). A row opens the order's detail.
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
  const {data, loading, error, reload} = useLoad(
    () => listOrders(warehouse.id),
    [warehouse.id, refreshKey],
  );
  const [filter, setFilter] = useState<Required<OrderFilter>>(NO_FILTER);
  const [deleting, setDeleting] = useState<Order | null>(null);
  const change = (next: Partial<OrderFilter>) =>
    setFilter((now) => ({...now, ...next}));
  const filtered =
    filter.status !== null ||
    filter.query !== '' ||
    filter.from !== '' ||
    filter.to !== '';

  // The chips count what the search and the dates keep; the status chip then narrows it.
  const unfiltered = useMemo(
    () =>
      (data ?? []).filter((order) =>
        matchesOrder(order, {...filter, status: null}),
      ),
    [data, filter],
  );
  const rows = useMemo(
    () => unfiltered.filter((order) => matchesOrder(order, filter)),
    [unfiltered, filter],
  );
  const counts = countByStatus(unfiltered);

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
      sortValue: (order) => order.code ?? '',
    },
    {
      key: 'customer',
      header: t('orders.columns.customer'),
      render: (order) => <CustomerCell order={order} />,
      sortValue: (order) => customerName(order.customer) ?? '',
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
      sortValue: (order) => order.status,
    },
    {
      key: 'created',
      header: t('orders.columns.created'),
      render: (order) => (
        <span className="text-nowrap">{dateTime(order.created_at)}</span>
      ),
      sortValue: (order) => order.created_at ?? '',
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
  const nothingLeft =
    data !== undefined && data.length > 0 && rows.length === 0;

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
          value={filter.status === null ? null : String(filter.status)}
          onChange={(key) =>
            change({status: key === null ? null : Number(key)})
          }
          allCount={data ? unfiltered.length : undefined}
          options={ORDER_STATUSES.map((status) => ({
            key: String(status),
            label: t(`orders.statuses.${status}`),
            count: data ? counts[status] : undefined,
          }))}
        />
        <div className="kf-order-table__search">
          <SearchBox
            label={t('orders.filters.search')}
            value={filter.query}
            onChange={(query) => change({query})}
          />
        </div>
        <DateField
          label={t('orders.filters.from')}
          value={filter.from}
          max={filter.to || undefined}
          onChange={(from) => change({from})}
        />
        <DateField
          label={t('orders.filters.to')}
          value={filter.to}
          min={filter.from || undefined}
          onChange={(to) => change({to})}
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
          rows={data === undefined ? undefined : rows}
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
