import {useTranslation} from '@/shared/i18n';

export type SkeletonVariant = 'text' | 'row' | 'card' | 'form' | 'kpi';

/** The shape of what is loading, instead of a spinner. Announced once as "Loading". */
export function Skeleton({
  variant = 'text',
  lines = 3,
}: {
  variant?: SkeletonVariant;
  lines?: number;
}) {
  const {t} = useTranslation();
  return (
    <div className={`kf-skeleton kf-skeleton--${variant}`} role="status">
      <span className="sr-only">{t('common.loading')}</span>
      {Array.from({length: lines}, (_, i) => (
        <span key={i} className="kf-skeleton__block" aria-hidden="true" />
      ))}
    </div>
  );
}
