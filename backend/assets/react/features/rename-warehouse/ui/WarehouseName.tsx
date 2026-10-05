import {useEffect, useId, useRef, useState, type FormEvent} from 'react';
import {ApiError, failureMessage} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {Button, useToast} from '@/shared/ui';
import {renameWarehouse, type Warehouse} from '../api/renameWarehouseApi';
import './rename-warehouse.css';

const MAX_LENGTH = 255;

/**
 * A warehouse's name as its card's title, renamed in place: a click on it (or `editing` from the card's menu) turns it
 * into a box; Enter saves (PUT /warehouses/{id}), Escape cancels. Blank and too-long names are refused before sending.
 */
export function WarehouseName({
  warehouse,
  editing,
  onEdit,
  onDone,
  onRenamed,
}: {
  warehouse: Warehouse;
  editing: boolean;
  onEdit: () => void;
  onDone: () => void;
  onRenamed: (warehouse: Warehouse) => void;
}) {
  const {t} = useTranslation();
  const toast = useToast();
  const id = useId();
  const [name, setName] = useState(warehouse.name);
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const title = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLInputElement>(null);
  const wasEditing = useRef(editing);

  useEffect(() => {
    if (editing && !wasEditing.current) {
      setName(warehouse.name);
      setError(null);
      setFailure(null);
    }
    if (editing) {
      box.current?.focus();
    } else if (wasEditing.current) {
      title.current?.focus();
    }
    wasEditing.current = editing;
  }, [editing, warehouse.name]);

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
    if (trimmed === warehouse.name) {
      onDone();
      return;
    }
    setBusy(true);
    try {
      const saved = await renameWarehouse(warehouse.id, trimmed);
      toast.success(
        t('stock.warehouses.renamed', {from: warehouse.name, to: saved.name}),
      );
      onRenamed(saved);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 404) {
        setFailure(t('stock.errors.warehouse_not_found'));
      } else if (cause instanceof ApiError && cause.status === 403) {
        setFailure(t('stock.errors.forbidden'));
      } else {
        setFailure(failureMessage(cause, t));
      }
    } finally {
      setBusy(false);
    }
  };

  if (!editing) {
    return (
      <h2 className="warehouse-name">
        <button
          ref={title}
          type="button"
          className="warehouse-name__button"
          title={t('stock.warehouses.renameHint', {warehouse: warehouse.name})}
          onClick={onEdit}
        >
          {warehouse.name}
        </button>
      </h2>
    );
  }

  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  return (
    <form className="warehouse-rename" onSubmit={submit} noValidate>
      <input
        ref={box}
        className={`form-control warehouse-rename__box${error ? ' is-invalid' : ''}`}
        aria-label={t('stock.warehouses.nameLabel', {warehouse: warehouse.name})}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${errorId} ${hintId}` : hintId}
        value={name}
        maxLength={MAX_LENGTH + 1}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onDone();
          }
        }}
      />
      {error && (
        <p className="warehouse-rename__error" id={errorId}>
          {error}
        </p>
      )}
      <p className="warehouse-rename__hint" id={hintId}>
        {t('stock.warehouses.renameKeys')}
      </p>
      {failure && (
        <div className="alert alert-danger" role="alert">
          {failure}
        </div>
      )}
      <div className="warehouse-rename__actions">
        <Button variant="ghost" size="sm" onClick={onDone}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" variant="primary" size="sm" loading={busy}>
          {t('common.save')}
        </Button>
      </div>
    </form>
  );
}
