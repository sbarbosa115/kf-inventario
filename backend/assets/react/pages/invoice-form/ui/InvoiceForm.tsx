import {useState, type FormEvent} from 'react';
import {useNavigate} from 'react-router-dom';
import Select from 'react-select';
import {type Customer, type CustomerFormValues} from '@/entities/customer';
import {
  createInvoice,
  emptyInvoiceForm,
  emptyLine,
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
import {listAllStock, type StockItem} from '@/entities/product';
import type {Warehouse} from '@/entities/warehouse';
import {AddAllProductsButton} from '@/features/add-all-products';
import {AddressForm} from '@/widgets/address-form';
import {ApiError, failureMessage} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {useLoad} from '@/shared/lib';
import {
  ActionBar,
  Button,
  Field,
  FormLayout,
  FormSection,
  Money,
  useToast,
} from '@/shared/ui';
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
 * Create invoice, laid out like the document: the customer on the left, the invoice (code, payment method, tax,
 * comments) on the right, the lines as a table under them and the subtotal, tax and total as they are typed. Saving
 * opens the PDF in a new tab and goes to the list.
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
  const toast = useToast();
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
    () => (warehouseId === null ? Promise.resolve([]) : listAllStock(warehouseId)),
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
      toast.success(t('invoices.created'));
      navigate('/admin/invoices');
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

  const warehouse = warehouses.find((w) => w.id === warehouseId);

  return (
    <FormLayout columns={2} onSubmit={submit} label={t('invoices.create')}>
      {failure && (
        <div className="alert alert-danger kf-invoice-form__wide" role="alert">
          {failure}
        </div>
      )}
      <FormSection
        title={t('invoices.form.customer')}
        description={t('invoices.form.customerHint')}
      >
        <div className="form-group">
          <label htmlFor="invoice-customer">
            {t('invoices.form.pickCustomer')}
          </label>
          <Select<Option>
            classNamePrefix="kf-select"
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
                onChange={(e) => setCustomerValues({last_name: e.target.value})}
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
      </FormSection>

      <FormSection title={t('invoices.form.invoice')}>
        <Field label={t('invoices.form.code')} error={errors.code}>
          <input
            className="form-control kf-mono"
            value={values.code}
            maxLength={255}
            onChange={(e) => set('code', e.target.value)}
          />
        </Field>
        <div className="form-row">
          <div className="col-md-6">
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
          </div>
          <div className="col-md-6">
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
          </div>
        </div>
        <Field label={t('invoices.form.comment')}>
          <textarea
            className="form-control"
            rows={3}
            value={values.comment}
            onChange={(e) => set('comment', e.target.value)}
          />
        </Field>
      </FormSection>

      <div className="kf-invoice-form__wide">
        <FormSection title={t('invoices.form.lines')}>
          <div className="kf-invoice-form__warehouse">
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
          </div>
          {stock.error !== null && stock.error !== undefined && (
            <div className="alert alert-warning" role="alert">
              {t('invoices.form.stockFailed')}
            </div>
          )}
          {errors.items && (
            <div className="alert alert-danger" role="alert">
              {errors.items}
            </div>
          )}
          <table className="kf-invoice-form__lines">
            <thead>
              <tr>
                <th scope="col">{t('invoices.form.columns.product')}</th>
                <th scope="col">{t('invoices.form.columns.description')}</th>
                <th scope="col" className="kf-invoice-form__num">
                  {t('invoices.form.columns.quantity')}
                </th>
                <th scope="col" className="kf-invoice-form__num">
                  {t('invoices.form.columns.unitPrice')}
                </th>
                <th scope="col" className="kf-invoice-form__num">
                  {t('invoices.form.columns.lineTotal')}
                </th>
                <th scope="col">
                  <span className="sr-only">{t('common.actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {values.lines.map((line, index) => {
                const number = index + 1;
                return (
                  <tr
                    key={line.key}
                    aria-label={t('invoices.form.line', {number})}
                  >
                    <td data-label={t('invoices.form.columns.product')}>
                      <Select<Option>
                        classNamePrefix="kf-select"
                        isClearable
                        aria-label={t('invoices.form.product', {number})}
                        placeholder={t('invoices.form.productPlaceholder')}
                        noOptionsMessage={() => t('invoices.form.noOptions')}
                        options={productOptions}
                        value={
                          productOptions.find(
                            (o) => o.value === line.product_id,
                          ) ?? null
                        }
                        onChange={(option) => pickProduct(line.key, option)}
                      />
                    </td>
                    <td data-label={t('invoices.form.columns.description')}>
                      <input
                        className="form-control"
                        aria-label={t('invoices.form.description', {number})}
                        placeholder={t('invoices.form.descriptionPlaceholder')}
                        value={line.description}
                        maxLength={255}
                        onChange={(e) =>
                          setLine(line.key, {description: e.target.value})
                        }
                      />
                    </td>
                    <td
                      className="kf-invoice-form__num"
                      data-label={t('invoices.form.columns.quantity')}
                    >
                      <input
                        className="form-control kf-num"
                        inputMode="numeric"
                        aria-label={t('invoices.form.quantity', {number})}
                        value={line.quantity}
                        onChange={(e) =>
                          setLine(line.key, {quantity: e.target.value})
                        }
                      />
                    </td>
                    <td
                      className="kf-invoice-form__num"
                      data-label={t('invoices.form.columns.unitPrice')}
                    >
                      <input
                        className="form-control kf-num"
                        inputMode="decimal"
                        aria-label={t('invoices.form.unitPrice', {number})}
                        value={line.unit_price}
                        onChange={(e) =>
                          setLine(line.key, {unit_price: e.target.value})
                        }
                      />
                    </td>
                    <td
                      className="kf-invoice-form__num kf-invoice-form__line-total"
                      data-label={t('invoices.form.columns.lineTotal')}
                    >
                      <Money
                        amount={lineCents(line.quantity, line.unit_price) / 100}
                      />
                    </td>
                    <td className="kf-invoice-form__remove">
                      <Button
                        variant="ghost"
                        icon="fa-times"
                        aria-label={t('invoices.form.remove', {number})}
                        onClick={() =>
                          set(
                            'lines',
                            values.lines.filter((l) => l.key !== line.key),
                          )
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="kf-invoice-form__line-actions">
            <Button
              icon="fa-plus"
              onClick={() => set('lines', [...values.lines, emptyLine()])}
            >
              {t('invoices.form.addLine')}
            </Button>
            <AddAllProductsButton
              stock={products}
              warehouseName={warehouse?.name ?? ''}
              lines={values.lines}
              onChange={(lines) => set('lines', lines)}
            />
          </div>
          <dl className="kf-invoice-form__totals">
            <div>
              <dt>{t('invoices.form.subtotal')}</dt>
              <dd data-testid="subtotal">
                <Money amount={totals.subtotal / 100} />
              </dd>
            </div>
            <div>
              <dt>{t('invoices.form.tax', {rate: Number(values.tax_rate)})}</dt>
              <dd data-testid="tax">
                <Money amount={totals.tax / 100} />
              </dd>
            </div>
            <div className="kf-invoice-form__grand">
              <dt>{t('invoices.form.total')}</dt>
              <dd data-testid="total">
                <Money amount={totals.total / 100} />
              </dd>
            </div>
          </dl>
        </FormSection>
      </div>

      <ActionBar
        secondary={
          <Button variant="ghost" to="/admin/invoices">
            {t('common.cancel')}
          </Button>
        }
        primary={
          <Button variant="primary" type="submit" loading={busy}>
            {t('invoices.form.submit')}
          </Button>
        }
      />
    </FormLayout>
  );
}
