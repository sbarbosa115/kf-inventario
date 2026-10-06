import {ADMIN, INVENTORY, consoleErrors, expect, test} from './support/test';

// 7 Users (USR-01 – 09). The cases run in order: the user USR-02 creates is the one USR-03 edits.
test.describe.configure({mode: 'serial'});

const NEW_USER = {
  name: 'Smoke Clerk',
  username: 'smoke.clerk',
  email: 'smoke.clerk@kf.test',
  password: 'smoke-pass-1',
};

test.describe('7 Users', () => {
  test('USR-01 · the list shows every account with its roles, and the old address lands on it', async ({
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

  test('USR-02 · a new user is created and appears in the list', async ({
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
  });

  test('USR-03 · editing a user without typing a password keeps the password they had', async ({
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

  test('USR-04 · the form names what is missing and what is wrong, and sends nothing', async ({
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

  test('USR-05 · a user that no longer exists says so', async ({
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

  test('USR-06 · a person without the Users role is refused', async ({
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

  test('USR-07 · the form groups the roles by what they open and describes each one', async ({
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

  test('USR-08 · the list filters by status and a row opens its form', async ({
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

  test('USR-09 · saving a user toasts, and the form keeps its action bar in view', async ({
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
});
