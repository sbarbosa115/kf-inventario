import {useMemo, useState} from 'react';
import {Link} from 'react-router-dom';
import {
  customerLabel,
  formatOrderDate,
  listOrders,
  orderPdfUrl,
  orderXlsUrl,
  ORDER_STATUSES,
  sourceKey,
  type Order,
} from '@/entities/order';
import {useCan} from '@/entities/session';
import {listWarehouses, type Warehouse} from '@/entities/warehouse';
import {OrderStatusSelect} from '@/features/change-order-status';
import {DeleteOrderButton} from '@/features/delete-order';
import {SyncOrdersButton} from '@/features/sync-orders';
import {ApiError} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {useLoad} from '@/shared/lib';
import {
  DataTable,
  EmptyState,
  ErrorState,
  Loader,
  type Column,
} from '@/shared/ui';

type DetailTab = 'products' | 'comments';

interface Props {
  /** Opens an order's detail on a tab (the page shows the dialog). */
  onOpenDetail: (orderId: number, tab: DetailTab) => void;
  /** Changes when the list must reload (comments saved in the detail). */
  refreshKey: number;
}

/**
 * One warehouse's orders (the first warehouse until another is picked): status filter, search, the status changed
 * in place, the detail, edit, getting-ready and document links of each row, and by role Create an Order, Sync
 * Orders and Delete.
 */
export function OrderTable(props: Props) {
  const {t} = useTranslation();
  const warehouses = useLoad(listWarehouses, []);
  const [picked, setPicked] = useState<number | null>(null);

  if (warehouses.error) {
    return <ErrorState error={warehouses.error} onRetry={warehouses.reload} />;
  }
  if (warehouses.data === undefined) return <Loader />;
  if (warehouses.data.length === 0) {
    return <EmptyState message={t('orders.noWarehouses')} />;
  }
  const all = warehouses.data;
  const current = all.find((w) => w.id === picked) ?? all[0]!;

  return (
    <WarehouseOrders
      key={current.id}
      warehouse={current}
      warehouses={all}
      onPick={setPicked}
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
  const canAdd = useCan('ROLE_CAN_CREATE_ORDERS');
  const canDelete = useCan('ROLE_CAN_DELETE_ORDERS');
  const canSync = useCan('ROLE_CAN_SYNC_ORDERS');
  const {data, loading, error, reload} = useLoad(
    () => listOrders(warehouse.id),
    [warehouse.id, refreshKey],
  );
  const [status, setStatus] = useState('');
  const [outcome, setOutcome] = useState<{ok: boolean; message: string} | null>(
    null,
  );

  const report = (result: {ok: boolean; message: string}) => {
    setOutcome(result);
    if (result.ok) reload();
  };

  // Rebuilt on each render: its cells call this list's reload (one warehouse's orders: cheap).
  const columns: Column<Order>[] = [
    {
      key: 'comments',
      header: t('orders.columns.comments'),
      render: (order) => (
        <button
          type="button"
          className="btn btn-sm btn-success text-nowrap"
          aria-label={t('orders.commentsOf', {
            code: order.code ?? order.id,
            count: order.comments_count,
          })}
          title={t('orders.columns.comments')}
          onClick={() => onOpenDetail(order.id, 'comments')}
        >
          {order.comments_count}{' '}
          <i className="fas fa-comments" aria-hidden="true" />
        </button>
      ),
    },
    {
      key: 'customer',
      header: t('orders.columns.customer'),
      render: (order) =>
        customerLabel(order.customer) ?? (
          <span className="text-muted">{t('orders.noCustomer')}</span>
        ),
      sortValue: (order) => customerLabel(order.customer) ?? '',
      searchValue: (order) => customerLabel(order.customer),
    },
    {
      key: 'code',
      header: t('orders.columns.code'),
      render: (order) => order.code,
      sortValue: (order) => order.code ?? '',
      searchValue: (order) => order.code ?? null,
    },
    {
      key: 'source',
      header: t('orders.columns.source'),
      render: (order) => t(`orders.sources.${sourceKey(order.source)}`),
    },
    {
      key: 'status',
      header: t('orders.columns.status'),
      render: (order) => <OrderStatusSelect order={order} onResult={report} />,
      sortValue: (order) => order.status,
    },
    {
      key: 'date',
      header: t('orders.columns.date'),
      render: (order) => (
        <span className="text-nowrap">{formatOrderDate(order.created_at)}</span>
      ),
      sortValue: (order) => order.created_at ?? '',
    },
    {
      key: 'options',
      header: t('orders.columns.options'),
      render: (order) => (
        <OrderActions
          order={order}
          canDelete={canDelete}
          onOpenDetail={onOpenDetail}
          onDeleted={() => report({ok: true, message: t('orders.deleted')})}
        />
      ),
    },
  ];

  const rows = useMemo(
    () =>
      status === ''
        ? data
        : data?.filter((order) => order.status === Number(status)),
    [data, status],
  );
  const forbidden = error instanceof ApiError && error.status === 403;

  return (
    <div>
      <div className="row">
        <div className="col-md-4 mb-2">
          <label htmlFor="orders-warehouse" className="sr-only">
            {t('orders.warehouse')}
          </label>
          <select
            id="orders-warehouse"
            className="form-control"
            value={warehouse.id}
            onChange={(event) => onPick(Number(event.target.value))}
          >
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
        <div className="col-md-4 mb-2">
          <label htmlFor="orders-status" className="sr-only">
            {t('orders.statusFilter')}
          </label>
          <select
            id="orders-status"
            className="form-control"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">{t('orders.allStatuses')}</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`orders.statuses.${s}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="col-md-4 mb-2">
          {canAdd && (
            <Link className="btn btn-success" to="/admin/orders/new">
              {t('orders.create')}
            </Link>
          )}
          {canSync && <SyncOrdersButton onResult={report} />}
        </div>
      </div>
      <hr />
      {outcome && (
        <div
          className={`alert ${outcome.ok ? 'alert-success' : 'alert-danger'}`}
          role={outcome.ok ? 'status' : 'alert'}
        >
          {outcome.message}
        </div>
      )}
      {forbidden ? (
        <div className="alert alert-warning" role="alert">
          {t('errors.forbidden')}
        </div>
      ) : status !== '' && data && data.length > 0 && rows?.length === 0 ? (
        <EmptyState
          message={t('orders.filteredEmpty')}
          action={
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => setStatus('')}
            >
              {t('common.showAll')}
            </button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(order) => order.id}
          loading={loading && data === undefined}
          error={error}
          onRetry={reload}
          emptyMessage={t('orders.empty')}
          pageSize={10}
        />
      )}
    </div>
  );
}

