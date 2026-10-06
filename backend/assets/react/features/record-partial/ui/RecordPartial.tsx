import {useId, useState} from 'react';
import {ApiError, failureMessage} from '@/shared/api';
import {useTranslation, type Translate} from '@/shared/i18n';
import type {DetectorFactory} from '@/shared/lib';
import {
  ActionBar,
  Button,
  CameraScanner,
  ScanInput,
  StatusBadge,
  type Tone,
} from '@/shared/ui';
import {
  recordPartial,
  type OrderPartials,
  type PartialItem,
} from '../api/recordPartialApi';
import {
  CLOSED_STATUSES,
  currentOf,
  leftOf,
  lineState,
  scan,
  shipmentUnits,
  shippedOf,
  stockOf,
  unscan,
  type LineState,
  type OrderLine,
  type ScanResult,
} from '../model/shipment';
import './record-partial.css';

type Refusal = {result: Exclude<ScanResult, 'added'>; code: string};

/** The tone of a line's state; a pending line shows no badge, so nothing alarms before anything happened. */
const STATE_TONES: Record<Exclude<LineState, 'pending'>, Tone> = {
  complete: 'accent',
  shipped: 'neutral',
  short: 'warning',
};

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

/** One product of the order: its code and title, its progress, its stock, and the stepper of this shipment. */
function ShipmentLine({
  line,
  partials,
  current,
  flash,
  onMore,
  onLess,
}: {
  line: OrderLine;
  partials: OrderPartials;
  current: PartialItem[];
  /** Grows each time this line is read, to flash it again. */
  flash: number;
  onMore: () => void;
  onLess: () => void;
}) {
  const {t} = useTranslation();
  const codeId = useId();
  const {code, title, detail} = line.product;
  const shipped = shippedOf(partials, line.uuid);
  const inShipment = currentOf(current, line.uuid);
  const state = lineState(line, partials, current);
  const progress = t('gettingReady.progress', {
    shipped,
    ordered: line.quantity,
    current: inShipment,
  });
  const width = (value: number) =>
    `${line.quantity > 0 ? Math.min(100, (value / line.quantity) * 100) : 0}%`;

  return (
    <li
      aria-labelledby={codeId}
      className={`shipment-line${state === 'pending' ? '' : ` is-${state}`}`}
    >
      {flash > 0 && (
        <span key={flash} className="shipment-line__flash" aria-hidden="true" />
      )}
      <div className="shipment-line__what">
        <span className="shipment-line__code" id={codeId}>
          {code}
        </span>
        {title && title !== code && (
          <span className="shipment-line__title">{title}</span>
        )}
        {detail && <span className="shipment-line__detail">{detail}</span>}
      </div>
      <div className="shipment-line__progress">
        <div
          className="shipment-line__bar"
          role="progressbar"
          aria-label={t('gettingReady.progressOf', {code})}
          aria-valuemin={0}
          aria-valuemax={line.quantity}
          aria-valuenow={shipped + inShipment}
          aria-valuetext={progress}
        >
          <span
            className="shipment-line__bar-shipped"
            style={{width: width(shipped)}}
          />
          <span
            className="shipment-line__bar-current"
            style={{width: width(inShipment)}}
          />
        </div>
        <div className="shipment-line__facts">
          <span className="shipment-line__count">{progress}</span>
          <span className="shipment-line__stock">
            {t('gettingReady.inStock', {stock: stockOf(partials, code)})}
          </span>
          {state !== 'pending' && (
            <StatusBadge tone={STATE_TONES[state]}>
              {t(`gettingReady.states.${state}`)}
            </StatusBadge>
          )}
        </div>
      </div>
      <div className="shipment-line__stepper">
        <Button
          variant="secondary"
          size="lg"
          icon="fa-minus"
          aria-label={t('gettingReady.less', {code})}
          disabled={inShipment === 0}
          onClick={onLess}
        />
        <output
          className="shipment-line__current"
          aria-label={t('gettingReady.thisShipmentOf', {code})}
        >
          {inShipment}
        </output>
        <Button
          variant="secondary"
          size="lg"
          icon="fa-plus"
          aria-label={t('gettingReady.more', {code})}
          disabled={leftOf(line, partials, current) <= 0}
          onClick={onMore}
        />
      </div>
    </li>
  );
}

