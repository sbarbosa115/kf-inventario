import {useTranslation} from '@/shared/i18n';
import {PageCard} from './PageCard';

/**
 * A screen the restructure has not moved yet: it sends the person to its legacy Twig page. Each page slice's item
 * replaces it (docs/pdr/prd-restructure.md).
 */
export function LegacyScreen({title, href}: {title: string; href: string}) {
  const {t} = useTranslation();
  return (
    <PageCard title={title}>
      <p className="font-weight-bold mb-1">{t('common.legacy.title')}</p>
      <p>{t('common.legacy.body')}</p>
      <a className="btn btn-primary" href={href}>
        {t('common.legacy.open')}
      </a>
    </PageCard>
  );
}
