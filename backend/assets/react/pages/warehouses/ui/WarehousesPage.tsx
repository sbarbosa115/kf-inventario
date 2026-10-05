import {useMemo, useState} from 'react';
import {RenameWarehouseModal} from '@/features/rename-warehouse';
import {apiGet, type Schema} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {useLoad} from '@/shared/lib';
import {DataTable, PageCard, type Column} from '@/shared/ui';

type Warehouse = Schema<'WarehouseOutput'>;

/** View warehouses: each one's number and name, and the way to rename it. */
export function WarehousesPage() {
  const {t} = useTranslation();
  const {data, loading, error, reload} = useLoad(
    () => apiGet<Warehouse[]>('/warehouses'),
    [],
  );
  const [editing, setEditing] = useState<Warehouse | null>(null);
  const [saved, setSaved] = useState(false);

  const columns = useMemo<Column<Warehouse>[]>(
    () => [
      {
        key: 'id',
        header: t('stock.warehouses.columns.id'),
        render: (warehouse) => warehouse.id,
        sortValue: (warehouse) => warehouse.id,
        searchValue: (warehouse) => warehouse.id,
      },
      {
        key: 'name',
        header: t('stock.warehouses.columns.name'),
        render: (warehouse) => warehouse.name,
        sortValue: (warehouse) => warehouse.name.toLowerCase(),
        searchValue: (warehouse) => warehouse.name,
      },
      {
        key: 'options',
        header: t('stock.warehouses.columns.options'),
        render: (warehouse) => (
          <button
            type="button"
            className="btn btn-sm btn-success"
            onClick={() => {
              setSaved(false);
              setEditing(warehouse);
            }}
          >
            <i className="fas fa-edit" aria-hidden="true" />{' '}
            {t('stock.warehouses.edit')}
          </button>
        ),
      },
    ],
    [t],
  );

  return (
    <PageCard title={t('stock.warehouses.title')}>
      {saved && (
        <div className="alert alert-success" role="status">
          {t('stock.warehouses.updated')}
        </div>
      )}
      <DataTable
        columns={columns}
        rows={data}
        rowKey={(warehouse) => warehouse.id}
        loading={loading && data === undefined}
        error={error}
        onRetry={reload}
        emptyMessage={t('stock.warehouses.empty')}
      />
      {editing && (
        <RenameWarehouseModal
          warehouse={editing}
          onClose={() => setEditing(null)}
          onRenamed={() => {
            setEditing(null);
            setSaved(true);
            reload();
          }}
        />
      )}
    </PageCard>
  );
}
