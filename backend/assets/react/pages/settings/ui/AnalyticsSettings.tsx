import {useState, type FormEvent} from 'react';
import {
  getAnalyticsSettings,
  saveAnalyticsSettings,
  type AnalyticsSettings as AnalyticsData,
} from '@/entities/settings';
import {ApiError, failureMessage} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {useLoad} from '@/shared/lib';
import {
  ActionBar,
  Button,
  ErrorState,
  Field,
  FormLayout,
  FormSection,
  Skeleton,
  useToast,
} from '@/shared/ui';
import {violationMessages} from '../lib/violations';

// The shapes the API checks on save (docs/pdr/prd-shops-settings.md, "Settings"): the same ones the loader requires.
const GA4 = /^G-[A-Z0-9]{4,12}$/;
const CLARITY = /^[a-z0-9]{6,20}$/;

/** Settings › Analytics: the GA4 Measurement ID and the Clarity Project ID; empty turns that tool off. */
export function AnalyticsSettings() {
  const analytics = useLoad(getAnalyticsSettings, []);
  if (analytics.error) {
    return <ErrorState error={analytics.error} onRetry={analytics.reload} />;
  }
  if (!analytics.data) return <Skeleton variant="form" />;
  return <AnalyticsForm initial={analytics.data} />;
}

function AnalyticsForm({initial}: {initial: AnalyticsData}) {
  const {t} = useTranslation();
  const toast = useToast();
  const [ga4, setGa4] = useState(initial.ga4_measurement_id ?? '');
  const [clarity, setClarity] = useState(initial.clarity_project_id ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFailure(null);
    const ga4Id = ga4.trim();
    const clarityId = clarity.trim();
    const found: Record<string, string> = {};
    if (ga4Id !== '' && !GA4.test(ga4Id)) {
      found.ga4_measurement_id = t('settings.analytics.invalidGa4');
    }
    if (clarityId !== '' && !CLARITY.test(clarityId)) {
      found.clarity_project_id = t('settings.analytics.invalidClarity');
    }
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    try {
      const answer = await saveAnalyticsSettings({
        ga4_measurement_id: ga4Id,
        clarity_project_id: clarityId,
      });
      setGa4(answer.ga4_measurement_id ?? '');
      setClarity(answer.clarity_project_id ?? '');
      toast.success(t('settings.analytics.saved'));
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) {
        setErrors(violationMessages(error.body));
        setFailure(t('errors.validation_failed'));
      } else if (error instanceof ApiError && error.status === 403) {
        setFailure(t('errors.forbidden'));
      } else {
        setFailure(failureMessage(error, t));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormLayout narrow onSubmit={submit} label={t('settings.tabs.analytics')}>
      {failure && (
        <div className="alert alert-danger" role="alert">
          {failure}
        </div>
      )}
      <FormSection title={t('settings.tabs.analytics')}>
        <p className="kf-settings__muted">
          <i className="fas fa-circle-info" aria-hidden="true" />{' '}
          {t('settings.analytics.status')}
        </p>
        <Field
          label={t('settings.analytics.ga4')}
          hint={t('settings.analytics.ga4Hint')}
          error={errors.ga4_measurement_id}
        >
          <input
            className="form-control kf-mono"
            value={ga4}
            placeholder="G-XXXXXXX"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            onChange={(event) => setGa4(event.target.value)}
          />
        </Field>
        <Field
          label={t('settings.analytics.clarity')}
          hint={t('settings.analytics.clarityHint')}
          error={errors.clarity_project_id}
        >
          <input
            className="form-control kf-mono"
            value={clarity}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            onChange={(event) => setClarity(event.target.value)}
          />
        </Field>
      </FormSection>
      <ActionBar
        primary={
          <Button type="submit" variant="primary" loading={busy}>
            {t('settings.analytics.save')}
          </Button>
        }
      />
    </FormLayout>
  );
}
