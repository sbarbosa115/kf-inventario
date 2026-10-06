# Security audit — shops-settings — 2026-10-06

- **Branch:** `feature/shops-settings-docs-cutover` (to be merged); all items 0 – 9 built in parallel into `feature/shops-settings`.
- **Scope:** shop connections (CRUD, test connection, webhook secrets); per-connection webhooks at `/webhooks/shops/{token}` (required HMAC-SHA256 signature); failed deliveries inbox (retry / discard); write-back to shops (order status, order notes) through an outbox queue; comment timeline with pins and quick phrases; server-side filters and paging on five lists; Settings screens (email, analytics, quick phrases); email test with sync send.
- **New tables:** `app_setting` (email, analytics, webhook toggle, quick phrases; encryption with `APP_ENCRYPTION_KEY`), `quick_phrase`, `shop_connection` (REST keys, webhook secret, capabilities; encryption), `shop_order_link`, `shop_delivery` (failed inbox, reason code, payload), `shop_outbox` (queued writes), `order_comment_meta` (pins, origin, shop notes).
- **Tools:**
  - `composer audit` and `npm audit --omit=dev`: checked after item 0 is merged (to be run at the barrier).
  - Secrets in the diff: `APP_ENCRYPTION_KEY` (dev stack fixed value in `backend/.env`, test value in `backend/.env.test`, production generates in `backend/.env.local` at cutover).
  - curl against local stack as `sbarbosa115` (admin) and `inventory` (read-only); the Playwright smoke suite.

## Findings

| # | Severity | Category | Where | What an attacker could do | Status |
|---|---|---|---|---|---|
| — | — | — | — | — | **To be filled by the auditor.** Check SSRF (shop URLs), webhook signatures (HMAC), secret encryption (key missing, decryption fails), failed-delivery payloads (PII: shop orders), sent status in health (401 marks keys read-only), outbox retry (idempotency), activity logging (who changed settings). |

## Notes

Existing findings from the restructure (`docs/security/audits/2026-10-05-restructure.md`) that affect shops-settings:

- Finding 1 (High, A01): any signed-in account can record partial shipments (kept; PRD decision 11). Shops-settings adds write-back to shops (order status / notes), but only through the outbox queue (not live; failures don't block local changes).
- Finding 5 / 14 (Low, A07 / A02): no sign-in throttling; user enumeration by timing. Same as legacy.
- Finding 10 (Low, A05): no script/style CSP, no HSTS. Deferred; the analytics loader injects GA4 and Clarity scripts by tag (never `innerHTML`).
- Finding 16 (Low, A02): `APP_SECRET` committed on `master`; generate a fresh one at cutover.
