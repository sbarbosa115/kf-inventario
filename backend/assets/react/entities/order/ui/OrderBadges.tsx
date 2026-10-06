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

/** Where an order came from: an icon and its word. */
export function OrderSource({source}: {source: number}) {
  const {t} = useTranslation();
  const key = sourceKey(source);
  return (
    <span className="text-nowrap">
      <i className={`fas ${SOURCE_ICONS[key]}`} aria-hidden="true" />{' '}
      {t(`orders.sources.${key}`)}
    </span>
  );
}
