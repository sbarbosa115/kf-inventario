import {lazy, Suspense} from 'react';
import {Navigate, Outlet, Route, Routes} from 'react-router-dom';
import {LoginPage} from '@/pages/login';
import {LogoutPage} from '@/pages/logout';
import {NotFoundPage} from '@/pages/not-found';
import {Loader} from '@/shared/ui';
import {AppShell} from '@/widgets/app-shell';
import {RequireSession} from './providers/RequireSession';

// Every page behind the sign-in is loaded when first opened. One route per screen of the route map
// (docs/pdr/prd-restructure.md); each page slice's item replaces its stub, never this file.
const ProductsPage = lazy(() =>
  import('@/pages/products').then((m) => ({default: m.ProductsPage})),
);
const ProductFormPage = lazy(() =>
  import('@/pages/product-form').then((m) => ({default: m.ProductFormPage})),
);
const ProductsUploadPage = lazy(() =>
  import('@/pages/products-upload').then((m) => ({
    default: m.ProductsUploadPage,
  })),
);
const BarcodeReaderPage = lazy(() =>
  import('@/pages/barcode-reader').then((m) => ({
    default: m.BarcodeReaderPage,
  })),
);
const IncomingStockPage = lazy(() =>
  import('@/pages/incoming-stock').then((m) => ({
    default: m.IncomingStockPage,
  })),
);
const WarehousesPage = lazy(() =>
  import('@/pages/warehouses').then((m) => ({default: m.WarehousesPage})),
);
const OrdersPage = lazy(() =>
  import('@/pages/orders').then((m) => ({default: m.OrdersPage})),
);
const OrderFormPage = lazy(() =>
  import('@/pages/order-form').then((m) => ({default: m.OrderFormPage})),
);
const OrderGettingReadyPage = lazy(() =>
  import('@/pages/order-getting-ready').then((m) => ({
    default: m.OrderGettingReadyPage,
  })),
);
const InvoicesPage = lazy(() =>
  import('@/pages/invoices').then((m) => ({default: m.InvoicesPage})),
);
const InvoiceFormPage = lazy(() =>
  import('@/pages/invoice-form').then((m) => ({default: m.InvoiceFormPage})),
);
const CustomersPage = lazy(() =>
  import('@/pages/customers').then((m) => ({default: m.CustomersPage})),
);
const CustomerFormPage = lazy(() =>
  import('@/pages/customer-form').then((m) => ({default: m.CustomerFormPage})),
);
const UsersPage = lazy(() =>
  import('@/pages/users').then((m) => ({default: m.UsersPage})),
);
const UserFormPage = lazy(() =>
  import('@/pages/user-form').then((m) => ({default: m.UserFormPage})),
);

function SignedIn() {
  return (
    <RequireSession>
      <AppShell>
        <Suspense fallback={<Loader />}>
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
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
