import {ADMIN, INVENTORY, consoleErrors, expect, test} from './support/test';

// Section 11 of docs/tests/ui-regression.md: Settings. Item 0 of shops-settings writes SET-01; item 4 (settings-ui)
// adds SET-02 – 08 here.

test.describe('11 Settings', () => {
  test('SET-01 · Settings is the admin’s only', async ({signedInAs}) => {
    const admin = await signedInAs(ADMIN);
    const errors = consoleErrors(admin);
    await admin.goto('/admin/products');

    await admin
      .getByRole('navigation', {name: 'Main menu'})
      .getByRole('link', {name: 'Settings'})
      .click();
    await expect(admin).toHaveURL(/\/admin\/settings$/);
    await expect(admin.getByRole('heading', {name: 'Settings'})).toBeVisible();
    await expect(
      admin
        .getByRole('navigation', {name: 'Settings sections'})
        .getByRole('link'),
    ).toHaveText([
      'General',
      'Email',
      'Analytics',
      'Shop connections',
      'Quick phrases',
    ]);
    await expect(admin.getByText('America/Bogota')).toBeVisible();
    await expect(admin.getByText(/The server's MAILER_DSN/)).toBeVisible();
    await expect(
      admin.getByRole('button', {name: 'Turn off the old webhook URL'}),
    ).toBeVisible();
    expect(errors).toEqual([]);

    const clerk = await signedInAs(INVENTORY);
    await clerk.goto('/admin/products');
    await expect(
      clerk.getByRole('link', {name: 'Settings', exact: true}),
    ).toHaveCount(0);
    await clerk.goto('/admin/settings');
    await expect(
      clerk.getByRole('heading', {name: 'Page not found'}),
    ).toBeVisible();
    expect((await clerk.request.get('/api/v1/settings/email')).status()).toBe(
      403,
    );
  });
});
