import {useState, type FormEvent} from 'react';
import {Link} from 'react-router-dom';
import {ApiError, failureMessage, type Schema} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {Field} from '@/shared/ui';
import {
  TEMPLATE_ALL_URL,
  TEMPLATE_URL,
  uploadProducts,
} from '../api/uploadProductsApi';

/** The upload form: a spreadsheet and the warehouse its quantities go to, with the template links. */
export function UploadProductsForm({
  warehouses,
}: {
  warehouses: Schema<'WarehouseOutput'>[];
}) {
  const {t} = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [warehouseId, setWarehouseId] = useState('');
  const [errors, setErrors] = useState<{file?: string; warehouse?: string}>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [stored, setStored] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFailure(null);
    setStored(null);
    const found = {
      file: file ? undefined : t('stock.upload.fileRequired'),
      warehouse:
        warehouseId === '' ? t('stock.upload.warehouseRequired') : undefined,
    };
    setErrors(found);
    if (!file || warehouseId === '') return;

    setBusy(true);
    try {
      const result = await uploadProducts(file, Number(warehouseId));
      setStored(result.stored);
      setFile(null);
      (event.target as HTMLFormElement).reset();
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

  return (
    <form onSubmit={submit} noValidate>
      <p>
        {t('stock.upload.description')}{' '}
        <a href={TEMPLATE_URL} className="btn btn-sm btn-success">
          <i className="fas fa-download" aria-hidden="true" />{' '}
          {t('stock.upload.downloadTemplate')}
        </a>{' '}
        <a href={TEMPLATE_ALL_URL} className="btn btn-sm btn-success">
          <i className="fas fa-download" aria-hidden="true" />{' '}
          {t('stock.upload.downloadAll')}
        </a>
      </p>
      {stored !== null && (
        <div className="alert alert-success" role="status">
          {t('stock.upload.done', {count: stored})}{' '}
          <Link to="/admin/products">{t('nav.productList')}</Link>
        </div>
      )}
      {failure && (
        <div className="alert alert-danger" role="alert">
          {failure}
        </div>
      )}
      <Field label={t('stock.upload.file')} error={errors.file}>
        <input
          type="file"
          className="form-control-file"
          accept=".xls,.xlsx"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
      </Field>
      <Field label={t('stock.upload.warehouse')} error={errors.warehouse}>
        <select
          className="form-control"
          value={warehouseId}
          onChange={(event) => setWarehouseId(event.target.value)}
        >
          <option value="">{t('stock.warehouse.choose')}</option>
          {warehouses.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.name}
            </option>
          ))}
        </select>
      </Field>
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? t('stock.upload.submitting') : t('stock.upload.submit')}
      </button>
    </form>
  );
}
