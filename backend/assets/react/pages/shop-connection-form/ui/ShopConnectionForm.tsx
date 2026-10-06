import {useEffect, useRef, useState, type FormEvent} from 'react';
import {useNavigate} from 'react-router-dom';
import {
  createShop,
  testShop,
  updateShop,
  type ShopConnection,
  type ShopConnectionPayload,
  type ShopTestPayload,
  type ShopTestResult,
} from '@/entities/shop-connection';
import {listWarehouses} from '@/entities/warehouse';
import {TestResultCard} from '@/features/test-shop-connection';
import {ApiError, failureMessage} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {useLoad} from '@/shared/lib';
import {
  ActionBar,
  Button,
  Field,
  FormLayout,
  FormSection,
  PasswordField,
  useToast,
} from '@/shared/ui';
import {Switch} from './Switch';
import {WebhookBlock} from './WebhookBlock';

interface Values {
  name: string;
  site_url: string;
  consumer_key: string;
  consumer_secret: string;
  warehouse_id: string;
  email_printer: boolean;
  active: boolean;
  order_status: boolean;
  order_note: boolean;
}

type Errors = Partial<Record<keyof Values, string>>;

function toValues(shop?: ShopConnection): Values {
  return {
    name: shop?.name ?? '',
    site_url: shop?.site_url ?? '',
    consumer_key: '',
    consumer_secret: '',
    warehouse_id: shop ? String(shop.warehouse.id) : '',
    email_printer: shop?.email_printer ?? false,
    active: shop?.active ?? true,
    order_status: shop?.capabilities.order_status ?? false,
    order_note: shop?.capabilities.order_note ?? false,
  };
}

/** What the API takes: blank keys are left out, so an edit keeps the saved ones. */
function toPayload(values: Values): ShopConnectionPayload {
  const key = values.consumer_key.trim();
  const secret = values.consumer_secret.trim();
  return {
    name: values.name.trim(),
    site_url: values.site_url.trim(),
    ...(key === '' ? {} : {consumer_key: key}),
    ...(secret === '' ? {} : {consumer_secret: secret}),
    warehouse_id: Number(values.warehouse_id),
    email_printer: values.email_printer,
    active: values.active,
    capabilities: {
      order_status: values.order_status,
      order_note: values.order_note,
    },
  };
}

/** The API's refusals, under the field they are about. */
const FIELD_OF_ERROR: Record<string, keyof Values> = {
  shop_url_invalid: 'site_url',
  shop_url_taken: 'site_url',
  shop_name_taken: 'name',
  warehouse_not_found: 'warehouse_id',
};

/**
 * A shop connection's form (docs/pdr/prd-shops-settings.md, "Screen proposals" 3): the shop (name, site URL,
 * active), its REST keys (blank keeps the saved ones), the warehouse its orders land in and the printer email, what
 * the app may update on the shop, and — once saved — its webhook to paste. "Test connection" tries the URL and keys as
 * typed (blank: the saved ones), so a new connection is saved first. After a create the page becomes the connection's,
 * showing the secret the create answered.
 */
