import {useEffect, useMemo, useRef, useState} from 'react';
import {listStock, STOCK_INCOMING, type StockItem} from '@/entities/product';
import {listWarehouses} from '@/entities/warehouse';
import {ApproveIncomingButton} from '@/features/approve-incoming';
import {ApiError} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {useLoad, useRememberedWarehouse} from '@/shared/lib';
import {
  DataTable,
  EmptyState,
  ErrorState,
  Num,
  PageHeader,
  Skeleton,
  Toolbar,
  WarehouseSwitch,
  type Column,
} from '@/shared/ui';
import './incoming-stock.css';

/** How long approved rows take to fade before the list reloads. */
const FADE_MS = 300;

/** Incoming: what waits for approval in a warehouse, its totals, and "Approve all (N)" (ROLE_MANAGE_INVENTORY). */
export function IncomingStockPage() {
  const {t} = useTranslation();
  const warehouses = useLoad(listWarehouses, []);
  const [warehouse, pick] = useRememberedWarehouse(warehouses.data);
  const incoming = useLoad(
    () =>
      warehouse === undefined
        ? Promise.resolve([] as StockItem[])
        : listStock(warehouse.id, STOCK_INCOMING),
    [warehouse?.id],
  );
  const [leaving, setLeaving] = useState(false);
  const fade = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (fade.current) clearTimeout(fade.current);
    },
    [],
  );

  const columns = useMemo<Column<StockItem>[]>(
    () => [
      {
        key: 'code',
        header: t('stock.incoming.columns.code'),
        render: (row) => row.code,
        sortValue: (row) => row.code.toLowerCase(),
        searchValue: (row) => row.code,
        mono: true,
      },
      {
        key: 'title',
        header: t('stock.incoming.columns.title'),
        render: (row) => row.title,
        sortValue: (row) => row.title.toLowerCase(),
        searchValue: (row) => row.title,
      },
      {
        key: 'quantity',
        header: t('stock.incoming.columns.quantity'),
        render: (row) => <Num value={row.quantity} />,
        sortValue: (row) => row.quantity,
        numeric: true,
      },
    ],
    [t],
  );

  const forbidden =
    incoming.error instanceof ApiError && incoming.error.status === 403;
  const rows = incoming.loading ? undefined : incoming.data;
  const subtitle =
    warehouse && rows && !forbidden
      ? t('stock.incoming.subtitle', {
          warehouse: warehouse.name,
          products: t('stock.count.products', {count: rows.length}),
          units: t('stock.count.units', {
            count: rows.reduce((sum, row) => sum + row.quantity, 0),
          }),
        })
      : undefined;

  const approved = () => {
    setLeaving(true);
    fade.current = setTimeout(() => {
      setLeaving(false);
      incoming.reload();
    }, FADE_MS);
  };

  return (
    <>
      <PageHeader
        title={t('stock.incoming.title')}
        subtitle={subtitle}
        primary={
          warehouse &&
          rows &&
          !forbidden && (
            <ApproveIncomingButton
              warehouse={warehouse}
              rows={leaving ? [] : rows}
              onApproved={approved}
            />
          )
        }
      />
      {warehouses.error ? (
        <ErrorState error={warehouses.error} onRetry={warehouses.reload} />
      ) : warehouses.data === undefined ? (
        <Skeleton variant="row" />
      ) : warehouses.data.length === 0 ? (
        <EmptyState icon="fa-warehouse" message={t('stock.warehouse.none')} />
      ) : (
        <>
          <Toolbar>
            <WarehouseSwitch
              warehouses={warehouses.data}
              value={warehouse?.id ?? null}
              onChange={pick}
            />
          </Toolbar>
          {forbidden ? (
            <div className="alert alert-warning" role="alert">
              {t('errors.forbidden')}
            </div>
          ) : rows && rows.length === 0 ? (
            <EmptyState
              icon="fa-inbox"
              title={t('stock.incoming.emptyTitle')}
              message={t('stock.incoming.empty')}
            />
          ) : (
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(row) => row.id}
              rowLabel={(row) => row.code}
              loading={rows === undefined && !incoming.error}
              error={incoming.error}
              onRetry={incoming.reload}
              rowClassName={() =>
                leaving ? 'incoming-row--leaving' : undefined
              }
            />
          )}
        </>
      )}
    </>
  );
}
