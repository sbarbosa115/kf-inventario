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
import {listShops} from '@/entities/shop-connection';
import {listWarehouses, type Warehouse} from '@/entities/warehouse';
import {OrderStatusMenu} from '@/features/change-order-status';
import {DeleteOrderConfirm} from '@/features/delete-order';
import {ApiError} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {
  useDebouncedText,
  useFormat,
  useListQuery,
  useLoad,
  useRememberedWarehouse,
} from '@/shared/lib';
import {
  Button,
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
  type TableQuery,
} from '@/shared/ui';
import './order-table.css';

export type OrderSection = 'products' | 'comments';

/** The list columns whose values are counted (the status chips and the Status, Source and Comments filters). */
const FACETS = ['status', 'source', 'pinned'];
const SEVERAL = 'several';

interface Props {
  /** Opens an order's detail (the page shows it), on a section. */
  onOpenDetail: (order: Order, section: OrderSection) => void;
  /** Changes when the list must reload (something changed in the detail, a sync). */
  refreshKey: number;
}

/**
 * One warehouse's orders (the remembered one, else the first): status chips counting what the other filters keep and
 * a search by number or customer in the toolbar; under the headers a filter per column (number and customer text,
 * source, status and "Pinned only" lists with their counts, a creation-date range; a sheet on a phone), all filtered,
 * sorted and paged on the server (the query in the address); a row per order with its status menu and its ⋯ menu
 * (edit, getting ready, documents, delete by role). A row opens the order's detail.
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
    () => listOrders(warehouse.id, {...list.query, facets: FACETS}),
    [warehouse.id, key, refreshKey],
  );
  // The phone's sheet: how many orders a draft keeps, one row asked.
  const countFor = (query: TableQuery) =>
    listOrders(warehouse.id, {...query, page: 1, perPage: 1}).then(
      (page) => page.total,
    );
  const [deleting, setDeleting] = useState<Order | null>(null);
  const [search, setSearch, flushSearch] = useDebouncedText(
    list.query.q ?? '',
    (q) => list.update({q: q === '' ? undefined : q}),
  );
  // The toolbar's chip is the one status ticked alone; two or more are the Status column's (and its chip above).
  const statusFilter = list.query.filters?.status;
  // With several ticked, no chip is pressed (not even All): a key no chip has.
  const status = !Array.isArray(statusFilter)
    ? null
    : statusFilter.length === 1
      ? statusFilter[0]!
      : SEVERAL;

  // The chips count what the search and the dates keep (the status facet ignores the status filter itself).
  const facet = data?.facets?.status;
  const counts = Object.fromEntries(
    (facet ?? []).map((f) => [f.value, f.count]),
  );
  const allCount = facet?.reduce((sum, f) => sum + f.count, 0);
  const shopOptions = useShopOptions(
    data?.items,
    data?.facets?.source,
    list.query.filters?.source,
  );

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
      filter: {type: 'text', field: 'code'},
    },
    {
      key: 'customer',
      header: t('orders.columns.customer'),
      render: (order) => <CustomerCell order={order} />,
      sortField: 'customer',
      filter: {type: 'text', field: 'customer'},
    },
    {
      key: 'source',
      header: t('orders.columns.source'),
      render: (order) => (
        <OrderSource source={order.source} shop={order.shop} />
      ),
      filter: {
        type: 'enum',
        field: 'source',
        options: [
          {value: 'phone', label: t('orders.sources.phone')},
          {value: 'web', label: t('orders.sources.web')},
          ...shopOptions,
        ],
      },
    },
    {
      key: 'status',
      header: t('orders.columns.status'),
      render: (order) => <OrderStatusMenu order={order} onChanged={reload} />,
      sortField: 'status',
      filter: {
        type: 'enum',
        field: 'status',
        options: ORDER_STATUSES.map((value) => ({
          value: String(value),
          label: t(`orders.statuses.${value}`),
        })),
      },
    },
    {
      key: 'created',
      header: t('orders.columns.created'),
      render: (order) => (
        <span className="text-nowrap">{dateTime(order.created_at)}</span>
      ),
      sortField: 'created_at',
      filter: {type: 'date', field: 'created_at'},
    },
    {
      key: 'comments',
      header: t('orders.notes.column'),
      render: (order) => (
        <NotesCell
          order={order}
          onOpen={() => onOpenDetail(order, 'comments')}
        />
      ),
      filter: {
        type: 'enum',
        field: 'pinned',
        options: [{value: '1', label: t('orders.filters.pinnedOnly')}],
      },
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
          countFor={countFor}
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

/** The Notes column: the pinned comment's first line under a pin (the whole note in its title), else the count. */
function NotesCell({order, onOpen}: {order: Order; onOpen: () => void}) {
  const {t} = useTranslation();
  const code = order.code ?? order.id;
  const pinned = order.pinned_comment?.content;
  if (pinned) {
    return (
      <button
        type="button"
        className="kf-order-table__pinned"
        title={pinned}
        aria-label={t('orders.notes.pinnedOf', {
          code,
          text: pinned.replace(/\s+/g, ' ').trim(),
        })}
        onClick={onOpen}
      >
        <i className="fas fa-thumbtack" aria-hidden="true" />
        <span className="kf-order-table__pinned-text">
          {pinned.split('\n')[0]}
        </span>
      </button>
    );
  }
  return (
    <Button
      size="sm"
      variant="ghost"
      icon="fa-comment"
      aria-label={t('orders.commentsOf', {code, count: order.comments_count})}
      onClick={onOpen}
    >
      {order.comments_count}
    </Button>
  );
}

const SHOP_VALUE = /^shop:(\d+)$/;

/**
 * The Source filter's shops (`shop:<id>`, one per connection, by name; docs/pdr/prd-shops-settings.md, Decisions 9):
 * every connection for an admin (who may read them), else the shops the source facet counts and the ones ticked,
 * named after the orders on the page ("Shop #3" when none of its orders is on it).
 */
function useShopOptions(
  orders: Order[] | undefined,
  facet: {value: string}[] | undefined,
  ticked: unknown,
): {value: string; label: string}[] {
  const {t} = useTranslation();
  const isAdmin = useCan('ROLE_ADMIN');
  const shops = useLoad(
    () => (isAdmin ? listShops() : Promise.resolve([])),
    [isAdmin],
  );
  const names = new Map<number, string>();
  for (const order of orders ?? []) {
    if (order.shop) names.set(order.shop.id, order.shop.name);
  }
  for (const shop of shops.data ?? []) names.set(shop.id, shop.name);
  const ids = new Set<number>((shops.data ?? []).map((shop) => shop.id));
  const values = [
    ...(facet ?? []).map((f) => f.value),
    ...(Array.isArray(ticked) ? (ticked as string[]) : []),
  ];
  for (const value of values) {
    const match = SHOP_VALUE.exec(value);
    if (match) ids.add(Number(match[1]));
  }
  return [...ids]
    .map((id) => ({
      value: `shop:${id}`,
      label: names.get(id) ?? t('orders.shop.unknown', {id}),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
