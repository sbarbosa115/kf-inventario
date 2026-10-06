import {
  ADMIN,
  INVENTORY,
  PASSWORD,
  consoleErrors,
  expect,
  test,
} from './support/test';

test.describe('1 Authentication and shell', () => {
  test('AUTH-01 · Signing in opens the product list', async ({page}) => {
    const errors = consoleErrors(page);
    await page.goto('/admin/login');

    await page.getByLabel('Username').fill(ADMIN);
    await page.getByLabel('Password', {exact: true}).fill(PASSWORD);
    await page.getByRole('button', {name: 'Sign in'}).click();

    await expect(page).toHaveURL(/\/admin\/products$/);
    await expect(
      page.getByRole('button', {name: 'Sergio Barbosa'}),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('AUTH-02 · A wrong password is refused', async ({page}) => {
    await page.goto('/admin/login');

    await page.getByLabel('Username').fill(ADMIN);
    await page.getByLabel('Password', {exact: true}).fill('not-the-password');
    await page.getByRole('button', {name: 'Sign in'}).click();

    await expect(page.getByRole('alert')).toHaveText(
      'Wrong username or password.',
    );
    await expect(page).toHaveURL(/\/admin\/login$/);
  });

  test('AUTH-03 · A page opened signed out comes back after signing in', async ({
    page,
  }) => {
    await page.goto('/admin/warehouses');

    await expect(page).toHaveURL(/\/admin\/login$/);
    await page.getByLabel('Username').fill(ADMIN);
    await page.getByLabel('Password', {exact: true}).fill(PASSWORD);
    await page.getByRole('button', {name: 'Sign in'}).click();

    await expect(page).toHaveURL(/\/admin\/warehouses$/);
  });

  test('AUTH-04 · Sign out ends the session', async ({page}) => {
    // Its own session: signing out of the shared one (signedInAs) would sign every later test out.
    await page.goto('/admin/login');
    await page.getByLabel('Username').fill(ADMIN);
    await page.getByLabel('Password', {exact: true}).fill(PASSWORD);
    await page.getByRole('button', {name: 'Sign in'}).click();
    await expect(page).toHaveURL(/\/admin\/products$/);

    await page.getByRole('button', {name: 'Sergio Barbosa'}).click();
    await page.getByRole('menuitem', {name: 'Sign out'}).click();

    await expect(page).toHaveURL(/\/admin\/login$/);
    await page.goto('/admin/products');
    await expect(page).toHaveURL(/\/admin\/login$/);
  });

  test('AUTH-05 · A legacy bookmark opened signed out goes to the sign-in page', async ({
    page,
  }) => {
    await page.goto('/admin/product/');

    await expect(page).toHaveURL(/\/admin\/login$/);
  });

  test('AUTH-06 · Remember me keeps you signed in after closing the browser', async ({
    browser,
    baseURL,
  }) => {
    for (const remember of [true, false]) {
      const context = await browser.newContext({baseURL});
      const page = await context.newPage();
      await page.goto('/admin/login');
      await page.getByLabel('Username').fill(ADMIN);
      await page.getByLabel('Password', {exact: true}).fill(PASSWORD);
      if (remember) {
        await page.getByLabel('Remember me').check();
      }
      await page.getByRole('button', {name: 'Sign in'}).click();
      await expect(page).toHaveURL(/\/admin\/products$/);

      // Closing the browser drops the cookies that last only for the session; a cookie with a date survives it.
      const kept = (await context.cookies()).filter(
        (cookie) => cookie.expires > 0,
      );
      await context.close();
      const reopened = await browser.newContext({baseURL});
      await reopened.addCookies(kept);
      const again = await reopened.newPage();
      await again.goto('/admin/products');

      if (remember) {
        await expect(
          again.getByRole('heading', {level: 1, name: 'Products'}),
        ).toBeVisible();
        await expect(again).toHaveURL(/\/admin\/products$/);
      } else {
        await expect(again).toHaveURL(/\/admin\/login$/);
      }
      await reopened.close();
    }
  });

  test('NAV-01 · The admin sees every section', async ({signedInAs}) => {
    const page = await signedInAs(ADMIN);
    const errors = consoleErrors(page);
    await page.goto('/admin/products');

    for (const name of [
      'Products',
      'Upload a stock sheet',
      'Scan',
      'Incoming',
      'Warehouses',
      'Orders',
      'Customers',
      'Users',
    ]) {
      await expect(page.getByRole('link', {name, exact: true})).toBeVisible();
    }
    expect(errors).toEqual([]);
  });

  test('NAV-02 · The inventory clerk sees the warehouse entries only', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(INVENTORY);
    await page.goto('/admin/products');

    await expect(
      page.getByRole('link', {name: 'Products', exact: true}),
    ).toBeVisible();
    for (const name of [
      'Warehouses',
      'Orders',
      'Customers',
      'Users',
      'Invoices',
    ]) {
      await expect(page.getByRole('link', {name, exact: true})).toHaveCount(0);
    }
  });

  test('NAV-03 · An unknown address shows "Page not found"', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/nothing-here');

    await expect(
      page.getByRole('heading', {name: 'Page not found'}),
    ).toBeVisible();
  });
});
