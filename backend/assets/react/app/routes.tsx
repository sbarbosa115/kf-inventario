import {lazy, Suspense} from 'react';
import {Navigate, Outlet, Route, Routes} from 'react-router-dom';
import {LoginPage} from '@/pages/login';
import {LogoutPage} from '@/pages/logout';
import {NotFoundPage} from '@/pages/not-found';
import {Skeleton} from '@/shared/ui';
import {AppShell} from '@/widgets/app-shell';
import {RequireSession} from './providers/RequireSession';

// Every page behind the sign-in is loaded when first opened, one chunk per screen. PAGES is also what
// prefetchRoute() starts while the session is still being asked, so the two load in parallel.
const PAGES = {
  products: () => import('@/pages/products'),
  productForm: () => import('@/pages/product-form'),
  productsUpload: () => import('@/pages/products-upload'),
  barcodeReader: () => import('@/pages/barcode-reader'),
  incomingStock: () => import('@/pages/incoming-stock'),
  warehouses: () => import('@/pages/warehouses'),
  orders: () => import('@/pages/orders'),
  orderForm: () => import('@/pages/order-form'),
  orderGettingReady: () => import('@/pages/order-getting-ready'),
  invoices: () => import('@/pages/invoices'),
  invoiceForm: () => import('@/pages/invoice-form'),
  customers: () => import('@/pages/customers'),
  customerForm: () => import('@/pages/customer-form'),
  users: () => import('@/pages/users'),
  userForm: () => import('@/pages/user-form'),
};

const ProductsPage = lazy(() =>
  PAGES.products().then((m) => ({default: m.ProductsPage})),
);
const ProductFormPage = lazy(() =>
  PAGES.productForm().then((m) => ({default: m.ProductFormPage})),
);
const ProductsUploadPage = lazy(() =>
  PAGES.productsUpload().then((m) => ({default: m.ProductsUploadPage})),
);
const BarcodeReaderPage = lazy(() =>
  PAGES.barcodeReader().then((m) => ({default: m.BarcodeReaderPage})),
);
const IncomingStockPage = lazy(() =>
  PAGES.incomingStock().then((m) => ({default: m.IncomingStockPage})),
);
const WarehousesPage = lazy(() =>
  PAGES.warehouses().then((m) => ({default: m.WarehousesPage})),
);
const OrdersPage = lazy(() =>
  PAGES.orders().then((m) => ({default: m.OrdersPage})),
);
const OrderFormPage = lazy(() =>
  PAGES.orderForm().then((m) => ({default: m.OrderFormPage})),
);
const OrderGettingReadyPage = lazy(() =>
  PAGES.orderGettingReady().then((m) => ({
    default: m.OrderGettingReadyPage,
  })),
);
const InvoicesPage = lazy(() =>
  PAGES.invoices().then((m) => ({default: m.InvoicesPage})),
);
const InvoiceFormPage = lazy(() =>
  PAGES.invoiceForm().then((m) => ({default: m.InvoiceFormPage})),
);
const CustomersPage = lazy(() =>
  PAGES.customers().then((m) => ({default: m.CustomersPage})),
);
const CustomerFormPage = lazy(() =>
  PAGES.customerForm().then((m) => ({default: m.CustomerFormPage})),
);
const UsersPage = lazy(() =>
  PAGES.users().then((m) => ({default: m.UsersPage})),
);
const UserFormPage = lazy(() =>
  PAGES.userForm().then((m) => ({default: m.UserFormPage})),
);

/** Which page chunk an address opens, most specific first. */
const PREFETCH: [RegExp, keyof typeof PAGES][] = [
  [/^\/admin\/products\/(new|[^/]+\/edit)$/, 'productForm'],
  [/^\/admin\/products\/upload$/, 'productsUpload'],
  [/^\/admin\/products\/barcode$/, 'barcodeReader'],
  [/^\/admin\/products\/incoming$/, 'incomingStock'],
  [/^\/(admin(\/products)?)?\/?$/, 'products'],
  [/^\/admin\/warehouses$/, 'warehouses'],
  [/^\/admin\/orders\/[^/]+\/getting-ready$/, 'orderGettingReady'],
  [/^\/admin\/orders\/(new|[^/]+\/edit)$/, 'orderForm'],
  [/^\/admin\/orders$/, 'orders'],
  [/^\/admin\/invoices\/new$/, 'invoiceForm'],
  [/^\/admin\/invoices$/, 'invoices'],
  [/^\/admin\/customers\/(new|[^/]+\/edit)$/, 'customerForm'],
  [/^\/admin\/customers$/, 'customers'],
  [/^\/admin\/users\/(new|[^/]+\/edit)$/, 'userForm'],
  [/^\/admin\/users$/, 'users'],
];

/**
 * Starts loading the page chunk of the address being opened, so it arrives while /auth/me is still pending
 * (called once by App). Returns the page's name, or null for an address that has none (sign-in, not found).
 */
export function prefetchRoute(pathname: string): string | null {
  const found = PREFETCH.find(([pattern]) => pattern.test(pathname));
  if (!found) return null;
  PAGES[found[1]]().catch(() => undefined);
  return found[1];
}

// The kit's specimen page (docs/design/README.md): development only, never in a production build.
const KitPage =
  process.env.NODE_ENV !== 'production'
    ? lazy(() => import('@/pages/kit').then((m) => ({default: m.KitPage})))
    : null;

function SignedIn() {
  return (
    <RequireSession>
      <AppShell>
        <Suspense fallback={<Skeleton variant="text" lines={6} />}>
          <Outlet />
        </Suspense>
      </AppShell>
    </RequireSession>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/admin/login" element={<LoginPage />} />
      <Route path="/admin/logout" element={<LogoutPage />} />
      <Route element={<SignedIn />}>
        <Route path="/" element={<Navigate to="/admin/products" replace />} />
        <Route
          path="/admin"
          element={<Navigate to="/admin/products" replace />}
        />
        <Route path="/admin/products" element={<ProductsPage />} />
        <Route path="/admin/products/new" element={<ProductFormPage />} />
        <Route
          path="/admin/products/:uuid/edit"
          element={<ProductFormPage />}
        />
        <Route path="/admin/products/upload" element={<ProductsUploadPage />} />
        <Route path="/admin/products/barcode" element={<BarcodeReaderPage />} />
        <Route
          path="/admin/products/incoming"
          element={<IncomingStockPage />}
        />
        <Route path="/admin/warehouses" element={<WarehousesPage />} />
        <Route path="/admin/orders" element={<OrdersPage />} />
        <Route path="/admin/orders/new" element={<OrderFormPage />} />
        <Route path="/admin/orders/:id/edit" element={<OrderFormPage />} />
        <Route
          path="/admin/orders/:id/getting-ready"
          element={<OrderGettingReadyPage />}
        />
        <Route path="/admin/invoices" element={<InvoicesPage />} />
        <Route path="/admin/invoices/new" element={<InvoiceFormPage />} />
        <Route path="/admin/customers" element={<CustomersPage />} />
        <Route path="/admin/customers/new" element={<CustomerFormPage />} />
        <Route
          path="/admin/customers/:id/edit"
          element={<CustomerFormPage />}
        />
        <Route path="/admin/users" element={<UsersPage />} />
        <Route path="/admin/users/new" element={<UserFormPage />} />
        <Route path="/admin/users/:id/edit" element={<UserFormPage />} />
        {KitPage && <Route path="/admin/_kit" element={<KitPage />} />}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
