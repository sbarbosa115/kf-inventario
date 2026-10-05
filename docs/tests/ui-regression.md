# UI regression suite

What a real user does with the app, case by case, written as steps and what must happen. It is run in two parts:
the **smoke suite** (Playwright, `backend/e2e/`) runs the simple cases against the Docker stack, and when it is green
a person runs the rest in a browser, **in order**: later cases use the data earlier ones create.

A case with `Smoke:` under its title is run by the script named there and skipped by the manual run; with
`Smoke (part):` the script covers what the line says and the rest ("by hand: …") is run manually; with neither, the
whole case is manual.

Every new feature adds its cases here, in the section of the screen it lives on, in the same format. A case is
only worth adding if it would catch the feature breaking: name the button, the data and what you should see.
Case IDs are stable: a new case takes the next number in its section, and a removed case leaves a gap.

Each run is recorded as a new file in [`runs/`](runs/): the smoke suite's attempts and the result of every manual
case (`python3 ~/.claude/skills/symfony-react-app/scripts/new-run.py` creates it, `smoke.py` runs the smoke suite
and records it).

## Before you start

**Start from known data, not from whatever the last run left.** Everything runs in Docker; `backend/e2e/prepare.sh`
does all of this (and the smoke suite runs it first):

```bash
docker compose exec php php bin/console doctrine:database:drop --force
docker compose exec php php bin/console doctrine:database:create
docker compose exec php php bin/console doctrine:migrations:migrate -n
docker compose exec php php bin/console app:smoke:prepare --seed
```

- `docker compose ps`: every service is up, and `docker compose logs node` says the last build compiled.
- Open the mail catcher (Mailpit, `http://localhost:8025` or the stack's `MAILPIT_PORT`) next to the app: cases that
  send email end with "an email arrives".
- Use one browser profile for the run and nothing else on the app's origin in it: tabs share one session.
- Have ready: the stock spreadsheet template (downloaded from the Products screen) for the upload cases, and a
  keyboard to type barcodes (a scanner types a code and Enter).

**Accounts.** Dev only (the fixtures, `src/DataFixtures/UserFixtures.php`), never reuse these passwords.

| Role | Sign in with | Lands on |
|---|---|---|
| Admin (`ROLE_ADMIN`: inventory, warehouses, orders, customers, users) | `sbarbosa115` / `123456` | `/admin/products` |
| Inventory clerk (`ROLE_MANAGE_INVENTORY`) | `inventory` / `123456` | `/admin/products` |
| Invoice clerk (the invoice roles + customers) | `invoices` / `123456` | `/admin/products` |

**On every screen, whatever the case says**, also check:

- The browser console has no errors, and nothing is a blank page.
- No text shows a raw translation key (`orders.title`).
- Tables and forms look like the rest of the app (`CLAUDE.md`): the shared table, its search box and pages.
- A success or error message appears after every save, and it belongs to *that* save.

---

## 1. Authentication and shell (AUTH, NAV)

**AUTH-01 · Signing in opens the product list**
Smoke: `e2e/auth.spec.ts`.
Open `/admin/login`, sign in as the admin. The product list opens and the top bar shows `sbarbosa115@gmail.com`.

**AUTH-02 · A wrong password is refused**
Smoke: `e2e/auth.spec.ts`.
Sign in as `sbarbosa115` with a wrong password: "Wrong username or password." and the page stays on the sign-in form.

**AUTH-03 · A page opened signed out comes back after signing in**
Smoke: `e2e/auth.spec.ts`.
Signed out, open `/admin/warehouses`: the sign-in page. Sign in: the Warehouses page opens.

**AUTH-04 · Logout ends the session**
Smoke: `e2e/auth.spec.ts`.
Top bar › your email › Logout: the sign-in page. Open `/admin/products` again: the sign-in page.

**AUTH-05 · A previous-version page opened signed out goes to the sign-in page**
Smoke: `e2e/auth.spec.ts`.
Signed out, open `/admin/product/` (a legacy page, until item 12 removes them): the React sign-in page.

**AUTH-06 · Remember me keeps you signed in after closing the browser**
Sign in with "Remember me" ticked, close every window of the browser, open `/admin/products`: still signed in.
Without it, the same steps end on the sign-in page.

**NAV-01 · The admin sees every section they had**
Smoke: `e2e/auth.spec.ts`.
Signed in as the admin: Products (Product List, Upload products, Barcode reader, Incoming products), Warehouses,
Orders, Customers, Users. No Invoices (the admin role does not include the invoice roles, as before).

**NAV-02 · The inventory clerk sees the products menu only**
Smoke: `e2e/auth.spec.ts`.
Signed in as `inventory`: Products and its four entries; no Warehouses, Orders, Invoices, Customers or Users.

**NAV-03 · An unknown address shows "Page not found"**
Smoke: `e2e/auth.spec.ts`.
Open `/admin/nothing-here` signed in: "Page not found" inside the app, with a link to the product list.

## 2. Products (INV)

<!-- Item 6 (products-ui) adds INV-01 – 08; item 7 (stock-ui) adds INV-09 – 16. -->

## 3. Warehouses (WH)

<!-- Item 7 (stock-ui) adds WH-01 – 03. -->

## 4. Customers (CUS)

<!-- Item 8 (customers-ui) adds CUS-01 – 06. -->

## 5. Orders (ORD)

<!-- Item 9 (orders-ui) adds ORD-01 – 10; item 10 (order-forms-ui) adds ORD-11 – 18; item 13 (woocommerce-sync) adds
     ORD-19 – 20. -->

## 6. Invoices (INVC)

<!-- Item 11 (invoices-ui) adds INVC-01 – 06. -->

## 7. Users (USR)

<!-- Item 1 (identity) adds USR-01 – 06. -->

## 8. Emails (MAIL)

<!-- Item 10 (order-forms-ui) adds MAIL-01 – 02: the printer's email of a new order, read in Mailpit. -->

## 9. WooCommerce webhook (HOOK)

<!-- Item 4 (ordering-api) adds HOOK-01 – 02 (manual: curl a sample payload with X-WC-Webhook-Source). -->
