import {useId, useState, type FormEvent} from 'react';
import {useNavigate} from 'react-router-dom';
import {
  createProduct,
  emptyProductForm,
  productFormToPayload,
  productToForm,
  updateProduct,
  validateProductForm,
  violationsToErrors,
  type Product,
  type ProductFormErrors,
  type ProductFormValues,
} from '@/entities/product';
import {ApiError, failureMessage} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {
  ActionBar,
  Button,
  Field,
  FormLayout,
  FormSection,
  useToast,
} from '@/shared/ui';
import './product-form.css';

/** The product's fields, in one section with its status last. Without `product` it creates one. */
export function ProductForm({product}: {product?: Product}) {
  const {t} = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const statusId = useId();
  const [values, setValues] = useState<ProductFormValues>(() =>
    product ? productToForm(product) : emptyProductForm(),
  );
  const [errors, setErrors] = useState<ProductFormErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof ProductFormValues>(
    key: K,
    value: ProductFormValues[K],
  ) => setValues((now) => ({...now, [key]: value}));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFailure(null);
    const found = validateProductForm(values, t);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    try {
      const payload = productFormToPayload(values);
      if (product) {
        await updateProduct(product.uuid, payload);
      } else {
        await createProduct(payload);
      }
      navigate('/admin/products');
      toast.success(
        t('products.form.saved'),
        product
          ? undefined
          : {
              action: {
                label: t('products.form.scanStock'),
                href: '/admin/products/barcode',
              },
            },
      );
      if (!product) {
        toast.success(t('products.form.nextUpload'), {
          action: {
            label: t('products.form.uploadSheet'),
            href: '/admin/products/upload',
          },
        });
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) {
        setErrors(violationsToErrors(error.body));
      } else if (error instanceof ApiError && error.status === 403) {
        setFailure(t('errors.forbidden'));
      } else if (error instanceof ApiError && error.status === 404) {
        setFailure(t('products.notFound'));
      } else {
        setFailure(failureMessage(error, t));
      }
      setBusy(false);
    }
  };

  return (
    <FormLayout narrow onSubmit={submit}>
      {failure && (
        <div className="alert alert-danger" role="alert">
          {failure}
        </div>
      )}
      <FormSection
        title={t('products.form.section')}
        description={t('products.form.sectionHelp')}
      >
        <Field label={t('products.form.code')} error={errors.code}>
          <input
            className="form-control kf-mono"
            value={values.code}
            maxLength={255}
            autoCapitalize="off"
            autoComplete="off"
            onChange={(event) => set('code', event.target.value)}
          />
        </Field>
        <Field label={t('products.form.title')} error={errors.title}>
          <input
            className="form-control"
            value={values.title}
            maxLength={255}
            onChange={(event) => set('title', event.target.value)}
          />
        </Field>
        <Field label={t('products.form.detail')} error={errors.detail}>
          <textarea
            className="form-control"
            rows={3}
            value={values.detail}
            onChange={(event) => set('detail', event.target.value)}
          />
        </Field>
        <Field label={t('products.form.price')} error={errors.price}>
          <PriceInput
            value={values.price}
            onChange={(value) => set('price', value)}
          />
        </Field>
        <div className="form-group kf-switch-row">
          <label className="kf-switch" htmlFor={statusId}>
            <input
              id={statusId}
              type="checkbox"
              role="switch"
              className="kf-switch__input"
              checked={values.status === '1'}
              onChange={(event) =>
                set('status', event.target.checked ? '1' : '0')
              }
            />
            <span className="kf-switch__track" aria-hidden="true" />
            <span className="kf-switch__label">
              {t('products.form.active')}
            </span>
          </label>
          <p className="kf-switch-row__help">{t('products.form.statusHelp')}</p>
        </div>
      </FormSection>
      <ActionBar
        primary={
          <Button type="submit" variant="primary" loading={busy}>
            {busy ? t('common.saving') : t('common.save')}
          </Button>
        }
        secondary={
          <Button variant="ghost" to="/admin/products">
            {t('common.cancel')}
          </Button>
        }
      />
    </FormLayout>
  );
}

/** The price with its "$" in front. Field gives this wrapper's input its id and error wiring through the child. */
function PriceInput(props: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  className?: string;
  ['aria-invalid']?: boolean;
  ['aria-describedby']?: string;
}) {
  const {value, onChange, className, ...aria} = props;
  return (
    <div className="input-group">
      <div className="input-group-prepend">
        <span className="input-group-text" aria-hidden="true">
          $
        </span>
      </div>
      <input
        {...aria}
        type="number"
        className={className}
        min={0}
        step="any"
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
