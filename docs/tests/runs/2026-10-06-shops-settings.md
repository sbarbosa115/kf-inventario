# UI regression run — 2026-10-06 (shops-settings)

- **Suite:** [`../ui-regression.md`](../ui-regression.md), at `f3e75e2`.
- **Branch:** `feature/shops-settings` at `f3e75e2`, on this checkout's stack (app `http://localhost:18090`, `http://nginx` inside the network).
- **Data:** reset to the seed before each smoke attempt (`backend/e2e/prepare.sh`: drop, migrate, `app:smoke:prepare --seed`).
- **How:** the smoke suite first (Playwright against this stack), until it is green; then the cases left for a person, in a browser driven through the real UI; emails read in the mail catcher; database/logs where a screen could not prove it.

## Summary

| | Cases |
|---|---|
| Cases in the suite | 174 (the baseline, `runs/2026-10-06-baseline.md`; 134 before it) |
| Run by the smoke suite | 174 |
| Left for the manual run | 0: the suite is smoke-only since the baseline |
| Manual: pass | — |
| Manual: fail | — |

## Smoke suite

`python3 ~/.claude/skills/symfony-react-app/scripts/smoke.py` runs it and adds a row here. A run that is not green
is recorded too: write what failed under "Smoke findings", fix it, and run again. The manual run starts only when
the last row is green.

| # | When | Commit | Result | Failed |
|---|---|---|---|---|
| 1 | 2026-10-06 10:59 | `f3e75e2` | Not green: 112 passed, 1 failed, 6 skipped | CUS-03; skipped: CUS-04, CUS-05, CUS-06, CUS-07, CUS-08, CUS-09 |
| 2 | 2026-10-06 11:06 | `9636ed2` | Green: 119 passed, 0 failed | — |
| 3 | 2026-10-06 11:17 | `7098916` | Green: 119 passed, 0 failed | — |
| 4 | 2026-10-06 13:12 | `8151dc9` | Not green: 155 passed, 1 failed, 2 skipped | FLT-08; skipped: FLT-09, FLT-10 |
| 5 | 2026-10-06 13:23 | `cc7cc33` | Green: 158 passed, 0 failed | — |
| 6 | 2026-10-06 16:23 | `d7f4fde` | Green: 174 passed, 0 failed | — |
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
3. FLT-08 (attempt 4): the test was wrong. It counted the rows right after the address changed, before the filtered
   page arrived (14 instead of 2). It now waits for the chips and a quiet network before counting.
4. Attempt 6 is the smoke-only baseline (174 cases): what the development runs before it met, and the fixes, are in
   `2026-10-06-baseline.md`, "Smoke findings".

## Manual run

None. The user decided on 2026-10-06 to drop the manual cases ("let's remove all of them manual tests for now, let's
re create a new smoke tests for playwright that take the current state of the application as base"): the suite was
rewritten as a smoke-only baseline (`runs/2026-10-06-baseline.md`), every case a Playwright test, and what needs the
outside world is listed in the README, "Not covered by the smoke suite". The 44 cases this file listed for a person
became smoke tests or were dropped there (the baseline says which).

## Findings

<!-- Numbered: what happened, which case, the cause, and the fix (commit) or why it was left. -->

## Conditions

<!-- Anything about the environment that could have affected the result. -->
