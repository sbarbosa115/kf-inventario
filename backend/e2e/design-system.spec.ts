import {
  ADMIN,
  INVENTORY,
  INVOICES,
  PASSWORD,
  consoleErrors,
  expect,
  test,
} from './support/test';

// Section 10 of docs/tests/ui-regression.md (and AUTH-07/08, NAV-05/06 of section 1): the redesign's shell, themes,
// languages and kit. Each test's browser context is its own, so a language or theme chosen here never leaks into
// another spec (they all run in English, light).

test.describe('10 Design system, at 1440 px', () => {
  test.use({viewport: {width: 1440, height: 860}});

  test('DS-01 · the shell shows the mark, the product name, the person, and the skip link first', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    const errors = consoleErrors(page);
    await page.goto('/admin/products');

    const brand = page.getByRole('link', {name: 'KF Inventory', exact: true});
    await expect(brand).toBeVisible();
    await expect(brand.locator('img')).toHaveAttribute(
      'src',
      '/images/kf-mark.svg',
    );
    const nav = page.getByRole('navigation', {name: 'Main menu'});
    for (const group of ['Warehouse', 'Sales', 'Admin']) {
      await expect(nav.getByText(group, {exact: true})).toBeVisible();
    }
    await expect(
      page.getByRole('button', {name: 'Sergio Barbosa'}),
    ).toBeVisible();

    await page.keyboard.press('Tab');
    await expect(
      page.getByRole('link', {name: 'Skip to content'}),
    ).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('main')).toBeFocused();
    expect(errors).toEqual([]);
  });

  test('DS-02 · the sidebar collapses to a rail and stays collapsed after a reload', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/products');

    await page.getByRole('button', {name: 'Collapse the menu'}).click();
    await expect(
      page.getByRole('link', {name: 'Products', exact: true}),
    ).toHaveAttribute('title', 'Products');
    await page.reload();
    await expect(
      page.getByRole('button', {name: 'Expand the menu'}),
    ).toBeVisible();
    await page.getByRole('button', {name: 'Expand the menu'}).click();
    await expect(
      page.getByRole('button', {name: 'Collapse the menu'}),
    ).toBeVisible();
  });

  test('DS-04 · the menus work with the keyboard: Enter opens with the first item focused, arrows, Home/End, Escape back', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/orders');

    const rowMenu = page.getByRole('button', {name: /^Actions for /}).first();
    await rowMenu.focus();
    await page.keyboard.press('Enter');
    const menu = page.getByRole('menu');
    const items = menu.getByRole('menuitem');
    await expect(items.first()).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(items.nth(1)).toBeFocused();
    await page.keyboard.press('End');
    await expect(items.last()).toBeFocused();
    await page.keyboard.press('Home');
    await expect(items.first()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(rowMenu).toBeFocused();

    const theme = page.getByRole('button', {name: /^Theme: /});
    await theme.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menuitemradio').first()).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(page.getByRole('menuitemradio').last()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(theme).toBeFocused();
  });

  test('DS-05 · the tab title follows the page', async ({signedInAs, page}) => {
    const admin = await signedInAs(ADMIN);
    await admin.goto('/admin/orders');
    const title = await admin.getByRole('heading', {level: 1}).textContent();
    await expect(admin).toHaveTitle(`${title?.trim()} · KF Inventory`);
    await admin.goto('/admin/nothing-here');
    await expect(admin).toHaveTitle('Page not found · KF Inventory');

    await page.goto('/admin/login');
    await expect(page).toHaveTitle('Sign in · KF Inventory');
  });

  test('DS-06 · the language switch changes the shell and the page, keeps the address and the rows, and survives a reload', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/orders');
    const rows = page.getByRole('row');
    await expect(rows.nth(1)).toBeVisible();
    const count = await rows.count();

    await page.getByRole('radio', {name: 'Español'}).click();
    await expect(
      page.getByRole('link', {name: 'Pedidos', exact: true}),
    ).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(page).toHaveURL(/\/admin\/orders$/);
    await expect(rows).toHaveCount(count);

    await page.reload();
    await expect(
      page.getByRole('link', {name: 'Clientes', exact: true}),
    ).toBeVisible();
    await page.getByRole('radio', {name: 'English'}).click();
    await expect(
      page.getByRole('link', {name: 'Orders', exact: true}),
    ).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('DS-07 · Dark is kept after a reload, and System follows the system', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.emulateMedia({colorScheme: 'light'});
    await page.goto('/admin/products');
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'light');

    await page.getByRole('button', {name: /^Theme: /}).click();
    await page.getByRole('menuitemradio', {name: 'Dark'}).click();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'dark');

    await page.getByRole('button', {name: 'Theme: Dark'}).click();
    await page.getByRole('menuitemradio', {name: 'System'}).click();
    await expect(html).toHaveAttribute('data-theme', 'light');
    await page.emulateMedia({colorScheme: 'dark'});
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'dark');
  });

  test('DS-08 · a success notification goes after 5 s, an error one stays until dismissed', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.clock.install();
    await page.goto('/admin/_kit');

    await page.getByRole('button', {name: 'Show a success toast'}).click();
    const success = page.getByRole('status').filter({hasText: 'Product saved'});
    await expect(success).toBeVisible();
    await page.clock.fastForward(4000);
    await expect(success).toBeVisible();
    await page.clock.fastForward(1500);
    await expect(success).toBeHidden();

    await page.getByRole('button', {name: 'Show an error toast'}).click();
    const failure = page
      .getByRole('alert')
      .filter({hasText: 'The shops could not be reached.'});
    await page.clock.fastForward(60_000);
    await expect(failure).toBeVisible();
    await failure.getByRole('button', {name: 'Dismiss'}).click();
    await expect(failure).toBeHidden();
  });

  test('DS-13 · sign in: the password can be shown, and what is missing is said in place', async ({
    page,
  }) => {
    await page.goto('/admin/login');

    const password = page.getByLabel('Password', {exact: true});
    await password.fill(PASSWORD);
    await expect(password).toHaveAttribute('type', 'password');
    await page.getByRole('button', {name: 'Show password'}).click();
    await expect(password).toHaveAttribute('type', 'text');

    await page.getByRole('button', {name: 'Sign in'}).click();
    await expect(page.getByRole('alert')).toHaveText(
      'Type your username and password.',
    );
    await expect(page.getByLabel('Username')).toBeFocused();
  });

  test('DS-14 · the page not found is branded and leads back', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/nothing-here');

    await expect(
      page.getByRole('heading', {name: 'Page not found'}),
    ).toBeVisible();
    await page.getByRole('link', {name: 'Go to the product list'}).click();
    await expect(page).toHaveURL(/\/admin\/products$/);
  });

  test('AUTH-07 · the sign-in page in Spanish, chosen or from the browser', async ({
    page,
    browser,
    baseURL,
  }) => {
    await page.goto('/admin/login');
    await page.getByRole('radio', {name: 'Español'}).click();
    await expect(
      page.getByRole('heading', {name: 'Iniciar sesión'}),
    ).toBeVisible();
    await expect(page.getByLabel('Usuario')).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole('button', {name: 'Iniciar sesión'}),
    ).toBeVisible();

    const spanish = await browser.newContext({baseURL, locale: 'es-CO'});
    const first = await spanish.newPage();
    await first.goto('/admin/login');
    await expect(
      first.getByRole('heading', {name: 'Iniciar sesión'}),
    ).toBeVisible();
    await spanish.close();
  });

  test('AUTH-08 · the top bar shows the name, and its menu the account and Sign out', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/products');

    await page.getByRole('button', {name: 'Sergio Barbosa'}).click();
    const menu = page.getByRole('menu');
    await expect(menu).toContainText(ADMIN);
    await expect(menu).toContainText('sbarbosa115@gmail.com');
    // Not clicked: it would end the session the other tests share.
    await expect(
      menu.getByRole('menuitem', {name: 'Sign out'}),
    ).toHaveAttribute('href', '/admin/logout');
  });

  test('NAV-06 · the scan shortcut is there for the inventory roles only', async ({
    signedInAs,
  }) => {
    const clerk = await signedInAs(INVENTORY);
    await clerk.goto('/admin/products');
    await expect(
      clerk.getByRole('link', {name: 'Open the reader'}),
    ).toHaveAttribute('href', '/admin/products/barcode');

    const invoices = await signedInAs(INVOICES);
    await invoices.goto('/admin/invoices');
    await expect(invoices.getByRole('heading', {level: 1})).toBeVisible();
    await expect(
      invoices.getByRole('link', {name: 'Open the reader'}),
    ).toHaveCount(0);
  });
});

