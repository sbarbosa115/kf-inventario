import {
  customerFormToPayload,
  customerToForm,
  emptyAddress,
  emptyCustomerForm,
  type Customer,
  type CustomerFormValues,
} from '@/entities/customer';
import type {InvoiceCustomerPayload} from '@/entities/invoice';

/** The customer part of the form: an existing customer (its id) or the fields typed for a new one. */
export interface InvoiceCustomer {
  id: number | null;
  values: CustomerFormValues;
}

export const noCustomer = (): InvoiceCustomer => ({
  id: null,
  values: emptyCustomerForm(),
});

/** Picking a customer fills the fields with what is saved; with no address saved, one empty one is offered. */
export function pickCustomer(customer: Customer): InvoiceCustomer {
  const values = customerToForm(customer);
  return {
    id: customer.id,
    values: {
      ...values,
      addresses:
        values.addresses.length > 0 ? values.addresses : [emptyAddress()],
    },
  };
}

/**
 * What goes up as `customer`: null when nobody was picked or typed (a point-of-sale invoice), otherwise the fields
 * and the addresses that have something in them (the server finds the customer by id, email or phone, or creates it).
 */
export function customerPayload(
  customer: InvoiceCustomer,
): InvoiceCustomerPayload | null {
  const {values} = customer;
  const addresses = values.addresses.filter(
    (a) =>
      a.address.trim() !== '' ||
      a.zip_code.trim() !== '' ||
      a.country.name !== '' ||
      a.state.name !== '' ||
      a.city.name !== '',
  );
  const typed =
    customer.id !== null ||
    addresses.length > 0 ||
    [values.first_name, values.last_name, values.email, values.phone].some(
      (text) => text.trim() !== '',
    );
  if (!typed) return null;
  return {id: customer.id, ...customerFormToPayload({...values, addresses})};
}
