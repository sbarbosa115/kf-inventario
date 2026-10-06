import {useMemo, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {
  listStock,
  matchesStock,
  stockFigures,
  type StockFilter,
  type StockItem,
} from '@/entities/product';
import {listWarehouses, type Warehouse} from '@/entities/warehouse';
import {
  DownloadStockSheet,
  downloadStockSheet,
} from '@/features/download-stock-sheet';
import {MoveStockPanel} from '@/features/move-stock';
import {ApiError} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {useLoad, useRememberedWarehouse} from '@/shared/lib';
import {
  Button,
  ClearFilters,
  DataTable,
  EmptyState,
  ErrorState,
  FilterChips,
  KpiStrip,
  Money,
  Num,
  SearchBox,
  Skeleton,
  Toolbar,
  useToast,
  WarehouseSwitch,
  type Column,
} from '@/shared/ui';
import './stock-table.css';

/**
 * One warehouse's stock (the one in the address, else the last one chosen in this browser, else the first): its
 * figures, a toolbar to narrow it, and a selectable table whose bar moves or downloads the selection.
 */
export function StockTable() {
  const {t} = useTranslation();
  const warehouses = useLoad(listWarehouses, []);
  const [current, pick] = useRememberedWarehouse(warehouses.data);

  if (warehouses.error) {
    return <ErrorState error={warehouses.error} onRetry={warehouses.reload} />;
  }
  if (warehouses.data === undefined)
    return <Skeleton variant="row" lines={4} />;
  if (warehouses.data.length === 0 || current === undefined) {
    return (
      <EmptyState icon="fa-warehouse" message={t('products.noWarehouses')} />
    );
  }

  return (
    <WarehouseStock
      key={current.id}
      warehouse={current}
      warehouses={warehouses.data}
      onPick={pick}
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
  const navigate = useNavigate();
  const toast = useToast();
  const {data, loading, error, reload} = useLoad(
    () => listStock(warehouse.id),
    [warehouse.id],
  );
  const [selected, setSelected] = useState<Set<string | number>>(new Set());
  const [moving, setMoving] = useState<StockItem[] | null>(null);
  const [chip, setChip] = useState<StockFilter | null>(null);
  const [search, setSearch] = useState('');

  const figures = useMemo(() => stockFigures(data ?? []), [data]);
  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (data ?? []).filter(
      (row) =>
        matchesStock(row, chip) &&
        (needle === '' ||
          [row.code, row.title, row.detail ?? ''].some((text) =>
            text.toLowerCase().includes(needle),
          )),
    );
  }, [data, chip, search]);
  const filtered = chip !== null || search.trim() !== '';
  const clearFilters = () => {
    setChip(null);
    setSearch('');
  };

  const columns = useMemo<Column<StockItem>[]>(
    () => [
      {
        key: 'code',
        header: t('products.columns.code'),
        render: (row) => row.code,
        sortValue: (row) => row.code,
        mono: true,
      },
      {
        key: 'title',
        header: t('products.columns.title'),
        render: (row) => row.title,
        sortValue: (row) => row.title,
      },
      {
        key: 'detail',
        header: t('products.columns.detail'),
        render: (row) =>
          row.detail ? (
            <span className="kf-stock__detail" title={row.detail}>
              {row.detail}
            </span>
          ) : null,
        sortValue: (row) => row.detail ?? '',
      },
      {
        key: 'quantity',
        header: t('products.columns.quantity'),
        render: (row) => <Num value={row.quantity} />,
        sortValue: (row) => row.quantity,
        numeric: true,
      },
      {
        key: 'price',
        header: t('products.columns.price'),
        render: (row) => <Money amount={row.price} />,
        sortValue: (row) => row.price ?? 0,
        numeric: true,
      },
    ],
    [t],
  );

  if (error instanceof ApiError && error.status === 403) {
    return (
      <div className="alert alert-warning" role="alert">
        {t('errors.forbidden')}
      </div>
    );
  }

  const loaded = data !== undefined;
  return (
    <div className="kf-stock">
      <Toolbar label={t('products.title')}>
        <WarehouseSwitch
          warehouses={warehouses}
          value={warehouse.id}
          onChange={onPick}
        />
        <SearchBox
          value={search}
          onChange={setSearch}
          label={t('products.search')}
        />
        <FilterChips
          label={t('products.filters.label')}
          value={chip}
          onChange={(key) => setChip(key as StockFilter | null)}
          allCount={loaded ? figures.products : undefined}
          options={[
            {
              key: 'in',
              label: t('products.filters.inStock'),
              count: loaded ? figures.inStock : undefined,
            },
            {
              key: 'out',
              label: t('products.filters.outOfStock'),
              count: loaded ? figures.outOfStock : undefined,
            },
          ]}
        />
        {filtered && <ClearFilters onClick={clearFilters} />}
      </Toolbar>
      {loaded ? (
        <KpiStrip
          items={[
            {
              label: t('products.kpi.products'),
              value: <Num value={figures.products} />,
            },
            {
              label: t('products.kpi.units'),
              value: <Num value={figures.units} />,
            },
            {
              label: t('products.kpi.value'),
              value: <Money amount={figures.value} />,
            },
          ]}
        />
      ) : (
        !error && <Skeleton variant="kpi" lines={3} />
      )}
      {loaded && data.length > 0 && shown.length === 0 ? (
        <EmptyState
          message={t('common.filteredEmpty')}
          action={
            <Button size="sm" onClick={clearFilters}>
              {t('common.showAll')}
            </Button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          rows={data === undefined ? undefined : shown}
          rowKey={(row) => row.id}
          rowLabel={(row) => row.code}
          loading={loading && data === undefined}
          error={error}
          onRetry={reload}
          emptyMessage={t('products.empty')}
          pageSize={10}
          searchable={false}
          selected={selected}
          onSelectedChange={setSelected}
          onRowClick={(row) => navigate(`/admin/products/${row.uuid}/edit`)}
          rowActions={(row) => [
            {
              label: t('products.actions.edit'),
              icon: 'fa-pen',
              href: `/admin/products/${row.uuid}/edit`,
            },
            {
              label: t('products.sheet.download'),
              icon: 'fa-file-excel',
              onSelect: () => downloadStockSheet([row.uuid]),
            },
          ]}
          selectionBar={(rows) => (
            <>
              <Button
                variant="primary"
                size="sm"
                icon="fa-people-carry"
                onClick={() => setMoving(rows)}
              >
                {t('products.move.open')}
              </Button>
              <DownloadStockSheet uuids={rows.map((row) => row.uuid)} />
            </>
          )}
          cardTitle={(row) => row.title}
          cardFacts={['code', 'quantity', 'price']}
        />
      )}
      {moving && (
        <MoveStockPanel
          rows={moving}
          source={warehouse}
          warehouses={warehouses}
          onClose={() => setMoving(null)}
          onMoved={(destination) => {
            setMoving(null);
            setSelected(new Set());
            toast.success(t('products.moved', {warehouse: destination.name}));
            reload();
          }}
        />
      )}
    </div>
  );
}
