import {useMemo, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {listStock, type StockFilter, type StockItem} from '@/entities/product';
import {listWarehouses, type Warehouse} from '@/entities/warehouse';
import {
  DownloadStockSheet,
  downloadStockSheet,
} from '@/features/download-stock-sheet';
import {MoveStockPanel} from '@/features/move-stock';
import {ApiError} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {
  useDebouncedText,
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
  KpiStrip,
  Money,
  Num,
  SearchBox,
  Skeleton,
  Toolbar,
  useToast,
  WarehouseSwitch,
  type Column,
  type FilterColumn,
  type TableQuery,
} from '@/shared/ui';
import './stock-table.css';

/**
 * One warehouse's stock (the one in the address, else the last one chosen in this browser, else the first): its
 * figures, a toolbar to narrow it, a filter under each header (code, title and detail text, quantity and price ranges;
 * a sheet on a phone, with the in-stock choice too), and a selectable table whose bar moves or downloads the
 * selection. Filtered, sorted and paged on the server; the query lives in the address
 * (?q=&filter[in_stock][]=no&filter[price][min]=500.01&page=2).
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
  const list = useListQuery({sort: 'code'});
  const [refresh, setRefresh] = useState(0);
  const key = JSON.stringify(list.query);
  const {data, loading, error, reload} = useLoad(
    () => listStock(warehouse.id, {...list.query, facets: ['in_stock']}),
    [warehouse.id, key, refresh],
  );
  // The figures and the chips' counts are the whole warehouse's, whatever the filters: one row, the totals and the
  // in-stock facet.
  const summary = useLoad(
    () => listStock(warehouse.id, {perPage: 1, facets: ['in_stock']}),
    [warehouse.id, refresh],
  );
  // The phone's sheet: how many products a draft keeps, one row asked.
  const countFor = (query: TableQuery) =>
    listStock(warehouse.id, {...query, page: 1, perPage: 1}).then(
      (page) => page.total,
    );
  const [selected, setSelected] = useState<Set<string | number>>(new Set());
  const [moving, setMoving] = useState<StockItem[] | null>(null);
  const [search, setSearch, flushSearch] = useDebouncedText(
    list.query.q ?? '',
    (q) => list.update({q: q === '' ? undefined : q}),
  );

  const inStockFilter = list.query.filters?.in_stock;
  // A chip is pressed when its choice is the one ticked; with both ticked (the sheet), none is (not even All).
  const chip: StockFilter | 'both' | null = !Array.isArray(inStockFilter)
    ? null
    : inStockFilter.length > 1
      ? 'both'
      : inStockFilter[0] === 'yes'
        ? 'in'
        : inStockFilter[0] === 'no'
          ? 'out'
          : null;
  const facet = summary.data?.facets?.in_stock ?? [];
  const countOf = (value: string) =>
    facet.find((f) => f.value === value)?.count ?? 0;
  const figures = summary.data
    ? {
        products: summary.data.total,
        units: summary.data.totals.units,
        value: summary.data.totals.value,
        inStock: countOf('yes'),
        outOfStock: countOf('no'),
      }
    : undefined;

  const columns = useMemo<Column<StockItem>[]>(
    () => [
      {
        key: 'code',
        header: t('products.columns.code'),
        render: (row) => row.code,
        sortField: 'code',
        mono: true,
        filter: {type: 'text', field: 'code'},
      },
      {
        key: 'title',
        header: t('products.columns.title'),
        render: (row) => row.title,
        sortField: 'title',
        filter: {type: 'text', field: 'title'},
      },
      {
        key: 'detail',
        header: t('products.columns.detail'),
        render: (row) =>
          row.detail ? (
            <span className="kf-stock__detail">{row.detail}</span>
          ) : null,
        filter: {type: 'text', field: 'detail'},
      },
      {
        key: 'quantity',
        header: t('products.columns.quantity'),
        render: (row) => <Num value={row.quantity} />,
        sortField: 'quantity',
        numeric: true,
        filter: {type: 'number', field: 'quantity'},
      },
      {
        key: 'price',
        header: t('products.columns.price'),
        render: (row) => <Money amount={row.price} />,
        sortField: 'price',
        numeric: true,
        filter: {type: 'money', field: 'price'},
      },
    ],
    [t],
  );
  // In stock has no column: the toolbar's chips on a desktop, a section of the sheet on a phone, a chip when set.
  const extraFilters = useMemo<FilterColumn[]>(
    () => [
      {
        label: t('products.filters.label'),
        filter: {
          type: 'enum',
          field: 'in_stock',
          options: [
            {value: 'yes', label: t('products.filters.inStock')},
            {value: 'no', label: t('products.filters.outOfStock')},
          ],
        },
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
          onBlur={flushSearch}
          label={t('products.search')}
        />
        <FilterChips
          label={t('products.filters.label')}
          value={chip}
          onChange={(key) =>
            list.setFilter(
              'in_stock',
              key === null ? undefined : [key === 'in' ? 'yes' : 'no'],
            )
          }
          allCount={figures?.products}
          options={[
            {
              key: 'in',
              label: t('products.filters.inStock'),
              count: figures?.inStock,
            },
            {
              key: 'out',
              label: t('products.filters.outOfStock'),
              count: figures?.outOfStock,
            },
          ]}
        />
      </Toolbar>
      {figures ? (
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
        !summary.error && <Skeleton variant="kpi" lines={3} />
      )}
      <DataTable
        columns={columns}
        rows={data?.items}
        rowKey={(row) => row.id}
        rowLabel={(row) => row.code}
        loading={loading && data === undefined}
        error={error}
        onRetry={reload}
        emptyMessage={t('products.empty')}
        searchable={false}
        query={list.query}
        onQueryChange={list.update}
        total={data?.total}
        facets={data?.facets}
        extraFilters={extraFilters}
        countFor={countFor}
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
        cardFacts={['code', 'detail', 'quantity', 'price']}
      />
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
            setRefresh((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}
