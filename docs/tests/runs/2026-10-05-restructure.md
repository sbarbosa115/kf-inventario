# UI regression run — 2026-10-05 (restructure)

- **Suite:** [`../ui-regression.md`](../ui-regression.md), at `757d2d0`.
- **Branch:** `feature/restructure` at `757d2d0`, on this checkout's stack (app <!-- URL -->).
- **Data:** <!-- reset to the seed before the run / not reset (why) -->
- **How:** the smoke suite first (Playwright against this stack), until it is green; then the cases left for a person, in a browser driven through the real UI; emails read in the mail catcher; database/logs where a screen could not prove it.

## Summary

| | Cases |
|---|---|
| Cases in the suite | 70 |
| Run by the smoke suite | 57 |
| Left for the manual run | 13 |
| Manual: pass | <!-- N (M after a fix made during the run) --> |
| Manual: fail | <!-- N: IDs --> |

## Smoke suite

`python3 ~/.claude/skills/symfony-react-app/scripts/smoke.py` runs it and adds a row here. A run that is not green
is recorded too: write what failed under "Smoke findings", fix it, and run again. The manual run starts only when
the last row is green.

| # | When | Commit | Result | Failed |
|---|---|---|---|---|
| 1 | 2026-10-05 15:03 | `757d2d0` | Not green: 30 passed, 6 failed, 31 skipped | CUS-02, INVC-03, ORD-01, INV-06, INV-10, USR-02; skipped: CUS-03, CUS-04, CUS-05, CUS-06, INVC-04, INVC-05, INVC-06, ORD-02, ORD-03, ORD-04, ORD-05, ORD-06, ORD-07, ORD-08, ORD-09, ORD-10, INV-07, INV-08, INV-11, INV-12, INV-13, INV-14, INV-15, INV-16, WH-01, WH-02, WH-03, USR-03, USR-04, USR-05, USR-06 |
| 2 | 2026-10-05 15:07 | `787f0af` | Not green: 45 passed, 3 failed, 19 skipped | INVC-03, ORD-02, INV-11; skipped: INVC-04, INVC-05, INVC-06, ORD-03, ORD-04, ORD-05, ORD-06, ORD-07, ORD-08, ORD-09, ORD-10, INV-12, INV-13, INV-14, INV-15, INV-16, WH-01, WH-02, WH-03 |
| 3 | 2026-10-05 15:11 | `6ba65cd` | Not green: 49 passed, 3 failed, 15 skipped | INVC-03, ORD-05, INV-12; skipped: INVC-04, INVC-05, INVC-06, ORD-06, ORD-07, ORD-08, ORD-09, ORD-10, INV-13, INV-14, INV-15, INV-16, WH-01, WH-02, WH-03 |
| 4 | 2026-10-05 15:15 | `06cc894` | Not green: 57 passed, 2 failed, 8 skipped | ORD-06, INV-15; skipped: ORD-07, ORD-08, ORD-09, ORD-10, INV-16, WH-01, WH-02, WH-03 |
| 5 | 2026-10-05 15:22 | `3af9acc` | Green: 67 passed, 0 failed | — |
| 6 | 2026-10-05 15:44 | `e0cbe2b` | Green: 67 passed, 0 failed | — |
| 7 | 2026-10-05 15:56 | `e432f0f` | Green: 67 passed, 0 failed | — |
<!-- smoke.py adds a row per run of the whole suite -->

### Smoke findings

<!-- Numbered: the failing test (its case ID), whether the app or the test was wrong, the cause, and the fix (commit). -->

1. **CUS-02, INV-06, USR-02 · test.** `getByRole('status')` matched both the success alert and the list's loading
   spinner (also `role="status"`, correctly). The specs now pick the status by its text (every spec).
2. **INV-10 · test.** `{name: 'Upload'}` also matched the file input, whose label says "…click on upload…": exact match.
3. **ORD-01 · test.** It expected no Delete or Sync button for the admin, but `ROLE_ADMIN` reaches `ROLE_MANAGE_ORDERS`
   (security.yaml, unchanged), so the legacy page showed both to the admin too. The test now expects them.
4. **INVC-03 · test (data).** The invoice form lists a warehouse's products from its stock, which needs
   `ROLE_MANAGE_INVENTORY` (as the legacy `product_all` did); the `invoices` fixture account has no such role, so the
   product picker was empty. A fixture account `sales` (invoice roles + inventory) runs the case; `invoices` stays the
   "no inventory role" account the products and stock specs rely on.

5. **INVC-03 (attempt 2) · test.** The account swap of finding 4 landed on INVC-01 instead of INVC-03 (a text match
   on the file's header comment); INVC-01 – 05 now all run as `sales` (INVC-04's Add all products lists stock too).
6. **ORD-02 · test.** `{name: 'Status'}` also matched each row's "Status of order …" select: exact match.
7. **INV-11 · test.** "Product List" is both the sidebar entry and the link in the upload's confirmation: the spec
   looks inside the confirmation.

8. **INVC-03 (attempt 3) · test.** Enter was pressed before the warehouse's stock had loaded into the picker, so
   nothing was picked; the spec clicks the listed option.
9. **ORD-05 · test.** It expected 50 of KF-01 on W00003, whose fixture holds 20 (the case text said 50 too: fixed).
10. **INV-12 · test.** The barcode reader looks an unknown code up on purpose and the API answers 404 (the red
    cross); the browser logs that request as a console error. The spec ignores exactly that one.

