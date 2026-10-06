import {
  ADMIN,
  INVENTORY,
  PASSWORD,
  consoleErrors,
  expect,
  test,
} from './support/test';

test.describe('1 Authentication and shell', () => {
  test('AUTH-01 · signing in opens the product list with the person in the top bar', async ({
    page,
  }) => {
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

  test('AUTH-02 · a wrong password is refused with one message that does not say which field was wrong', async ({
    page,
  }) => {
    await page.goto('/admin/login');

    await page.getByLabel('Username').fill(ADMIN);
    await page.getByLabel('Password', {exact: true}).fill('not-the-password');
    await page.getByRole('button', {name: 'Sign in'}).click();

    await expect(page.getByRole('alert')).toHaveText(
      'Wrong username or password.',
    );
    await expect(page).toHaveURL(/\/admin\/login$/);
  });

  test('AUTH-03 · a page opened signed out asks to sign in, then comes back to it', async ({
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

  test('AUTH-05 · a legacy page opened signed out goes to the sign-in page', async ({
    page,
  }) => {
    await page.goto('/admin/product/');

    await expect(page).toHaveURL(/\/admin\/login$/);
  });

  test('NAV-01 · an admin sees every section the legacy sidebar showed them', async ({
    signedInAs,
  }) => {
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

  test('NAV-02 · an inventory clerk sees the warehouse entries only', async ({
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

  test('NAV-03 · an unknown address shows "Page not found" inside the app', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/nothing-here');

    await expect(
      page.getByRole('heading', {name: 'Page not found'}),
    ).toBeVisible();
  });
});
