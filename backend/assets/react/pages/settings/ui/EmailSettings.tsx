import {useState, type FormEvent} from 'react';
import {
  getEmailSettings,
  saveEmailSettings,
  type EmailSettings as EmailSettingsData,
  type EmailSettingsPayload,
} from '@/entities/settings';
import {useSession} from '@/entities/session';
import {TestEmailPanel} from '@/features/test-email';
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
  PasswordField,
  Skeleton,
  useToast,
} from '@/shared/ui';
import {isEmailAddress, violationMessages} from '../lib/violations';
import {EmailSettingsCc} from './EmailSettingsCc';

interface Values {
  host: string;
  port: string;
  user: string;
  password: string;
  encryption: 'tls' | 'ssl' | 'none';
  from_address: string;
  from_name: string;
  printer_address: string;
  cc: string[];
}

const ENCRYPTIONS = ['tls', 'ssl', 'none'] as const;

function toValues(data: EmailSettingsData): Values {
  return {
    host: data.dsn_host ?? '',
    port: data.dsn_port ? String(data.dsn_port) : '',
    user: data.dsn_user ?? '',
    password: '',
    encryption: (ENCRYPTIONS as readonly string[]).includes(data.encryption)
      ? (data.encryption as Values['encryption'])
      : 'tls',
    from_address: data.from_address ?? '',
    from_name: data.from_name ?? '',
    printer_address: data.printer_address ?? '',
    cc: data.cc,
  };
}

function toPayload(values: Values): EmailSettingsPayload {
  const port = values.port.trim();
  return {
    host: values.host.trim(),
    port: port === '' ? null : Number(port),
    user: values.user.trim(),
    // A blank password is not sent: the server keeps the stored one (while the host stays the same).
    ...(values.password === '' ? {} : {password: values.password}),
    encryption: values.encryption,
    from_address: values.from_address.trim(),
    from_name: values.from_name.trim(),
    printer_address: values.printer_address.trim(),
    cc: values.cc,
  };
}

/** Settings › Email: the SMTP server and the sender/printer/cc of the order email, each with the source it comes from. */
export function EmailSettings() {
  const email = useLoad(getEmailSettings, []);
  if (email.error) {
    return <ErrorState error={email.error} onRetry={email.reload} />;
  }
  if (!email.data) return <Skeleton variant="form" />;
  return <EmailForm initial={email.data} />;
}

