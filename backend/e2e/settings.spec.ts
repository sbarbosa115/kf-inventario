import {
  ADMIN,
  INVENTORY,
  PASSWORD,
  consoleErrors,
  expect,
  test,
} from './support/test';
import {emailTo} from './support/mail';

// Section 11 of docs/tests/ui-regression.md: Settings. SET-01 is item 0's; SET-02 – 08 are item 4's (settings-ui).
// The cases change the app's settings, so they run in order and the last hook puts every setting back.

const ADMIN_EMAIL = 'sbarbosa115@gmail.com';

/** The stack's Mailpit as the custom SMTP server (the e2e and php containers reach it as `mailpit`). */
const MAILPIT_SMTP = {host: 'mailpit', port: '1025'};

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

  test.describe.serial('Email, Analytics and Quick phrases tabs', () => {
    test('SET-02 · General says where email leaves from, and the legacy switch', async ({
      signedInAs,
    }) => {
      const admin = await signedInAs(ADMIN);
      await admin.goto('/admin/settings');

      await expect(
        admin.getByText("The server's MAILER_DSN (no SMTP server in Settings)"),
      ).toBeVisible();
      await expect(admin.getByText('(mailpit)')).toBeVisible();
      await expect(
        admin.getByRole('heading', {name: 'The old webhook URL'}),
      ).toBeVisible();
      await expect(
        admin.getByRole('button', {name: 'Turn off the old webhook URL'}),
      ).toBeVisible();
    });

    test('SET-03 · Email: the server is saved, the password field is blank afterwards', async ({
      signedInAs,
    }) => {
      const admin = await signedInAs(ADMIN);
      const errors = consoleErrors(admin);
      await admin.goto('/admin/settings/email');

      await expect(admin.getByLabel('Host')).toHaveValue('');
      await expect(
        admin.getByText(/MAILER_DSN from the server is used \(mailpit\)/),
      ).toBeVisible();
      await admin.getByLabel('Host').fill(MAILPIT_SMTP.host);
      await admin.getByLabel('Port').fill(MAILPIT_SMTP.port);
      await admin.getByLabel('User', {exact: true}).fill('mailer');
      await admin.getByLabel('Password', {exact: true}).fill(PASSWORD);
      await admin.getByLabel('Encryption').selectOption('none');
      await admin.getByRole('button', {name: 'Save'}).click();

      await expect(admin.getByRole('status')).toContainText(
        'Email settings saved.',
      );
      await expect(admin.getByLabel('Password', {exact: true})).toHaveValue('');
      await expect(admin.getByText('A password is saved')).toBeVisible();
      await expect(admin.getByLabel('Host')).toHaveValue(MAILPIT_SMTP.host);

      const saved = await (
        await admin.request.get('/api/v1/settings/email')
      ).json();
      expect(saved).toMatchObject({
        dsn_host: MAILPIT_SMTP.host,
        dsn_port: 1025,
        has_password: true,
        encryption: 'none',
        source: {dsn: 'settings'},
      });
      expect(JSON.stringify(saved)).not.toContain(PASSWORD);

      // A reload shows the same, and a save with the password left blank keeps it.
      await admin.reload();
      await expect(admin.getByLabel('Host')).toHaveValue(MAILPIT_SMTP.host);
      await admin.getByLabel('User', {exact: true}).fill('mailer2');
      await admin.getByRole('button', {name: 'Save'}).click();
      await expect(admin.getByRole('status')).toContainText(
        'Email settings saved.',
      );
      expect(
        (await (await admin.request.get('/api/v1/settings/email')).json())
          .has_password,
      ).toBe(true);
      expect(errors).toEqual([]);
    });

    test('SET-04 · "Send test email" reaches Mailpit through the saved server', async ({
      signedInAs,
    }) => {
      const admin = await signedInAs(ADMIN);
      await admin.goto('/admin/settings/email');
      const since = new Date(Date.now() - 2000);

      await admin.getByRole('button', {name: 'Send test email'}).click();
      const panel = admin.getByRole('dialog', {name: 'Send test email'});
      await expect(panel.getByLabel('Send to')).toHaveValue(ADMIN_EMAIL);
      await panel.getByRole('button', {name: 'Send'}).click();

      await expect(panel.getByRole('status')).toContainText(
        `Sent through ${MAILPIT_SMTP.host}`,
      );
      const mail = await emailTo(admin.request, ADMIN_EMAIL, {
        subject: /KF Inventory test email/,
        since,
      });
      expect(mail.subject).toBe('KF Inventory test email');
    });

    test('SET-05 · a wrong host answers the server’s own error inline', async ({
      signedInAs,
    }) => {
      const admin = await signedInAs(ADMIN);
      await admin.goto('/admin/settings/email');
      // One test email every 10 seconds: wait out SET-04's.
      await admin.waitForTimeout(10_500);

      await admin.getByLabel('Host').fill('nowhere.invalid');
      await admin.getByLabel('Port').fill('25');
      await admin.getByRole('button', {name: 'Save'}).click();
      await expect(admin.getByRole('status')).toContainText(
        'Email settings saved.',
      );
      await admin.getByRole('button', {name: 'Send test email'}).click();
      const panel = admin.getByRole('dialog', {name: 'Send test email'});
      await panel.getByRole('button', {name: 'Send'}).click();

      await expect(panel.getByRole('alert')).toContainText(
        'The server refused it:',
      );
      await expect(panel.getByRole('status')).toHaveCount(0);

      // Put the working server back for the cases after this one.
      await admin.keyboard.press('Escape');
      await admin.getByLabel('Host').fill(MAILPIT_SMTP.host);
      await admin.getByLabel('Port').fill(MAILPIT_SMTP.port);
      await admin.getByLabel('Password', {exact: true}).fill(PASSWORD);
      await admin.getByRole('button', {name: 'Save'}).click();
      await expect(admin.getByRole('status')).toContainText(
        'Email settings saved.',
      );
    });

    test('SET-06 · Analytics IDs load both scripts after navigation, never on the sign-in page', async ({
      signedInAs,
      browser,
      baseURL,
    }) => {
      const admin = await signedInAs(ADMIN);
      const external: string[] = [];
      await admin.route(/googletagmanager\.com|clarity\.ms/, (route) => {
        external.push(route.request().url());
        return route.fulfill({
          status: 200,
          contentType: 'application/javascript',
          body: '',
        });
      });
      await admin.goto('/admin/settings/analytics');

      await admin
        .getByLabel('Google Analytics 4 Measurement ID')
        .fill('G-SMOKE123');
      await admin.getByLabel('Microsoft Clarity Project ID').fill('smoke12345');
      await admin.getByRole('button', {name: 'Save'}).click();
      await expect(admin.getByRole('status')).toContainText(
        'Analytics settings saved.',
      );

      await admin
        .getByRole('navigation', {name: 'Main menu'})
        .getByRole('link', {name: 'Orders'})
        .first()
        .click();
      await expect(admin).toHaveURL(/\/admin\/orders/);
      await expect(
        admin.locator(
          'script[src="https://www.googletagmanager.com/gtag/js?id=G-SMOKE123"]',
        ),
      ).toHaveCount(1);
      await expect(
        admin.locator('script[src="https://www.clarity.ms/tag/smoke12345"]'),
      ).toHaveCount(1);
      expect(external.length).toBeGreaterThanOrEqual(2);

      // Signed out, the sign-in page asks for nothing and loads nothing.
      const context = await browser.newContext({baseURL});
      const login = await context.newPage();
      const requests: string[] = [];
      login.on('request', (request) => requests.push(request.url()));
      await login.goto('/admin/login');
      await expect(login.getByRole('button', {name: /sign in/i})).toBeVisible();
      await login.waitForTimeout(500);
      expect(
        requests.filter((url) =>
          /settings\/public|googletagmanager|clarity\.ms/.test(url),
        ),
      ).toEqual([]);
      await context.close();
    });

    test('SET-07 · Quick phrases: add, rename, reorder, deactivate; the comment box offers the active ones in order', async ({
      signedInAs,
    }) => {
      const admin = await signedInAs(ADMIN);
      await admin.goto('/admin/settings/phrases');
      const list = admin.getByRole('list', {name: 'Quick phrases'});

      await admin.getByLabel('Add phrase').fill('Smoke first');
      await admin.getByLabel('Add phrase').press('Enter');
      await expect(admin.getByRole('status').last()).toContainText(
        'Phrase added.',
      );
      await admin.getByLabel('Add phrase').fill('Smoke second');
      await admin.getByLabel('Add phrase').press('Enter');
      await expect(list.getByText('Smoke second')).toBeVisible();

      await admin.getByRole('button', {name: 'Rename Smoke second'}).click();
      await admin.getByLabel('Phrase', {exact: true}).fill('Smoke renamed');
      await admin.getByLabel('Phrase', {exact: true}).press('Enter');
      await expect(list.getByText('Smoke renamed')).toBeVisible();

      await admin.getByRole('button', {name: 'Move Smoke renamed up'}).click();
      await expect(
        admin.getByRole('button', {name: 'Move Smoke renamed down'}),
      ).toBeEnabled();
      const texts = async () =>
        (
          await (
            await admin.request.get('/api/v1/settings/quick-phrases')
          ).json()
        ).map((phrase: {text: string}) => phrase.text);
      await expect
        .poll(texts)
        .toEqual(expect.arrayContaining(['Smoke renamed', 'Smoke first']));
      const order = await texts();
      expect(order.indexOf('Smoke renamed')).toBeLessThan(
        order.indexOf('Smoke first'),
      );

      const active = admin.getByRole('switch', {
        name: 'Smoke first is active',
      });
      await active.click();
      await expect(active).not.toBeChecked();
      await expect.poll(texts).not.toContain('Smoke first');
      // Inactive: still listed here, gone from what the comment box reads (GET without ?all=1).
      await expect(list.getByText('Smoke first')).toBeVisible();
    });

    test('SET-08 · a bad GA ID is refused in place', async ({signedInAs}) => {
      const admin = await signedInAs(ADMIN);
      await admin.goto('/admin/settings/analytics');
      const before = await (
        await admin.request.get('/api/v1/settings/analytics')
      ).json();

      await admin
        .getByLabel('Google Analytics 4 Measurement ID')
        .fill('UA-123456-1');
      await admin.getByRole('button', {name: 'Save'}).click();

      await expect(
        admin.getByText(/A GA4 ID looks like G-ABC1234/),
      ).toBeVisible();
      await expect(admin.getByRole('status')).toHaveCount(0);
      expect(
        await (await admin.request.get('/api/v1/settings/analytics')).json(),
      ).toEqual(before);
    });

    test.afterAll(async ({browser, baseURL}) => {
      // Puts every setting back: the env serves the email, no analytics, and the phrases these cases added go.
      const context = await browser.newContext({baseURL});
      const origin = new URL(baseURL as string).origin;
      const login = await context.request.post('/api/v1/auth/login', {
        data: {username: ADMIN, password: PASSWORD},
        headers: {Origin: origin},
      });
      expect(login.status()).toBe(200);
      const headers = {Origin: origin};
      await context.request.put('/api/v1/settings/email', {
        headers,
        data: {
          host: '',
          port: null,
          user: '',
          encryption: 'tls',
          from_address: '',
          from_name: '',
          printer_address: '',
          cc: [],
        },
      });
      await context.request.put('/api/v1/settings/analytics', {
        headers,
        data: {ga4_measurement_id: '', clarity_project_id: ''},
      });
      const phrases = (await (
        await context.request.get('/api/v1/settings/quick-phrases?all=1')
      ).json()) as {id: number; text: string}[];
      for (const phrase of phrases.filter((one) =>
        one.text.startsWith('Smoke '),
      )) {
        await context.request.delete(
          `/api/v1/settings/quick-phrases/${phrase.id}`,
          {
            headers,
          },
        );
      }
      await context.close();
    });
  });
});
