import {act, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import {SessionProvider} from '@/entities/session';
import {fakeApi} from '@/shared/test/fakeApi';
import {AppShell} from './AppShell';

const ADMIN = [
  'ROLE_ADMIN',
  'ROLE_MANAGE_INVENTORY',
  'ROLE_MANAGE_WAREHOUSES',
  'ROLE_UPDATE_ORDERS',
  'ROLE_MANAGE_CUSTOMERS',
  'ROLE_MANAGE_USERS',
  'ROLE_USER',
];
const INVENTORY = ['ROLE_MANAGE_INVENTORY', 'ROLE_USER'];
const SALES = [
  'ROLE_UPDATE_ORDERS',
  'ROLE_MANAGE_CUSTOMERS',
  'ROLE_UPDATE_INVOICES',
  'ROLE_USER',
];

/** A window as wide as the test says: desktop from 1024 px. */
function setWidth(desktop: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query.includes('min-width: 1024px') ? desktop : false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

async function renderAs(roles: string[], path = '/admin/products') {
  fakeApi({
    'GET /auth/me': [
      200,
      {id: 1, username: 'ana', name: 'Ana Gómez', email: 'ana@kf.test', roles},
    ],
  });
  render(
    <SessionProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppShell>
          <p>page</p>
        </AppShell>
      </MemoryRouter>
    </SessionProvider>,
  );
  await screen.findByRole('button', {name: 'Ana Gómez'});
}

/** Every link's accessible name appears once: Playwright's strict mode depends on it. */
function expectUniqueLinkNames() {
  const names = screen.getAllByRole('link').map((l) => l.textContent?.trim());
  expect(names.length).toBe(new Set(names).size);
}

describe('AppShell on a desktop', () => {
  beforeEach(() => setWidth(true));
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('shows an inventory person the warehouse entries and nothing of sales or admin', async () => {
    await renderAs(INVENTORY);

    const nav = screen.getByRole('navigation', {name: 'Main menu'});
    expect(within(nav).getByRole('link', {name: 'Products'})).toHaveAttribute(
      'href',
      '/admin/products',
    );
    expect(within(nav).getByRole('link', {name: 'Products'})).toHaveAttribute(
      'aria-current',
      'page',
    );
    for (const name of ['Upload a stock sheet', 'Scan', 'Incoming']) {
      expect(within(nav).getByRole('link', {name})).toBeInTheDocument();
    }
    for (const name of [
      'Warehouses',
      'Orders',
      'Customers',
      'Invoices',
      'Users',
    ]) {
      expect(screen.queryByRole('link', {name})).not.toBeInTheDocument();
    }
    expect(screen.getByRole('link', {name: 'Open the reader'})).toHaveAttribute(
      'href',
      '/admin/products/barcode',
    );
    expect(screen.queryByRole('navigation', {name: 'Shortcuts'})).toBeNull();
    expectUniqueLinkNames();
  });

  it('shows the entries of every role an admin reaches, as the legacy sidebar did', async () => {
    await renderAs(ADMIN);

    for (const name of ['Warehouses', 'Orders', 'Customers', 'Users']) {
      expect(screen.getByRole('link', {name})).toBeInTheDocument();
    }
    // Invoices need ROLE_UPDATE_INVOICES, which no role reaches through the hierarchy (unchanged from the legacy app).
    expect(
      screen.queryByRole('link', {name: 'Invoices'}),
    ).not.toBeInTheDocument();
    expectUniqueLinkNames();
  });

  it('gives the sales office no scan shortcut', async () => {
    await renderAs(SALES, '/admin/orders');

    expect(screen.getByRole('link', {name: 'Invoices'})).toBeInTheDocument();
    expect(screen.queryByRole('link', {name: 'Open the reader'})).toBeNull();
  });

  it('collapses the sidebar to a rail of icons and remembers it', async () => {
    await renderAs(INVENTORY);

    await userEvent.click(
      screen.getByRole('button', {name: 'Collapse the menu'}),
    );
    expect(localStorage.getItem('kf.sidebar')).toBe('rail');
    const products = screen.getByRole('link', {name: 'Products'});
    expect(products).toHaveAttribute('title', 'Products');
    expect(
      screen.getByRole('button', {name: 'Expand the menu'}),
    ).toHaveAttribute('aria-expanded', 'false');
  });

  it('starts as a rail when it was left so', async () => {
    localStorage.setItem('kf.sidebar', 'rail');
    await renderAs(INVENTORY);

    expect(screen.getByRole('button', {name: 'Expand the menu'})).toBeVisible();
  });

  it('has a skip link first, the landmarks, and the account menu with the name', async () => {
    await renderAs(ADMIN);

    const links = screen.getAllByRole('link');
    expect(links[0]).toHaveTextContent('Skip to content');
    expect(links[0]).toHaveAttribute('href', '#main');
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
    await userEvent.click(screen.getByRole('button', {name: 'Ana Gómez'}));
    const menu = screen.getByRole('menu');
    expect(menu).toHaveTextContent('ana');
    expect(menu).toHaveTextContent('ana@kf.test');
    expect(
      within(menu).getByRole('menuitem', {name: 'Sign out'}),
    ).toHaveAttribute('href', '/admin/logout');
  });
});

describe('AppShell on a phone', () => {
  beforeEach(() => setWidth(false));
  afterEach(() => vi.unstubAllGlobals());

  it('has no sidebar; a tab bar with the first entries the role reaches, and More', async () => {
    await renderAs(INVENTORY);

    expect(screen.queryByRole('navigation', {name: 'Main menu'})).toBeNull();
    const tabs = screen.getByRole('navigation', {name: 'Shortcuts'});
    expect(
      within(tabs)
        .getAllByRole('link')
        .map((l) => l.textContent),
    ).toEqual(['Products', 'Scan', 'Incoming']);
    expect(within(tabs).getByRole('button', {name: 'More'})).toBeVisible();
    expectUniqueLinkNames();
  });

  it('gives the sales office its own tabs', async () => {
    await renderAs(SALES, '/admin/orders');

    const tabs = screen.getByRole('navigation', {name: 'Shortcuts'});
    expect(
      within(tabs)
        .getAllByRole('link')
        .map((l) => l.textContent),
    ).toEqual(['Orders', 'Customers', 'Invoices']);
  });

  it('opens the whole menu as a drawer from Menu or More, hiding the tab bar behind it', async () => {
    await renderAs(ADMIN);

    await userEvent.click(screen.getByRole('button', {name: 'Menu'}));
    const drawer = screen.getByRole('dialog', {name: 'Main menu'});
    for (const name of [
      'Products',
      'Upload a stock sheet',
      'Warehouses',
      'Orders',
      'Users',
    ]) {
      expect(within(drawer).getByRole('link', {name})).toBeInTheDocument();
    }
    expect(screen.queryByRole('navigation', {name: 'Shortcuts'})).toBeNull();
    expectUniqueLinkNames();

    await userEvent.click(within(drawer).getByRole('link', {name: 'Orders'}));
    expect(screen.queryByRole('dialog')).toBeNull();

    await userEvent.click(screen.getByRole('button', {name: 'More'}));
    expect(screen.getByRole('dialog', {name: 'Main menu'})).toBeVisible();
    await act(() => userEvent.keyboard('{Escape}'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
