import {useState, type FormEvent} from 'react';
import {ApiError, failureMessage, type Schema} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {Field, Modal} from '@/shared/ui';
import {renameWarehouse} from '../api/renameWarehouseApi';

const MAX_LENGTH = 255;

/** Edit warehouse: the form has one field, its name. Calls onRenamed with the saved warehouse. */
export function RenameWarehouseModal({
  warehouse,
  onClose,
  onRenamed,
}: {
  warehouse: Schema<'WarehouseOutput'>;
  onClose: () => void;
  onRenamed: (warehouse: Schema<'WarehouseOutput'>) => void;
}) {
  const {t} = useTranslation();
  const [name, setName] = useState(warehouse.name);
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFailure(null);
    const trimmed = name.trim();
    if (trimmed === '') {
      setError(t('stock.warehouses.required'));
      return;
    }
    if (trimmed.length > MAX_LENGTH) {
      setError(t('stock.warehouses.tooLong'));
      return;
    }
    setError(null);
    setBusy(true);
    try {
      onRenamed(await renameWarehouse(warehouse.id, trimmed));
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 404) {
        setFailure(t('stock.errors.warehouse_not_found'));
      } else if (cause instanceof ApiError && cause.status === 403) {
        setFailure(t('stock.errors.forbidden'));
      } else {
        setFailure(failureMessage(cause, t));
      }
      setBusy(false);
    }
  };

  return (
    <Modal
      title={t('stock.warehouses.editTitle')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            form="rename-warehouse"
            className="btn btn-primary"
            disabled={busy}
          >
            {busy ? t('common.saving') : t('common.save')}
          </button>
        </>
      }
    >
      <form id="rename-warehouse" onSubmit={submit} noValidate>
        {failure && (
          <div className="alert alert-danger" role="alert">
            {failure}
          </div>
        )}
        <Field label={t('stock.warehouses.name')} error={error}>
          <input
            className="form-control"
            value={name}
            maxLength={MAX_LENGTH + 1}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
      </form>
    </Modal>
  );
}
