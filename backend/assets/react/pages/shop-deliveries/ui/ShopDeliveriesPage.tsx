import {useTranslation} from '@/shared/i18n';
import {EmptyState, PageHeader} from '@/shared/ui';

/**
 * A connection's failed deliveries (/admin/settings/shops/:id/deliveries). Shops-settings' item 6 builds it; the route
 * exists from item 0 so that item 6 does not touch the router.
 */
export function ShopDeliveriesPage() {
  const {t} = useTranslation();
  return (
    <>
      <PageHeader
        title={t('settings.tabs.shops')}
        back="/admin/settings/shops"
      />
      <EmptyState icon="fa-person-digging" message={t('settings.pending')} />
    </>
  );
}
