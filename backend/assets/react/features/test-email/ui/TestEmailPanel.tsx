import {useState, type FormEvent} from 'react';
import {sendTestEmail} from '@/entities/settings';
import {ApiError, failureMessage} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {Button, Field, SlideOver} from '@/shared/ui';

type Outcome =
  {kind: 'sent'; host: string | null} | {kind: 'failed'; message: string};

const isAddress = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

/**
 * "Send test email" (Settings › Email): a centred panel asking where to send it, with the result inline. The send is
 * synchronous on the server, so a refusal of the SMTP server comes back as its own words (502 `smtp_failed`,
 * `detail.reason`), and a second try within 10 s as 429 `test_email_too_soon`.
 */
export function TestEmailPanel({
  defaultTo,
  onClose,
}: {
  defaultTo: string;
  onClose: () => void;
}) {
  const {t} = useTranslation();
  const [to, setTo] = useState(defaultTo);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [busy, setBusy] = useState(false);

  const send = async (event?: FormEvent) => {
    event?.preventDefault();
    setOutcome(null);
    const address = to.trim();
    if (!isAddress(address)) {
      setFieldError(t('settings.test.invalidAddress'));
      return;
    }
    setFieldError(null);
    setBusy(true);
    try {
      const result = await sendTestEmail(address);
      setOutcome({kind: 'sent', host: result.host ?? null});
    } catch (error) {
      setOutcome({kind: 'failed', message: describe(error)});
      if (error instanceof ApiError && error.status === 422) {
        const first = (error.body as {violations?: {message: string}[]} | null)
          ?.violations?.[0];
        if (first) {
          setFieldError(first.message);
          setOutcome(null);
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const describe = (error: unknown): string => {
    if (error instanceof ApiError && error.code === 'smtp_failed') {
      const reason = (error.body as {detail?: {reason?: string}} | null)?.detail
        ?.reason;
      return reason
        ? t('settings.test.failed', {reason})
        : t('settings.test.failedNoReason');
    }
    if (error instanceof ApiError && error.status === 429) {
      return t('settings.test.tooSoon');
    }
    return failureMessage(error, t);
  };

  return (
    <SlideOver
      title={t('settings.test.title')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('settings.test.close')}
          </Button>
          <Button
            variant="primary"
            icon="fa-paper-plane"
            loading={busy}
            onClick={() => void send()}
          >
            {t('settings.test.send')}
          </Button>
        </>
      }
    >
      <form onSubmit={send} noValidate>
        <p className="kf-settings__muted">{t('settings.test.intro')}</p>
        <Field label={t('settings.test.to')} error={fieldError}>
          <input
            type="email"
            className="form-control"
            value={to}
            autoComplete="email"
            onChange={(event) => setTo(event.target.value)}
          />
        </Field>
        <div aria-live="polite">
          {outcome?.kind === 'sent' && (
            <div className="alert alert-success" role="status">
              {outcome.host
                ? t('settings.test.sent', {host: outcome.host})
                : t('settings.test.sentNoHost')}
            </div>
          )}
          {outcome?.kind === 'failed' && (
            <div className="alert alert-danger" role="alert">
              {outcome.message}
            </div>
          )}
        </div>
      </form>
    </SlideOver>
  );
}
