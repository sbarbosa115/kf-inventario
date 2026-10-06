import type {Translate} from '@/shared/i18n';
import type {
  AddressPayload,
  Customer,
  CustomerPayload,
} from '../api/customerApi';

/** A place in a select: an existing one has an id; a name the person typed has id null. Empty: no id, no name. */
export interface PlaceValue {
  id: number | null;
  name: string;
}

export interface AddressValue {
  id: number | null;
  address: string;
  zip_code: string;
  address_type: number | null;
  country: PlaceValue;
  state: PlaceValue;
  city: PlaceValue;
}

export interface CustomerFormValues {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  addresses: AddressValue[];
}

export type CustomerFormErrors = Partial<
  Record<'first_name' | 'last_name' | 'email' | 'phone', string>
>;

const NO_PLACE: PlaceValue = {id: null, name: ''};

export function emptyAddress(): AddressValue {
  return {
    id: null,
    address: '',
    zip_code: '',
    address_type: null,
    country: NO_PLACE,
    state: NO_PLACE,
    city: NO_PLACE,
  };
}

/** A new customer starts with one empty address, as the legacy form did. */
export function emptyCustomerForm(): CustomerFormValues {
  return {
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    addresses: [emptyAddress()],
  };
}

export function customerToForm(customer: Customer): CustomerFormValues {
  return {
    first_name: customer.first_name ?? '',
    last_name: customer.last_name ?? '',
    email: customer.email ?? '',
    phone: customer.phone ?? '',
    addresses: customer.addresses.map((address) => ({
      id: address.id,
      address: address.address ?? '',
      zip_code: address.zip_code ?? '',
      address_type: address.address_type ?? null,
      country: {
        id: address.city?.state.country.id ?? null,
        name: address.city?.state.country.name ?? '',
      },
      state: {
        id: address.city?.state.id ?? null,
        name: address.city?.state.name ?? '',
      },
      city: {id: address.city?.id ?? null, name: address.city?.name ?? ''},
    })),
  };
}

/** What can be told before asking the server: the legacy form required these six fields. */
export function validateCustomerForm(
  values: CustomerFormValues,
  t: Translate,
): CustomerFormErrors {
  const errors: CustomerFormErrors = {};
  if (values.first_name.trim() === '')
    errors.first_name = t('customers.form.required');
  if (values.last_name.trim() === '')
    errors.last_name = t('customers.form.required');
  if (values.email.trim() === '') {
    errors.email = t('customers.form.required');
  } else if (!/^\S+@\S+\.\S+$/.test(values.email.trim())) {
    errors.email = t('customers.form.invalidEmail');
  }
  if (values.phone.trim() === '') errors.phone = t('customers.form.required');
  return errors;
}

/** True when every address has its street and zip code (required by the legacy form, too). */
export function addressesComplete(addresses: AddressValue[]): boolean {
  return addresses.every(
    (a) => a.address.trim() !== '' && a.zip_code.trim() !== '',
  );
}

const place = (value: PlaceValue) => ({
  id: value.id,
  name: value.name.trim() === '' ? null : value.name,
});

function addressToPayload(value: AddressValue): AddressPayload {
  return {
    id: value.id,
    address: value.address.trim(),
    zip_code: value.zip_code.trim(),
    address_type: value.address_type,
    city: {
      ...place(value.city),
      state: {...place(value.state), country: place(value.country)},
    },
  };
}

export function customerFormToPayload(
  values: CustomerFormValues,
): CustomerPayload {
  return {
    first_name: values.first_name.trim(),
    last_name: values.last_name.trim(),
    email: values.email.trim(),
    phone: values.phone.trim(),
    addresses: values.addresses.map(addressToPayload),
  };
}

/** The API's violations ({field, message}) as the form's field errors. */
export function violationsToErrors(body: unknown): CustomerFormErrors {
  const errors: CustomerFormErrors = {};
  const violations =
    (body as {violations?: {field: string; message: string}[]} | null)
      ?.violations ?? [];
  for (const {field, message} of violations) {
    const name = field as keyof CustomerFormErrors;
    if (['first_name', 'last_name', 'email', 'phone'].includes(name)) {
      errors[name] ??= message;
    }
  }
  return errors;
}
