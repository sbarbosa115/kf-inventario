import {useState, type FormEvent} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import Select from 'react-select';
import {type Customer, type CustomerFormValues} from '@/entities/customer';
import {
  createInvoice,
  emptyInvoiceForm,
  emptyLine,
  formatCents,
  invoiceFormToPayload,
  invoicePdfUrl,
  invoiceTotals,
  lineCents,
  PAYMENT_METHODS,
  TAX_RATES,
  validateInvoiceForm,
  type InvoiceFormErrors,
  type InvoiceFormValues,
  type LineValues,
} from '@/entities/invoice';
import type {Country} from '@/entities/location';
import {listStock, type StockItem} from '@/entities/product';
import type {Warehouse} from '@/entities/warehouse';
import {AddAllProductsButton} from '@/features/add-all-products';
import {AddressForm} from '@/widgets/address-form';
import {ApiError, failureMessage} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {useLoad} from '@/shared/lib';
import {Field} from '@/shared/ui';
import {
  customerPayload,
  noCustomer,
  pickCustomer,
  type InvoiceCustomer,
} from '../lib/customerPayload';
import './invoice-form.css';

interface Option {
  value: number;
  label: string;
}

const customerOption = (c: Customer): Option => ({
  value: c.id,
  label: `${c.first_name ?? ''} ${c.last_name ?? ''} [${c.email ?? ''}] [${c.phone ?? ''}]`,
});

/**
 * Create invoice: the customer (picked, or typed for a new one), the code the server suggests, the payment method,
 * the tax and the lines, with the subtotal, tax and total as they are typed. Saving opens the PDF in a new tab and
 * goes to the list.
 */
