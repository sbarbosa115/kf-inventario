# UI regression run — 2026-10-06 (mobile-pass)

- **Suite:** [`../ui-regression.md`](../ui-regression.md), at `62d27d0`.
- **Branch:** `feature/mobile-pass` at `62d27d0`, on this checkout's stack (app http://localhost:18090, `http://nginx` inside the compose network).
- **Data:** reset to the seed before every attempt (`smoke.py` runs `backend/e2e/prepare.sh`).
- **How:** the smoke suite first (Playwright against this stack), until it is green; then the cases left for a person, in a browser driven through the real UI; emails read in the mail catcher; database/logs where a screen could not prove it.

## Summary

| | Cases |
|---|---|
| Cases in the suite | 194 |
| Run by the smoke suite | 194 |
| Left for the manual run | 0 |
| Manual: pass | <!-- N (M after a fix made during the run) --> |
| Manual: fail | <!-- N: IDs --> |

## Smoke suite

`python3 ~/.claude/skills/symfony-react-app/scripts/smoke.py` runs it and adds a row here. A run that is not green
is recorded too: write what failed under "Smoke findings", fix it, and run again. The manual run starts only when
the last row is green.

| # | When | Commit | Result | Failed |
|---|---|---|---|---|
| 1 | 2026-10-06 22:09 | `62d27d0` | Not green: 173 passed, 1 failed, 20 skipped | SHOP-08; skipped: MOB-01, MOB-02, MOB-03, MOB-04, MOB-05, MOB-06, MOB-07, MOB-08, MOB-09, MOB-10, MOB-11, MOB-12, MOB-13, MOB-14, MOB-15, MOB-16, MOB-17, MOB-18, MOB-19, MOB-20 |
| 2 | 2026-10-06 22:26 | `65509e1` | Green: 194 passed, 0 failed | — |
<!-- smoke.py adds a row per run of the whole suite -->

### Smoke findings

1. **SHOP-08 (attempt 1), the test was wrong; MOB-01 – 20 skipped because the lane depends on it.** It clicked Check
   now while the Orders page was still loading. The pull asks the fake shop, which the dev stack serves from the same
   five PHP workers; the pull's request held the session lock (native file sessions) and the page's own requests
   (the list, the shops) queued behind it, filling the pool, so the fake shop's request found no worker and the pull
   timed out at 15 s (`502`, the list `499`). It failed the same way on this branch before any of its fixes touched
   the shell or the orders, and with the shops spec run alone. Fix: SHOP-08 (and MOB-18) wait for the list before
   tapping Check now, as a person does (`65509e1`); three runs of the shops spec green. Production's shops are not
   served by the app, so the deadlock is the dev stack's.

## Manual run

Replace "Not run" with Pass, Fail, "Pass after fix" (with the commit) or Blocked (with why). Group consecutive
passes into ranges (`AREA-01 – 05`) once done.

| ID | Result | Case / notes |
|---|---|---|


## Findings

<!-- Numbered: what happened, which case, the cause, and the fix (commit) or why it was left. -->

## Conditions

<!-- Anything about the environment that could have affected the result. -->
