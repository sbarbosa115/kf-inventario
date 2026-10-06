import {useId, useState} from 'react';
import {listWarehouses, type Warehouse} from '@/entities/warehouse';
import {WarehouseName} from '@/features/rename-warehouse';
import {useTranslation} from '@/shared/i18n';
import {useLoad} from '@/shared/lib';
import {
  EmptyState,
  ErrorState,
  PageHeader,
  RowMenu,
  Skeleton,
} from '@/shared/ui';
import './warehouses.css';

/** One warehouse: its name (renamed in place) and the shop addresses whose orders arrive there. */
function WarehouseCard({
  warehouse,
  editing,
  onEditingChange,
  onRenamed,
}: {
  warehouse: Warehouse;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  onRenamed: () => void;
}) {
  const {t} = useTranslation();
  const urlsId = useId();
  return (
    <article className="warehouse-card">
      <header className="warehouse-card__header">
        <WarehouseName
          warehouse={warehouse}
          editing={editing}
          onEdit={() => onEditingChange(true)}
          onDone={() => onEditingChange(false)}
          onRenamed={onRenamed}
        />
        {!editing && (
          <RowMenu
            label={t('common.actionsFor', {name: warehouse.name})}
            actions={[
              {
                label: t('stock.warehouses.rename'),
                icon: 'fa-pen',
                onSelect: () => onEditingChange(true),
              },
            ]}
          />
        )}
      </header>
      <p className="warehouse-card__label" id={urlsId}>
        {t('stock.warehouses.urls')}
      </p>
      {warehouse.urls.length === 0 ? (
        <p className="warehouse-card__none">{t('stock.warehouses.noUrls')}</p>
      ) : (
        <ul className="warehouse-card__urls" aria-labelledby={urlsId}>
          {warehouse.urls.map((url) => (
            <li key={url}>{url}</li>
          ))}
        </ul>
      )}
    </article>
  );
}

/** Warehouses: a card each, renamed in place, with the shops that send their orders there (any signed-in user). */
export function WarehousesPage() {
  const {t} = useTranslation();
  const {data, error, reload} = useLoad(listWarehouses, []);
  const [editing, setEditing] = useState<number | null>(null);

  return (
    <>
      <PageHeader title={t('stock.warehouses.title')} />
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : data === undefined ? (
        <Skeleton variant="card" />
      ) : data.length === 0 ? (
        <EmptyState icon="fa-warehouse" message={t('stock.warehouses.empty')} />
      ) : (
        <ul className="warehouse-cards" aria-label={t('stock.warehouses.list')}>
          {data.map((warehouse) => (
            <li key={warehouse.id}>
              <WarehouseCard
                warehouse={warehouse}
                editing={editing === warehouse.id}
                onEditingChange={(on) => setEditing(on ? warehouse.id : null)}
                onRenamed={() => {
                  setEditing(null);
                  reload();
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