/**
 * The getting-ready screen's work: scan each product (the camera or the barcode box) to put one in this shipment,
 * checked against the order, what was shipped and the warehouse's stock; refusals are said inline under the scanner,
 * which keeps its focus; then ship it. The rules are the legacy PartialHandler's (`model/shipment`).
 */
export function RecordPartial({
  partials,
  onSaved,
  detector,
}: {
  partials: OrderPartials;
  onSaved: (partials: OrderPartials) => void;
  /** How the camera decodes frames; tests pass a fake. */
  detector?: DetectorFactory;
}) {
  const {t} = useTranslation();
  const [current, setCurrent] = useState<PartialItem[]>([]);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [flashes, setFlashes] = useState<Record<string, number>>({});

  const add = (code: string) => {
    const next = scan(code, partials, current);
    setCurrent(next.current);
    if (next.result === 'added') {
      setRefusal(null);
      const uuid = next.line?.uuid ?? '';
      setFlashes((now) => ({...now, [uuid]: (now[uuid] ?? 0) + 1}));
    } else {
      setRefusal({
        result: next.result,
        code: next.line?.product.code ?? code.trim(),
      });
    }
  };

  const ship = async () => {
    setFailure(null);
    setSending(true);
    try {
      onSaved(await recordPartial(partials.order_id, current));
    } catch (error) {
      setFailure(refusalMessage(error, t));
      setSending(false);
    }
  };

  const closed = CLOSED_STATUSES.includes(partials.status);
  const units = shipmentUnits(current);
  let status: string | undefined;
  if (closed) status = t('gettingReady.closed');
  else if (units === 0) status = t('gettingReady.nothingYet');

  return (
    <div className="record-partial">
      <section
        className="record-partial__scanner"
        aria-label={t('gettingReady.scanner')}
      >
        <p className="record-partial__hint">{t('gettingReady.description')}</p>
        <CameraScanner
          onScan={add}
          paused={sending || closed}
          detector={detector}
        />
        <ScanInput onScan={add} size="lg" autoFocus />
        {refusal && (
          <p className="record-partial__refusal" role="alert">
            <i className="fas fa-exclamation-circle" aria-hidden="true" />{' '}
            {t(`gettingReady.refusals.${refusal.result}`, {
              code: refusal.code,
            })}
          </p>
        )}
      </section>

      {partials.products.length === 0 ? (
        <p className="record-partial__empty">{t('gettingReady.noProducts')}</p>
      ) : (
        <ol
          className="record-partial__lines"
          aria-label={t('gettingReady.list')}
        >
          {partials.products.map((line) => (
            <ShipmentLine
              key={line.uuid}
              line={line}
              partials={partials}
              current={current}
              flash={flashes[line.uuid] ?? 0}
              onMore={() => add(line.product.code)}
              onLess={() => setCurrent((now) => unscan(now, line.uuid))}
            />
          ))}
        </ol>
      )}

      {failure && (
        <div className="alert alert-danger" role="alert">
          {failure}
        </div>
      )}

      <ActionBar
        status={status}
        secondary={
          <Button variant="ghost" size="lg" to="/admin/orders">
            {t('common.cancel')}
          </Button>
        }
        primary={
          <Button
            variant="primary"
            size="lg"
            icon="fa-truck"
            loading={sending}
            disabled={closed || units === 0}
            onClick={ship}
          >
            {t('gettingReady.ship', {count: units})}
          </Button>
        }
      />
    </div>
  );
}
