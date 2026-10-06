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

/** What the form needs before it can be saved, in the order the action bar names them. */
export type MissingField =
  | 'first_name'
  | 'last_name'
  | 'email'
  | 'warehouse'
  | 'products'
  | 'source'
  | 'payment_method'
  | 'status';

/** What is still missing (the legacy form's requirements): empty when the order can be saved. */
export function missingFields(values: OrderFormValues): MissingField[] {
  const {customer} = values;
  const checks: [MissingField, boolean][] = [
    ['first_name', customer.first_name.trim() !== ''],
    ['last_name', customer.last_name.trim() !== ''],
    ['email', customer.email.trim() !== ''],
    ['warehouse', values.warehouse_id !== null],
    ['products', values.products.some(isLineFilled)],
    ['source', values.source !== null],
    ['payment_method', values.payment_method !== null],
    ['status', values.status !== null],
  ];
  return checks.filter(([, filled]) => !filled).map(([field]) => field);
}

export function isOrderFormValid(values: OrderFormValues): boolean {
  return missingFields(values).length === 0;
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