export function ShopConnectionForm({
  shop,
  initialSecret,
}: {
  shop?: ShopConnection;
  initialSecret?: string | null;
}) {
  const {t} = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const warehouses = useLoad(listWarehouses, []);
  const [saved, setSaved] = useState(shop);
  const [values, setValues] = useState(() => toValues(shop));
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<ShopTestResult | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  // The result lands at the end of the form: bring it into view (Test is pressed in the sticky action bar).
  useEffect(() => {
    if (result) resultRef.current?.scrollIntoView?.({block: 'nearest'});
  }, [result]);

  const set = <K extends keyof Values>(key: K, value: Values[K]) =>
    setValues((now) => ({...now, [key]: value}));

  const validate = (): Errors => {
    const found: Errors = {};
    if (values.name.trim() === '') found.name = t('shops.form.required');
    if (values.site_url.trim() === '') {
      found.site_url = t('shops.form.required');
    }
    if (values.warehouse_id === '') {
      found.warehouse_id = t('shops.form.warehouseRequired');
    }
    return found;
  };

  const refused = (error: unknown): boolean => {
    if (!(error instanceof ApiError)) return false;
    if (error.status === 422 && error.code === 'validation_failed') {
      const violations =
        (error.body as {violations?: {field: string; message: string}[]})
          ?.violations ?? [];
      const found: Errors = {};
      for (const {field, message} of violations) {
        const key = field as keyof Values;
        if (key in values) found[key] ??= message;
      }
      setErrors(found);
      return Object.keys(found).length > 0;
    }
    const field = FIELD_OF_ERROR[error.code];
    if (!field) return false;
    const reason = (error.body as {detail?: {reason?: string}} | null)?.detail
      ?.reason;
    setErrors({
      [field]:
        error.code === 'shop_url_invalid' && reason
          ? reason
          : t(`shops.errors.${error.code}`),
    });
    return true;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    try {
      const payload = toPayload(values);
      if (saved === undefined) {
        const created = await createShop(payload);
        toast.success(t('shops.form.created', {name: created.name}));
        navigate(`/admin/settings/shops/${created.id}`, {
          replace: true,
          state: {secret: created.webhook_secret ?? null},
        });
        return;
      }
      const answer = await updateShop(saved.id, payload);
      setSaved(answer);
      setValues(toValues(answer));
      toast.success(t('shops.form.saved', {name: answer.name}));
    } catch (error) {
      if (!refused(error)) {
        if (error instanceof ApiError && error.code === 'shop_not_found') {
          toast.error(t('shops.errors.shop_not_found'));
        } else {
          toast.error(failureMessage(error, t));
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    if (saved === undefined) return;
    setTesting(true);
    setResult(null);
    const typed: ShopTestPayload = {site_url: values.site_url.trim()};
    const key = values.consumer_key.trim();
    const secret = values.consumer_secret.trim();
    if (key !== '') typed.consumer_key = key;
    if (secret !== '') typed.consumer_secret = secret;
    try {
      setResult(await testShop(saved.id, typed));
    } catch (error) {
      toast.error(failureMessage(error, t));
    } finally {
      setTesting(false);
    }
  };

  return (
    <FormLayout
      columns={2}
      onSubmit={(event) => void submit(event)}
      label={saved ? t('shops.form.editTitle') : t('shops.form.newTitle')}
    >
      <FormSection title={t('shops.form.sections.shop')}>
        <Field label={t('shops.form.name')} error={errors.name}>
          <input
            type="text"
            maxLength={100}
            autoComplete="off"
            value={values.name}
            onChange={(event) => set('name', event.target.value)}
          />
        </Field>
        <Field
          label={t('shops.form.siteUrl')}
          hint={t('shops.form.siteUrlHint')}
          error={errors.site_url}
        >
          <input
            type="url"
            inputMode="url"
            maxLength={255}
            autoComplete="off"
            spellCheck={false}
            className="form-control kf-mono"
            value={values.site_url}
            onChange={(event) => set('site_url', event.target.value)}
          />
        </Field>
        <Switch
          label={t('shops.form.active')}
          help={t('shops.form.activeHint')}
          checked={values.active}
          onChange={(on) => set('active', on)}
        />
      </FormSection>
      <FormSection
        title={t('shops.form.sections.rest')}
        description={t('shops.form.restHelp')}
      >
        <PasswordField
          label={t('shops.form.consumerKey')}
          value={values.consumer_key}
          onChange={(value) => set('consumer_key', value)}
          autoComplete="off"
          error={errors.consumer_key}
        />
        <PasswordField
          label={t('shops.form.consumerSecret')}
          value={values.consumer_secret}
          onChange={(value) => set('consumer_secret', value)}
          autoComplete="off"
          error={errors.consumer_secret}
        />
        {saved && (
          <p className="kf-shop-form__note">
            <i
              className={`fas ${saved.has_keys ? 'fa-key' : 'fa-exclamation-triangle'}`}
              aria-hidden="true"
            />{' '}
            {saved.has_keys
              ? t('shops.form.keysSaved')
              : t('shops.form.noKeys')}
          </p>
        )}
      </FormSection>
      <FormSection title={t('shops.form.sections.orders')}>
        <Field
          label={t('shops.form.warehouse')}
          hint={t('shops.form.warehouseHint')}
          error={errors.warehouse_id}
        >
          <select
            className="custom-select"
            value={values.warehouse_id}
            onChange={(event) => set('warehouse_id', event.target.value)}
          >
            <option value="">{t('shops.form.chooseWarehouse')}</option>
            {(warehouses.data ?? []).map((warehouse) => (
              <option key={warehouse.id} value={String(warehouse.id)}>
                {warehouse.name}
              </option>
            ))}
          </select>
        </Field>
        <Switch
          label={t('shops.form.emailPrinter')}
          help={t('shops.form.emailPrinterHint')}
          checked={values.email_printer}
          onChange={(on) => set('email_printer', on)}
        />
      </FormSection>
      <FormSection title={t('shops.form.sections.capabilities')}>
        <Switch
          label={t('shops.form.orderStatus')}
          help={t('shops.form.orderStatusHint')}
          checked={values.order_status}
          onChange={(on) => set('order_status', on)}
        />
        <Switch
          label={t('shops.form.orderNote')}
          help={t('shops.form.orderNoteHint')}
          checked={values.order_note}
          onChange={(on) => set('order_note', on)}
        />
      </FormSection>
      {saved && <WebhookBlock shop={saved} initialSecret={initialSecret} />}
      {result && (
        <div
          className="kf-shop-form__result"
          aria-live="polite"
          ref={resultRef}
        >
          <TestResultCard result={result} />
        </div>
      )}
      <ActionBar
        status={saved ? undefined : t('shops.form.testFirst')}
        primary={
          <Button type="submit" variant="primary" loading={busy}>
            {busy ? t('shops.form.saving') : t('shops.form.save')}
          </Button>
        }
        secondary={
          <>
            <Button variant="ghost" to="/admin/settings/shops">
              {t('common.cancel')}
            </Button>
            <Button
              icon="fa-plug"
              loading={testing}
              disabled={saved === undefined}
              onClick={() => void test()}
            >
              {testing ? t('shops.test.running') : t('shops.test.button')}
            </Button>
          </>
        }
      />
    </FormLayout>
  );
}
