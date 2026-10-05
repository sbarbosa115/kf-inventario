import {useState, type FormEvent} from 'react';
import {Link, useNavigate} from 'react-router-dom';
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
import {Field} from '@/shared/ui';

/** The product's fields (the legacy ProductType's, in its order). Without `product` it creates one. */
export function ProductForm({product}: {product?: Product}) {
  const {t} = useTranslation();
  const navigate = useNavigate();
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
      navigate('/admin/products', {
        state: {saved: product ? 'updated' : 'created'},
      });
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
    <form onSubmit={submit} noValidate>
      {failure && (
        <div className="alert alert-danger" role="alert">
          {failure}
        </div>
      )}
      {!product && (
        <div className="alert alert-warning">
          {t('products.form.notListedYet')}
        </div>
      )}
      <Field label={t('products.form.status')} error={errors.status}>
        <select
          className="form-control"
          value={values.status}
          onChange={(event) =>
            set('status', event.target.value === '0' ? '0' : '1')
          }
        >
          <option value="1">{t('products.form.active')}</option>
          <option value="0">{t('products.form.inactive')}</option>
        </select>
      </Field>
      <Field label={t('products.form.code')} error={errors.code}>
        <input
          className="form-control"
          value={values.code}
          maxLength={255}
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
        <input
          type="number"
          className="form-control"
          min={0}
          step="any"
          inputMode="decimal"
          value={values.price}
          onChange={(event) => set('price', event.target.value)}
        />
      </Field>
      <button type="submit" className="btn btn-primary mr-2" disabled={busy}>
        {busy ? t('common.saving') : t('common.save')}
      </button>
      <Link to="/admin/products" className="btn btn-secondary">
        {t('common.cancel')}
      </Link>
    </form>
  );
}
