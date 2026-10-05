import type {Translate} from '@/shared/i18n';
import type {Product, ProductPayload} from '../api/productApi';

/** The form's values as typed (selects and inputs hold strings). */
export interface ProductFormValues {
  status: '1' | '0';
  code: string;
  title: string;
  detail: string;
  price: string;
}

export type ProductFormErrors = Partial<Record<keyof ProductFormValues, string>>;

/** The spreadsheet template's header placeholders: the API refuses them as a code or a title (ProductInput). */
const FORBIDDEN_CODES = ['·', 'CODE'];
const FORBIDDEN_TITLES = ['PRODUCT'];

export function emptyProductForm(): ProductFormValues {
  return {status: '1', code: '', title: '', detail: '', price: ''};
}

export function productToForm(product: Product): ProductFormValues {
  return {
    status: product.status === 0 ? '0' : '1',
    code: product.code,
    title: product.title,
    detail: product.detail ?? '',
    price:
      product.price === null || product.price === undefined
        ? ''
        : String(product.price),
  };
}

/** What can be told before asking the server: the same rules as the API's ProductInput. */
export function validateProductForm(
  values: ProductFormValues,
  t: Translate,
): ProductFormErrors {
  const errors: ProductFormErrors = {};
  const code = values.code.trim();
  const title = values.title.trim();
  if (code === '') {
    errors.code = t('products.form.required');
  } else if (FORBIDDEN_CODES.includes(code)) {
    errors.code = t('products.form.notEqual', {value: code});
  }
  if (title === '') {
    errors.title = t('products.form.required');
  } else if (FORBIDDEN_TITLES.includes(title)) {
    errors.title = t('products.form.notEqual', {value: title});
  }
  const price = values.price.trim();
  if (price !== '') {
    const number = Number(price);
    if (!Number.isFinite(number)) {
      errors.price = t('products.form.invalidNumber');
    } else if (number < 0) {
      errors.price = t('products.form.positiveOrZero');
    }
  }
  return errors;
}

export function productFormToPayload(values: ProductFormValues): ProductPayload {
  const detail = values.detail.trim();
  const price = values.price.trim();
  return {
    code: values.code.trim(),
    title: values.title.trim(),
    detail: detail === '' ? null : detail,
    status: Number(values.status),
    price: price === '' ? null : Number(price),
  };
}

/** The API's violations ({field, message}) as the form's field errors. */
export function violationsToErrors(body: unknown): ProductFormErrors {
  const errors: ProductFormErrors = {};
  const violations =
    (body as {violations?: {field: string; message: string}[]} | null)
      ?.violations ?? [];
  for (const {field, message} of violations) {
    const name = field.replace(/\[.*$/, '') as keyof ProductFormValues;
    errors[name] ??= message;
  }
  return errors;
}
