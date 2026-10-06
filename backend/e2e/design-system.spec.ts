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

  test('DS-01 · The shell at 1440 px', async ({signedInAs}) => {
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

  test('DS-02 · The sidebar collapses to a rail with tooltips and stays so', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/products');

    await page.getByRole('button', {name: 'Collapse the menu'}).click();
    // The rail: icons named by their tooltip, the current page's marked.
    const rail = page.getByRole('navigation', {name: 'Main menu'});
    for (const name of ['Products', 'Upload a stock sheet', 'Scan', 'Orders']) {
      await expect(rail.getByRole('link', {name, exact: true})).toHaveAttribute(
        'title',
        name,
      );
    }
    await expect(
      rail.getByRole('link', {name: 'Products', exact: true}),
    ).toHaveAttribute('aria-current', 'page');
    await expect(
      rail.getByRole('link', {name: 'Orders', exact: true}),
    ).not.toHaveAttribute('aria-current');
    await page.reload();
    await expect(
      page.getByRole('button', {name: 'Expand the menu'}),
    ).toBeVisible();
    await page.getByRole('button', {name: 'Expand the menu'}).click();
    await expect(
      page.getByRole('button', {name: 'Collapse the menu'}),
    ).toBeVisible();
  });

  test('DS-04 · Menus work with the keyboard, and the focus ring shows', async ({
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
    // The ring: 2 px of the accent around what has the keyboard's focus.
    const ring = (el: Element) => {
      const style = getComputedStyle(el);
      return `${style.outlineStyle} ${style.outlineWidth}`;
    };
    expect(await rowMenu.evaluate(ring)).toBe('solid 2px');
    await page.keyboard.press('Tab');
    expect(
      await page.evaluate(() => {
        const el = document.activeElement as Element;
        const style = getComputedStyle(el);
        return `${style.outlineStyle} ${style.outlineWidth}`;
      }),
      'the next control shows the ring too',
    ).toBe('solid 2px');

    const theme = page.getByRole('button', {name: /^Theme: /});
    await theme.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menuitemradio').first()).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(page.getByRole('menuitemradio').last()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(theme).toBeFocused();
  });

  test('DS-05 · The tab title follows the page', async ({signedInAs, page}) => {
    const admin = await signedInAs(ADMIN);
    await admin.goto('/admin/orders');
    const title = await admin.getByRole('heading', {level: 1}).textContent();
    await expect(admin).toHaveTitle(`${title?.trim()} · KF Inventory`);
    await admin.goto('/admin/nothing-here');
    await expect(admin).toHaveTitle('Page not found · KF Inventory');

    await page.goto('/admin/login');
    await expect(page).toHaveTitle('Sign in · KF Inventory');
  });

  test('DS-06 · The language switch keeps the page', async ({signedInAs}) => {
    const page = await signedInAs(ADMIN);
    // The customers: a full page of them (FLT-05's), which no other case changes in number.
    await page.goto('/admin/customers');
    const rows = page.locator('tbody tr[role="row"]');
    await expect(rows.first()).toBeVisible();
    const count = await rows.count();

    await page.getByRole('radio', {name: 'Español'}).click();
    await expect(
      page.getByRole('link', {name: 'Pedidos', exact: true}),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', {level: 1, name: 'Clientes'}),
    ).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(page).toHaveURL(/\/admin\/customers$/);
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

  test("DS-07 · Light, dark, or the system's, without a white flash", async ({
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
    // No white flash: the theme is on <html> when the body is first parsed, before the app's script runs.
    await page.addInitScript(() => {
      new MutationObserver((_, observer) => {
        if (document.body) {
          document.documentElement.dataset.firstPaintTheme =
            document.documentElement.dataset.theme ?? 'none';
          observer.disconnect();
        }
      }).observe(document, {childList: true, subtree: true});
    });
    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await expect(html).toHaveAttribute('data-first-paint-theme', 'dark');

    await page.getByRole('button', {name: 'Theme: Dark'}).click();
    await page.getByRole('menuitemradio', {name: 'System'}).click();
    await expect(html).toHaveAttribute('data-theme', 'light');
    await page.emulateMedia({colorScheme: 'dark'});
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'dark');
  });

  test('DS-08 · Notifications', async ({signedInAs}) => {
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

  test('DS-13 · Signing in: show the password, Caps Lock, the error in place', async ({
    page,
  }) => {
    await page.goto('/admin/login');

    const password = page.getByLabel('Password', {exact: true});
    await password.fill(PASSWORD);
    await expect(password).toHaveAttribute('type', 'password');
    await page.getByRole('button', {name: 'Show password'}).click();
    await expect(password).toHaveAttribute('type', 'text');

    // A key pressed with Caps Lock on (the browser reports the lock on the key's event).
    await password.dispatchEvent('keyup', {key: 'A', modifierCapsLock: true});
    await expect(page.getByText('Caps Lock is on')).toBeVisible();
    await password.dispatchEvent('keyup', {key: 'a', modifierCapsLock: false});
    await expect(page.getByText('Caps Lock is on')).toHaveCount(0);

    await page.getByRole('button', {name: 'Sign in'}).click();
    await expect(page.getByRole('alert')).toHaveText(
      'Type your username and password.',
    );
    await expect(page.getByLabel('Username')).toBeFocused();
  });

  test('DS-14 · The page not found is branded, with the way back', async ({
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

  test('AUTH-07 · The sign-in page in Spanish', async ({
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

  test('AUTH-08 · The name in the top bar, Sign out in its menu', async ({
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

  test('NAV-06 · The scan shortcut only for the inventory roles', async ({
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

  test('DS-15 · Every filter control in the kit works', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    const errors = consoleErrors(page);
    await page.goto('/admin/_kit');
    const kit = page.getByRole('region', {name: 'Table filters'});
    // The controls on their own, above the server-mode table that uses them too.
    const controls = kit.locator('.kit-page__filters');

    await expect(
      controls.getByRole('searchbox', {name: 'Filter by Order'}),
    ).toBeVisible();
    await controls.getByRole('button', {name: 'Status · 1'}).click();
    const status = page.getByRole('dialog', {name: 'Status · 1'});
    await expect(status.getByRole('checkbox', {name: /Created/})).toBeChecked();
    await expect(status).toContainText('Delivered40');
    await page.keyboard.press('Escape');
    await expect(status).toHaveCount(0);

    await controls.getByRole('button', {name: 'Created', exact: true}).click();
    await page.getByRole('button', {name: 'Last 7 days'}).click();
    await expect(
      controls.getByRole('button', {name: /^Created: /}),
    ).toBeVisible();
    await page.keyboard.press('Escape');

    await controls.getByRole('button', {name: 'Total: $100 – $500'}).click();
    await page.getByRole('button', {name: 'Over $500'}).click();
    await expect(
      controls.getByRole('button', {name: 'Total: Over $500'}),
    ).toBeVisible();
    await page.keyboard.press('Escape');

    await kit
      .getByRole('button', {name: 'Remove the filter Status: Created'})
      .click();
    await expect(kit.getByText('Status: Created')).toHaveCount(0);
    const pager = kit.getByRole('navigation', {name: 'Pages'}).first();
    await expect(pager).toContainText('51 – 75 of 1,240');
    await pager.getByRole('button', {name: 'Next'}).click();
    await expect(pager).toContainText('76 – 100 of 1,240');

    // The server-mode table: a header sort and a status tick ask for other rows.
    const area = kit.locator('.kf-data-table');
    const table = area.getByRole('table');
    await expect(area.getByText('1 – 10 of 64')).toBeVisible();
    await table.getByRole('button', {name: /^Order/}).click();
    await expect(table.getByRole('row').nth(2)).toContainText('W00001');
    await table.getByRole('button', {name: 'Status', exact: true}).click();
    await page
      .getByRole('dialog', {name: 'Status'})
      .getByRole('checkbox', {name: /Delivered/})
      .check();
    await page.keyboard.press('Escape');
    await expect(area.getByText('Status: Delivered')).toBeVisible();
    await expect(table.getByRole('row').filter({hasText: 'W000'})).toHaveCount(
      10,
    );
    await expect(
      table
        .getByRole('row')
        .filter({hasText: 'W000'})
        .filter({hasNotText: 'Delivered'}),
    ).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});

test.describe('10 Design system, on a phone (390 px)', () => {
  test.use({
    viewport: {width: 390, height: 844},
    isMobile: true,
    hasTouch: true,
  });

  test('DS-03 · The phone layout', async ({signedInAs}) => {
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

  test('NAV-05 · The tab bar of the inventory clerk on a phone', async ({
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

  test('DS-16 · The filter sheet on a phone', async ({signedInAs}) => {
    const page = await signedInAs(ADMIN);
    const errors = consoleErrors(page);
    await page.goto('/admin/_kit');
    const kit = page
      .getByRole('region', {name: 'Table filters'})
      .locator('.kf-data-table');
    const table = kit.getByRole('table');
    await expect(table.getByRole('row').filter({hasText: 'W000'})).toHaveCount(
      10,
    );
    await expect(
      table.locator('.kf-table__filters'),
      'no filter row on a phone',
    ).toHaveCount(0);

    await kit.getByRole('button', {name: 'Filters · 0'}).click();
    const sheet = page.getByRole('dialog', {name: 'Filters'});
    await expect(sheet).toBeVisible();
    for (let i = 0; i < 12; i++) await page.keyboard.press('Tab');
    expect(
      await page.evaluate(
        () => !!document.activeElement?.closest('[role="dialog"]'),
      ),
      'the focus stays in the sheet',
    ).toBe(true);
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(kit.getByText('Status: Created')).toHaveCount(0);

    await kit.getByRole('button', {name: 'Filters · 0'}).click();
    await sheet.getByRole('button', {name: /^Status/}).click();
    await sheet.getByRole('checkbox', {name: /Created/}).check();
    await sheet.getByRole('button', {name: 'Show 11 results'}).click();

    await expect(sheet).toHaveCount(0);
    await expect(kit.getByText('Status: Created')).toBeVisible();
    await expect(
      table.getByRole('row').filter({hasText: 'Delivered'}),
    ).toHaveCount(0);
    await expect(kit.getByRole('button', {name: 'Filters · 1'})).toBeVisible();
    expect(errors).toEqual([]);
  });
});
