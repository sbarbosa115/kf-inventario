import {ADMIN, INVENTORY, consoleErrors, expect, test} from './support/test';

// 4 Customers (CUS-01 – 06). The cases run in order: the customer CUS-02 creates is the one CUS-03 edits and CUS-04 deletes.
test.describe.configure({mode: 'serial'});

const NEW_CUSTOMER = {
  first: 'Smoke',
  last: 'Customer',
  email: 'smoke.customer@kf.test',
  phone: '3001112233',
  address: '742 Evergreen Terrace',
  zip: '05001',
  country: 'Smokeland',
  state: 'Smoke State',
  city: 'Smoke City',
};

test.describe('4 Customers', () => {
  test('CUS-01 · the list shows the customers, and the old address lands on it', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    const errors = consoleErrors(page);

    await page.goto('/admin/customer/');

    await expect(page).toHaveURL(/\/admin\/customers$/);
    await expect(page.getByRole('heading', {name: 'Customers'})).toBeVisible();
    await expect(
      page.getByRole('link', {name: 'Create Customer'}),
    ).toBeVisible();
    await expect(page.getByRole('columnheader', {name: 'Email'})).toBeVisible();
    await expect(
      page.getByRole('link', {name: /Edit this customer/}).first(),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('CUS-02 · a customer is created with a country, state and city that did not exist', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/customers');

    await page.getByRole('link', {name: 'Create Customer'}).click();
    await expect(
      page.getByRole('heading', {name: 'New Customer'}),
    ).toBeVisible();
    await page.getByLabel('Name', {exact: true}).fill(NEW_CUSTOMER.first);
    await page.getByLabel('Last Name').fill(NEW_CUSTOMER.last);
    await page.getByLabel('Email').fill(NEW_CUSTOMER.email);
    await page.getByLabel('Phone').fill(NEW_CUSTOMER.phone);
    await page.getByLabel('Address', {exact: true}).fill(NEW_CUSTOMER.address);
    await page.getByLabel('Zip Code').fill(NEW_CUSTOMER.zip);
    const places: [string, string][] = [
      ['Country', NEW_CUSTOMER.country],
      ['State', NEW_CUSTOMER.state],
      ['City', NEW_CUSTOMER.city],
    ];
    for (const [label, name] of places) {
      await page.getByLabel(label, {exact: true}).fill(name);
      await page.getByText(`Create "${name}"`).click();
    }
    await page.getByRole('button', {name: 'Save'}).click();

    await expect(page).toHaveURL(/\/admin\/customers$/);
    await expect(
      page
        .getByRole('status')
        .filter({hasText: 'The customer was created successfully.'}),
    ).toBeVisible();
    await page.getByRole('searchbox').fill(NEW_CUSTOMER.email);
    await expect(
      page.getByRole('row', {name: new RegExp(NEW_CUSTOMER.email)}),
    ).toBeVisible();
  });

  test('CUS-03 · editing a customer shows what was saved, including the new place names', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/customers');
    await page.getByRole('searchbox').fill(NEW_CUSTOMER.email);
    await page
      .getByRole('row', {name: new RegExp(NEW_CUSTOMER.email)})
      .getByRole('link', {name: /Edit this customer/})
      .click();

    await expect(
      page.getByRole('heading', {name: 'Edit customer'}),
    ).toBeVisible();
    await expect(page.getByLabel('Name', {exact: true})).toHaveValue(
      NEW_CUSTOMER.first,
    );
    await expect(page.getByLabel('Address', {exact: true})).toHaveValue(
      NEW_CUSTOMER.address,
    );
    const group = page.getByRole('group', {name: 'Address 1'});
    await expect(group.getByText(NEW_CUSTOMER.country)).toBeVisible();
    await expect(group.getByText(NEW_CUSTOMER.state)).toBeVisible();
    await expect(group.getByText(NEW_CUSTOMER.city)).toBeVisible();

    await page.getByLabel('Phone').fill('3009998877');
    await page.getByRole('button', {name: 'Add Address'}).first().click();
    await expect(page.getByRole('group', {name: 'Address 2'})).toBeVisible();
    await page
      .getByRole('group', {name: 'Address 2'})
      .getByRole('button', {name: 'Remove Address'})
      .click();
    await expect(page.getByRole('group', {name: 'Address 2'})).toHaveCount(0);
    await page.getByRole('button', {name: 'Save'}).click();

    await expect(
      page
        .getByRole('status')
        .filter({hasText: 'The customer was updated successfully.'}),
    ).toBeVisible();
    await page.getByRole('searchbox').fill('3009998877');
    await expect(
      page.getByRole('row', {name: new RegExp(NEW_CUSTOMER.email)}),
    ).toBeVisible();
  });

  test('CUS-04 · deleting asks first, and the customer is gone after', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/customers');
    await page.getByRole('searchbox').fill(NEW_CUSTOMER.email);
    const row = page.getByRole('row', {name: new RegExp(NEW_CUSTOMER.email)});

    await row.getByRole('button', {name: /Delete Customer/}).click();
    const dialog = page.getByRole('dialog');
    await expect(
      dialog.getByText('Are you sure to delete this Customer?'),
    ).toBeVisible();
    await dialog.getByRole('button', {name: 'Cancel'}).click();
    await expect(row).toBeVisible();

    await row.getByRole('button', {name: /Delete Customer/}).click();
    await page
      .getByRole('dialog')
      .getByRole('button', {name: 'Delete', exact: true})
      .click();

    await expect(
      page.getByRole('status').filter({hasText: 'The customer was deleted.'}),
    ).toBeVisible();
    await page.getByRole('searchbox').fill(NEW_CUSTOMER.email);
    await expect(
      page.getByRole('row', {name: new RegExp(NEW_CUSTOMER.email)}),
    ).toHaveCount(0);
  });

  test('CUS-05 · the form names what is missing, and a customer that no longer exists says so', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(ADMIN);
    await page.goto('/admin/customers/new');

    await page.getByRole('button', {name: 'Save'}).click();
    await expect(
      page.getByText('This value should not be blank.').first(),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/customers\/new$/);

    await page.goto('/admin/customers/999999/edit');
    await expect(page.getByRole('alert')).toContainText(
      'This customer no longer exists.',
    );
    await expect(
      page.getByRole('link', {name: 'Back to the customers'}),
    ).toBeVisible();
  });

  test('CUS-06 · a person without the Customers role is refused', async ({
    signedInAs,
  }) => {
    const page = await signedInAs(INVENTORY);

    await page.goto('/admin/customers');

    await expect(page.getByRole('link', {name: 'Customers'})).toHaveCount(0);
    await expect(page.getByRole('alert')).toContainText(
      'You do not have permission to do this.',
    );
    const answer = await page.request.get('/api/v1/customers');
    expect(answer.status()).toBe(403);
  });
});
