import {getEmailSettings, getWebhookSettings} from '@/entities/settings';
import {useTranslation} from '@/shared/i18n';
import {useFormat, useLoad} from '@/shared/lib';
import {ErrorState, Skeleton, StatusBadge} from '@/shared/ui';

/**
 * Settings › General: facts about this installation (the time zone, where email leaves from) and the old webhook URL,
 * retired (a 410 tombstone since the legacy webhook was removed: docs/pdr/prd-shops-settings.md, "Decision (user,
 * 2026-10-06)"), with what still reached it since the deploy — any hit is a shop not re-pointed.
 */
export function GeneralSettings() {
  const {t} = useTranslation();
  const {dateTime} = useFormat();
  const email = useLoad(getEmailSettings, []);
  const webhooks = useLoad(getWebhookSettings, []);
  const legacy = webhooks.data;

  return (
    <div className="kf-settings__general">
      <section className="kf-settings__card" aria-labelledby="settings-facts">
        <h2 id="settings-facts" className="kf-settings__card-title">
          {t('settings.general.facts')}
        </h2>
        <dl className="kf-settings__facts">
          <div>
            <dt>{t('settings.general.timeZone')}</dt>
            <dd>{t('settings.general.timeZoneValue')}</dd>
          </div>
          <div>
            <dt>{t('settings.general.emailFrom')}</dt>
            <dd>
              {email.error ? (
                <ErrorState error={email.error} onRetry={email.reload} />
              ) : email.data ? (
                <>
                  {t(`settings.general.emailSource.${email.data.source.dsn}`)}
                  {email.data.source.dsn === 'env' && email.data.env_host && (
                    <span className="kf-settings__muted kf-mono">
                      {' '}
                      ({email.data.env_host})
                    </span>
                  )}
                </>
              ) : (
                <Skeleton variant="text" lines={1} />
              )}
            </dd>
          </div>
        </dl>
      </section>
      <section className="kf-settings__card" aria-labelledby="settings-legacy">
        <h2 id="settings-legacy" className="kf-settings__card-title">
          {t('settings.general.legacyTitle')}
        </h2>
        {webhooks.error ? (
          <ErrorState error={webhooks.error} onRetry={webhooks.reload} />
        ) : !legacy ? (
          <Skeleton variant="text" lines={2} />
        ) : (
          <div className="kf-settings__legacy">
            <p className="kf-settings__legacy-state">
              <StatusBadge tone="neutral">
                {t('settings.general.retired')}
              </StatusBadge>{' '}
              {t('settings.general.legacyRetired')}
            </p>
            <p className="kf-settings__muted">
              {legacy.legacy_hits > 0
                ? t('settings.general.legacyHits', {
                    count: legacy.legacy_hits,
                    date: dateTime(legacy.legacy_last_hit_at),
                  })
                : t('settings.general.legacyNoHits')}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
