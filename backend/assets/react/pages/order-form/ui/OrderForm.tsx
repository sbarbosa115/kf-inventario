import {Fragment, useId, useState, type FormEvent} from 'react';
import {useNavigate} from 'react-router-dom';
import Select from 'react-select';
import type {Customer, CustomerFormValues} from '@/entities/customer';
import type {Country} from '@/entities/location';
import {listStock, type StockItem} from '@/entities/product';
import type {Warehouse} from '@/entities/warehouse';
import {AddressForm} from '@/widgets/address-form';
import {ApiError, failureMessage} from '@/shared/api';
import {useTranslation, type Translate} from '@/shared/i18n';
import {useLoad} from '@/shared/lib';
import {
  ActionBar,
  Button,
  ErrorState,
  Field,
  FormLayout,
  FormSection,
  useToast,
} from '@/shared/ui';
import {createOrder, updateOrder, type OrderDetail} from '../api/orderFormApi';
import {
  emptyLine,
  emptyOrderForm,
  isLineFilled,
  isWarehouseLocked,
  missingFields,
  orderFormToPayload,
  orderToForm,
  PAYMENT_METHODS,
  PICKABLE_STATUSES,
  SOURCES,
  withCustomer,
  type MissingField,
  type OrderFormValues,
  type OrderLineValue,
} from '../model/orderForm';
import './order-form.css';

interface ProductOption {
  uuid: string;
  label: string;
}

/** Why the server refused the order, in the person's words. */
function saveFailure(error: unknown, t: Translate): string {
  if (error instanceof ApiError) {
    if (error.code === 'validation_failed') {
      const violations =
        (error.body as {violations?: {field: string; message: string}[]} | null)
          ?.violations ?? [];
      return t('orderForm.errors.validation_failed', {
        fields: violations.map((v) => `${v.field}: ${v.message}`).join('; '),
      });
    }
    if (
      [
        'order_without_products',
        'product_not_found',
        'warehouse_not_found',
        'order_not_found',
      ].includes(error.code)
    ) {
      return t(`orderForm.errors.${error.code}`);
    }
    if (error.status === 403) return t('errors.forbidden');
  }
  return failureMessage(error, t);
}

const toNumber = (value: string) => (value === '' ? null : Number(value));

/**
 * The order form (the legacy ManageOrder): the customer in one column (picked from the existing ones or typed, with
 * their addresses), the order in the other: the warehouse first, then its products as a table, the order number,
 * source, payment method, status and comment. The action bar names what is still missing; a click on a name
 * highlights the missing fields and goes to that one. Without `order` it places one; with it, it edits that one.
 */
