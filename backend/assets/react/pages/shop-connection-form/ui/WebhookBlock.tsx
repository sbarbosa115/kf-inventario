import {useState} from 'react';
import {
  getWebhookSecret,
  rotateWebhookSecret,
  type ShopConnection,
} from '@/entities/shop-connection';
import {failureMessage} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {Button, ConfirmModal, FormSection, useToast} from '@/shared/ui';
import {CopyField, useCopy} from './CopyField';

/**
 * The connection's webhook, to paste in WooCommerce: its URL and its signing secret, each with Copy. The secret is
 * hidden until asked for (read again from the server), except right after the connection was created, when the
 * create answer's secret is shown at once. "Rotate secret" makes a new one after asking: deliveries signed with the
 * old one are refused from then on.
 */
export function WebhookBlock({
  shop,
  initialSecret,
}: {
  shop: ShopConnection;
  initialSecret?: string | null;
}) {
  const {t} = useTranslation();
  const toast = useToast();
  const copy = useCopy();
  const [secret, setSecret] = useState<string | null>(initialSecret ?? null);
  const [url, setUrl] = useState(shop.webhook_url);
  const [shown, setShown] = useState(Boolean(initialSecret));
  const [rotating, setRotating] = useState(false);
  const [busy, setBusy] = useState(false);

  const read = async (): Promise<string | null> => {
    if (secret !== null) return secret;
    setBusy(true);
    try {
      const answer = await getWebhookSecret(shop.id);
      setSecret(answer.webhook_secret);
      setUrl(answer.webhook_url);
      return answer.webhook_secret;
    } catch (error) {
      toast.error(failureMessage(error, t));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const toggle = async () => {
    if (shown) {
      setShown(false);
      return;
    }
    if ((await read()) !== null) setShown(true);
  };

  const copySecret = async () => {
    const value = await read();
    if (value !== null) await copy(value);
  };

  const rotate = async () => {
    setBusy(true);
    try {
      const answer = await rotateWebhookSecret(shop.id);
      setSecret(answer.webhook_secret);
      setUrl(answer.webhook_url);
      setShown(true);
      toast.success(t('shops.webhook.rotated'));
    } catch (error) {
      toast.error(failureMessage(error, t));
    } finally {
      setBusy(false);
      setRotating(false);
    }
  };

  return (
    <FormSection
      title={t('shops.form.sections.webhook')}
      description={t('shops.webhook.steps')}
    >
      <CopyField
        label={t('shops.webhook.url')}
        value={url}
        copyLabel={t('shops.webhook.copyUrl')}
        onCopy={() => void copy(url)}
      />
      <CopyField
        label={t('shops.webhook.secret')}
        value={shown && secret !== null ? secret : ''}
        placeholder="••••••••••••••••"
        copyLabel={t('shops.webhook.copySecret')}
        onCopy={() => void copySecret()}
        hint={initialSecret ? t('shops.webhook.newSecret') : undefined}
        extra={
          <Button
            icon={shown ? 'fa-eye-slash' : 'fa-eye'}
            aria-label={
              shown ? t('shops.webhook.hide') : t('shops.webhook.show')
            }
            aria-pressed={shown}
            loading={busy && !rotating}
            onClick={() => void toggle()}
          />
        }
      />
      <div>
        <Button icon="fa-redo" onClick={() => setRotating(true)}>
          {t('shops.webhook.rotate')}
        </Button>
      </div>
      {rotating && (
        <ConfirmModal
          title={t('shops.webhook.rotateTitle')}
          confirmLabel={t('shops.webhook.rotate')}
          busy={busy}
          onConfirm={() => void rotate()}
          onCancel={() => setRotating(false)}
        >
          {t('shops.webhook.rotateBody')}
        </ConfirmModal>
      )}
    </FormSection>
  );
}
