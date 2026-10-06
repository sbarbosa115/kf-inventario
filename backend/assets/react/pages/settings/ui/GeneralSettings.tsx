import {useState} from 'react';
import {
  getEmailSettings,
  getWebhookSettings,
  saveWebhookSettings,
  type WebhookSettings,
} from '@/entities/settings';
import {failureMessage} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {useFormat, useLoad} from '@/shared/lib';
import {
  Button,
  ConfirmModal,
  ErrorState,
  Skeleton,
  StatusBadge,
  useToast,
} from '@/shared/ui';

/**
 * Settings › General: facts about this installation (the time zone, where email leaves from) and the switch of the
 * legacy webhook URL, with what reached it since it was turned off (docs/pdr/prd-shops-settings.md, Decisions 8).
 */
export function GeneralSettings() {
  const {t} = useTranslation();
  const {dateTime} = useFormat();
  const toast = useToast();
  const email = useLoad(getEmailSettings, []);
  const webhooks = useLoad(getWebhookSettings, []);
  const [saved, setSaved] = useState<WebhookSettings | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const legacy = saved ?? webhooks.data;

  const save = async (enabled: boolean) => {
    setBusy(true);
    try {
      setSaved(await saveWebhookSettings(enabled));
      toast.success(
        t(enabled ? 'settings.general.turnedOn' : 'settings.general.turnedOff'),
      );
    } catch (error) {
      toast.error(failureMessage(error, t));
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

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
              <StatusBadge tone={legacy.legacy_enabled ? 'accent' : 'neutral'}>
                {legacy.legacy_enabled
                  ? t('settings.general.on')
                  : t('settings.general.off')}
              </StatusBadge>{' '}
              {t(
                legacy.legacy_enabled
                  ? 'settings.general.legacyOn'
                  : 'settings.general.legacyOff',
              )}
            </p>
            {!legacy.legacy_enabled && (
              <p className="kf-settings__muted">
                {legacy.legacy_hits_since > 0
                  ? t('settings.general.legacyHits', {
                      count: legacy.legacy_hits_since,
                      date: dateTime(legacy.legacy_last_hit_at),
                    })
                  : t('settings.general.legacyNoHits')}
              </p>
            )}
            {legacy.legacy_enabled ? (
              <Button
                variant="danger"
                icon="fa-power-off"
                loading={busy}
                onClick={() => setConfirming(true)}
              >
                {t('settings.general.turnOff')}
              </Button>
            ) : (
              <Button loading={busy} onClick={() => save(true)}>
                {t('settings.general.turnOn')}
              </Button>
            )}
          </div>
        )}
      </section>
      {confirming && (
        <ConfirmModal
          title={t('settings.general.confirmOffTitle')}
          confirmLabel={t('settings.general.turnOff')}
          danger
          busy={busy}
          onConfirm={() => save(false)}
          onCancel={() => setConfirming(false)}
        >
          {t('settings.general.confirmOffBody')}
        </ConfirmModal>
      )}
    </div>
  );
}
