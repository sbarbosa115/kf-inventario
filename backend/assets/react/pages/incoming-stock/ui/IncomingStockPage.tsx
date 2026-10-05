import {useMemo, useState} from 'react';
import {ApproveIncomingButton} from '@/features/approve-incoming';
import {ApiError, apiGet, type Schema} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {useLoad} from '@/shared/lib';
import {
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  Loader,
  PageCard,
  type Column,
} from '@/shared/ui';

type Stock = Schema<'StockOutput'>;

/** Incoming products: what waits for approval in a warehouse, and "Approve all" (ROLE_MANAGE_INVENTORY). */
export function IncomingStockPage() {
  const {t} = useTranslation();
  const warehouses = useLoad(
    () => apiGet<Schema<'WarehouseOutput'>[]>('/warehouses'),
    [],
  );
  const [picked, setPicked] = useState<number | null>(null);
  const [approved, setApproved] = useState<number | null>(null);
  const warehouseId = picked ?? warehouses.data?.[0]?.id ?? null;
  const incoming = useLoad(
    () =>
      warehouseId === null
        ? Promise.resolve([] as Stock[])
        : apiGet<Stock[]>(`/warehouses/${warehouseId}/stock?status=0`),
    [warehouseId],
  );

  const columns = useMemo<Column<Stock>[]>(
    () => [
      {
        key: 'code',
        header: t('stock.incoming.columns.code'),
        render: (row) => row.code,
        sortValue: (row) => row.code.toLowerCase(),
        searchValue: (row) => row.code,
      },
      {
        key: 'title',
        header: t('stock.incoming.columns.description'),
        render: (row) => row.title,
        sortValue: (row) => row.title.toLowerCase(),
        searchValue: (row) => row.title,
      },
      {
        key: 'quantity',
        header: t('stock.incoming.columns.quantity'),
        render: (row) => row.quantity,
        sortValue: (row) => row.quantity,
        searchValue: (row) => row.quantity,
        numeric: true,
      },
      {
        key: 'warehouse',
        header: t('stock.incoming.columns.warehouse'),
        render: (row) => row.warehouse.name,
        sortValue: (row) => row.warehouse.name.toLowerCase(),
        searchValue: (row) => row.warehouse.name,
      },
    ],
    [t],
  );

  const forbidden =
    incoming.error instanceof ApiError && incoming.error.status === 403;

  return (
    <PageCard title={t('stock.incoming.title')}>
      {warehouses.error ? (
        <ErrorState error={warehouses.error} onRetry={warehouses.reload} />
      ) : warehouses.data === undefined ? (
        <Loader />
      ) : warehouses.data.length === 0 ? (
        <EmptyState message={t('stock.warehouse.none')} />
      ) : (
        <>
          <div className="row">
            <div className="col-md-6">
              <Field label={t('stock.warehouse.label')}>
                <select
                  className="form-control"
                  value={warehouseId ?? ''}
                  onChange={(event) => {
                    setApproved(null);
                    setPicked(Number(event.target.value));
                  }}
                >
                  {warehouses.data.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
          {warehouseId !== null && (
            <div className="mb-3">
              <ApproveIncomingButton
                warehouseId={warehouseId}
                disabled={!incoming.data || incoming.data.length === 0}
                onApproved={(count) => {
                  setApproved(count);
                  incoming.reload();
                }}
              />
            </div>
          )}
          {approved !== null && (
            <div className="alert alert-success" role="status">
              {t('stock.incoming.approved', {count: approved})}
            </div>
          )}
          {forbidden ? (
            <div className="alert alert-warning" role="alert">
              {t('errors.forbidden')}
            </div>
          ) : (
            <DataTable
              columns={columns}
              rows={incoming.data}
              rowKey={(row) => row.id}
              loading={incoming.loading && incoming.data === undefined}
              error={incoming.error}
              onRetry={incoming.reload}
              emptyMessage={t('stock.incoming.empty')}
            />
          )}
        </>
      )}
    </PageCard>
  );
}