export function OrderForm({
  order,
  warehouses,
  locations,
  customers,
  customersUnavailable,
}: {
  order?: OrderDetail;
  warehouses: Warehouse[];
  locations: Country[];
  customers: Customer[];
  customersUnavailable: boolean;
}) {
  const {t} = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const id = useId();
  const [values, setValues] = useState<OrderFormValues>(() =>
    order ? orderToForm(order) : emptyOrderForm(),
  );
  const [highlight, setHighlight] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const stock = useLoad(
    () =>
      values.warehouse_id === null
        ? Promise.resolve<StockItem[]>([])
        : listStock(values.warehouse_id),
    [values.warehouse_id],
  );
  const productOptions: ProductOption[] = (stock.data ?? []).map((item) => ({
    uuid: item.uuid,
    label: t('orderForm.productOption', {title: item.title, code: item.code}),
  }));

  const set = <K extends keyof OrderFormValues>(
    key: K,
    value: OrderFormValues[K],
  ) => setValues((now) => ({...now, [key]: value}));
  const setCustomer = (changes: Partial<CustomerFormValues>) =>
    setValues((now) => ({...now, customer: {...now.customer, ...changes}}));
  const setLine = (index: number, changes: Partial<OrderLineValue>) =>
    setValues((now) => ({
      ...now,
      products: now.products.map((line, i) =>
        i === index ? {...line, ...changes} : line,
      ),
    }));

  const customerLabel = (customer: Customer) =>
    t('orderForm.customerOption', {
      name: `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim(),
      email: customer.email ?? '',
      phone: customer.phone ?? '',
    });

  const lineValue = (line: OrderLineValue): ProductOption | null => {
    if (line.uuid === '') return null;
    return (
      productOptions.find((option) => option.uuid === line.uuid) ?? {
        uuid: line.uuid,
        label: line.label ?? line.uuid,
      }
    );
  };

  // A saved order may hold a status the form does not offer (partial, sent…): it stays selectable so it is kept.
  const statuses =
    values.status !== null && !PICKABLE_STATUSES.includes(values.status)
      ? [...PICKABLE_STATUSES, values.status]
      : PICKABLE_STATUSES;

  const missing = missingFields(values);
  const valid = missing.length === 0;
  const locked = isWarehouseLocked(values);
  const lastLine = values.products[values.products.length - 1];
  /** The "Required" under a field, once the person asked to see what is missing. */
  const required = (field: MissingField) =>
    highlight && missing.includes(field) ? t('orderForm.required') : null;

  /** Highlights every missing field and moves to the one named (by its `name`, in this form). */
  const goTo = (field: MissingField, form: HTMLFormElement | null) => {
    setHighlight(true);
    const named = (name: string) =>
      form?.querySelector<HTMLElement>(`[name="${name}"]`)?.focus();
    if (field === 'products' && values.warehouse_id === null) {
      named('warehouse');
      return;
    }
    if (field === 'products') {
      const index = Math.max(
        0,
        values.products.findIndex((line) => !isLineFilled(line)),
      );
      const line = values.products[index];
      document
        .getElementById(
          line && line.uuid !== ''
            ? `${id}-quantity-${index}`
            : `${id}-product-${index}`,
        )
        ?.focus();
      return;
    }
    named(field);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!valid) {
      setHighlight(true);
      return;
    }
    setFailure(null);
    setBusy(true);
    try {
      const payload = orderFormToPayload(values);
      if (order) {
        await updateOrder(order.id, payload);
      } else {
        await createOrder(payload);
      }
      toast.success(t(order ? 'orderForm.updated' : 'orderForm.created'));
      navigate('/admin/orders');
    } catch (error) {
      setFailure(saveFailure(error, t));
      setBusy(false);
    }
  };

  const missingList =
    missing.length > 0 ? (
      <p className="order-form__missing">
        <span>{t('orderForm.missing', {count: missing.length})}</span>{' '}
        {missing.map((field, index) => (
          <Fragment key={field}>
            {index > 0 && ', '}
            <button
              type="button"
              className="order-form__missing-field"
              onClick={(event) =>
                goTo(field, event.currentTarget.closest('form'))
              }
            >
              {t(`orderForm.missingNames.${field}`)}
            </button>
          </Fragment>
        ))}
      </p>
    ) : undefined;

  return (
    <FormLayout
      columns={2}
      onSubmit={submit}
      label={order ? t('orderForm.editTitle') : t('orderForm.newTitle')}
    >
      {failure && (
        <div className="alert alert-danger order-form__failure" role="alert">
          {failure}
        </div>
      )}
      <FormSection
        title={t('orderForm.customerInformation')}
        description={t('orderForm.customerHint')}
      >
        <div className="form-group">
          <label htmlFor={`${id}-customer`}>
            {t('orderForm.searchCustomer')}
          </label>
          <Select<Customer>
            classNamePrefix="kf-select"
            inputId={`${id}-customer`}
            isClearable
            placeholder={t('orderForm.searchCustomerPlaceholder')}
            options={customers}
            getOptionLabel={customerLabel}
            getOptionValue={(customer) => String(customer.id)}
            value={customers.find((c) => c.id === values.customer_id) ?? null}
            noOptionsMessage={() => t('orderForm.noCustomers')}
            onChange={(customer) =>
              setValues((now) => withCustomer(now, customer))
            }
          />
          {customersUnavailable && (
            <small className="form-text text-muted">
              {t('orderForm.customersUnavailable')}
            </small>
          )}
        </div>
        <div className="form-row">
          <div className="col-md-6">
            <Field
              label={t('orderForm.firstName')}
              error={required('first_name')}
            >
              <input
                name="first_name"
                className="form-control"
                required
                value={values.customer.first_name}
                maxLength={255}
                onChange={(e) => setCustomer({first_name: e.target.value})}
              />
            </Field>
          </div>
          <div className="col-md-6">
            <Field
              label={t('orderForm.lastName')}
              error={required('last_name')}
            >
              <input
                name="last_name"
                className="form-control"
                required
                value={values.customer.last_name}
                maxLength={255}
                onChange={(e) => setCustomer({last_name: e.target.value})}
              />
            </Field>
          </div>
        </div>
        <div className="form-row">
          <div className="col-md-6">
            <Field label={t('orderForm.email')} error={required('email')}>
              <input
                name="email"
                type="email"
                className="form-control"
                required
                value={values.customer.email}
                maxLength={255}
                onChange={(e) => setCustomer({email: e.target.value})}
              />
            </Field>
          </div>
          <div className="col-md-6">
            <Field label={t('orderForm.phone')}>
              <input
                type="tel"
                className="form-control"
                value={values.customer.phone}
                maxLength={255}
                onChange={(e) => setCustomer({phone: e.target.value})}
              />
            </Field>
          </div>
        </div>
        <AddressForm
          addresses={values.customer.addresses}
          locations={locations}
          onChange={(addresses) => setCustomer({addresses})}
        />
      </FormSection>

      <FormSection
        title={t('orderForm.orderDetail')}
        description={t('orderForm.orderHint')}
      >
        <div className="form-row">
          <div className="col-md-6">
            <Field
              label={t('orderForm.warehouse')}
              error={required('warehouse')}
            >
              <select
                name="warehouse"
                className="form-control"
                required
                value={values.warehouse_id ?? ''}
                disabled={locked}
                onChange={(e) =>
                  setValues((now) => ({
                    ...now,
                    warehouse_id: toNumber(e.target.value),
                    // The rows name products of the previous warehouse's stock.
                    products: [emptyLine()],
                  }))
                }
              >
                <option value="">{t('orderForm.selectWarehouse')}</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
            </Field>
            {locked && (
              <p className="order-form__lock">
                <i className="fas fa-lock" aria-hidden="true" />{' '}
                {t('orderForm.warehouseLocked')}
              </p>
            )}
          </div>
          <div className="col-md-6">
            <Field
              label={t('orderForm.paymentMethod')}
              error={required('payment_method')}
            >
              <select
                name="payment_method"
                className="form-control"
                required
                value={values.payment_method ?? ''}
                onChange={(e) =>
                  set('payment_method', toNumber(e.target.value))
                }
              >
                <option value="">{t('orderForm.selectPaymentMethod')}</option>
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {t(`orderForm.paymentMethods.${method}`)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        {stock.error ? (
          <ErrorState error={stock.error} onRetry={stock.reload} />
        ) : null}
        <table className="table order-lines">
          <caption className="sr-only">{t('orderForm.lines')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('orderForm.productColumn')}</th>
              <th scope="col" className="order-lines__quantity">
                {t('orderForm.quantity')}
              </th>
              <th scope="col" className="order-lines__remove">
                <span className="sr-only">{t('orderForm.removeColumn')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {values.products.map((line, index) => {
              const number = index + 1;
              return (
                // Rows have no stable id (a new one has no product yet); they are added at the end, removed anywhere.
                <tr key={index}>
                  <td>
                    <label
                      htmlFor={`${id}-product-${index}`}
                      className="sr-only"
                    >
                      {t('orderForm.product', {number})}
                    </label>
                    <Select<ProductOption>
                      classNamePrefix="kf-select"
                      inputId={`${id}-product-${index}`}
                      placeholder={t('orderForm.selectProduct')}
                      isDisabled={values.warehouse_id === null}
                      isLoading={stock.loading}
                      options={productOptions}
                      getOptionValue={(option) => option.uuid}
                      value={lineValue(line)}
                      noOptionsMessage={() => t('orderForm.noProducts')}
                      onChange={(option) =>
                        option &&
                        setLine(index, {uuid: option.uuid, label: option.label})
                      }
                    />
                  </td>
                  <td className="order-lines__quantity">
                    <input
                      id={`${id}-quantity-${index}`}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      step={1}
                      className="form-control"
                      aria-label={t('orderForm.quantityOf', {number})}
                      value={line.quantity}
                      onChange={(e) =>
                        setLine(index, {quantity: e.target.value})
                      }
                    />
                  </td>
                  <td className="order-lines__remove">
                    {values.products.length > 1 && (
                      <Button
                        variant="ghost"
                        icon="fa-times"
                        aria-label={t('orderForm.removeProduct', {number})}
                        onClick={() =>
                          set(
                            'products',
                            values.products.filter((_, i) => i !== index),
                          )
                        }
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {values.warehouse_id === null && (
          <p className="order-form__note">{t('orderForm.warehouseFirst')}</p>
        )}
        {required('products') && (
          <p className="order-form__error">
            {t('orderForm.errors.order_without_products')}
          </p>
        )}
        <Button
          variant="secondary"
          icon="fa-plus"
          className="order-form__add-line"
          disabled={!lastLine || !isLineFilled(lastLine)}
          onClick={() => set('products', [...values.products, emptyLine()])}
        >
          {t('orderForm.addProduct')}
        </Button>

        <div className="form-row">
          <div className="col-md-4">
            <Field label={t('orderForm.code')}>
              <input
                className="form-control order-form__code"
                value={values.code}
                maxLength={255}
                onChange={(e) => set('code', e.target.value)}
              />
            </Field>
          </div>
          <div className="col-md-4">
            <Field label={t('orderForm.source')} error={required('source')}>
              <select
                name="source"
                className="form-control"
                required
                value={values.source ?? ''}
                onChange={(e) => set('source', toNumber(e.target.value))}
              >
                <option value="">{t('orderForm.selectSource')}</option>
                {SOURCES.map((source) => (
                  <option key={source} value={source}>
                    {t(`orderForm.sources.${source}`)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="col-md-4">
            <Field label={t('orderForm.status')} error={required('status')}>
              <select
                name="status"
                className="form-control"
                required
                value={values.status ?? ''}
                onChange={(e) => set('status', toNumber(e.target.value))}
              >
                <option value="">{t('orderForm.selectStatus')}</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {t(`orderForm.statuses.${status}`)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>
        <Field label={t('orderForm.comment')}>
          <textarea
            className="form-control"
            rows={3}
            value={values.comment}
            onChange={(e) => set('comment', e.target.value)}
          />
        </Field>
      </FormSection>

      <ActionBar
        status={missingList}
        secondary={
          <Button variant="ghost" to="/admin/orders">
            {t('common.cancel')}
          </Button>
        }
        primary={
          <Button
            type="submit"
            variant="primary"
            icon="fa-save"
            loading={busy}
            disabled={!valid}
          >
            {order ? t('orderForm.update') : t('orderForm.create')}
          </Button>
        }
      />
    </FormLayout>
  );
}