11. **ORD-06 · test.** `getByLabel('Comment 1')` also matched "Save comment 1" and "Remove comment 1": exact match.
12. **INV-15 · app (bug kept from the legacy app).** "Approve all" turned the incoming KF-02 row (4) into a second
    in-stock row beside the one already there (0), so the stock list, the barcode reader and shipments read the first
    row only. Approval now adds the incoming quantity to the row in stock and drops the incoming row; test
    `StockApiTest::testApprovingAddsTheIncomingToTheRowAlreadyInStock` (red first). README "Known gaps" says how to find
    duplicates production may already hold.

## Browser pass

Every screen opened signed in (admin; `sales` for invoices): product list, product form, upload, barcode reader,
incoming, warehouses, orders (and the detail dialog, Sync Orders), order form new and edit, getting-ready, customers
and the customer form, users and the user form, invoices and the invoice form. No blank page and no console error,
except once an "Uncaught TypeError: Cannot read properties of undefined (reading 'global')" on /admin/customers
right after closing a dialog with Escape and navigating away; it did not come back in three more loads (recorded,
not reproduced). Pages are complete in about 2 s on the dev stack (session check, then the page's chunk, then its
data; StrictMode doubles the requests in dev only).

## Manual run

Replace "Not run" with Pass, Fail, "Pass after fix" (with the commit) or Blocked (with why). Group consecutive
passes into ranges (`AREA-01 – 05`) once done.

| ID | Result | Case / notes |
|---|---|---|
| AUTH-06 | Pass | Remember me keeps you signed in after closing the browser — Checked on the cookies: with the box, REMEMBERME lasts 7 days and alone (no session, as after closing the browser) signs in; without it no remember-me cookie, and the session cookie ends with the browser. |
| INV-03 | Pass | The selected products download as the stock spreadsheet — by hand: see the case — The download held the header and exactly KF-01 and KF-02 (quantity and price 0). |
| INV-04 | Pass | Move to Warehouse moves the chosen quantities; they arrive as incoming — by hand: see the case — 2 of KF-03 moved to Usa arrived there as incoming (Usa incoming: KF-03 2); the dialog itself is covered by the smoke test and MoveStock.test.tsx. |
| INV-05 | Pass | A move the warehouse can no longer cover is refused, and nothing moves — Checked through the API the dialog uses: after moving all of KF-01, the stale move answers 422 "Only 0 of KF-01 are available." and the stock is unchanged; the dialog keeping open on a refusal is covered by MoveStock.test.tsx. |
| INV-11 | Pass after fix | A spreadsheet from the template is stored in the chosen warehouse — by hand: see the case — Quantities added to the two rows and the new product created with its stock; a sheet with the wrong columns was stored (a product "x") instead of refused: fixed in "a stock sheet without the template's five columns is refused" (test ProductApiTest::testASheetWithoutTheTemplatesColumnsIsRefusedAndStoresNothing). |
| ORD-07 | Pass | The order's documents download — by hand: see the case — PDF, remaining PDF and `file-upload-template-W00001.xls` read: customer, address and the three products; the XLS lists date, code and quantity per product; the detail's Download/Remaining Products buttons seen in the browser. |
| ORD-09 | Blocked (part) | Sync Orders says what it did — by hand: see the case — Needs a WooCommerce test shop and its keys, none here. Without keys: "0 orders imported, 0 skipped." (browser); the 502 message is covered by SyncOrders.test.tsx and SyncOrdersApiTest. |
| ORD-19 | Pass | Sync Orders without shop keys places nothing, and needs the sync role — by hand: see the case — In the browser as the admin: "0 orders imported, 0 skipped." and the list unchanged. |
| ORD-20 | Blocked | Sync Orders pulls a shop's waiting orders once, into the warehouse of that shop — Needs a WooCommerce test shop with waiting orders; covered by SyncOrdersApiTest with a fake shop. |
| INVC-03 | Pass | An invoice is created with a customer, a product and tax, its PDF opens and the list shows it — by hand: see the case — As `sales`: INV-0002 300.00 + 6 % 18.00 = 318.00, its PDF shows the code, customer, line and tax; an invoice with no customer is a POS Client; a new customer with a new country, state and city is created once. |
| USR-02 | Pass | A new user is created and appears in the list — by hand: see the case — The new user signs in and holds the inventory roles only (sidebar: Products); the form offers the nine roles and the status (browser). |
| USR-03 | Pass | Editing without typing a password keeps the password — by hand: see the case — Edited with a blank password (name, roles): the old password still signs in. |
| MAIL-01 | Pass after fix | An order placed by hand is emailed to the printer — by hand: see the case — Subject, printer, cc sales@klassicfab.com, from KF Inventory <orders@kf.local>, body and order-<id>.pdf all right; but an order naming its customer by id alone blanked that customer, so the PDF had no customer: fixed in "naming a customer by id alone leaves them as they are" (test CustomerRegistryTest::testAnIdAloneNamesTheCustomerAndChangesNothing), then re-run on fresh data: the PDF shows Jose Perez. |

## Findings

<!-- Numbered: what happened, which case, the cause, and the fix (commit) or why it was left. -->

## Conditions

<!-- Anything about the environment that could have affected the result. -->
