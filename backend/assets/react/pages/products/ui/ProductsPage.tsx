import {useTranslation} from '@/shared/i18n';
import {LegacyScreen} from '@/shared/ui';

/** Until item 6 builds this screen: a link to its legacy page (docs/pdr/prd-restructure.md). */
export function ProductsPage() {
  const {t} = useTranslation();
  return <LegacyScreen title={t('nav.productList')} href={'/admin/product/'} />;
}
