export {
  createProduct,
  getProduct,
  listStock,
  STOCK_IN,
  STOCK_INCOMING,
  updateProduct,
} from './api/productApi';
export type {Product, ProductPayload, StockItem} from './api/productApi';
export {
  emptyProductForm,
  productFormToPayload,
  productToForm,
  validateProductForm,
  violationsToErrors,
} from './model/productForm';
export type {ProductFormErrors, ProductFormValues} from './model/productForm';
