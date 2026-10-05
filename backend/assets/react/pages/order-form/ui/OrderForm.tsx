import {useId, useState, type FormEvent} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import Select from 'react-select';
import type {Customer, CustomerFormValues} from '@/entities/customer';
import type {Country} from '@/entities/location';
import {listStock, type StockItem} from '@/entities/product';
import type {Warehouse} from '@/entities/warehouse';
import {AddressForm} from '@/widgets/address-form';
import {ApiError, failureMessage} from '@/shared/api';
import {useTranslation, type Translate} from '@/shared/i18n';
import {useLoad} from '@/shared/lib';
import {ErrorState, Field} from '@/shared/ui';
import {createOrder, updateOrder, type OrderDetail} from '../api/orderFormApi';
import {
  emptyLine,
  emptyOrderForm,
  isLineFilled,
  isOrderFormValid,
  isWarehouseLocked,
  orderFormToPayload,
  orderToForm,
  PAYMENT_METHODS,
  PICKABLE_STATUSES,
  SOURCES,
  withCustomer,
  type OrderFormValues,
  type OrderLineValue,
} from '../model/orderForm';

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
 * The order form (the legacy ManageOrder): the customer on the left (picked from the existing ones or typed, with
 * their addresses), the order on the right: warehouse first, then its products, the code, source, payment method
 * and status. Without `order` it places one; with it, it edits that one.
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
  const id = useId();
  const [values, setValues] = useState<OrderFormValues>(() =>
    order ? orderToForm(order) : emptyOrderForm(),
  );
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

  const valid = isOrderFormValid(values);
  const locked = isWarehouseLocked(values);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    setFailure(null);
    setBusy(true);
    try {
      const payload = orderFormToPayload(values);
      if (order) {
        await updateOrder(order.id, payload);
      } else {
        await createOrder(payload);
      }
      navigate('/admin/orders', {
        state: {saved: order ? 'updated' : 'created'},
      });
    } catch (error) {
      setFailure(saveFailure(error, t));
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
        <div className="col-sm-6">
          <h2 className="h4">{t('orderForm.customerInformation')}</h2>
          <div className="form-group">
            <label htmlFor={`${id}-customer`}>
              {t('orderForm.searchCustomer')}
            </label>
            <Select<Customer>
              classNamePrefix="kf-select"
              inputId={`${id}-customer`}
              isClearable
              placeholder={t('orderForm.searchCustomer')}
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
              <Field label={t('orderForm.firstName')}>
                <input
                  className="form-control"
                  value={values.customer.first_name}
                  maxLength={255}
                  onChange={(e) => setCustomer({first_name: e.target.value})}
                />
              </Field>
            </div>
            <div className="col-md-6">
              <Field label={t('orderForm.lastName')}>
                <input
                  className="form-control"
                  value={values.customer.last_name}
                  maxLength={255}
                  onChange={(e) => setCustomer({last_name: e.target.value})}
                />
              </Field>
            </div>
          </div>
          <div className="form-row">
            <div className="col-md-6">
              <Field label={t('orderForm.email')}>
                <input
                  type="email"
                  className="form-control"
                  value={values.customer.email}
                  maxLength={255}
                  onChange={(e) => setCustomer({email: e.target.value})}
                />
              </Field>
            </div>
            <div className="col-md-6">
              <Field label={t('orderForm.phone')}>
                <input
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
          <Field label={t('orderForm.comment')}>
            <textarea
              className="form-control"
              value={values.comment}
              onChange={(e) => set('comment', e.target.value)}
            />
          </Field>
        </div>

        <div className="col-sm-6">
          <h2 className="h4">{t('orderForm.orderDetail')}</h2>
          <div className="form-row">
            <div className="col-6">
              <Field label={t('orderForm.warehouse')}>
                <select
                  className="form-control"
                  value={values.warehouse_id ?? ''}
                  disabled={locked}
                  title={locked ? t('orderForm.warehouseLocked') : undefined}
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
            </div>
            <div className="col-6">
              <Field label={t('orderForm.paymentMethod')}>
                <select
                  className="form-control"
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
          <div className="form-row">
            <div className="col-4">
              <Field label={t('orderForm.code')}>
                <input
                  className="form-control"
                  value={values.code}
                  maxLength={255}
                  onChange={(e) => set('code', e.target.value)}
                />
              </Field>
            </div>
            <div className="col-4">
              <Field label={t('orderForm.source')}>
                <select
                  className="form-control"
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
            <div className="col-4">
              <Field label={t('orderForm.status')}>
                <select
                  className="form-control"
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

          {stock.error ? (
            <ErrorState error={stock.error} onRetry={stock.reload} />
          ) : null}
          {values.products.map((line, index) => {
            const number = index + 1;
            const last = index === values.products.length - 1;
            return (
              // Rows have no stable id (a new one has no product yet); they are added at the end, removed anywhere.
              <div className="form-row" key={index}>
                <div className="form-group col-6">
                  <label htmlFor={`${id}-product-${index}`} className="sr-only">
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
                </div>
                <div className="form-group col-3">
                  <input
                    type="number"
                    min={1}
                    step={1}
                    className="form-control"
                    aria-label={t('orderForm.quantityOf', {number})}
                    placeholder={t('orderForm.quantity')}
                    value={line.quantity}
                    onChange={(e) => setLine(index, {quantity: e.target.value})}
                  />
                </div>
                <div className="form-group col-3 text-nowrap">
                  {last && isLineFilled(line) && (
                    <button
                      type="button"
                      className="btn btn-success"
                      aria-label={t('orderForm.addProduct')}
                      title={t('orderForm.addProduct')}
                      onClick={() =>
                        set('products', [...values.products, emptyLine()])
                      }
                    >
                      <i className="fas fa-plus-circle" aria-hidden="true" />
                    </button>
                  )}{' '}
                  {values.products.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-danger"
                      aria-label={t('orderForm.removeProduct')}
                      title={t('orderForm.removeProduct')}
                      onClick={() =>
                        set(
                          'products',
                          values.products.filter((_, i) => i !== index),
                        )
                      }
                    >
                      <i className="fas fa-times-circle" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          <div className="mt-2">
            <button
              type="submit"
              className="btn btn-success"
              disabled={!valid || busy}
            >
              <i className="fas fa-save" aria-hidden="true" />{' '}
              {order ? t('orderForm.update') : t('orderForm.create')}
              {busy && (
                <>
                  {' '}
                  <i className="fas fa-spinner fa-pulse" aria-hidden="true" />
                </>
              )}
            </button>{' '}
            <Link to="/admin/orders" className="btn btn-danger">
              <i className="fas fa-times-circle" aria-hidden="true" />{' '}
              {t('common.cancel')}
            </Link>
            {!valid && (
              <small className="form-text text-muted">
                {t('orderForm.incomplete')}
              </small>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