export function InvoiceForm({
  suggestedCode,
  customers,
  locations,
  warehouses,
}: {
  suggestedCode: string;
  customers: Customer[];
  locations: Country[];
  warehouses: Warehouse[];
}) {
  const {t} = useTranslation();
  const navigate = useNavigate();
  const [values, setValues] = useState<InvoiceFormValues>(() =>
    emptyInvoiceForm(suggestedCode),
  );
  const [customer, setCustomer] = useState<InvoiceCustomer>(noCustomer);
  const [warehouseId, setWarehouseId] = useState<number | null>(
    warehouses[0]?.id ?? null,
  );
  const [errors, setErrors] = useState<InvoiceFormErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const stock = useLoad(
    () => (warehouseId === null ? Promise.resolve([]) : listStock(warehouseId)),
    [warehouseId],
  );
  const products: StockItem[] | undefined = stock.data;
  const productOptions: Option[] = (products ?? []).map((item) => ({
    value: item.product_id,
    label: `${item.title} (${item.code})`,
  }));

  const set = <K extends keyof InvoiceFormValues>(
    key: K,
    value: InvoiceFormValues[K],
  ) => setValues((now) => ({...now, [key]: value}));
  const setCustomerValues = (changes: Partial<CustomerFormValues>) =>
    setCustomer((now) => ({...now, values: {...now.values, ...changes}}));
  const setLine = (key: number, changes: Partial<LineValues>) =>
    set(
      'lines',
      values.lines.map((line) =>
        line.key === key ? {...line, ...changes} : line,
      ),
    );

  const pickProduct = (key: number, option: Option | null) => {
    const item = products?.find((s) => s.product_id === option?.value);
    setLine(
      key,
      item
        ? {
            product_id: item.product_id,
            description: item.title,
            unit_price: String(item.price ?? 0),
          }
        : {product_id: null},
    );
  };

  const totals = invoiceTotals(values.lines, Number(values.tax_rate));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFailure(null);
    const found = validateInvoiceForm(values, t);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    try {
      const created = await createInvoice(
        invoiceFormToPayload(values, customerPayload(customer)),
      );
      window.open(invoicePdfUrl(created.id), '_blank');
      navigate('/admin/invoices', {state: {saved: 'created'}});
    } catch (error) {
      if (error instanceof ApiError && error.code === 'invoice_code_taken') {
        setErrors({code: t('invoices.form.codeTaken')});
      } else if (error instanceof ApiError && error.status === 422) {
        const violations =
          (error.body as {violations?: {field: string; message: string}[]})
            .violations ?? [];
        const code = violations.find((v) => v.field === 'code');
        setErrors(code ? {code: code.message} : {});
        setFailure(t('errors.validation_failed'));
      } else if (error instanceof ApiError && error.status === 403) {
        setFailure(t('errors.forbidden'));
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
      <div className="row">
        <div className="col-md-6">
          <h2 className="h5">{t('invoices.form.customer')}</h2>
          <div className="form-group">
            <label htmlFor="invoice-customer">
              {t('invoices.form.pickCustomer')}
            </label>
            <Select<Option>
              inputId="invoice-customer"
              isClearable
              placeholder={t('invoices.form.searchCustomer')}
              noOptionsMessage={() => t('invoices.form.noOptions')}
              options={customers.map(customerOption)}
              value={
                customer.id === null
                  ? null
                  : customers
                      .map(customerOption)
                      .find((o) => o.value === customer.id)
              }
              onChange={(option) => {
                const picked = customers.find((c) => c.id === option?.value);
                setCustomer(picked ? pickCustomer(picked) : noCustomer());
              }}
            />
          </div>
          <div className="form-row">
            <div className="col-md-6">
              <Field label={t('invoices.form.firstName')}>
                <input
                  className="form-control"
                  value={customer.values.first_name}
                  maxLength={255}
                  onChange={(e) =>
                    setCustomerValues({first_name: e.target.value})
                  }
                />
              </Field>
            </div>
            <div className="col-md-6">
              <Field label={t('invoices.form.lastName')}>
                <input
                  className="form-control"
                  value={customer.values.last_name}
                  maxLength={255}
                  onChange={(e) =>
                    setCustomerValues({last_name: e.target.value})
                  }
                />
              </Field>
            </div>
          </div>
          <div className="form-row">
            <div className="col-md-6">
              <Field label={t('invoices.form.email')}>
                <input
                  type="email"
                  className="form-control"
                  value={customer.values.email}
                  maxLength={255}
                  onChange={(e) => setCustomerValues({email: e.target.value})}
                />
              </Field>
            </div>
            <div className="col-md-6">
              <Field label={t('invoices.form.phone')}>
                <input
                  className="form-control"
                  value={customer.values.phone}
                  maxLength={255}
                  onChange={(e) => setCustomerValues({phone: e.target.value})}
                />
              </Field>
            </div>
          </div>
          <AddressForm
            addresses={customer.values.addresses}
            locations={locations}
            onChange={(addresses) => setCustomerValues({addresses})}
          />
          <hr />
          <Field label={t('invoices.form.code')} error={errors.code}>
            <input
              className="form-control"
              value={values.code}
              maxLength={255}
              onChange={(e) => set('code', e.target.value)}
            />
          </Field>
          <Field label={t('invoices.form.paymentMethod')}>
            <select
              className="form-control"
              value={values.payment_method}
              onChange={(e) => set('payment_method', e.target.value)}
            >
              <option value="">--</option>
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {t(`invoices.form.payment.${method}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('invoices.form.taxRate')}>
            <select
              className="form-control"
              value={values.tax_rate}
              onChange={(e) => set('tax_rate', e.target.value)}
            >
              {TAX_RATES.map((rate) => (
                <option key={rate} value={rate}>
                  {rate}%
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('invoices.form.comment')}>
            <textarea
              className="form-control"
              rows={3}
              value={values.comment}
              onChange={(e) => set('comment', e.target.value)}
            />
          </Field>
        </div>

        <div className="col-md-6">
          <h2 className="h5">{t('invoices.form.items')}</h2>
          <Field label={t('invoices.form.warehouse')}>
            <select
              className="form-control"
              value={warehouseId ?? ''}
              onChange={(e) =>
                setWarehouseId(
                  e.target.value === '' ? null : Number(e.target.value),
                )
              }
            >
              <option value="">--</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </Field>
          {stock.error !== null && stock.error !== undefined && (
            <div className="alert alert-warning" role="alert">
              {t('invoices.form.stockFailed')}
            </div>
          )}
          <div className="d-flex justify-content-end mb-2">
            <AddAllProductsButton
              stock={products}
              lines={values.lines}
              onChange={(lines) => set('lines', lines)}
            />
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => set('lines', [...values.lines, emptyLine()])}
            >
              {t('invoices.form.addItem')}
            </button>
          </div>
          {errors.items && (
            <div className="alert alert-danger" role="alert">
              {errors.items}
            </div>
          )}
          {values.lines.map((line, index) => {
            const number = index + 1;
            return (
              <fieldset
                key={line.key}
                className="form-row mb-2 invoice-form__line"
                aria-label={t('invoices.form.item', {number})}
              >
                <div className="col-md-5 mb-1">
                  <Select<Option>
                    isClearable
                    aria-label={t('invoices.form.product', {number})}
                    placeholder={t('invoices.form.productPlaceholder')}
                    noOptionsMessage={() => t('invoices.form.noOptions')}
                    options={productOptions}
                    value={
                      productOptions.find((o) => o.value === line.product_id) ??
                      null
                    }
                    onChange={(option) => pickProduct(line.key, option)}
                  />
                  <input
                    className="form-control mt-1"
                    aria-label={t('invoices.form.description', {number})}
                    placeholder={t('invoices.form.descriptionPlaceholder')}
                    value={line.description}
                    maxLength={255}
                    onChange={(e) =>
                      setLine(line.key, {description: e.target.value})
                    }
                  />
                </div>
                <div className="col-md-2 mb-1">
                  <input
                    className="form-control"
                    inputMode="numeric"
                    aria-label={t('invoices.form.quantity', {number})}
                    value={line.quantity}
                    onChange={(e) =>
                      setLine(line.key, {quantity: e.target.value})
                    }
                  />
                </div>
                <div className="col-md-2 mb-1">
                  <input
                    className="form-control"
                    inputMode="decimal"
                    aria-label={t('invoices.form.unitPrice', {number})}
                    value={line.unit_price}
                    onChange={(e) =>
                      setLine(line.key, {unit_price: e.target.value})
                    }
                  />
                </div>
                <div className="col-md-2 mb-1 invoice-form__line-total">
                  {formatCents(lineCents(line.quantity, line.unit_price))}
                </div>
                <div className="col-md-1 mb-1">
                  <button
                    type="button"
                    className="btn btn-danger"
                    aria-label={t('invoices.form.remove', {number})}
                    title={t('invoices.form.remove', {number})}
                    onClick={() =>
                      set(
                        'lines',
                        values.lines.filter((l) => l.key !== line.key),
                      )
                    }
                  >
                    <i className="fas fa-times" aria-hidden="true" />
                  </button>
                </div>
              </fieldset>
            );
          })}
          <div className="d-flex justify-content-end mt-3">
            <div className="text-right invoice-form__totals">
              <div>
                <strong>{t('invoices.form.subtotal')}:</strong>{' '}
                <span data-testid="subtotal">
                  {formatCents(totals.subtotal)}
                </span>
              </div>
              <div>
                <strong>
                  {t('invoices.form.tax', {rate: Number(values.tax_rate)})}:
                </strong>{' '}
                <span data-testid="tax">{formatCents(totals.tax)}</span>
              </div>
              <div>
                <strong>{t('invoices.form.total')}:</strong>{' '}
                <span data-testid="total">{formatCents(totals.total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="form-row mt-3">
        <div className="col-md-6 mb-2">
          <Link to="/admin/invoices" className="btn btn-danger btn-block">
            {t('common.cancel')}
          </Link>
        </div>
        <div className="col-md-6 mb-2">
          <button
            type="submit"
            className="btn btn-success btn-block"
            disabled={busy}
          >
            {busy ? t('common.saving') : t('invoices.form.submit')}
          </button>
        </div>
      </div>
    </form>
  );
}
