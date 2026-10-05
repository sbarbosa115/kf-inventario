import {listWarehouses} from '@/entities/warehouse';
import {ScanStock} from '@/features/scan-stock';
import {useTranslation} from '@/shared/i18n';
import {useLoad, useSound} from '@/shared/lib';
import {Button, EmptyState, ErrorState, PageHeader, Skeleton} from '@/shared/ui';

/** The scan sound (a short tone per read), on or off, remembered per browser. */
function SoundToggle() {
  const {t} = useTranslation();
  const [on, setOn] = useSound();
  return (
    <Button
      variant="ghost"
      icon={on ? 'fa-volume-up' : 'fa-volume-mute'}
      aria-label={t('stock.scan.sound')}
      aria-pressed={on}
      onClick={() => setOn(!on)}
    />
  );
}

/** Scan stock: choose the warehouse and Add or Remove, scan, and send the list (ROLE_MANAGE_INVENTORY). */
export function BarcodeReaderPage() {
  const {t} = useTranslation();
  const {data, error, reload} = useLoad(listWarehouses, []);

  return (
    <>
      <PageHeader
        title={t('stock.scan.title')}
        subtitle={t('stock.scan.subtitle')}
        primary={<SoundToggle />}
      />
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : data === undefined ? (
        <Skeleton variant="form" />
      ) : data.length === 0 ? (
        <EmptyState icon="fa-warehouse" message={t('stock.warehouse.none')} />
      ) : (
        <ScanStock warehouses={data} />
      )}
    </>
  );
}
