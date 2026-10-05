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

## Manual run

Replace "Not run" with Pass, Fail, "Pass after fix" (with the commit) or Blocked (with why). Group consecutive
passes into ranges (`AREA-01 – 05`) once done.

| ID | Result | Case / notes |
|---|---|---|
| AUTH-06 | Not run | Remember me keeps you signed in after closing the browser |
| INV-03 | Not run | The selected products download as the stock spreadsheet — by hand: see the case |
| INV-04 | Not run | Move to Warehouse moves the chosen quantities; they arrive as incoming — by hand: see the case |
| INV-05 | Not run | A move the warehouse can no longer cover is refused, and nothing moves |
| INV-11 | Not run | A spreadsheet from the template is stored in the chosen warehouse — by hand: see the case |
| ORD-07 | Not run | The order's documents download — by hand: see the case |
| ORD-09 | Not run | Sync Orders says what it did — by hand: see the case |
| ORD-19 | Not run | Sync Orders without shop keys places nothing, and needs the sync role — by hand: see the case |
| ORD-20 | Not run | Sync Orders pulls a shop's waiting orders once, into the warehouse of that shop |
| INVC-03 | Not run | An invoice is created with a customer, a product and tax, its PDF opens and the list shows it — by hand: see the case |
| USR-02 | Not run | A new user is created and appears in the list — by hand: see the case |
| USR-03 | Not run | Editing without typing a password keeps the password — by hand: see the case |
| MAIL-01 | Not run | An order placed by hand is emailed to the printer — by hand: see the case |

## Findings

<!-- Numbered: what happened, which case, the cause, and the fix (commit) or why it was left. -->

## Conditions

<!-- Anything about the environment that could have affected the result. -->
