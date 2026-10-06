import type {Translate} from '@/shared/i18n';
import type {
  InvoiceCustomerPayload,
  InvoiceLinePayload,
  InvoicePayload,
} from '../api/invoiceApi';

/** One line being typed: amounts stay text until they are sent. `key` identifies the row in the list. */
export interface LineValues {
  key: number;
  product_id: number | null;
  description: string;
  quantity: string;
  unit_price: string;
}

export interface InvoiceFormValues {
  code: string;
  payment_method: string;
  /** "0" or "6", the two rates of the legacy form. */
  tax_rate: string;
  comment: string;
  lines: LineValues[];
}

export type InvoiceFormErrors = Partial<Record<'code' | 'items', string>>;

export const PAYMENT_METHODS = ['credit_counted', 'credit_card'] as const;
export const TAX_RATES = ['0', '6'] as const;

let lastKey = 0;

export function emptyLine(): LineValues {
  lastKey += 1;
  return {
    key: lastKey,
    product_id: null,
    description: '',
    quantity: '1',
    unit_price: '0',
  };
}

/** A new invoice starts with the code the server suggests and one empty line, as the legacy form did. */
export function emptyInvoiceForm(code: string): InvoiceFormValues {
  return {
    code,
    payment_method: '',
    tax_rate: '0',
    comment: '',
    lines: [emptyLine()],
  };
}

/** A line counts when it names a product or has a description: the empty rows are dropped when sending. */
export const lineIsFilled = (line: LineValues) =>
  line.product_id !== null || line.description.trim() !== '';

const MONEY = /^\d+([.,]\d{1,2})?$/;

const lineIsValid = (line: LineValues) =>
  /^[1-9]\d*$/.test(line.quantity.trim()) && MONEY.test(line.unit_price.trim());

/** What can be told before asking the server. */
export function validateInvoiceForm(
  values: InvoiceFormValues,
  t: Translate,
): InvoiceFormErrors {
  const errors: InvoiceFormErrors = {};
  if (values.code.trim() === '') errors.code = t('invoices.form.required');
  const filled = values.lines.filter(lineIsFilled);
  if (filled.length === 0) {
    errors.items = t('invoices.form.noItems');
  } else if (!filled.every(lineIsValid)) {
    errors.items = t('invoices.form.badItems');
  }
  return errors;
}

const linePayload = (line: LineValues): InvoiceLinePayload => ({
  product_id: line.product_id,
  description: line.description.trim(),
  quantity: Number(line.quantity.trim()),
  unit_price: line.unit_price.trim().replace(',', '.'),
  discount: '0',
});

export function invoiceFormToPayload(
  values: InvoiceFormValues,
  customer: InvoiceCustomerPayload | null,
): InvoicePayload {
  const street = customer?.addresses.find((a) => a.address !== '')?.address;
  return {
    code: values.code.trim(),
    payment_method: values.payment_method === '' ? null : values.payment_method,
    customer,
    customer_address: street ?? null,
    tax_rate: values.tax_rate,
    comment: values.comment.trim() === '' ? null : values.comment.trim(),
    items: values.lines.filter(lineIsFilled).map(linePayload),
  };
}
