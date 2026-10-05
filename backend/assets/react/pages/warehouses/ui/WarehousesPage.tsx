import {useTranslation} from '@/shared/i18n';
import {LegacyScreen} from '@/shared/ui';

/** Until item 7 builds this screen: a link to its legacy page (docs/pdr/prd-restructure.md). */
export function WarehousesPage() {
  const {t} = useTranslation();
  return (
    <LegacyScreen title={t('nav.warehouses')} href={'/admin/warehouse/'} />
  );
}
