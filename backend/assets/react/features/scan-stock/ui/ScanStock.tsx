import {useState, type KeyboardEvent} from 'react';
import {ApiError, failureMessage, type Schema} from '@/shared/api';
import {useTranslation, type Translate} from '@/shared/i18n';
import {ConfirmModal, Field} from '@/shared/ui';
import {
  addStock,
  productExists,
  removeStock,
  type StockItem,
} from '../api/scanStockApi';
import {
  isValidQuantity,
  readCode,
  setExists,
  setQuantity,
  type ScannedLine,
} from '../model/scanList';

type Action = 'add' | 'remove';

function failureText(error: unknown, t: Translate): string {
  if (error instanceof ApiError) {
    if (error.status === 403) return t('stock.errors.forbidden');
    if (error.code === 'insufficient_stock') {
      const detail = (
        error.body as {detail?: {code?: string; available?: number}}
      ).detail;
      return t('stock.errors.insufficient_stock', {
        code: detail?.code ?? '',
        available: detail?.available ?? 0,
      });
    }
    if (
      ['stock_not_found', 'warehouse_not_found', 'product_not_found'].includes(
        error.code,
      )
    ) {
      return t(`stock.errors.${error.code}`);
    }
    if (error.status === 422) return t('errors.validation_failed');
  }
  return failureMessage(error, t);
}

/** The barcode reader: codes typed or scanned (Enter), checked against the products, then added to or removed from a warehouse. */
export function ScanStock({
  warehouses,
}: {
  warehouses: Schema<'WarehouseOutput'>[];
}) {
  const {t} = useTranslation();
  const [text, setText] = useState('');
  const [rows, setRows] = useState<ScannedLine[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [confirming, setConfirming] = useState<Action | null>(null);
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const warehouse = warehouses.find((w) => String(w.id) === warehouseId);
  const allValid = rows.every((row) => isValidQuantity(row.quantity));
  const canSend = warehouse !== undefined && rows.length > 0 && allValid;

  const read = () => {
    const code = text.trim();
    if (code === '') return;
    setText('');
    setDone(null);
    const known = rows.some((row) => row.code === code);
    setRows((now) => readCode(now, code));
    if (!known) {
      productExists(code).then((exists) =>
        setRows((now) => setExists(now, code, exists)),
      );
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      read();
    }
  };

  const send = async () => {
    if (!warehouse || confirming === null) return;
    const items: StockItem[] = rows.map((row) => ({
      code: row.code,
      quantity: Number(row.quantity),
    }));
    setSending(true);
    setFailure(null);
    try {
      await (confirming === 'add' ? addStock : removeStock)(
        warehouse.id,
        items,
      );
      setDone(
        t(
          confirming === 'add'
            ? 'stock.barcode.added'
            : 'stock.barcode.removed',
          {
            warehouse: warehouse.name,
          },
        ),
      );
      setRows([]);
    } catch (error) {
      setFailure(failureText(error, t));
    } finally {
      setSending(false);
      setConfirming(null);
    }
  };

  return (
    <div>
      <p>{t('stock.barcode.description')}</p>
      {done && (
        <div className="alert alert-success" role="status">
          {done}
        </div>
      )}
      {failure && (
        <div className="alert alert-danger" role="alert">
          {failure}
        </div>
      )}
      <div className="form-inline">
        <input
          type="text"
          className="form-control form-control-sm my-1 mr-sm-2"
          placeholder={t('stock.barcode.placeholder')}
          aria-label={t('stock.barcode.placeholder')}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          className="btn btn-primary btn-sm my-2"
          onClick={read}
        >
          {t('stock.barcode.add')}
        </button>
      </div>

      <table className="table table-sm">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">{t('stock.barcode.code')}</th>
            <th scope="col">{t('stock.barcode.quantity')}</th>
            <th scope="col">{t('stock.barcode.options')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.code}>
              <th scope="row">{index + 1}</th>
              <td width="75%">{row.code}</td>
              <td>
                <input
                  type="text"
                  inputMode="numeric"
                  value={row.quantity}
                  aria-label={`${t('stock.barcode.quantity')} of ${row.code}`}
                  aria-invalid={!isValidQuantity(row.quantity) || undefined}
                  className={`form-control form-control-sm${isValidQuantity(row.quantity) ? '' : ' is-invalid'}`}
                  onChange={(event) =>
                    setRows((now) =>
                      setQuantity(now, row.code, event.target.value),
                    )
                  }
                />
              </td>
              <td>
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  aria-label={t('stock.barcode.remove', {code: row.code})}
                  onClick={() =>
                    setRows((now) => now.filter((r) => r.code !== row.code))
                  }
                >
                  <i className="fas fa-trash-alt" aria-hidden="true" />
                </button>{' '}
                {row.exists === true && (
                  <span
                    className="btn btn-sm btn-success"
                    title={t('stock.barcode.exists')}
                  >
                    <i className="fas fa-check-circle" aria-hidden="true" />
                  </span>
                )}
                {row.exists === false && (
                  <span
                    className="btn btn-sm btn-danger"
                    title={t('stock.barcode.missing')}
                  >
                    <i className="fas fa-times-circle" aria-hidden="true" />
                  </span>
                )}
                {row.exists === null && (
                  <span
                    className="btn btn-sm btn-info"
                    title={t('stock.barcode.checking')}
                  >
                    <i
                      className="fas fa-circle-notch fa-spin"
                      aria-hidden="true"
                    />
                  </span>
                )}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="text-center">
                {t('stock.barcode.empty')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {!allValid && (
        <p className="text-danger small">{t('stock.barcode.badQuantity')}</p>
      )}

      <Field label={t('stock.warehouse.label')}>
        <select
          className="form-control form-control-sm"
          value={warehouseId}
          onChange={(event) => setWarehouseId(event.target.value)}
        >
          <option value="">{t('stock.warehouse.choose')}</option>
          {warehouses.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </Field>

      <button
        type="button"
        className="btn btn-primary my-2 mr-1"
        disabled={!canSend}
        onClick={() => setConfirming('add')}
      >
        {t('stock.barcode.addProducts')}
      </button>
      <button
        type="button"
        className="btn btn-danger my-2"
        disabled={!canSend}
        onClick={() => setConfirming('remove')}
      >
        {t('stock.barcode.removeProducts')}
      </button>

      {confirming && warehouse && (
        <ConfirmModal
          title={t('stock.barcode.confirmTitle')}
          confirmLabel={
            sending
              ? t('stock.barcode.sending')
              : t(
                  confirming === 'add'
                    ? 'stock.barcode.confirmAdd'
                    : 'stock.barcode.confirmRemove',
                )
          }
          danger={confirming === 'remove'}
          busy={sending}
          onConfirm={send}
          onCancel={() => setConfirming(null)}
        >
          {t(
            confirming === 'add'
              ? 'stock.barcode.confirmBody'
              : 'stock.barcode.confirmBodyRemove',
            {warehouse: warehouse.name},
          )}
          <hr />
          <table className="table table-sm">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">{t('stock.barcode.code')}</th>
                <th scope="col">{t('stock.barcode.quantity')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.code}>
                  <td>{index + 1}</td>
                  <td width="75%">{row.code}</td>
                  <td>{row.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ConfirmModal>
      )}
    </div>
  );
}