function OrderActions({
  order,
  canDelete,
  onOpenDetail,
  onDeleted,
}: {
  order: Order;
  canDelete: boolean;
  onOpenDetail: (orderId: number, tab: DetailTab) => void;
  onDeleted: () => void;
}) {
  const {t} = useTranslation();
  const code = order.code ?? String(order.id);
  return (
    <div className="text-nowrap">
      <button
        type="button"
        className="btn btn-sm btn-success mr-1"
        aria-label={t('orders.detailOf', {code})}
        onClick={() => onOpenDetail(order.id, 'products')}
      >
        {t('orders.detail')}
      </button>
      <Link
        to={`/admin/orders/${order.id}/edit`}
        className="btn btn-sm btn-success mr-1"
        title={t('orders.edit')}
        aria-label={t('orders.edit')}
      >
        <i className="fas fa-pencil-alt" aria-hidden="true" />
      </Link>
      <Link
        to={`/admin/orders/${order.id}/getting-ready`}
        className="btn btn-sm btn-success mr-1"
        title={t('orders.gettingReady')}
        aria-label={t('orders.gettingReady')}
      >
        <i className="fas fa-truck-loading" aria-hidden="true" />
      </Link>
      <a
        href={orderPdfUrl(order.id)}
        className="btn btn-sm btn-success mr-1"
        target="_blank"
        rel="noopener noreferrer"
        title={t('orders.pdf')}
        aria-label={t('orders.pdf')}
      >
        <i className="fas fa-file-pdf" aria-hidden="true" />
      </a>
      <a
        href={orderXlsUrl(order.id)}
        className="btn btn-sm btn-success mr-1"
        target="_blank"
        rel="noopener noreferrer"
        title={t('orders.xls')}
        aria-label={t('orders.xls')}
      >
        <i className="fas fa-file-excel" aria-hidden="true" />
      </a>
      {canDelete && <DeleteOrderButton order={order} onDeleted={onDeleted} />}
    </div>
  );
}
