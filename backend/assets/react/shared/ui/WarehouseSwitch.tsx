import {useId} from 'react';
import {useTranslation} from '@/shared/i18n';

export interface WarehouseOption {
  id: number;
  name: string;
}

/**
 * Which warehouse a screen works on: a segmented control for up to four warehouses, a compact select beyond.
 * The warehouses are passed in (shared knows no entity); remember the choice with useRememberedWarehouse.
 */
export function WarehouseSwitch({
  warehouses,
  value,
  onChange,
  label,
}: {
  warehouses: WarehouseOption[];
  value: number | null;
  onChange: (id: number) => void;
  label?: string;
}) {
  const {t} = useTranslation();
  const id = useId();
  const name = label ?? t('common.warehouse');

  if (warehouses.length > 4) {
    return (
      <div className="kf-warehouse-switch kf-warehouse-switch--select">
        <label className="sr-only" htmlFor={id}>
          {name}
        </label>
        <i className="fas fa-warehouse" aria-hidden="true" />
        <select
          id={id}
          className="form-control"
          value={value ?? ''}
          onChange={(event) => onChange(Number(event.target.value))}
        >
          {warehouses.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.name}
            </option>
          ))}
        </select>
      </div>
    );
  }

  const select = (index: number, group: HTMLElement) => {
    const i = (index + warehouses.length) % warehouses.length;
    const warehouse = warehouses[i];
    if (!warehouse) return;
    onChange(warehouse.id);
    group.querySelectorAll<HTMLElement>('[role="radio"]')[i]?.focus();
  };
  const at = warehouses.findIndex((warehouse) => warehouse.id === value);
  return (
    <div
      className="kf-segmented kf-warehouse-switch"
      role="radiogroup"
      aria-label={name}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
          event.preventDefault();
          select(at + 1, event.currentTarget);
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
          event.preventDefault();
          select(at - 1, event.currentTarget);
        }
      }}
    >
      {warehouses.map((warehouse, index) => {
        const checked = warehouse.id === value;
        return (
          <button
            key={warehouse.id}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked || (at === -1 && index === 0) ? 0 : -1}
            className="kf-segmented__option"
            onClick={() => onChange(warehouse.id)}
          >
            {warehouse.name}
          </button>
        );
      })}
    </div>
  );
}
