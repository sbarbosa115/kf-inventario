# Security audit — mobile-pass — 2026-10-07

- **Branch:** `feature/mobile-pass` at `7803471`, against `origin/main`
- **Scope:** phone layout and touch fixes in the React SPA (kit CSS, dropdown placement, toasts on phones, focus on
  the first invalid field, scroll-into-view, scan page bar, order-form lines table, products Detail on cards) and a new
  Playwright phone lane (MOB-01 – 20). No route, controller, DTO, role, migration, dependency or server file changed.
- **Tools:**
  - `composer audit`: clean
  - `npm audit --omit=dev`: clean
  - secrets in the diff: 0 found

## Leads from audit.py

Each one checked against the checklist in `docs/security/README.md` and resolved into a finding or "nothing found".

- none

## Findings

| # | Severity | Category | Where | What an attacker could do | Status |
|---|---|---|---|---|---|

## Checked, nothing found

- **XSS (A03):** no `dangerouslySetInnerHTML`, no HTML built from data; the products Detail is rendered as React text
  (wrapping is CSS only). Toast, dropdown and focus changes move existing elements, they render no new content.
- **Access control (A01):** no API change; the UI keeps hiding what the session's roles do not reach.
- **Dependencies (A06):** `composer audit` and `npm audit --omit=dev` clean; none added.

## Not applicable

- Injection, uploads, authentication, sessions/CSRF, webhooks, jobs, emails, data model: no server code or input
  changed.
