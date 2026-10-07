import {useEffect, useRef, useState, type KeyboardEvent} from 'react';
import {ApiError, failureMessage, type Schema} from '@/shared/api';
import {useTranslation, type Translate} from '@/shared/i18n';
import {
  readSetting,
  usePhone,
  useRememberedWarehouse,
  writeSetting,
  type DetectorFactory,
} from '@/shared/lib';
import {
  ActionBar,
  Button,
  CameraScanner,
  ConfirmModal,
  ScanInput,
  useToast,
  WarehouseSwitch,
} from '@/shared/ui';
import {
  addStock,
  findProductByCode,
  removeStock,
  type StockItem,
} from '../api/scanStockApi';
import {
  isValidQuantity,
  linesToSend,
  readCode,
  removeLine,
  setLookup,
  setQuantity,
  stepQuantity,
  totals,
  unreadCode,
  type ScanMode,
  type ScannedLine,
} from '../model/scanList';
import './scan-stock.css';

export const SCAN_MODE_KEY = 'kf.scanMode';
export const SCAN_INTRO_KEY = 'kf.scanIntroSeen';

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

/** Add or Remove, as a large segmented control (Remove in the danger colour): the mode every scan works in. */
function ModeSwitch({
  value,
  onChange,
}: {
  value: ScanMode;
  onChange: (mode: ScanMode) => void;
}) {
  const {t} = useTranslation();
  const modes: {mode: ScanMode; label: string; icon: string}[] = [
    {mode: 'add', label: t('stock.scan.modeAdd'), icon: 'fa-plus'},
    {mode: 'remove', label: t('stock.scan.modeRemove'), icon: 'fa-minus'},
  ];
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      !['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(event.key)
    )
      return;
    event.preventDefault();
    const next: ScanMode = value === 'add' ? 'remove' : 'add';
    onChange(next);
    event.currentTarget
      .querySelector<HTMLElement>(`[data-mode="${next}"]`)
      ?.focus();
  };
  return (
    <div
      className="kf-segmented scan-mode"
      role="radiogroup"
      aria-label={t('stock.scan.mode')}
      onKeyDown={onKeyDown}
    >
      {modes.map(({mode, label, icon}) => (
        <button
          key={mode}
          type="button"
          role="radio"
          data-mode={mode}
          aria-checked={value === mode}
          tabIndex={value === mode ? 0 : -1}
          className={`kf-segmented__option scan-mode__option scan-mode__option--${mode}`}
          onClick={() => onChange(mode)}
        >
          <i className={`fas ${icon}`} aria-hidden="true" /> {label}
        </button>
      ))}
    </div>
  );
}

