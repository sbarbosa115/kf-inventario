# UI regression run — 2026-10-06 (shops-settings)

- **Suite:** [`../ui-regression.md`](../ui-regression.md), at `f3e75e2`.
- **Branch:** `feature/shops-settings` at `f3e75e2`, on this checkout's stack (app `http://localhost:18090`, `http://nginx` inside the network).
- **Data:** reset to the seed before each smoke attempt (`backend/e2e/prepare.sh`: drop, migrate, `app:smoke:prepare --seed`).
- **How:** the smoke suite first (Playwright against this stack), until it is green; then the cases left for a person, in a browser driven through the real UI; emails read in the mail catcher; database/logs where a screen could not prove it.

## Summary

| | Cases |
|---|---|
| Cases in the suite | 134 |
| Run by the smoke suite | 96 |
| Left for the manual run | 38 |
| Manual: pass | <!-- N (M after a fix made during the run) --> |
| Manual: fail | <!-- N: IDs --> |

## Smoke suite

`python3 ~/.claude/skills/symfony-react-app/scripts/smoke.py` runs it and adds a row here. A run that is not green
is recorded too: write what failed under "Smoke findings", fix it, and run again. The manual run starts only when
the last row is green.

| # | When | Commit | Result | Failed |
|---|---|---|---|---|
| 1 | 2026-10-06 10:59 | `f3e75e2` | Not green: 112 passed, 1 failed, 6 skipped | CUS-03; skipped: CUS-04, CUS-05, CUS-06, CUS-07, CUS-08, CUS-09 |
| 2 | 2026-10-06 11:06 | `9636ed2` | Green: 119 passed, 0 failed | — |
| 3 | 2026-10-06 11:17 | `7098916` | Green: 119 passed, 0 failed | — |
<!-- smoke.py adds a row per run of the whole suite -->

### Smoke findings

<!-- Numbered: the failing test (its case ID), whether the app or the test was wrong, the cause, and the fix (commit). -->

1. **ORD-03** (an early run of the list specs, before attempt 1; the app was wrong). The orders search is debounced and
   asks the server: the spec found W00001 in the list as it was, opened its status menu, and the narrowed list that
   arrived 300 ms later shrank the page; the scroll that followed closed the menu. Fix: `RowMenu` (and the filter
   popovers) follow their button when the page scrolls or the list under them changes size, and close only when the
   button left the window (item 0's 0.4 commit).
2. **CUS-03** (attempt 1; the app was wrong). Same race, worse: the search's debounced commit to the address fired after
   the click on Edit had started navigating (a lazy page loads in a transition, so the list was still mounted), and
   navigated back to the list. Fix: a debounced search hands its pending text on when the field loses the focus
   (`useDebouncedText`'s flush on blur, in the four toolbars, `DataTable`'s server search and the filter row's text
   inputs), so nothing is left pending once the person clicks elsewhere. CUS-04 – 09 were skipped because CUS-03
   failed (serial describe).

## Manual run

Replace "Not run" with Pass, Fail, "Pass after fix" (with the commit) or Blocked (with why). Group consecutive
passes into ranges (`AREA-01 – 05`) once done.

| ID | Result | Case / notes |
|---|---|---|
| AUTH-06 | Not run | Remember me keeps you signed in after closing the browser |
| NAV-04 | Not run | The rail shows icons with tooltips |
| INV-03 | Not run | The selected products download as the stock spreadsheet — by hand: see the case |
| INV-04 | Not run | Move to Warehouse moves the chosen quantities; they arrive as incoming — by hand: see the case |
| INV-05 | Not run | A move the warehouse can no longer cover is refused, and nothing moves |
| INV-19 | Not run | The selection bar moves or downloads what is ticked, and Move opens beside the list — by hand: see the case |
| INV-22 | Not run | On a phone the list is cards and the form is one column — by hand: see the case |
| INV-11 | Not run | A spreadsheet from the template is stored in the chosen warehouse — by hand: see the case |
| INV-26 | Not run | The camera on the scan screen — by hand: see the case |
| INV-28 | Not run | The drop zone shows the chosen sheet — by hand: see the case |
| INV-30 | Not run | The warehouse screens on a phone — by hand: see the case |
| CUS-10 | Not run | Spanish and dark, by hand |
| ORD-07 | Not run | The order's documents download — by hand: see the case |
| ORD-09 | Not run | Sync shop orders says what it did — by hand: see the case |
| ORD-26 | Not run | On a phone the orders are cards — by hand: see the case |
| ORD-27 | Not run | The orders screens in Spanish, light and dark |
| ORD-28 | Not run | Keyboard only |
| ORD-19 | Not run | Sync Orders without shop keys places nothing, and needs the sync role — by hand: see the case |
| ORD-20 | Not run | Sync Orders pulls a shop's waiting orders once, into the warehouse of that shop |
| ORD-32 | Not run | The form and getting ready on a phone (390 px) — by hand: see the case |
| ORD-33 | Not run | The order form's two columns, and the required marks |
| ORD-34 | Not run | Spanish, dark, and keyboard only |
| INVC-03 | Not run | An invoice is created with a customer, a product and tax, its PDF opens and the list shows it — by hand: see the case |
| INVC-10 | Not run | The invoice form reads like the document |
| INVC-11 | Not run | Spanish and the dark theme on both invoice screens |
| USR-02 | Not run | A new user is created and appears in the list — by hand: see the case |
| USR-03 | Not run | Editing without typing a password keeps the password — by hand: see the case |
| USR-09 | Not run | Saving toasts, and the form is usable on a phone and in dark — by hand: see the case |
| MAIL-01 | Not run | An order placed by hand is emailed to the printer — by hand: see the case |
| DS-03 | Not run | The phone layout — by hand: every screen looks right at 390 px (no cut text, 44 px targets, the action bar above the tab bar) |
| DS-04 | Not run | A visible focus everywhere — by hand: the ring itself, everywhere |
| DS-07 | Not run | Light, dark, or the system's — by hand: no white flash when the page reloads in dark, and every screen readable in both |
| DS-09 | Not run | No raw key in Spanish, light and dark |
| DS-10 | Not run | The camera is asked for only after the tap |
| DS-11 | Not run | A camera read lands once, with a tone and a vibration |
| DS-12 | Not run | Lighthouse accessibility |
| DS-13 | Not run | Signing in: show the password, Caps Lock, the error in place — by hand: with Caps Lock on, "Caps Lock is on" appears under the password |
| DS-15 | Not run | Every filter control in the kit, light and dark, 44 px on a phone — by hand: the look |

## Findings

<!-- Numbered: what happened, which case, the cause, and the fix (commit) or why it was left. -->

## Conditions

<!-- Anything about the environment that could have affected the result. -->
