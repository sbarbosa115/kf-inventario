import {useEffect, useRef, useState, type FormEvent} from 'react';
import {Link} from 'react-router-dom';
import {ApiError, failureMessage} from '@/shared/api';
import {useTranslation, type Translate} from '@/shared/i18n';
import {Modal} from '@/shared/ui';
import {
  recordPartial,
  type OrderPartials,
  type PartialItem,
  type PartialOrder,
} from '../api/recordPartialApi';
import {
  CLOSED_STATUSES,
  COMPLETE,
  currentOf,
  leftLabel,
  rowClass,
  scan,
  shippedOf,
  stockOf,
  unscan,
  type ScanResult,
} from '../model/shipment';

type Refusal = Exclude<ScanResult, 'added'>;

/** What the server's refusal of a shipment means for the person packing it. */
function refusalMessage(error: unknown, t: Translate): string {
  if (error instanceof ApiError) {
    const detail = (
      error.body as {detail?: {code?: string; available?: number}} | null
    )?.detail;
    switch (error.code) {
      case 'insufficient_stock':
        return t('gettingReady.errors.insufficient_stock', {
          code: detail?.code ?? '',
          available: detail?.available ?? 0,
        });
      case 'partial_exceeds_order':
      case 'stock_not_found':
      case 'order_not_found':
      case 'validation_failed':
        return t(`gettingReady.errors.${error.code}`);
      case 'forbidden':
        return t('errors.forbidden');
    }
  }
  return failureMessage(error, t);
}

/**
 * The getting-ready screen's work: scan (or type) each product's barcode to put one in this shipment, check it
 * against the order, what was shipped and the warehouse's stock, then save the shipment. Ports the legacy
 * PartialHandler.
 */
export function RecordPartial({
  order,
  partials,
  onSaved,
}: {
  order: PartialOrder;
  partials: OrderPartials;
  onSaved: (partials: OrderPartials) => void;
}) {
  const {t} = useTranslation();
  const [code, setCode] = useState('');
  const [current, setCurrent] = useState<PartialItem[]>([]);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const barcode = useRef<HTMLInputElement>(null);

  useEffect(() => {
    barcode.current?.focus();
  }, []);

  const add = (productCode: string) => {
    if (productCode.trim() === '') return;
    const next = scan(productCode, order, partials, current);
    setCurrent(next.current);
    if (next.result === 'added') {
      setCode('');
    } else {
      setRefusal(next.result);
    }
  };

  const dismiss = () => {
    setRefusal(null);
    setCode('');
    barcode.current?.focus();
  };

  const onScan = (event: FormEvent) => {
    event.preventDefault();
    add(code);
  };

  const save = async () => {
    setFailure(null);
    setSending(true);
    try {
      onSaved(await recordPartial(order.id, current));
    } catch (error) {
      setFailure(refusalMessage(error, t));
      setSending(false);
    }
  };

  const closed = CLOSED_STATUSES.includes(partials.status);

  return (
    <div>
      <form onSubmit={onScan}>
        <p>{t('gettingReady.description')}</p>
        <div className="form-inline">
          <label htmlFor="getting-ready-barcode" className="sr-only">
            {t('gettingReady.barCode')}
          </label>
          <input
            id="getting-ready-barcode"
            type="text"
            className="form-control form-control-sm my-1 mr-sm-2"
            placeholder={t('gettingReady.barCode')}
            value={code}
            autoComplete="off"
            ref={barcode}
            onChange={(event) => setCode(event.target.value)}
          />
          <button
            type="submit"
            className="btn btn-primary btn-sm my-2"
            disabled={code.trim() === ''}
          >
            {t('gettingReady.addAction')}
          </button>
        </div>
      </form>

      {failure && (
        <div className="alert alert-danger" role="alert">
          {failure}
        </div>
      )}

      <table className="table table-sm getting-ready__table">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">{t('gettingReady.code')}</th>
            <th scope="col">{t('gettingReady.productDescription')}</th>
            <th scope="col">{t('gettingReady.inventory')}</th>
            <th scope="col">{t('gettingReady.orderQuantity')}</th>
            <th scope="col">{t('gettingReady.orderLeft')}</th>
            <th scope="col">{t('gettingReady.thisOrder')}</th>
            <th scope="col">{t('gettingReady.options')}</th>
          </tr>
        </thead>
        <tbody>
          {order.products.map((line, index) => {
            const inThisOrder = currentOf(current, line.uuid);
            const left = leftLabel(line, partials, current);
            return (
              <tr key={line.uuid} className={rowClass(line, partials, current)}>
                <th scope="row">{index + 1}</th>
                <td className="getting-ready__code">{line.product.code}</td>
                <td className="getting-ready__detail">
                  {line.product.detail}
                </td>
                <td className="text-center">
                  <button
                    type="button"
                    className="btn btn-info btn-sm"
                    title={t('gettingReady.inventoryAvailable')}
                    aria-label={`${stockOf(partials, line.product.code)} ${t('gettingReady.inventoryAvailable')}`}
                  >
                    {stockOf(partials, line.product.code)}
                  </button>
                </td>
                <td className="text-center">{`${line.quantity} / ${left}`}</td>
                <td className="text-center">
                  {shippedOf(partials, line.uuid)}
                </td>
                <td className="text-center">
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    aria-label={t('gettingReady.thisOrder')}
                    readOnly
                    value={inThisOrder}
                  />
                </td>
                <td className="text-nowrap">
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    aria-label={t('gettingReady.removeOne')}
                    title={t('gettingReady.removeOne')}
                    disabled={inThisOrder === 0}
                    onClick={() => setCurrent(unscan(current, line.uuid))}
                  >
                    <i className="fas fa-minus-circle" aria-hidden="true" />
                  </button>{' '}
                  <button
                    type="button"
                    className="btn btn-sm btn-success"
                    aria-label={t('gettingReady.addOne')}
                    title={t('gettingReady.addOne')}
                    disabled={left === COMPLETE}
                    onClick={() => add(line.product.code)}
                  >
                    <i className="fas fa-plus-circle" aria-hidden="true" />
                  </button>
                </td>
              </tr>
            );
          })}
          {order.products.length === 0 && (
            <tr>
              <td colSpan={8} className="text-center">
                {t('gettingReady.noProducts')}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="form-row">
        <div className="form-group col-md-6">
          <Link className="btn btn-danger btn-block" to="/admin/orders">
            {t('common.cancel')}
          </Link>
        </div>
        <div className="form-group col-md-6">
          <button
            className="btn btn-success btn-block"
            type="button"
            disabled={sending || closed || current.length === 0}
            onClick={save}
          >
            {sending ? t('common.saving') : t('gettingReady.addPartial')}
          </button>
        </div>
      </div>

      {refusal && (
        <Modal
          title={t(`gettingReady.refusals.${refusal}.error`)}
          onClose={dismiss}
          footer={
            <button type="button" className="btn btn-success" onClick={dismiss}>
              {t(`gettingReady.refusals.${refusal}.ok`)}
            </button>
          }
        >
          <p className="mb-0">{t(`gettingReady.refusals.${refusal}.title`)}</p>
        </Modal>
      )}
    </div>
  );
}