/** One code of the running list: the code, its product once known, a stepper and a way out. */
function ScanLineRow({
  line,
  flashing,
  onQuantity,
  onStep,
  onRemove,
}: {
  line: ScannedLine;
  flashing: boolean;
  onQuantity: (quantity: string) => void;
  onStep: (delta: 1 | -1) => void;
  onRemove: () => void;
}) {
  const {t} = useTranslation();
  const valid = isValidQuantity(line.quantity);
  return (
    <li
      className={[
        'scan-line',
        line.lookup === 'missing' ? 'scan-line--missing' : null,
        flashing ? 'is-flashing' : null,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="scan-line__what">
        <span className="scan-line__code">{line.code}</span>
        {line.lookup === 'found' && (
          <span className="scan-line__title">{line.title}</span>
        )}
        {line.lookup === 'checking' && (
          <span className="scan-line__note">{t('stock.scan.checking')}</span>
        )}
        {line.lookup === 'failed' && (
          <span className="scan-line__note">{t('stock.scan.notChecked')}</span>
        )}
        {line.lookup === 'missing' && (
          <span className="scan-line__missing">
            <i className="fas fa-times-circle" aria-hidden="true" />{' '}
            {t('stock.scan.notAProduct')}
          </span>
        )}
      </div>
      <div className="scan-line__count">
        <Button
          variant="ghost"
          icon="fa-minus"
          aria-label={t('stock.scan.less', {code: line.code})}
          disabled={!valid || Number(line.quantity) <= 1}
          onClick={() => onStep(-1)}
        />
        <input
          type="text"
          inputMode="numeric"
          className={`form-control scan-line__quantity${valid ? '' : ' is-invalid'}`}
          aria-label={t('stock.scan.quantityOf', {code: line.code})}
          aria-invalid={!valid || undefined}
          value={line.quantity}
          onChange={(event) => onQuantity(event.target.value)}
        />
        <Button
          variant="ghost"
          icon="fa-plus"
          aria-label={t('stock.scan.more', {code: line.code})}
          onClick={() => onStep(1)}
        />
        <Button
          variant="ghost"
          icon="fa-times"
          aria-label={t('stock.scan.removeLine', {code: line.code})}
          onClick={onRemove}
        />
      </div>
    </li>
  );
}

/**
 * The scan screen's work: the warehouse and the mode first (both remembered), then codes from the camera or typed
 * (Enter), a running list with the products' titles, Undo last scan, and the footer that adds in one tap or removes
 * after a confirmation. Refusals stay inline, so the scanner keeps its focus.
 */
export function ScanStock({
  warehouses,
  detector,
}: {
  warehouses: Schema<'WarehouseOutput'>[];
  /** How the camera decodes frames; tests pass a fake. */
  detector?: DetectorFactory;
}) {
  const {t} = useTranslation();
  const toast = useToast();
  const [warehouse, pickWarehouse] = useRememberedWarehouse(warehouses);
  const [mode, setMode] = useState<ScanMode>(() =>
    readSetting(SCAN_MODE_KEY) === 'remove' ? 'remove' : 'add',
  );
  const [introSeen, setIntroSeen] = useState(
    () => readSetting(SCAN_INTRO_KEY) === '1',
  );
  const [lines, setLines] = useState<ScannedLine[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [flash, setFlash] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  const scanArea = useRef<HTMLDivElement>(null);
  const known = useRef(new Set<string>());

  useEffect(() => {
    known.current = new Set(lines.map((line) => line.code));
  }, [lines]);

  useEffect(() => {
    if (focusRequest > 0) scanArea.current?.querySelector('input')?.focus();
  }, [focusRequest]);
  const refocus = () => setFocusRequest((n) => n + 1);

  // A phone shows little of the page: the box would be under the tab bar (or the action bar) just when it is needed.
  // Choosing the warehouse or the mode brings it up as little as needed; the first scan puts it on top (it stays
  // there, sticky), with the list under it and the action bar below.
  const phone = usePhone();
  const showBox = (block: ScrollLogicalPosition) => {
    if (phone) scanArea.current?.scrollIntoView?.({block});
  };

  const chooseWarehouse = (id: number) => {
    pickWarehouse(id);
    showBox('nearest');
  };

  const chooseMode = (next: ScanMode) => {
    setMode(next);
    writeSetting(SCAN_MODE_KEY, next);
    showBox('nearest');
  };

  const onScan = (code: string) => {
    if (lines.length === 0) showBox('start');
    setFailure(null);
    setFlash(code);
    setHistory((now) => [...now, code]);
    setLines((now) => readCode(now, code));
    if (known.current.has(code)) return;
    known.current.add(code);
    findProductByCode(code).then(
      (product) =>
        setLines((now) =>
          product
            ? setLookup(now, code, 'found', product.title)
            : setLookup(now, code, 'missing'),
        ),
      () => setLines((now) => setLookup(now, code, 'failed')),
    );
  };

  const undo = () => {
    const code = history[history.length - 1];
    if (code === undefined) return;
    setHistory((now) => now.slice(0, -1));
    setLines((now) => unreadCode(now, code));
    setFlash(null);
    refocus();
  };

  const undoRef = useRef(undo);
  useEffect(() => {
    undoRef.current = undo;
  });
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z')
        return;
      const target = event.target as HTMLInputElement | null;
      const editing =
        (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') &&
        target.value !== '';
      if (editing || document.querySelector('[role="dialog"]')) return;
      event.preventDefault();
      undoRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const removeCode = (code: string) => {
    setLines((now) => removeLine(now, code));
    setHistory((now) => now.filter((read) => read !== code));
  };

  const sent = linesToSend(lines);
  const sum = totals(lines);
  const missing = lines.length - sent.length;
  const allValid = lines.every((line) => isValidQuantity(line.quantity));
  const canSend = warehouse !== undefined && sent.length > 0 && allValid;
  const unitsText = t('stock.count.units', {count: sum.units});
  const productsText = t('stock.count.products', {count: sum.products});

  const send = async () => {
    if (!warehouse || !canSend) return;
    const items: StockItem[] = sent.map((line) => ({
      code: line.code,
      quantity: Number(line.quantity),
    }));
    setSending(true);
    setFailure(null);
    try {
      await (mode === 'add' ? addStock : removeStock)(warehouse.id, items);
      toast.success(
        t(mode === 'add' ? 'stock.scan.added' : 'stock.scan.removed', {
          units: unitsText,
          warehouse: warehouse.name,
        }),
      );
      setLines([]);
      setHistory([]);
      setFlash(null);
    } catch (error) {
      setFailure(failureText(error, t));
    } finally {
      setSending(false);
      setConfirming(false);
      refocus();
    }
  };

  const name = warehouse?.name ?? '';
  const primary =
    mode === 'add' ? (
      <Button
        variant="primary"
        size="lg"
        icon="fa-plus"
        disabled={!canSend}
        loading={sending}
        onClick={send}
      >
        {t('stock.scan.addTo', {warehouse: name})}
      </Button>
    ) : (
      <Button
        variant="danger"
        size="lg"
        icon="fa-minus"
        disabled={!canSend || sending}
        onClick={() => setConfirming(true)}
      >
        {t('stock.scan.removeFrom', {warehouse: name})}
      </Button>
    );

  return (
    <div className="scan-stock">
      {!introSeen && (
        <div className="scan-stock__intro">
          <i className="fas fa-info-circle" aria-hidden="true" />
          <span>{t('stock.scan.intro')}</span>
          <Button
            variant="ghost"
            size="sm"
            icon="fa-times"
            aria-label={t('common.dismiss')}
            onClick={() => {
              setIntroSeen(true);
              writeSetting(SCAN_INTRO_KEY, '1');
            }}
          />
        </div>
      )}

      <section className="scan-stock__step" aria-labelledby="scan-step-1">
        <h2 className="scan-stock__step-title" id="scan-step-1">
          <span className="scan-stock__step-number" aria-hidden="true">
            1
          </span>
          {t('stock.scan.step1')}
        </h2>
        <div className="scan-stock__choices">
          <WarehouseSwitch
            warehouses={warehouses}
            value={warehouse?.id ?? null}
            onChange={chooseWarehouse}
          />
          <ModeSwitch value={mode} onChange={chooseMode} />
        </div>
      </section>

      <section className="scan-stock__step" aria-labelledby="scan-step-2">
        <h2 className="scan-stock__step-title" id="scan-step-2">
          <span className="scan-stock__step-number" aria-hidden="true">
            2
          </span>
          {t('stock.scan.step2')}
        </h2>
        <CameraScanner
          onScan={onScan}
          paused={confirming || sending}
          detector={detector}
        />
        <div ref={scanArea} className="scan-stock__box">
          <ScanInput onScan={onScan} size="lg" autoFocus />
        </div>
        {failure && (
          <div className="alert alert-danger scan-stock__failure" role="alert">
            {failure}
          </div>
        )}
      </section>

      <section className="scan-stock__list">
        {lines.length === 0 ? (
          <p className="scan-stock__empty">{t('stock.scan.empty')}</p>
        ) : (
          <ol className="scan-stock__lines" aria-label={t('stock.scan.list')}>
            {lines.map((line) => {
              const flashing = flash === line.code;
              return (
                <ScanLineRow
                  key={flashing ? `${line.code}:${line.reads}` : line.code}
                  line={line}
                  flashing={flashing}
                  onQuantity={(quantity) =>
                    setLines((now) => setQuantity(now, line.code, quantity))
                  }
                  onStep={(delta) =>
                    setLines((now) => stepQuantity(now, line.code, delta))
                  }
                  onRemove={() => removeCode(line.code)}
                />
              );
            })}
          </ol>
        )}
      </section>

      <ActionBar
        sticky={lines.length > 0}
        status={
          <>
            <span className="scan-stock__totals">
              {productsText} · {unitsText}
            </span>
            {missing > 0 && (
              <span className="scan-stock__left-out">
                {t('stock.scan.leftOut', {count: missing})}
              </span>
            )}
            {!allValid && (
              <span className="scan-stock__invalid">
                {t('stock.scan.badQuantity')}
              </span>
            )}
          </>
        }
        secondary={
          <Button
            variant="secondary"
            size="lg"
            icon="fa-undo"
            disabled={history.length === 0 || sending}
            onClick={undo}
          >
            {t('stock.scan.undo')}
          </Button>
        }
        primary={primary}
      />

      {confirming && warehouse && (
        <ConfirmModal
          title={t('stock.scan.confirmRemoveTitle', {warehouse: name})}
          confirmLabel={t('stock.scan.confirmRemove', {units: unitsText})}
          danger
          busy={sending}
          onConfirm={send}
          onCancel={() => {
            setConfirming(false);
            refocus();
          }}
        >
          <p>
            {t('stock.scan.confirmRemoveBody', {
              units: unitsText,
              products: productsText,
              warehouse: name,
            })}
          </p>
        </ConfirmModal>
      )}
    </div>
  );
}
