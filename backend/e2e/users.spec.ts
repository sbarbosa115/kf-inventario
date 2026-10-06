import {ADMIN, INVENTORY, consoleErrors, expect, test} from './support/test';

// 7 Users (USR-01 – 10). The cases run in order: the user USR-02 creates is the one USR-03 edits.
test.describe.configure({mode: 'serial'});

const NEW_PASSWORD = 'smoke-pass-2';

const NEW_USER = {
  name: 'Smoke Clerk',
  username: 'smoke.clerk',
  email: 'smoke.clerk@kf.test',
  password: 'smoke-pass-1',
};

test.describe('7 Users', () => {
  test('USR-01 · The list shows every account with its roles, and the old address lands on it', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    const errors = consoleErrors(page);

    await page.goto('/admin/user/');

    await expect(page).toHaveURL(/\/admin\/users$/);
    await expect(
      page.getByRole('heading', {name: 'Users', exact: true}),
    ).toBeVisible();
    const admin = page.getByRole('row', {name: /sbarbosa115@gmail\.com/});
    await expect(admin.getByText('Admin', {exact: true})).toBeVisible();
    await expect(page.getByText('ROLE_ADMIN')).toHaveCount(0);
    await expect(
      page.getByRole('row', {name: /inventory@kf\.local/}),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('USR-02 · A new user is created, appears in the list and signs in to what the role opens', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/users');

    await page.getByRole('link', {name: /Create user/}).click();
    await expect(page.getByRole('heading', {name: 'New user'})).toBeVisible();
    await page.getByLabel('Name', {exact: true}).fill(NEW_USER.name);
    await page.getByLabel('Email').fill(NEW_USER.email);
    await page.getByLabel('Username').fill(NEW_USER.username);
    await page.getByLabel('Password', {exact: true}).fill(NEW_USER.password);
    await page.getByLabel('Inventory', {exact: true}).check();
    await page.getByRole('button', {name: 'Save'}).click();

    await expect(page).toHaveURL(/\/admin\/users$/);
    await expect(
      page.getByRole('status').filter({hasText: 'The user was created.'}),
    ).toBeVisible();
    const row = page.getByRole('row', {name: new RegExp(NEW_USER.email)});
    await expect(row.getByText('Inventory', {exact: true})).toBeVisible();

    // The new account signs in and sees what Inventory opens, nothing more.
    const clerk = await signedInAs(NEW_USER.username, NEW_USER.password);
    await clerk.goto('/admin/products');
    const menu = clerk.getByRole('navigation', {name: 'Main menu'});
    await expect(
      menu.getByRole('link', {name: 'Products', exact: true}),
    ).toBeVisible();
    for (const name of [
      'Orders',
      'Customers',
      'Users',
      'Warehouses',
      'Invoices',
    ]) {
      await expect(menu.getByRole('link', {name, exact: true})).toHaveCount(0);
    }
  });

  test('USR-03 · Editing without typing a password keeps the password', async ({
    signedInAs,
    browser,
    baseURL,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/users');
    await page
      .getByRole('row', {name: new RegExp(NEW_USER.email)})
      .getByRole('button', {name: /^Actions for /})
      .click();
    await page.getByRole('menuitem', {name: 'Edit'}).click();

    await expect(page.getByRole('heading', {name: 'Edit user'})).toBeVisible();
    await expect(page.getByLabel('Password', {exact: true})).toHaveValue('');
    await page.getByLabel('Name', {exact: true}).fill('Smoke Clerk Renamed');
    await page.getByLabel('Orders', {exact: true}).check();
    await page.getByRole('button', {name: 'Save'}).click();

    await expect(
      page.getByRole('status').filter({hasText: 'The user was updated.'}),
    ).toBeVisible();
    const row = page.getByRole('row', {name: /Smoke Clerk Renamed/});
    await expect(row.getByText('Orders', {exact: true})).toBeVisible();
    // The old password still opens the account.
    const context = await browser.newContext({baseURL});
    const signIn = await context.request.post('/api/v1/auth/login', {
      data: {username: NEW_USER.username, password: NEW_USER.password},
      headers: {Origin: new URL(baseURL as string).origin},
    });
    expect(signIn.status()).toBe(200);
    await context.close();
  });

  test('USR-04 · The form names what is missing and what is wrong', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/users/new');

    await page.getByRole('button', {name: 'Save'}).click();
    await expect(page.getByLabel('Name', {exact: true})).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    await expect(page.getByLabel('Password', {exact: true})).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    await expect(page).toHaveURL(/\/admin\/users\/new$/);

    await page.getByLabel('Name', {exact: true}).fill('Someone');
    await page.getByLabel('Email').fill('not-an-email');
    await page.getByLabel('Username').fill('someone');
    await page.getByLabel('Password', {exact: true}).fill('123');
    await page.getByRole('button', {name: 'Save'}).click();
    await expect(
      page.getByText('This value is not a valid email address.'),
    ).toBeVisible();
    await expect(
      page.getByText('The password needs at least 6 characters.'),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/users\/new$/);
  });

  test('USR-05 · A user that no longer exists says so', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);

    await page.goto('/admin/users/999999/edit');

    await expect(page.getByRole('alert')).toContainText(
      'This user no longer exists.',
    );
    await page.getByRole('link', {name: 'Back to the users'}).click();
    await expect(page).toHaveURL(/\/admin\/users$/);
  });

  test('USR-06 · A person without the Users role is refused', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(INVENTORY);

    await page.goto('/admin/users');

    await expect(page.getByRole('alert')).toHaveText(
      'You do not have permission to do this.',
    );
    await expect(
      page.getByRole('link', {name: 'Users', exact: true}),
    ).toHaveCount(0);
    const answer = await page.request.get('/api/v1/users');
    expect(answer.status()).toBe(403);
  });

  test('USR-07 · The form groups the roles by what they open and describes each one', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    const errors = consoleErrors(page);

    await page.goto('/admin/users/new');

    for (const group of ['Warehouse', 'Sales', 'Invoices', 'Admin']) {
      await expect(page.getByRole('group', {name: group})).toBeVisible();
    }
    await expect(page.getByRole('checkbox')).toHaveCount(9);
    await expect(
      page.getByText(
        'Products, stock, the barcode reader, incoming stock and uploads.',
      ),
    ).toBeVisible();
    await expect(
      page
        .getByRole('group', {name: 'Admin'})
        .getByText('Admin includes everything except invoices.'),
    ).toBeVisible();
    await expect(page.getByText('ROLE_')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('USR-08 · The list filters by status and a row opens its form', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/users');
    const admin = page.getByRole('row', {name: /sbarbosa115@gmail\.com/});
    await expect(admin).toBeVisible();

    await page.getByRole('button', {name: /^Inactive/}).click();
    await expect(admin).toHaveCount(0);
    await page.getByRole('button', {name: /^Active/}).click();
    await expect(admin).toBeVisible();
    await page.getByRole('button', {name: /^All/}).click();

    await admin.getByText('sbarbosa115@gmail.com').click();
    await expect(page).toHaveURL(/\/admin\/users\/\d+\/edit$/);
    await expect(page.getByRole('heading', {name: 'Edit user'})).toBeVisible();
  });

  test('USR-09 · Saving toasts, and the action bar is in view', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/users');
    await page
      .getByRole('row', {name: new RegExp(NEW_USER.email)})
      .getByRole('button', {name: /^Actions for /})
      .click();
    await page.getByRole('menuitem', {name: 'Edit'}).click();

    await expect(page.getByRole('button', {name: 'Save'})).toBeInViewport();
    await page.getByLabel('Inventory', {exact: true}).uncheck();
    await page.getByRole('button', {name: 'Save'}).click();

    await expect(
      page.getByRole('status').filter({hasText: 'The user was updated.'}),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/users$/);
  });

  test('USR-10 · A new password typed on Edit replaces the old one', async ({
    signedInAs,
    browser,
    baseURL,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/users');
    await page
      .getByRole('row', {name: new RegExp(NEW_USER.email)})
      .getByRole('button', {name: /^Actions for /})
      .click();
    await page.getByRole('menuitem', {name: 'Edit'}).click();
    await page.getByLabel('Password', {exact: true}).fill(NEW_PASSWORD);
    await page.getByRole('button', {name: 'Save'}).click();
    await expect(
      page.getByRole('status').filter({hasText: 'The user was updated.'}),
    ).toBeVisible();

    const context = await browser.newContext({baseURL});
    const signIn = (password: string) =>
      context.request.post('/api/v1/auth/login', {
        data: {username: NEW_USER.username, password},
        headers: {Origin: new URL(baseURL as string).origin},
      });
    expect((await signIn(NEW_USER.password)).status(), 'the old one').toBe(401);
    expect((await signIn(NEW_PASSWORD)).status(), 'the new one').toBe(200);
    await context.close();
  });
});
