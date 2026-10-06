import {useMemo, useState} from 'react';
import type {StockItem} from '@/entities/product';
import type {Warehouse} from '@/entities/warehouse';
import {ApiError, failureMessage} from '@/shared/api';
import {useTranslation, type Translate} from '@/shared/i18n';
import {
  Button,
  DataTable,
  Field,
  Num,
  SlideOver,
  type Column,
} from '@/shared/ui';
import {moveStock} from '../api/moveStockApi';
import {moveItems, quantityOptions} from '../model/moveLines';

/** The API's refusals of a move, in the person's words (products.errors.<code>). */
const KNOWN_ERRORS = [
  'insufficient_stock',
  'same_warehouse',
  'product_not_found',
  'stock_not_found',
  'warehouse_not_found',
];

function moveFailure(error: unknown, t: Translate): string {
  if (error instanceof ApiError) {
    if (error.status === 403) return t('errors.forbidden');
    if (KNOWN_ERRORS.includes(error.code)) {
      const detail =
        (error.body as {detail?: {code?: string; available?: number}} | null)
          ?.detail ?? {};
      return t(`products.errors.${error.code}`, {
        code: detail.code ?? '',
        available: detail.available ?? 0,
      });
    }
  }
  return failureMessage(error, t);
}

/**
 * Move to warehouse, in a slide-over so the list stays in view: the selected stock rows of `source`, a quantity (1..available) for each and the destination
 * (every other warehouse). The stock arrives there as incoming, waiting for approval.
 */
export function MoveStockPanel({
  rows,
  source,
  warehouses,
  onMoved,
  onClose,
}: {
  rows: StockItem[];
  source: Warehouse;
  warehouses: Warehouse[];
  onMoved: (destination: Warehouse) => void;
  onClose: () => void;
}) {
  const {t} = useTranslation();
  const destinations = useMemo(
    () => warehouses.filter((warehouse) => warehouse.id !== source.id),
    [warehouses, source.id],
  );
  const [destinationId, setDestinationId] = useState<number | undefined>(
    destinations[0]?.id,
  );
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const items = moveItems(rows, picked);
  const destination = destinations.find((w) => w.id === destinationId);

  const columns = useMemo<Column<StockItem>[]>(
    () => [
      {
        key: 'code',
        header: t('products.columns.code'),
        render: (row) => row.code,
        mono: true,
      },
      {
        key: 'title',
        header: t('products.columns.title'),
        render: (row) => row.title,
      },
      {
        key: 'quantity',
        header: t('products.columns.quantity'),
        render: (row) =>
          row.quantity > 0 ? (
            <span className="d-inline-flex align-items-center">
              <select
                className="form-control form-control-sm"
                aria-label={t('products.move.quantityOf', {code: row.code})}
                value={picked[row.uuid] ?? 1}
                onChange={(event) =>
                  setPicked((now) => ({
                    ...now,
                    [row.uuid]: Number(event.target.value),
                  }))
                }
              >
                {quantityOptions(row.quantity).map((quantity) => (
                  <option key={quantity} value={quantity}>
                    {quantity}
                  </option>
                ))}
              </select>
              <span className="text-muted ml-2 text-nowrap">
                / <Num value={row.quantity} />
              </span>
            </span>
          ) : (
            <span className="text-muted">
              {t('products.move.noneAvailable')}
            </span>
          ),
      },
    ],
    [t, picked],
  );

  const move = async () => {
    if (!destination || items.length === 0) return;
    setBusy(true);
    setFailure(null);
    try {
      await moveStock(source.id, destination.id, items);
      onMoved(destination);
    } catch (error) {
      setFailure(moveFailure(error, t));
      setBusy(false);
    }
  };

  return (
    <SlideOver
      title={t('products.move.title')}
      width="lg"
      onClose={onClose}
      header={
        <p className="text-muted mb-0">
          {t('products.move.summary', {source: source.name})}
        </p>
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={move}
            loading={busy}
            disabled={!destination || items.length === 0}
          >
            {busy ? t('products.move.moving') : t('products.move.submit')}
          </Button>
        </>
      }
    >
      {failure && (
        <div className="alert alert-danger" role="alert">
          {failure}
        </div>
      )}
      {destination ? (
        <Field label={t('products.move.destination')}>
          <select
            className="form-control"
            value={destinationId}
            onChange={(event) => setDestinationId(Number(event.target.value))}
          >
            {destinations.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <div className="alert alert-warning">
          {t('products.move.noDestination')}
        </div>
      )}
      {items.length === 0 && (
        <div className="alert alert-warning">
          {t('products.move.nothingToMove')}
        </div>
      )}
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        searchable={false}
        pageSize={0}
      />
    </SlideOver>
  );
}
