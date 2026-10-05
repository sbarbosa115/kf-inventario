import {useState, type ReactNode} from 'react';
import {Link, NavLink, useLocation} from 'react-router-dom';
import {useCan, useSession} from '@/entities/session';
import {useTranslation} from '@/shared/i18n';
import './app-shell.css';

/**
 * The frame of every signed-in page: the top bar with the person's email and Logout, the sidebar with the entries
 * their roles open (the same rules as the legacy base.html.twig), and the page.
 */
export function AppShell({children}: {children: ReactNode}) {
  const {t} = useTranslation();
  const {session} = useSession();
  const [collapsed, setCollapsed] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  return (
    <div className="app-shell">
      <nav className="navbar navbar-expand navbar-dark bg-dark static-top">
        <Link className="navbar-brand mr-1" to="/admin/products">
          <i className="fas fa-boxes mr-1" aria-hidden="true" />
          {t('common.appName')}
        </Link>
        <button
          type="button"
          className="btn btn-link btn-sm text-white"
          aria-label={t('nav.toggle')}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((now) => !now)}
        >
          <i className="fas fa-bars" aria-hidden="true" />
        </button>
        <ul className="navbar-nav ml-auto">
          <li className="nav-item dropdown">
            <button
              type="button"
              className="btn btn-link nav-link dropdown-toggle"
              aria-haspopup="true"
              aria-expanded={accountOpen}
              onClick={() => setAccountOpen((now) => !now)}
            >
              <i className="fas fa-user-circle fa-fw" aria-hidden="true" />{' '}
              {session?.email ?? session?.username}
            </button>
            {accountOpen && (
              <div className="dropdown-menu dropdown-menu-right show">
                <Link className="dropdown-item" to="/admin/logout">
                  {t('nav.logout')}
                </Link>
              </div>
            )}
          </li>
        </ul>
      </nav>
      <div className="app-shell__wrapper">
        {!collapsed && <Sidebar />}
        <div className="app-shell__content">
          <main className="container-fluid pt-3">{children}</main>
          <footer className="app-shell__footer">
            {t('common.footer', {year: new Date().getFullYear()})}
          </footer>
        </div>
      </div>
    </div>
  );
}

function Sidebar() {
  const {t} = useTranslation();
  const {pathname} = useLocation();
  const inventory = useCan('ROLE_MANAGE_INVENTORY');
  const warehouses = useCan('ROLE_MANAGE_WAREHOUSES');
  const orders = useCan('ROLE_UPDATE_ORDERS');
  const invoices = useCan('ROLE_UPDATE_INVOICES');
  const customers = useCan('ROLE_MANAGE_CUSTOMERS');
  const users = useCan('ROLE_MANAGE_USERS');
  const [productsOpen, setProductsOpen] = useState(
    pathname.startsWith('/admin/products'),
  );

  return (
    <nav className="app-shell__sidebar" aria-label={t('nav.sections.products')}>
      <ul className="navbar-nav">
        {(inventory || warehouses) && (
          <li className="app-shell__section">{t('nav.sections.products')}</li>
        )}
        {inventory && (
          <li className="nav-item">
            <button
              type="button"
              className={`btn btn-link nav-link dropdown-toggle${pathname.startsWith('/admin/products') ? ' active' : ''}`}
              aria-expanded={productsOpen}
              onClick={() => setProductsOpen((now) => !now)}
            >
              <i className="fas fa-fw fa-boxes" aria-hidden="true" />{' '}
              {t('nav.products')}
            </button>
            {productsOpen && (
              <ul className="app-shell__submenu">
                <Entry to="/admin/products" end label={t('nav.productList')} />
                <Entry
                  to="/admin/products/upload"
                  label={t('nav.productsUpload')}
                />
                <Entry to="/admin/products/barcode" label={t('nav.barcode')} />
                <Entry
                  to="/admin/products/incoming"
                  label={t('nav.incoming')}
                />
              </ul>
            )}
          </li>
        )}
        {warehouses && (
          <Entry
            to="/admin/warehouses"
            icon="fa-warehouse"
            label={t('nav.warehouses')}
          />
        )}
        {(orders || invoices || customers) && (
          <li className="app-shell__section">{t('nav.sections.sales')}</li>
        )}
        {orders && (
          <Entry
            to="/admin/orders"
            icon="fa-shopping-cart"
            label={t('nav.orders')}
          />
        )}
        {invoices && (
          <Entry
            to="/admin/invoices"
            icon="fa-file-invoice-dollar"
            label={t('nav.invoices')}
          />
        )}
        {customers && (
          <Entry
            to="/admin/customers"
            icon="fa-users"
            label={t('nav.customers')}
          />
        )}
        {users && (
          <>
            <li className="app-shell__section">{t('nav.sections.admin')}</li>
            <Entry
              to="/admin/users"
              icon="fa-user-cog"
              label={t('nav.users')}
            />
          </>
        )}
      </ul>
    </nav>
  );
}

function Entry({
  to,
  label,
  icon,
  end = false,
}: {
  to: string;
  label: string;
  icon?: string;
  end?: boolean;
}) {
  return (
    <li className="nav-item">
      <NavLink to={to} end={end} className="nav-link">
        {icon && <i className={`fas fa-fw ${icon}`} aria-hidden="true" />}{' '}
        {label}
      </NavLink>
    </li>
  );
}