function EmailForm({initial}: {initial: EmailSettingsData}) {
  const {t} = useTranslation();
  const toast = useToast();
  const {session} = useSession();
  const [saved, setSaved] = useState(initial);
  const [values, setValues] = useState(() => toValues(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);

  const set = <K extends keyof Values>(key: K, value: Values[K]) =>
    setValues((now) => ({...now, [key]: value}));

  const hostChanged = values.host.trim() !== (saved.dsn_host ?? '');
  const passwordHint =
    values.password !== ''
      ? t('settings.email.passwordNew')
      : saved.has_password
        ? hostChanged
          ? t('settings.email.passwordHostChanged')
          : t('settings.email.passwordKeep')
        : t('settings.email.passwordNew');
  const sourceLabel = (source: string) => t(`settings.email.source.${source}`);

  const validate = (): Record<string, string> => {
    const found: Record<string, string> = {};
    const port = values.port.trim();
    if (port !== '' && !(/^\d+$/.test(port) && +port >= 1 && +port <= 65535)) {
      found.port = t('settings.email.invalidPort');
    }
    if (/[:/\s]/.test(values.host.trim())) {
      found.host = t('settings.email.hostWithPort');
    }
    for (const key of ['from_address', 'printer_address'] as const) {
      const value = values[key].trim();
      if (value !== '' && !isEmailAddress(value)) {
        found[key] = t('settings.email.invalidAddress');
      }
    }
    return found;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFailure(null);
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    try {
      const answer = await saveEmailSettings(toPayload(values));
      setSaved(answer);
      setValues(toValues(answer));
      toast.success(t('settings.email.saved'));
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
    <>
      <FormLayout narrow onSubmit={submit} label={t('settings.tabs.email')}>
        {failure && (
          <div className="alert alert-danger" role="alert">
            {failure}
          </div>
        )}
        <FormSection
          title={t('settings.email.smtpTitle')}
          description={t('settings.email.smtpHint')}
        >
          <p className="kf-settings__muted kf-settings__source-note">
            {saved.source.dsn === 'env' &&
              (saved.env_host
                ? t('settings.email.envNoteHost', {host: saved.env_host})
                : t('settings.email.envNote'))}
            {saved.source.dsn === 'none' && t('settings.email.noneNote')}
          </p>
          <div className="form-row">
            <div className="col-md-8">
              <Field label={t('settings.email.host')} error={errors.host}>
                <input
                  className="form-control"
                  value={values.host}
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  placeholder="smtp.example.com"
                  onChange={(event) => set('host', event.target.value)}
                />
              </Field>
            </div>
            <div className="col-md-4">
              <Field label={t('settings.email.port')} error={errors.port}>
                <input
                  type="number"
                  className="form-control"
                  value={values.port}
                  min={1}
                  max={65535}
                  inputMode="numeric"
                  placeholder="587"
                  onChange={(event) => set('port', event.target.value)}
                />
              </Field>
            </div>
          </div>
          <Field label={t('settings.email.user')} error={errors.user}>
            <input
              className="form-control"
              value={values.user}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              onChange={(event) => set('user', event.target.value)}
            />
          </Field>
          <PasswordField
            label={t('settings.email.password')}
            value={values.password}
            autoComplete="new-password"
            error={errors.password}
            onChange={(value) => set('password', value)}
          />
          <small className="form-text kf-settings__password-hint">
            {saved.has_password && (
              <>
                <strong>{t('settings.email.passwordSaved')}</strong>
                {'. '}
              </>
            )}
            {passwordHint}
          </small>
          <Field
            label={t('settings.email.encryption')}
            error={errors.encryption}
          >
            <select
              className="form-control"
              value={values.encryption}
              onChange={(event) =>
                set('encryption', event.target.value as Values['encryption'])
              }
            >
              {ENCRYPTIONS.map((option) => (
                <option key={option} value={option}>
                  {t(`settings.email.encryptionOptions.${option}`)}
                </option>
              ))}
            </select>
          </Field>
        </FormSection>
        <FormSection
          title={t('settings.email.senderTitle')}
          description={t('settings.email.senderHint')}
        >
          <Field
            label={t('settings.email.fromAddress')}
            error={errors.from_address}
            hint={sourceLabel(saved.source.from)}
          >
            <input
              type="email"
              className="form-control"
              value={values.from_address}
              autoComplete="off"
              onChange={(event) => set('from_address', event.target.value)}
            />
          </Field>
          <Field label={t('settings.email.fromName')} error={errors.from_name}>
            <input
              className="form-control"
              value={values.from_name}
              autoComplete="off"
              onChange={(event) => set('from_name', event.target.value)}
            />
          </Field>
          <Field
            label={t('settings.email.printerAddress')}
            error={errors.printer_address}
            hint={sourceLabel(saved.source.printer)}
          >
            <input
              type="email"
              className="form-control"
              value={values.printer_address}
              autoComplete="off"
              onChange={(event) => set('printer_address', event.target.value)}
            />
          </Field>
          <EmailSettingsCc
            label={t('settings.email.cc')}
            value={values.cc}
            error={errors.cc}
            hint={sourceLabel(saved.source.cc)}
            onChange={(next) => set('cc', next)}
          />
        </FormSection>
        <ActionBar
          secondary={
            <Button icon="fa-paper-plane" onClick={() => setTesting(true)}>
              {t('settings.email.sendTest')}
            </Button>
          }
          primary={
            <Button type="submit" variant="primary" loading={busy}>
              {t('settings.email.save')}
            </Button>
          }
        />
      </FormLayout>
      {testing && (
        <TestEmailPanel
          defaultTo={session?.email ?? ''}
          onClose={() => setTesting(false)}
        />
      )}
    </>
  );
}
