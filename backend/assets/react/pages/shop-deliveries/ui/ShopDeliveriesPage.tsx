import {useMemo, useState} from 'react';
import {useParams} from 'react-router-dom';
import {
  getShop,
  listDeliveries,
  type ShopDelivery,
} from '@/entities/shop-connection';
import {useDeliveryActions} from '@/features/retry-delivery';
import {useTranslation} from '@/shared/i18n';
import {useFormat, useListQuery, useLoad} from '@/shared/lib';
import {
  DataTable,
  PageHeader,
  StatusBadge,
  type Column,
  type TableQuery,
  type Tone,
} from '@/shared/ui';
import {failureLabel} from '@/widgets/shop-health';
import {DeliveryPanel} from './DeliveryPanel';
import './shop-deliveries.css';

const STATUSES = ['failed', 'placed', 'discarded'] as const;
const REASONS = [
  'unknown_product',
  'no_warehouse',
  'bad_signature',
  'not_an_order',
  'no_lines',
  'duplicate',
  'inactive',
];
const FACETS = ['status', 'reason_code'];
const STATUS_TONES: Record<string, Tone> = {
  failed: 'danger',
  placed: 'accent',
  discarded: 'neutral',
};

/**
 * A connection's failed deliveries (/admin/settings/shops/:id/deliveries, ROLE_ADMIN): the inbox of what the shop sent
 * and could not be placed, filtered under the headers (status — failed by default —, reason, received date, shop order
 * number, customer) and paged on the server; a row opens its body; Retry places it once the cause is fixed, Discard
 * sets it aside.
 */
export function ShopDeliveriesPage() {
  const {id} = useParams();
  const shopId = Number(id);
  const {t} = useTranslation();
  const shop = useLoad(() => getShop(shopId), [shopId]);
  const list = useListQuery({sort: '-received_at'});

  return (
    <>
      <PageHeader
        title={t('shops.deliveries.title')}
        subtitle={shop.data?.name}
        back="/admin/settings/shops"
      />
      <Deliveries shopId={shopId} list={list} />
    </>
  );
}

function Deliveries({
  shopId,
  list,
}: {
  shopId: number;
  list: ReturnType<typeof useListQuery>;
}) {
  const {t} = useTranslation();
  const {dateTime} = useFormat();
  // The failed ones by default: while the address names no status and nothing was changed yet, the query (and its
  // chip) says Failed; the first change writes the whole query, so removing that chip then shows every status.
  const [defaulted, setDefaulted] = useState(true);
  const query: TableQuery =
    defaulted && list.query.filters?.status === undefined
      ? {
          ...list.query,
          filters: {...list.query.filters, status: ['failed']},
        }
      : list.query;
  const change = (next: TableQuery) => {
    setDefaulted(false);
    list.update(next);
  };
  const key = JSON.stringify(query);
  const {data, loading, error, reload} = useLoad(
    () => listDeliveries(shopId, {...query, facets: FACETS}, ''),
    [shopId, key],
  );
  const countFor = (query: TableQuery) =>
    listDeliveries(shopId, {...query, page: 1, perPage: 1}, '').then(
      (page) => page.total,
    );
  const [open, setOpen] = useState<ShopDelivery | null>(null);
  const actions = useDeliveryActions(shopId, () => {
    setOpen(null);
    reload();
  });

  const columns = useMemo<Column<ShopDelivery>[]>(
    () => [
      {
        key: 'received',
        header: t('shops.deliveries.received'),
        render: (d) => (
          <span className="text-nowrap">{dateTime(d.received_at)}</span>
        ),
        sortField: 'received_at',
        filter: {type: 'date', field: 'received_at'},
      },
      {
        key: 'remote',
        header: t('shops.deliveries.remoteId'),
        render: (d) => d.remote_order_id ?? '—',
        mono: true,
        sortField: 'remote_order_id',
        filter: {type: 'text', field: 'remote_order_id'},
      },
      {
        key: 'customer',
        header: t('shops.deliveries.customer'),
        render: (d) => d.summary.customer ?? '—',
        filter: {type: 'text', field: 'customer'},
      },
      {
        key: 'lines',
        header: t('shops.deliveries.lines'),
        render: (d) =>
          d.summary.lines.length === 0 ? (
            '—'
          ) : (
            <ul className="kf-deliveries__lines">
              {d.summary.lines.map((line, index) => (
                <li key={index} className="kf-mono">
                  {t('shops.deliveries.line', {
                    sku: line.sku ?? t('shops.deliveries.noSku'),
                    quantity: line.quantity,
                  })}
                </li>
              ))}
            </ul>
          ),
      },
      {
        key: 'reason',
        header: t('shops.deliveries.reason'),
        render: (d) =>
          d.reason_code ? (
            <span className="kf-deliveries__reason">
              <StatusBadge tone="danger">
                {failureLabel(d.reason_code, t)}
              </StatusBadge>
              {d.reason && <span>{d.reason}</span>}
            </span>
          ) : (
            '—'
          ),
        filter: {
          type: 'enum',
          field: 'reason_code',
          options: REASONS.map((value) => ({
            value,
            label: failureLabel(value, t),
          })),
        },
      },
      {
        key: 'status',
        header: t('shops.deliveries.status'),
        render: (d) => (
          <span className="kf-deliveries__status">
            <StatusBadge tone={STATUS_TONES[d.status] ?? 'neutral'}>
              {t(`shops.deliveries.statuses.${d.status}`)}
            </StatusBadge>
            {d.order && (
              <span className="kf-mono">{d.order.code ?? d.order.id}</span>
            )}
          </span>
        ),
        filter: {
          type: 'enum',
          field: 'status',
          options: STATUSES.map((value) => ({
            value,
            label: t(`shops.deliveries.statuses.${value}`),
          })),
        },
      },
    ],
    [t, dateTime],
  );

  return (
    <>
      <DataTable
        columns={columns}
        rows={data?.items}
        query={query}
        onQueryChange={change}
        total={data?.total}
        facets={data?.facets}
        countFor={countFor}
        rowKey={(d) => d.id}
        rowLabel={(d) => d.remote_order_id ?? `#${d.id}`}
        loading={loading && data === undefined}
        error={error}
        onRetry={reload}
        emptyMessage={t('shops.deliveries.empty')}
        searchable={false}
        onRowClick={setOpen}
        rowActions={(d) => [
          {
            label: t('shops.deliveries.viewBody'),
            icon: 'fa-file-code',
            onSelect: () => setOpen(d),
          },
          ...(d.status === 'failed'
            ? [
                {
                  label: t('shops.deliveries.retry'),
                  icon: 'fa-redo',
                  disabled: actions.busy === d.id,
                  onSelect: () => void actions.retry(d),
                },
                {
                  label: t('shops.deliveries.discard'),
                  icon: 'fa-ban',
                  disabled: actions.busy === d.id,
                  onSelect: () => void actions.discard(d),
                },
              ]
            : []),
        ]}
        cardTitle={(d) => (
          <>
            <span className="kf-mono">{d.remote_order_id ?? `#${d.id}`}</span>
            {d.summary.customer && <> · {d.summary.customer}</>}
          </>
        )}
        cardFacts={['received', 'lines', 'reason', 'status']}
      />
      {open && (
        <DeliveryPanel
          shopId={shopId}
          delivery={open}
          busy={actions.busy === open.id}
          onRetry={() => void actions.retry(open)}
          onDiscard={() => void actions.discard(open)}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}