test.describe('10 Design system, on a phone (390 px)', () => {
  test.use({
    viewport: {width: 390, height: 844},
    isMobile: true,
    hasTouch: true,
  });

  test('DS-03 · Menu opens the drawer, the tab bar shows the role’s entries, nothing scrolls sideways', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    const errors = consoleErrors(page);

    for (const path of [
      '/admin/products',
      '/admin/orders',
      '/admin/products/barcode',
    ]) {
      await page.goto(path);
      await expect(page.getByRole('heading', {level: 1})).toBeVisible();
      const [scroll, client] = await page.evaluate(() => [
        document.documentElement.scrollWidth,
        document.documentElement.clientWidth,
      ]);
      expect(scroll, `${path} scrolls sideways`).toBe(client);
    }

    await expect(page.getByRole('navigation', {name: 'Main menu'})).toHaveCount(
      0,
    );
    const tabs = page.getByRole('navigation', {name: 'Shortcuts'});
    await expect(tabs.getByRole('link')).toHaveText([
      'Products',
      'Scan',
      'Incoming',
    ]);
    await page.getByRole('button', {name: 'Menu'}).click();
    const drawer = page.getByRole('dialog', {name: 'Main menu'});
    await expect(drawer.getByRole('link', {name: 'Users'})).toBeVisible();
    await drawer.getByRole('link', {name: 'Orders'}).click();
    await expect(page).toHaveURL(/\/admin\/orders$/);
    await expect(drawer).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('NAV-05 · the tab bar of the inventory clerk: Products, Scan, Incoming, More', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(INVENTORY);
    await page.goto('/admin/products');

    const tabs = page.getByRole('navigation', {name: 'Shortcuts'});
    await expect(tabs.getByRole('link')).toHaveText([
      'Products',
      'Scan',
      'Incoming',
    ]);
    await tabs.getByRole('button', {name: 'More'}).click();
    await expect(
      page.getByRole('dialog', {name: 'Main menu'}).getByRole('link', {
        name: 'Upload a stock sheet',
      }),
    ).toBeVisible();
  });
});
