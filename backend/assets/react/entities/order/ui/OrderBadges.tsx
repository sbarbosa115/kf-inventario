import {useTranslation} from '@/shared/i18n';
import {StatusBadge} from '@/shared/ui';
import {sourceKey, statusTone} from '../model/order';

/** An order's status as a badge: its word, in its tone. */
export function OrderStatusBadge({status}: {status: number}) {
  const {t} = useTranslation();
  const {tone, filled} = statusTone(status);
  return (
    <StatusBadge tone={tone} filled={filled}>
      {t(`orders.statuses.${status}`)}
    </StatusBadge>
  );
}

const SOURCE_ICONS = {
  web: 'fa-globe',
  phone: 'fa-phone',
  unknown: 'fa-question',
} as const;

/**
 * Where an order came from: an icon and its word, or the shop connection's name (with the globe) for an order a
 * connection brought (docs/pdr/prd-shops-settings.md, Decisions 9).
 */
export function OrderSource({
  source,
  shop,
}: {
  source: number;
  shop?: {name: string} | null;
}) {
  const {t} = useTranslation();
  const key = shop ? 'web' : sourceKey(source);
  return (
    <span className="text-nowrap">
      <i className={`fas ${SOURCE_ICONS[key]}`} aria-hidden="true" />{' '}
      {shop ? shop.name : t(`orders.sources.${key}`)}
    </span>
  );
}
