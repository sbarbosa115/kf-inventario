import {
  useEffect,
  useId,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
} from 'react';
import {ApiError, failureMessage, type Schema} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {useFormat, useRememberedWarehouse} from '@/shared/lib';
import {Button, WarehouseSwitch} from '@/shared/ui';
import {
  TEMPLATE_ALL_URL,
  TEMPLATE_URL,
  uploadProducts,
} from '../api/uploadProductsApi';
import {isSpreadsheet, sheetType} from '../model/sheetFile';
import './upload-products.css';

interface Stored {
  count: number;
  warehouse: {id: number; name: string};
}

/**
 * Upload a stock sheet in three steps: download the template, fill in the quantities, choose the warehouse and drop
 * the file (a wrong type is refused in place). The result says how many rows were stored, and where.
 */
export function UploadProductsForm({
  warehouses,
}: {
  warehouses: Schema<'WarehouseOutput'>[];
}) {
  const {t} = useTranslation();
  const {num} = useFormat();
  const ids = useId();
  const input = useRef<HTMLInputElement>(null);
  const [warehouse, pickWarehouse] = useRememberedWarehouse(warehouses);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [stored, setStored] = useState<Stored | null>(null);
  const [busy, setBusy] = useState(false);
  const result = useRef<HTMLElement>(null);

  // The summary is above the three steps and Upload below them: on a phone, where Upload is pressed, the summary
  // would be out of sight. It is brought into view (no further than needed).
  useEffect(() => {
    if (stored) result.current?.scrollIntoView?.({block: 'nearest'});
  }, [stored]);

  const choose = (chosen: File | null | undefined) => {
    setFailure(null);
    if (!chosen) return;
    if (!isSpreadsheet(chosen)) {
      setFile(null);
      setFileError(t('stock.upload.wrongType', {name: chosen.name}));
      if (input.current) input.current.value = '';
      return;
    }
    setFileError(null);
    setStored(null);
    setFile(chosen);
  };

  const clear = () => {
    setFile(null);
    if (input.current) input.current.value = '';
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    choose(event.dataTransfer?.files?.[0]);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFailure(null);
    if (!file) {
      setFileError(t('stock.upload.fileRequired'));
      return;
    }
    if (!warehouse) return;
    setBusy(true);
    try {
      const result = await uploadProducts(file, warehouse.id);
      setStored({
        count: result.stored,
        warehouse: {id: warehouse.id, name: warehouse.name},
      });
      clear();
    } catch (error) {
      if (error instanceof ApiError && error.status === 415) {
        setFailure(t('stock.upload.unsupported_media'));
      } else if (error instanceof ApiError && error.status === 422) {
        setFailure(
          error.code === 'invalid_spreadsheet'
            ? t('stock.upload.invalid_spreadsheet')
            : t('errors.validation_failed'),
        );
      } else if (error instanceof ApiError && error.status === 403) {
        setFailure(t('stock.errors.forbidden'));
      } else if (error instanceof ApiError && error.status === 404) {
        setFailure(t('stock.errors.warehouse_not_found'));
      } else {
        setFailure(failureMessage(error, t));
      }
    } finally {
      setBusy(false);
    }
  };

  const hintId = `${ids}-hint`;
  const errorId = `${ids}-error`;

  return (
    <form className="upload" onSubmit={submit} noValidate>
      {stored && (
        <section className="upload-result" role="status" ref={result}>
          <i
            className="fas fa-check-circle upload-result__icon"
            aria-hidden="true"
          />
          <div className="upload-result__text">
            <p className="upload-result__title">
              {t('stock.upload.stored', {
                count: stored.count,
                warehouse: stored.warehouse.name,
              })}
            </p>
            <p className="upload-result__next">
              {t('stock.upload.storedNext')}
            </p>
          </div>
          <Button
            variant="secondary"
            icon="fa-boxes"
            to={`/admin/products?warehouse=${stored.warehouse.id}`}
          >
            {t('stock.upload.openProducts', {warehouse: stored.warehouse.name})}
          </Button>
        </section>
      )}

      <ol className="upload-steps" aria-label={t('stock.upload.steps')}>
        <li className="upload-step">
          <span className="upload-step__number" aria-hidden="true">
            1
          </span>
          <div className="upload-step__body">
            <h2 className="upload-step__title">{t('stock.upload.step1')}</h2>
            <p className="upload-step__text">{t('stock.upload.step1Text')}</p>
            <div className="upload-step__actions">
              <Button
                variant="secondary"
                icon="fa-download"
                href={TEMPLATE_URL}
              >
                {t('stock.upload.downloadTemplate')}
              </Button>
              <Button
                variant="secondary"
                icon="fa-download"
                href={TEMPLATE_ALL_URL}
              >
                {t('stock.upload.downloadAll')}
              </Button>
            </div>
          </div>
        </li>
        <li className="upload-step">
          <span className="upload-step__number" aria-hidden="true">
            2
          </span>
          <div className="upload-step__body">
            <h2 className="upload-step__title">{t('stock.upload.step2')}</h2>
            <p className="upload-step__text">{t('stock.upload.step2Text')}</p>
          </div>
        </li>
        <li className="upload-step">
          <span className="upload-step__number" aria-hidden="true">
            3
          </span>
          <div className="upload-step__body">
            <h2 className="upload-step__title">{t('stock.upload.step3')}</h2>
            <WarehouseSwitch
              warehouses={warehouses}
              value={warehouse?.id ?? null}
              onChange={pickWarehouse}
            />
            <label
              className={`upload-drop${dragging ? ' is-dragging' : ''}${fileError ? ' is-invalid' : ''}`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <input
                ref={input}
                type="file"
                className="upload-drop__input"
                accept=".xls,.xlsx"
                aria-label={t('stock.upload.file')}
                aria-describedby={fileError ? `${hintId} ${errorId}` : hintId}
                aria-invalid={fileError ? true : undefined}
                onChange={(event) => choose(event.target.files?.[0])}
              />
              <i
                className="fas fa-file-excel upload-drop__icon"
                aria-hidden="true"
              />
              <span className="upload-drop__text">
                {t('stock.upload.drop')}
              </span>
              <span className="upload-drop__hint" id={hintId}>
                {t('stock.upload.dropHint')}
              </span>
            </label>
            {fileError && (
              <p className="upload-drop__error" id={errorId} role="alert">
                {fileError}
              </p>
            )}
            {file && (
              <div className="upload-file">
                <i
                  className="fas fa-file-excel upload-file__icon"
                  aria-hidden="true"
                />
                <div className="upload-file__what">
                  <span className="upload-file__name">{file.name}</span>
                  <span className="upload-file__facts">
                    {t('stock.upload.kilobytes', {
                      size: num(Math.max(1, Math.round(file.size / 1024))),
                    })}{' '}
                    · {sheetType(file)}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  icon="fa-times"
                  aria-label={t('stock.upload.removeFile', {name: file.name})}
                  onClick={clear}
                />
              </div>
            )}
            {failure && (
              <div className="alert alert-danger" role="alert">
                {failure}
              </div>
            )}
            <div className="upload-step__actions">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                icon="fa-upload"
                loading={busy}
              >
                {t('stock.upload.submit')}
              </Button>
            </div>
          </div>
        </li>
      </ol>
    </form>
  );
}
