export {
  createCustomer,
  deleteCustomer,
  getCustomer,
  listAllCustomers,
  listCustomers,
  PAGE_SIZE,
  updateCustomer,
} from './api/customerApi';
export type {
  AddressPayload,
  Customer,
  CustomerPage,
  CustomerPayload,
} from './api/customerApi';
export {
  addressesComplete,
  customerFormToPayload,
  customerToForm,
  emptyAddress,
  emptyCustomerForm,
  validateCustomerForm,
  violationsToErrors,
} from './model/customerForm';
export type {
  AddressValue,
  CustomerFormErrors,
  CustomerFormValues,
  PlaceValue,
} from './model/customerForm';
