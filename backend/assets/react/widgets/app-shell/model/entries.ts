/** The shell's navigation: which entries a person's roles open (the legacy sidebar's rules), grouped. */
export type NavGroup = 'warehouse' | 'sales' | 'admin';

export interface NavEntry {
  key: string;
  to: string;
  /** An i18n key. */
  label: string;
  icon: string;
  group: NavGroup;
  role: string;
}

export const GROUPS: NavGroup[] = ['warehouse', 'sales', 'admin'];

const ALL: NavEntry[] = [
  {
    key: 'products',
    to: '/admin/products',
    label: 'nav.productList',
    icon: 'fa-boxes-stacked',
    group: 'warehouse',
    role: 'ROLE_MANAGE_INVENTORY',
  },
  {
    key: 'upload',
    to: '/admin/products/upload',
    label: 'nav.productsUpload',
    icon: 'fa-file-arrow-up',
    group: 'warehouse',
    role: 'ROLE_MANAGE_INVENTORY',
  },
  {
    key: 'scan',
    to: '/admin/products/barcode',
    label: 'nav.barcode',
    icon: 'fa-barcode',
    group: 'warehouse',
    role: 'ROLE_MANAGE_INVENTORY',
  },
  {
    key: 'incoming',
    to: '/admin/products/incoming',
    label: 'nav.incoming',
    icon: 'fa-dolly',
    group: 'warehouse',
    role: 'ROLE_MANAGE_INVENTORY',
  },
  {
    key: 'warehouses',
    to: '/admin/warehouses',
    label: 'nav.warehouses',
    icon: 'fa-warehouse',
    group: 'warehouse',
    role: 'ROLE_MANAGE_WAREHOUSES',
  },
  {
    key: 'orders',
    to: '/admin/orders',
    label: 'nav.orders',
    icon: 'fa-cart-shopping',
    group: 'sales',
    role: 'ROLE_UPDATE_ORDERS',
  },
  {
    key: 'customers',
    to: '/admin/customers',
    label: 'nav.customers',
    icon: 'fa-users',
    group: 'sales',
    role: 'ROLE_MANAGE_CUSTOMERS',
  },
  {
    key: 'invoices',
    to: '/admin/invoices',
    label: 'nav.invoices',
    icon: 'fa-file-invoice-dollar',
    group: 'sales',
    role: 'ROLE_UPDATE_INVOICES',
  },
  {
    key: 'users',
    to: '/admin/users',
    label: 'nav.users',
    icon: 'fa-user-gear',
    group: 'admin',
    role: 'ROLE_MANAGE_USERS',
  },
  {
    key: 'settings',
    to: '/admin/settings',
    label: 'nav.settings',
    icon: 'fa-sliders',
    group: 'admin',
    role: 'ROLE_ADMIN',
  },
];

/**
 * The tab bar's order: the work done standing up first (Products, Scan, Incoming), then the sales office's, so an
 * inventory clerk gets Products · Scan · Incoming and a sales clerk Orders · Customers · Invoices. Upload, a desk
 * task, comes last (docs/pdr/prd-redesign.md, Decisions 17).
 */
const TAB_ORDER = [
  'products',
  'scan',
  'incoming',
  'orders',
  'customers',
  'invoices',
  'warehouses',
  'users',
  'upload',
  'settings',
];

/** The entries the session's roles open (the server sends every reachable role), in sidebar order. */
export function entriesFor(roles: readonly string[]): NavEntry[] {
  return ALL.filter((entry) => roles.includes(entry.role));
}

/** The bottom tab bar's three entries. */
export function tabsFor(entries: NavEntry[]): NavEntry[] {
  return TAB_ORDER.map((key) => entries.find((e) => e.key === key))
    .filter((e): e is NavEntry => e !== undefined)
    .slice(0, 3);
}

/** The entry the address belongs to: the longest matching path ("/admin/products/barcode" is Scan, not Products). */
export function activeEntry(
  pathname: string,
  entries: NavEntry[],
): string | undefined {
  return entries
    .filter((e) => pathname === e.to || pathname.startsWith(`${e.to}/`))
    .sort((a, b) => b.to.length - a.to.length)[0]?.key;
}
