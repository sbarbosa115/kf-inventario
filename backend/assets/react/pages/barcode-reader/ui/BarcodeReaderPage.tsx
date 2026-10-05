import {useTranslation} from '@/shared/i18n';
import {LegacyScreen} from '@/shared/ui';

/** Until item 7 builds this screen: a link to its legacy page (docs/pdr/prd-restructure.md). */
export function BarcodeReaderPage() {
  const {t} = useTranslation();
  return (
    <LegacyScreen
      title={t('nav.barcode')}
      href={'/admin/product/update/bar-code'}
    />
  );
}
