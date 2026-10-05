// The Spanish catalogue: one file per i18n prefix, so each screen item edits only its own (docs/pdr/prd-redesign.md,
// Decisions 7). Every key here exists in the other language too (i18n.test.ts).
import common from './common.json';
import nav from './nav.json';
import auth from './auth.json';
import errors from './errors.json';
import users from './users.json';
import products from './products.json';
import stock from './stock.json';
import customers from './customers.json';
import address from './address.json';
import orders from './orders.json';
import orderForm from './orderForm.json';
import gettingReady from './gettingReady.json';
import invoices from './invoices.json';
import roles from './roles.json';

export default {
  common,
  nav,
  auth,
  errors,
  users,
  products,
  stock,
  customers,
  address,
  orders,
  orderForm,
  gettingReady,
  invoices,
  roles,
};
