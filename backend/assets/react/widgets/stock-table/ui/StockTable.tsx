import {useMemo, useState} from 'react';
import {Link} from 'react-router-dom';
import {listStock, type StockItem} from '@/entities/product';
import {listWarehouses, type Warehouse} from '@/entities/warehouse';
import {DownloadStockSheet} from '@/features/download-stock-sheet';
import {MoveStockModal} from '@/features/move-stock';
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

const PRICE = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * One warehouse's stock (the first warehouse until another is picked): a selectable, searchable table, and the
 * actions on the selection (Move to Warehouse, Update Selected Using Excel) next to Create Product.
 */
export function StockTable() {
  const {t} = useTranslation();
  const warehouses = useLoad(listWarehouses, []);
  const [picked, setPicked] = useState<number | null>(null);

  if (warehouses.error) {
    return <ErrorState error={warehouses.error} onRetry={warehouses.reload} />;
  }
  if (warehouses.data === undefined) return <Loader />;
  if (warehouses.data.length === 0) {
    return <EmptyState message={t('products.noWarehouses')} />;
  }
  const all = warehouses.data;
  const current = all.find((w) => w.id === picked) ?? all[0]!;

  return (
    <WarehouseStock
      key={current.id}
      warehouse={current}
      warehouses={all}
      onPick={setPicked}
    />
  );
}

function WarehouseStock({
  warehouse,
  warehouses,
  onPick,
}: {
  warehouse: Warehouse;
  warehouses: Warehouse[];
  onPick: (id: number) => void;
}) {
  const {t} = useTranslation();
  const {data, loading, error, reload} = useLoad(
    () => listStock(warehouse.id),
    [warehouse.id],
  );
  const [selected, setSelected] = useState<Set<string | number>>(new Set());
  const [moving, setMoving] = useState(false);
  const [moved, setMoved] = useState<string | null>(null);

  const selectedRows = useMemo(
    () => (data ?? []).filter((row) => selected.has(row.id)),
    [data, selected],
  );

  const columns = useMemo<Column<StockItem>[]>(
    () => [
      {
        key: 'code',
        header: t('products.columns.code'),
        render: (row) => row.code,
        sortValue: (row) => row.code,
        searchValue: (row) => row.code,
      },
      {
        key: 'detail',
        header: t('products.columns.description'),
        render: (row) => row.detail,
        sortValue: (row) => row.detail ?? '',
        searchValue: (row) => row.detail ?? null,
      },
      {
        key: 'title',
        header: t('products.columns.title'),
        render: (row) => row.title,
        sortValue: (row) => row.title,
        searchValue: (row) => row.title,
      },
      {
        key: 'quantity',
        header: t('products.columns.quantity'),
        render: (row) => row.quantity,
        sortValue: (row) => row.quantity,
        searchValue: (row) => row.quantity,
        numeric: true,
      },
      {
        key: 'price',
        header: t('products.columns.price'),
        render: (row) =>
          row.price === null || row.price === undefined
            ? ''
            : PRICE.format(row.price),
        sortValue: (row) => row.price ?? 0,
        searchValue: (row) => row.price ?? null,
        numeric: true,
      },
      {
        key: 'warehouse',
        header: t('products.columns.warehouse'),
        render: (row) => row.warehouse.name,
      },
      {
        key: 'options',
        header: t('products.columns.options'),
        render: (row) => (
          <Link
            to={`/admin/products/${row.uuid}/edit`}
            className="btn btn-sm btn-success"
            aria-label={t('products.edit', {code: row.code})}
            title={t('products.edit', {code: row.code})}
          >
            <i className="fas fa-edit" aria-hidden="true" />
          </Link>
        ),
      },
    ],
    [t],
  );

  const forbidden = error instanceof ApiError && error.status === 403;

  return (
    <div>
      <div className="row">
        <div className="col-md-6">
          <label htmlFor="stock-warehouse" className="sr-only">
            {t('products.warehouse')}
          </label>
          <select
            id="stock-warehouse"
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
      </div>
      <hr />
      <div className="d-flex flex-wrap align-items-center">
        <button
          type="button"
          className="btn btn-sm btn-success m-1"
          disabled={selectedRows.length === 0}
          onClick={() => {
            setMoved(null);
            setMoving(true);
          }}
        >
          <i className="fas fa-people-carry mr-1" aria-hidden="true" />
          {t('products.move.open')}
        </button>
        <DownloadStockSheet uuids={selectedRows.map((row) => row.uuid)} />
        <Link to="/admin/products/new" className="btn btn-sm btn-success m-1">
          {t('products.create')}
        </Link>
        {selectedRows.length > 0 && (
          <span className="small text-muted ml-2">
            {t('products.selected', {count: selectedRows.length})}
          </span>
        )}
      </div>
      <hr />
      {moved && (
        <div className="alert alert-success" role="status">
          {moved}
        </div>
      )}
      {forbidden ? (
        <div className="alert alert-warning" role="alert">
          {t('errors.forbidden')}
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={data}
          rowKey={(row) => row.id}
          loading={loading && data === undefined}
          error={error}
          onRetry={reload}
          emptyMessage={t('products.empty')}
          pageSize={10}
          selected={selected}
          onSelectedChange={setSelected}
        />
      )}
      {moving && (
        <MoveStockModal
          rows={selectedRows}
          source={warehouse}
          warehouses={warehouses}
          onClose={() => setMoving(false)}
          onMoved={(destination) => {
            setMoving(false);
            setSelected(new Set());
            setMoved(t('products.moved', {warehouse: destination.name}));
            reload();
          }}
        />
      )}
    </div>
  );
}
