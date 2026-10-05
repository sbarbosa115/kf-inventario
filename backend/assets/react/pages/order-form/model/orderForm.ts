import {
  customerFormToPayload,
  customerToForm,
  emptyCustomerForm,
  type Customer,
  type CustomerFormValues,
} from '@/entities/customer';
import type {OrderDetail, OrderPayload} from '../api/orderFormApi';

/** The statuses a person picks when placing or editing an order (the later ones come from shipping it). */
export const PICKABLE_STATUSES = [1, 2, 3];
export const SOURCES = [1, 2];
export const PAYMENT_METHODS = [1, 2];

/** A product row: the product (its uuid) and how many, as typed. `label` names a saved product before the warehouse's stock has loaded. */
export interface OrderLineValue {
  uuid: string;
  quantity: string;
  label?: string;
}

export interface OrderFormValues {
  code: string;
  status: number | null;
  source: number | null;
  payment_method: number | null;
  comment: string;
  warehouse_id: number | null;
  /** The existing customer picked in "Search Customer", if any. */
  customer_id: number | null;
  customer: CustomerFormValues;
  products: OrderLineValue[];
}

export const emptyLine = (): OrderLineValue => ({uuid: '', quantity: ''});

export function emptyOrderForm(): OrderFormValues {
  return {
    code: '',
    status: null,
    source: null,
    payment_method: null,
    comment: '',
    warehouse_id: null,
    customer_id: null,
    customer: emptyCustomerForm(),
    products: [emptyLine()],
  };
}

export function orderToForm(order: OrderDetail): OrderFormValues {
  return {
    code: order.code ?? '',
    status: order.status,
    source: order.source,
    payment_method: order.payment_method ?? null,
    comment: order.comment ?? '',
    warehouse_id: order.warehouse?.id ?? null,
    customer_id: order.customer?.id ?? null,
    customer: order.customer
      ? customerToForm(order.customer)
      : emptyCustomerForm(),
    products:
      order.products.length > 0
        ? order.products.map((line) => ({
            uuid: line.uuid,
            quantity: String(line.quantity),
            label: `${line.product.title} (${line.product.code})`,
          }))
        : [emptyLine()],
  };
}

/** Picking an existing customer fills their fields and addresses; clearing the pick empties them. */
export function withCustomer(
  values: OrderFormValues,
  customer: Customer | null,
): OrderFormValues {
  return {
    ...values,
    customer_id: customer?.id ?? null,
    customer: customer ? customerToForm(customer) : emptyCustomerForm(),
  };
}

/** The typed quantity as a whole number (NaN when there is none). */
const quantityOf = (line: OrderLineValue) => Number.parseInt(line.quantity, 10);

/** A row counts once it has a product and a quantity above zero. */
export function isLineFilled(line: OrderLineValue): boolean {
  return line.uuid !== '' && quantityOf(line) > 0;
}

/** The warehouse is chosen first: once a product is filled it stays (the products belong to its stock). */
export function isWarehouseLocked(values: OrderFormValues): boolean {
  return values.products.some(isLineFilled);
}

/** What the legacy form required before it showed its save button. */
export function isOrderFormValid(values: OrderFormValues): boolean {
  const {customer} = values;
  return (
    customer.first_name.trim() !== '' &&
    customer.last_name.trim() !== '' &&
    customer.email.trim() !== '' &&
    values.warehouse_id !== null &&
    values.products.some(isLineFilled) &&
    values.source !== null &&
    values.payment_method !== null &&
    values.status !== null
  );
}

/** The body of POST/PUT /orders; only filled product rows are sent. Call it on a valid form. */
export function orderFormToPayload(values: OrderFormValues): OrderPayload {
  return {
    code: values.code.trim() === '' ? null : values.code.trim(),
    status: values.status ?? 1,
    source: values.source ?? 2,
    payment_method: values.payment_method ?? 1,
    comment: values.comment.trim() === '' ? null : values.comment,
    warehouse_id: values.warehouse_id ?? 0,
    customer: {
      id: values.customer_id,
      ...customerFormToPayload(values.customer),
    },
    products: values.products
      .filter(isLineFilled)
      .map((line) => ({uuid: line.uuid, quantity: quantityOf(line)})),
    comments: [],
  };
}
