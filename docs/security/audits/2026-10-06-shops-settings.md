# Security audit — shops-settings — 2026-10-06

- **Branch:** `feature/shops-settings` at `dcf94aa` (start of the audit, every item merged), against `origin/main`;
  fixes in `69f81e4` and `73df4b4`.
- **Scope:** everything since `origin/main`:
  - **Public:** the per-connection webhook `POST|GET /webhooks/shops/{token}` (new) and the legacy webhook
    `/admin/order/1H39j0jpQPsWL958v9R4` (now behind the `webhooks.legacy_enabled` switch, counts hits, keeps failed
    bodies in the inbox).
  - **Admin (`ROLE_ADMIN`):** `/api/v1/settings/{email,email/test,analytics,webhooks}`, quick-phrase writes,
    `/api/v1/shops*` (CRUD, webhook secret read/rotate, Test connection, deliveries inbox with retry/discard, outbox
    with retry).
  - **Any signed-in user:** `GET /api/v1/settings/public`, `GET /api/v1/settings/quick-phrases`,
    `POST /api/v1/orders/{id}/comments`, `POST|DELETE …/comments/{cId}/pin`; `ROLE_CAN_READ_ORDERS`:
    `GET /api/v1/orders/{id}/comments`.
  - **List query contract** (`page`, `per_page`, `sort`, `q`, `filter[…]`, `facets`) on the orders, stock,
    customers, invoices and users lists (`ListQueryParser`, `ListQueryApplier`, each context's `ListMapping`).
  - **Outbound requests:** `SafeShopHttp` (Guzzle, every call to a shop: Test connection, the pull, the write-back),
    the SMTP transport built from Settings (`SettingsMailTransport`, the synchronous test email).
  - **Secrets at rest:** `SodiumSecretBox` (`APP_ENCRYPTION_KEY`), `app:settings:rekey`; rendered content: shop
    notes and inbox payloads (shop customers' data) in React; the analytics loader (`shared/lib/analytics.ts`).
  - **Jobs and commands:** `app:shops:pull` (cron), the `shops` Messenger queue (`PushShopUpdate` carries an outbox
    id), `app:settings:rekey`.
  - **Dev-only:** the fake shop `/_fake-shop/*` (`FakeShopController`, `kernel.debug`), `ShopFixtures`.
  - **Config and dependencies:** `security.yaml` (`^/webhooks/shops/` public), `SpaController` (excludes `webhooks/`),
    `.env`/`.env.test` (`APP_ENCRYPTION_KEY`), `deploy/cpanel-update.sh` + `deploy/env.local.example`; `ext-sodium`
    added, `automattic/woocommerce` removed (Guzzle, already a root requirement, now does the calls).
- **Tools:**
  - `composer audit`: clean. `npm audit --omit=dev`: clean.
  - Secrets in the diff: 11 secret-looking lines, **all dev/test fixtures, none a real credential**: the fake shop's
    token, keys and webhook secret (`src/DataFixtures/ShopFixtures.php` ×3, `FakeShopController.php` ×1 — loaded only
    by `DoctrineFixturesBundle`, which `bundles.php` enables in dev/test only, and answered only under
    `kernel.debug`), the same values in four Playwright specs (`comments`, `orders-sync` ×2, `shops`, `webhook`), and
    two made-up webhook secrets in `ShopConnectionForm.test.tsx`. Also `APP_ENCRYPTION_KEY` in `backend/.env` (dev,
    commented "for local stacks only") and `backend/.env.test` (suite): public by design; production must set its own
    (finding 4).
  - `debug:router` (the 37 new/changed routes), `scripts/audit.py` (77 leads, all resolved below), curl against the dev
    stack (`http://localhost:18090`) as `sbarbosa115` (admin), `inventory`, `invoices`, `sales` and signed out; the
    database read with `docker compose exec -T database mysql`; `var/log/dev.log` grepped after the operations;
    PHPUnit (test database) for the fixes. Everything the audit created on the dev stack (connection 8 "AUDIT hook",
    its 5 inbox rows, a hidden quick phrase, Email/Analytics values, the legacy switch toggled off and on) was removed
    or put back as found.

## Findings

| # | Severity | Category | Where | What an attacker could do | Status |
|---|---|---|---|---|---|
| 1 | Medium | A02 / A10 Secret exfiltration | `POST /api/v1/shops/{id}/test`, `PUT /api/v1/shops/{id}` (`ShopsTester`, `UpdateShopConnectionHandler`) | The consumer key and secret are "never readable" (PRD Security), but "Test connection" with a **typed site URL and blank keys** used the saved keys for the typed URL, and an edit that moved the URL to another host with blank keys kept them (then "Check now" or the cron pull sent them there). Whoever holds an admin session (a stolen session, an XSS) points the test at a host of theirs and receives the shop's Read/Write REST keys in the `Authorization: Basic` header: the shop's orders, customers and write access. Tried live: Test on the Fake shop with `site_url` `http://nginx/audit-exfil` and blank keys → nginx's access log shows `ck_fake_shop` as the request's user. | **Fixed** in `69f81e4`: blank keys fall back to the saved ones only on the same scheme, host and port (`ShopConnection::sameSite`; the SMTP password already followed this rule); otherwise the edit answers 422 on `consumer_key` (`ShopKeysRequired`) and the test answers `ok: false` "Type the consumer key and secret again…". Tests `testTheSavedKeysAreNeverSentToAnotherSite`, `testMovingAConnectionToAnotherSiteNeedsItsKeysTypedAgain` (red before the fix). Re-tried live: 422, and the test no longer calls the other host. Another *path* on the same host keeps the saved keys (same server). |
| 2 | Medium | A07 / A01 Webhook | `POST /admin/order/1H39j0jpQPsWL958v9R4` while `webhooks.legacy_enabled` is on (`ImportShopOrderHandler`) | Restructure finding 2, widened. The legacy URL's only credentials are its committed path and `X-WC-Webhook-Source`; with `WOO_COMMERCE_WEBHOOK_SECRET` empty (the default) a forged, **unsigned** delivery whose source is a connection's site URL is imported *through that connection* (its warehouse, printer email, link): the signature the per-connection URL requires (Decisions 5) is bypassed while the switch is on. New with this feature: a delivery that cannot be placed is kept in `shop_delivery` with its body (up to nginx's 12 MB, no 1 MB cap as on the new URL; rows of an unknown source have no connection and are shown nowhere, purged after 90 days), so a forger can also fill the database. Read in the code and in `LegacyWebhookApiTest::testOnAShopThatHasAConnectionIsImportedThroughIt`; tried live: switch off → 410 for POST and GET, on → 200 as before. | **Open: for the user.** It ends when the switch is turned off (cutover step 7), which is the fix. Until then: set `WOO_COMMERCE_WEBHOOK_SECRET` to the shops' current webhook secret (they already sign with it) so unsigned deliveries are refused, and keep the window between deploy and switch-off short. Requiring the *connection's* secret on the legacy URL would refuse the shops' real deliveries between steps 4 and 5 of the cutover, so it was not done. README Known gaps updated. |
| 3 | Low | A02 / A09 Secret in logs | `var/log/*.log` (Symfony's router `request.INFO "Matched route"`), the web server's access log | The PRD says webhook refusals log only the token's first 6 characters (they do: `Shop webhook [6ea461…] refused`), but the router logs every request's `route_parameters.token` and `request_uri` in full: always in dev, and in prod whenever `fingers_crossed` flushes its buffer (any error in the same request). The access log holds the full path anyway. The token alone places nothing (the signature is also required; the secret is never logged — grepped: 0 hits for the secret, the consumer key/secret and the SMTP password). | **Open: accepted as inherent** (WooCommerce delivers to a URL; the path is the routing key). Recommendation if wanted: a Monolog processor that shortens `/webhooks/shops/<token>`. Rotate a connection's secret if logs leak together with a secret. |
| 4 | Low | A02 Secrets | `deploy/cpanel-update.sh` | The check accepted any 64 hex characters as `APP_ENCRYPTION_KEY`, including the public keys committed in `backend/.env` and `backend/.env.test`: a production copied from the dev `.env` would seal the SMTP password and shop keys with a published key. | **Fixed** in `73df4b4`: the script fails when `.env.local` holds either committed key (case-insensitive). Tried by hand on a copy of the block: dev key → fail, test key upper-cased → fail, a fresh key → OK, `.env.test` missing → OK; `bash -n` clean. No automated test (the script has none). |
| 5 | Low | A01 Read access | `POST\|DELETE /api/v1/orders/{id}/comments/{cId}/pin` | Pin/unpin are `ROLE_USER` (PRD) and answer the comment, while reading an order's comments needs `ROLE_CAN_READ_ORDERS`. Tried live as `invoices`: `GET /orders/1/comments` → 403, `DELETE /orders/1/comments/1/pin` → 200 with `"content":"Comment for W00001"` (unpin of an unpinned comment changes nothing): any account reads any comment by id. | **Open: recommendation**, inside restructure finding 1 (accepted 2026-10-05: `PUT /orders/{id}/comments`, also `ROLE_USER`, already answers every comment of the order). If the user revisits those roles, give pin/unpin `ROLE_CAN_READ_ORDERS` (the order panel that pins needs it anyway). |
| 6 | Low | A10 Internal probe | `PUT /api/v1/settings/email` + `POST …/email/test` | The SMTP host may be private or loopback on purpose (cPanel's own mail server is `localhost`), so an admin can make the server open a TCP connection to any internal `host:port` and read the outcome in `detail.reason` (tried: `nginx:80` → "Connection to "nginx:80" timed out."). One per 10 s per user. | **Accepted** (admin only, throttled; blocking private hosts would break the common cPanel setup). |
| 7 | Low | A04 Inbox noise | `POST /webhooks/shops/{token}` with a wrong signature | Whoever knows a token (256 bits; it is in the shop's settings and the logs, finding 3) but not the secret adds one `bad_signature` row (no body) per request and moves the connection's "last failure". | **Accepted** (bounded: no body stored, purged after 90 days; the PRD wants refusals visible in health). Note for the user: the token cannot be rotated (only the secret), and a connection orders came from cannot be deleted and recreated, so a leaked token stays valid; a "new webhook URL" action would close that if it is ever needed. |

## Leads from audit.py

Each one checked against the checklist in `docs/security/README.md`; every lead is resolved by the group it points to.

- **L1 — A03 `ShopConnectionSealedSecrets.php:41`:** the interpolated column comes from the regex's own alternation
  (`consumer_key|consumer_secret|webhook_secret`), the id is cast to int and bound, the value is bound. Console-only
  (`app:settings:rekey`). Nothing found.
- **L2 — A08 `PullShopsCommand.php:39`:** the lock file is a fixed path (`%kernel.project_dir%/var/shops-pull.lock`),
  no input. Nothing found.
- **L3 — A01 / A08 / A10 `FakeShopController`:** dev-only by design (Decisions 17): every action calls `devOnly()`, a
  404 unless `kernel.debug` (production runs `APP_ENV=prod`, debug off); its state file is a fixed path under `var/`;
  it makes no outbound request (the lead's `file_get_contents` reads that file). The SPA route excludes `_*`, so a
  production `/_fake-shop/*` is a 404. Nothing found.
- **L4 — A10 test files:** `LegacyWebhookApiTest`, `ShopConnections`, `ShopWebhookApiTest` use the test client. Not
  outbound. Nothing found (the real outbound paths are under A10 below).
- **L5 — A05 / A01 `security.yaml:80-83`:** one rule added, `^/webhooks/shops/` → `PUBLIC_ACCESS`; the only route under
  it is `shop_webhook` (debug:router), whose credentials are the token and the signature. The legacy rule's comment
  changed, not its path. `^/api/` stays `ROLE_USER`. Nothing found.
- **L6 — A01 `SpaController.php:16`:** the requirement now also excludes `webhooks/` so the webhook never falls into
  the SPA shell; no data in the shell. Nothing found.
- **L7 — A01 `ShopWebhookController.php:36`:** public on purpose; tried live (A02/A07 below): no or wrong signature →
  401, unknown token → 404 and nothing stored, > 1 MB → 413. Findings 3 and 7.
- **L8 — A01 the other new routes and their `#[IsGranted]`s (SettingsController, QuickPhraseController,
  ShopConnectionController, ShopOutboxController, OrderCommentController):** class-level `ROLE_ADMIN` on shops and
  outbox, per-action roles on settings, phrases and comments, exactly as the PRD's tables. Tried live as `inventory`,
  `invoices`, `sales` and signed out over all 32 new `/api/v1` method+path pairs: every settings/shops/outbox route
  401 signed out and 403 for the three non-admins; `GET /settings/public` and `GET /settings/quick-phrases` 200 for
  them (with `?all=1` a non-admin still gets only active phrases: a hidden phrase was 0 hits for `sales`, 1 for the
  admin); `GET /orders/{id}/comments` 403 (none of them has `ROLE_CAN_READ_ORDERS`); comment add/pin/unpin reach the
  handler (`ROLE_USER`, PRD; finding 5). Single-tenant app: "another tenant" is another connection or another order —
  tried as admin: delivery 1 (connection 7) through `/shops/1/…` GET/retry/discard → 404 `delivery_not_found`,
  delivery 4 (connection 1) through `/shops/7/…` → 404, a connection-less legacy row through `/shops/1/…` → 404, outbox
  4 (connection 4) retried through `/shops/1/…` → 404 `outbox_not_found`, comment 21 (order 14) pinned/unpinned
  through order 1 → 404 `comment_not_found`, an unknown shop or order → 404. ContractTest covers route × role.
- **L9 — Frontend "open redirect" (`FailedUpdates.tsx:21`, `ShopConnectionFormPage.tsx:33`, `useListQuery.test.tsx`):**
  `useLocation()` reads the hash (`#failed-updates`) and the router state that hands the new connection's secret to
  its page; nothing navigates to a value from the URL; the list filters live in the query string and are only sent to
  the API (which validates them). Nothing found.

- [x] [A03 Injection] `backend/src/Ordering/Infrastructure/Settings/ShopConnectionSealedSecrets.php:41`: value concatenated into a query: bind it with setParameter → L1
- [x] [A08 Path traversal] `backend/src/Ordering/UI/Cli/PullShopsCommand.php:39`: filesystem path built from a variable: normalise and keep it inside the root → L2
- [x] [A08 Path traversal] `backend/src/Ordering/UI/Http/Controller/FakeShopController.php:139`: filesystem path built from a variable: normalise and keep it inside the root → L3
- [x] [A08 Path traversal] `backend/src/Ordering/UI/Http/Controller/FakeShopController.php:149`: filesystem path built from a variable: normalise and keep it inside the root → L3
- [x] [A10 SSRF] `backend/src/Ordering/UI/Http/Controller/FakeShopController.php:139`: server-side request: is the URL user-supplied? → L3
- [x] [A10 SSRF] `backend/tests/Functional/Ordering/LegacyWebhookApiTest.php:107`: server-side request: is the URL user-supplied? → L4
- [x] [A10 SSRF] `backend/tests/Functional/Ordering/ShopConnections.php:74`: server-side request: is the URL user-supplied? → L4
- [x] [A10 SSRF] `backend/tests/Functional/Ordering/ShopWebhookApiTest.php:173`: server-side request: is the URL user-supplied? → L4
- [x] [A10 SSRF] `backend/tests/Functional/Ordering/ShopWebhookApiTest.php:177`: server-side request: is the URL user-supplied? → L4
- [x] [A01 Access control] `backend/src/Ordering/UI/Http/Controller/FakeShopController.php:36`: new route: firewall, role and ownership checked, and a test for another tenant → L3
- [x] [A01 Access control] `backend/src/Ordering/UI/Http/Controller/FakeShopController.php:44`: new route: firewall, role and ownership checked, and a test for another tenant → L3
- [x] [A01 Access control] `backend/src/Ordering/UI/Http/Controller/FakeShopController.php:90`: new route: firewall, role and ownership checked, and a test for another tenant → L3
- [x] [A01 Access control] `backend/src/Ordering/UI/Http/Controller/OrderCommentController.php:41`: new route: firewall, role and ownership checked, and a test for another tenant → L8
- [x] [A01 Access control] `backend/src/Ordering/UI/Http/Controller/OrderCommentController.php:55`: new route: firewall, role and ownership checked, and a test for another tenant → L8
- [x] [A01 Access control] `backend/src/Ordering/UI/Http/Controller/OrderCommentController.php:74`: new route: firewall, role and ownership checked, and a test for another tenant → L8
- [x] [A01 Access control] `backend/src/Ordering/UI/Http/Controller/OrderCommentController.php:87`: new route: firewall, role and ownership checked, and a test for another tenant → L8
- [x] [A01 Access control] `backend/src/Ordering/UI/Http/Controller/ShopConnectionController.php:87`: new route: firewall, role and ownership checked, and a test for another tenant → L8
- [x] [A01 Access control] `backend/src/Ordering/UI/Http/Controller/ShopConnectionController.php:97`: new route: firewall, role and ownership checked, and a test for another tenant → L8
- [x] [A01 Access control] `backend/src/Ordering/UI/Http/Controller/ShopConnectionController.php:108`: new route: firewall, role and ownership checked, and a test for another tenant → L8
- [x] [A01 Access control] `backend/src/Ordering/UI/Http/Controller/ShopConnectionController.php:122`: new route: firewall, role and ownership checked, and a test for another tenant → L8
- [x] [A01 Access control] `backend/src/Ordering/UI/Http/Controller/ShopConnectionController.php:135`: new route: firewall, role and ownership checked, and a test for another tenant → L8
- [x] [A01 Access control] `backend/src/Ordering/UI/Http/Controller/ShopConnectionController.php:146`: new route: firewall, role and ownership checked, and a test for another tenant → L8
- [x] [A01 Access control] `backend/src/Ordering/UI/Http/Controller/ShopConnectionController.php:158`: new route: firewall, role and ownership checked, and a test for another tenant → L8
- [x] [A01 Access control] `backend/src/Ordering/UI/Http/Controller/ShopConnectionController.php:171`: new route: firewall, role and ownership checked, and a test for another tenant → L8
- [x] [A01 Access control] `backend/src/Ordering/UI/Http/Controller/ShopConnectionController.php:193`: new route: firewall, role and ownership checked, and a test for another tenant → L8
- [x] [A01 Access control] `backend/src/Ordering/UI/Http/Controller/ShopConnectionController.php:227`: new route: firewall, role and ownership checked, and a test for another tenant → L8
- [x] [A01 Access control] `backend/src/Ordering/UI/Http/Controller/ShopConnectionController.php:240`: new route: firewall, role and ownership checked, and a test for another tenant → L8
- [x] [A01 Access control] `backend/src/Ordering/UI/Http/Controller/ShopConnectionController.php:252`: new route: firewall, role and ownership checked, and a test for another tenant → L8
- [x] [A01 Access control] `backend/src/Ordering/UI/Http/Controller/ShopOutboxController.php:36`: new route: firewall, role and ownership checked, and a test for another tenant → L8
- [x] [A01 Access control] `backend/src/Ordering/UI/Http/Controller/ShopOutboxController.php:53`: new route: firewall, role and ownership checked, and a test for another tenant → L8
- [x] [A01 Access control] `backend/src/Ordering/UI/Http/Controller/ShopWebhookController.php:36`: new route: firewall, role and ownership checked, and a test for another tenant → L7
- [x] [A01 Access control] `backend/src/Settings/UI/Http/Controller/QuickPhraseController.php:42`: new route: firewall, role and ownership checked, and a test for another tenant → L8
- [x] [A01 Access control] `backend/src/Settings/UI/Http/Controller/QuickPhraseController.php:55`: new route: firewall, role and ownership checked, and a test for another tenant → L8
- [x] [A01 Access control] `backend/src/Settings/UI/Http/Controller/QuickPhraseController.php:72`: new route: firewall, role and ownership checked, and a test for another tenant → L8
- [x] [A01 Access control] `backend/src/Settings/UI/Http/Controller/QuickPhraseController.php:87`: new route: firewall, role and ownership checked, and a test for another tenant → L8
- [x] [A01 Access control] `backend/src/Settings/UI/Http/Controller/QuickPhraseController.php:102`: new route: firewall, role and ownership checked, and a test for another tenant → L8
- [x] [A01 Access control] `backend/src/Settings/UI/Http/Controller/SettingsController.php:52`: new route: firewall, role and ownership checked, and a test for another tenant → L8
- [x] [A01 Access control] `backend/src/Settings/UI/Http/Controller/SettingsController.php:66`: new route: firewall, role and ownership checked, and a test for another tenant → L8
- [x] [A01 Access control] `backend/src/Settings/UI/Http/Controller/SettingsController.php:79`: new route: firewall, role and ownership checked, and a test for another tenant → L8
- [x] [A01 Access control] `backend/src/Settings/UI/Http/Controller/SettingsController.php:107`: new route: firewall, role and ownership checked, and a test for another tenant → L8
- [x] [A01 Access control] `backend/src/Settings/UI/Http/Controller/SettingsController.php:123`: new route: firewall, role and ownership checked, and a test for another tenant → L8
- [x] [A01 Access control] `backend/src/Settings/UI/Http/Controller/SettingsController.php:134`: new route: firewall, role and ownership checked, and a test for another tenant → L8
- [x] [A01 Access control] `backend/src/Settings/UI/Http/Controller/SettingsController.php:149`: new route: firewall, role and ownership checked, and a test for another tenant → L8
- [x] [A01 Access control] `backend/src/Settings/UI/Http/Controller/SettingsController.php:160`: new route: firewall, role and ownership checked, and a test for another tenant → L8
- [x] [A01 Access control] `backend/src/Shared/UI/Http/Spa/SpaController.php:16`: new route: firewall, role and ownership checked, and a test for another tenant → L6
- [x] [A01 Access control] `backend/config/packages/security.yaml:83`: access check removed or loosened? → L5
- [x] [A01 Access control] `backend/src/Ordering/UI/Http/Controller/OrderCommentController.php:20`: access check removed or loosened? → L8
- [x] [A01 Access control] `backend/src/Ordering/UI/Http/Controller/OrderCommentController.php:42`: access check removed or loosened? → L8
- [x] [A01 Access control] `backend/src/Ordering/UI/Http/Controller/OrderCommentController.php:56`: access check removed or loosened? → L8
- [x] [A01 Access control] `backend/src/Ordering/UI/Http/Controller/OrderCommentController.php:75`: access check removed or loosened? → L8
- [x] [A01 Access control] `backend/src/Ordering/UI/Http/Controller/OrderCommentController.php:88`: access check removed or loosened? → L8
- [x] [A01 Access control] `backend/src/Ordering/UI/Http/Controller/ShopConnectionController.php:45`: access check removed or loosened? → L8
- [x] [A01 Access control] `backend/src/Ordering/UI/Http/Controller/ShopConnectionController.php:52`: access check removed or loosened? → L8
- [x] [A01 Access control] `backend/src/Ordering/UI/Http/Controller/ShopOutboxController.php:17`: access check removed or loosened? → L8
- [x] [A01 Access control] `backend/src/Ordering/UI/Http/Controller/ShopOutboxController.php:23`: access check removed or loosened? → L8
- [x] [A01 Access control] `backend/src/Settings/UI/Http/Controller/QuickPhraseController.php:23`: access check removed or loosened? → L8
- [x] [A01 Access control] `backend/src/Settings/UI/Http/Controller/QuickPhraseController.php:43`: access check removed or loosened? → L8
- [x] [A01 Access control] `backend/src/Settings/UI/Http/Controller/QuickPhraseController.php:56`: access check removed or loosened? → L8
- [x] [A01 Access control] `backend/src/Settings/UI/Http/Controller/QuickPhraseController.php:73`: access check removed or loosened? → L8
- [x] [A01 Access control] `backend/src/Settings/UI/Http/Controller/QuickPhraseController.php:88`: access check removed or loosened? → L8
- [x] [A01 Access control] `backend/src/Settings/UI/Http/Controller/QuickPhraseController.php:103`: access check removed or loosened? → L8
- [x] [A01 Access control] `backend/src/Settings/UI/Http/Controller/SettingsController.php:31`: access check removed or loosened? → L8
- [x] [A01 Access control] `backend/src/Settings/UI/Http/Controller/SettingsController.php:53`: access check removed or loosened? → L8
- [x] [A01 Access control] `backend/src/Settings/UI/Http/Controller/SettingsController.php:67`: access check removed or loosened? → L8
- [x] [A01 Access control] `backend/src/Settings/UI/Http/Controller/SettingsController.php:80`: access check removed or loosened? → L8
- [x] [A01 Access control] `backend/src/Settings/UI/Http/Controller/SettingsController.php:108`: access check removed or loosened? → L8
- [x] [A01 Access control] `backend/src/Settings/UI/Http/Controller/SettingsController.php:124`: access check removed or loosened? → L8
- [x] [A01 Access control] `backend/src/Settings/UI/Http/Controller/SettingsController.php:135`: access check removed or loosened? → L8
- [x] [A01 Access control] `backend/src/Settings/UI/Http/Controller/SettingsController.php:150`: access check removed or loosened? → L8
- [x] [A01 Access control] `backend/src/Settings/UI/Http/Controller/SettingsController.php:161`: access check removed or loosened? → L8
- [x] [A05 Config] `backend/config/packages/security.yaml:80`: security/CORS/framework config changed → L5
- [x] [A05 Config] `backend/config/packages/security.yaml:82`: security/CORS/framework config changed → L5
- [x] [A05 Config] `backend/config/packages/security.yaml:83`: security/CORS/framework config changed → L5
- [x] [Frontend] `backend/assets/react/pages/shop-connection-form/ui/FailedUpdates.tsx:21`: open redirect: only follow same-origin relative paths → L9
- [x] [Frontend] `backend/assets/react/pages/shop-connection-form/ui/ShopConnectionFormPage.tsx:33`: open redirect: only follow same-origin relative paths → L9
- [x] [Frontend] `backend/assets/react/shared/lib/useListQuery.test.tsx:7`: open redirect: only follow same-origin relative paths → L9
- [x] [Frontend] `backend/assets/react/shared/lib/useListQuery.test.tsx:10`: open redirect: only follow same-origin relative paths → L9

## Checked, nothing found

- **A01 Access control:** see L8. Ownership is never from the body: the comment author and pinner are the session
  user, `actorId` of settings changes too; a delivery or outbox row is loaded through its connection
  (`Shops::delivery($connection, $id)`, `ShopPushes::get($id, $outboxId)`), a comment through its order
  (`OrderComments::of`). Lists: the inbox and outbox are per connection; the five list endpoints keep their roles and
  scopes (orders still per `warehouse_id`). The UI hides Settings behind `useCan('ROLE_ADMIN')` and the API refuses it
  (above). Nothing is served from a public file URL.
- **A02 Cryptographic failures / secrets at rest:** `SodiumSecretBox` = `sodium_crypto_secretbox`, a fresh
  `random_bytes(24)` nonce per seal, MAC checked on open, `v1:` + base64; a key that is not 64 hex characters refuses
  to build the service. Read in the database after the operations: every `shop_connection.consumer_key`,
  `consumer_secret`, `webhook_secret` starts `v1:` (0 rows otherwise, 7 connections), and `app_setting.email.dsn`
  (`encrypted = 1`) read `v1:UkTz…` after saving an SMTP password `AuditPa55-SECRET`; 0 rows of `app_setting` or
  `log` contain the password or the audit connection's keys. Answers: `GET /shops`, `GET /shops/8`,
  `GET /settings/email` and `POST /shops/8/test` grepped for the password, the keys, `v1:` and the webhook secret →
  0 hits (`has_password`, `has_keys`; `webhook_secret` null except in the create answer and the deliberate
  `GET|POST …/webhook-secret`). Logs: `var/log/dev.log` and `test.log` → 0 hits for the SMTP password, the consumer
  key/secret and the webhook secrets (finding 3 for the token). Tokens and secrets: `bin2hex(random_bytes(32))`.
  Signature: `hash_equals(base64(HMAC-SHA256(raw body, secret)), header)`, the raw body (not re-encoded JSON); the
  secret is opened per delivery. A blank SMTP password is kept only for the same host (tried: changing the host to
  `[::1]` dropped it). `.env` committed values: only the dev/test `APP_ENCRYPTION_KEY`s (labelled), production's is
  required by the deploy script (finding 4) and documented in `deploy/env.local.example` with `app:settings:rekey`.
- **A02/A07 Webhook, tried live** on an inactive audit connection (so nothing could be placed): no
  `X-WC-Webhook-Signature` → 401 `{status:false}`; a wrong one → 401; the right HMAC of another body (one trailing
  space) → 401; the hex digest instead of base64 → 401; each kept as `bad_signature` with `payload` NULL; an unknown
  token → 404 and no row; a 65-character or non-alphanumeric token → 404 (route requirement); 1 MB + 1 byte with
  Content-Length → 413, the same **chunked** (no Content-Length) → 413; GET (WooCommerce's ping) → 200; the correctly
  signed body → 200 and an `inactive` inbox row, no order `990001`. Logs show `Shop webhook [6ea461…] refused` (prefix
  only). Legacy URL: switch off → 410 `{"status":false,"error":"webhook_moved"}` (POST and GET), on → 200 as before
  (finding 2).
- **A03 Injection:** `ListQueryParser` checks every field, sort, enum value, date, number, page and facet against the
  endpoint's `ListSchema` → 422 `validation_failed` (tried on `/orders`: `filter[nope]`, `sort=password`,
  `sort=-id;DROP`, `sort[]=`, `filter[status][]=99`, a bad date, `per_page` 0 and 1000, `facets` on a text column,
  `filter[code][]`, `filter[source][]=shop:1) OR 1=1`, `/users?filter[roles][]=%` → all 422). `ListQueryApplier` binds
  every value (`setParameter`), the column expressions come from the code's `ListMapping`, the sort from the
  allow-list; `LIKE` escapes `%`, `_` and `\` (tried: `filter[code]=%` and `q=_` → 0 of 20 orders). The closures
  (`sourceCondition`, `pinnedCondition`, the users' role `LIKE`, customers' first address) interpolate only parameter
  names and class names, and bind the values; `shop:<id>` is cast to int. `'; OR 1=1--` in the customers `q` → an
  empty page. XSS: no `dangerouslySetInnerHTML`, `innerHTML` or `eval` anywhere in `assets/react`; shop notes,
  comments, quick phrases (a stored `<script>` phrase came back JSON-escaped), inbox payloads (a `<pre>` of text) and
  the remote store name are rendered as React text; no `href` takes a site URL or other stored value. Analytics IDs:
  validated on the Input DTO and again in the handler after `trim` (`^G-[A-Z0-9]{4,12}$`, `^[a-z0-9]{6,20}$`); tried:
  `G-ABC123"><script>…`, `G-ABC123&x=1`, `javascript:alert(1)`, `%2F..%2F`, lower case, `abc123</script>`, upper case,
  `/../` → 422; a trailing newline is trimmed away. The loader re-checks the shapes, builds the two script URLs with
  `encodeURIComponent` and `createElement('script').src`, never HTML; it runs only in `AppShell` (the sign-in page is
  outside it, and `/settings/public` is 401 signed out; the sign-in HTML has no `googletagmanager`/`clarity.ms`).
  SMTP: the host must match a host-name/IP-literal pattern (tried: `smtp://evil.example`, `user:pw@evil.example`,
  `evil.example:25`, `/path`, `?verify_peer=0`, `#x`, `evil.example@mailpit`, `null://null`, `sendmail://default`,
  a space, CR LF, `-oQ/tmp` → 422 on `host`); the user and password are `rawurlencode`d into the DSN (tried
  `a@b:c/d?e#f` / `p@ss:/?#w`: round-trips unchanged, host stays `mailpit`); the port is 1–65535; the encryption one
  of three. Email headers go through Mime `Address` (the test recipient must be a valid address: a CR LF + `Bcc:` →
  422). No `exec`/`shell_exec`/`proc_open`.
- **A04 Insecure design:** the test email is limited to one per 10 s per user (tried: 202, then 429 twice
  `test_email_too_soon`); Test connection has a 15 s timeout and is admin-only. Input DTOs list the fields
  (`ShopConnectionInput`, `EmailSettingsInput`, …); the webhook token, secret and health are never taken from a body.
  Domain rules: one pinned comment per order, `send_to_shop` only on an active connection with `order_note`
  (`shop_note_unavailable`), an inactive phrase id refused (tried: 404 `quick_phrase_not_found`), a connection orders
  came from cannot be deleted (409), a duplicate delivery places nothing.
- **A05 Misconfiguration:** the fake shop is `kernel.debug`-only (L3); fixtures bundle dev/test only; the new public
  rule is the webhook path alone; API errors keep the `{error, message}` shape (no traces). No CORS added.
- **A06 Components:** `composer audit` and `npm audit --omit=dev` clean; `automattic/woocommerce` removed; Guzzle
  7.15.5 (patched in the restructure) now does the shop calls; `ext-sodium` is in `composer.json` and the deploy
  script's extension check.
- **A07 CSRF:** every new write is under `/api/` and covered by `SameOriginWrites` + the `SameSite=Lax` session
  cookie. Tried as the admin on 13 new writes (settings email/test/analytics/webhooks, quick phrases, shops
  create/update/delete/rotate/test, delivery retry, comment add/pin): `Origin: https://evil.example` → 403,
  `Origin: null` → 403, `Sec-Fetch-Site: cross-site` → 403 on every one. (Requests with no Origin at all pass, as
  designed for non-browser clients: a browser always sends Origin on a cross-site write, and the Lax cookie is not
  sent with it.)
- **A08 Integrity:** `PushShopUpdate` carries an outbox row id, the handler reloads the row; Retry re-runs the import
  from the stored body (admin-only; the body was signed when it arrived, or came from the shop's own API on a pull);
  no `unserialize`; no uploads; no user path in the filesystem (L2, L3).
- **A09 Logging:** settings changes are `log` rows by key, never value (`Email settings were changed.`
  `{"keys":[…]}`); shop connections created/edited/deleted with id, name, URL and `keys_replaced` (no keys); webhook
  refusals a warning with the token prefix; a legacy hit is counted even when the switch is off.
- **A10 SSRF**, tried live through Test connection (the same `SafeShopHttp::refusal` guards create and update, tried
  for `127.0.0.1`, `169.254.169.254`, `[::1]`, `2130706433` on create and `10.1.2.3`, `localhost` on update → 422
  `shop_url_invalid`): refused with "private or reserved address" — `https://127.0.0.1`, `http://127.0.0.1:8080`,
  `localhost`, `localhost.`, `10.0.0.5`, `172.17.0.1`, `192.168.1.1`, `169.254.169.254/latest/meta-data`, `[::1]`,
  `[::ffff:127.0.0.1]`, `[::ffff:7f00:1]`, `[fd00::1]`, `2130706433`, `0x7f000001`, `0177.0.0.1`, `017700000001`,
  `127.1`, `0`, `0.0.0.0`, `100.64.0.1`, the stack's `database`, `php:9000`, `mailpit:8025`, names that resolve to
  internal IPs (`localtest.me`, `127.0.0.1.nip.io`, `169.254.169.254.nip.io`), `http://example.com@127.0.0.1`,
  `http://127.0.0.1#@example.com`; refused as not a web address — `ftp://`, `gopher://127.0.0.1:6379`, `file:///etc/passwd`;
  unresolvable (`[fe80::1%eth0]`, `nginx.evil`) → "could not be resolved" (accepted at save, refused at every call);
  `http://user:pass@example.com` → the credentials are dropped by the normalisation; a redirecting site
  (`http://github.com`) → "redirect (301), which is not followed". DNS rebinding (code + `SafeShopHttpTest::
  testTheCallIsPinnedToTheCheckedAddressWithTheKeysAndATimeout`): every address `gethostbynamel` returns is checked,
  then cURL is pinned to the checked one with `CURLOPT_RESOLVE` (an IP literal is connected to as is), and
  `CURLOPT_PROTOCOLS` is http/https only; only `/wp-json/` and `/wp-json/wc/v3/<endpoint>` (pattern-checked) are
  appended to the stored URL. http and the `nginx` host are allowed only when `kernel.environment` is `dev`. The pin
  relies on Guzzle choosing its cURL handler, which it does when `ext-curl` is loaded (the deploy script requires it).
- **Frontend:** no secrets in the bundle (no `process.env` beyond `NODE_ENV`); `localStorage` holds only UI
  preferences; the webhook secret is fetched on demand and kept in component state; no open redirect (L9).

## Not applicable

- Uploads and path traversal: the feature accepts no files and builds no path from input.
- Multi-tenant isolation: one company; "another tenant" was tried as another connection and another order (L8).
- JWT/refresh tokens, sign-in codes, reset tokens: the app has none (session cookie).
- Rich-text sanitising: comments, phrases and notes are plain text everywhere in the app. A note sent to a shop is
  shown in WooCommerce's admin, which runs order notes through `wp_kses_post` (WooCommerce's concern).

## Notes

Restructure findings that still apply (`2026-10-05-restructure.md`): 1 (`ROLE_USER` order writes, accepted — the
comment timeline's add/pin follow it, finding 5), 2 (the legacy webhook, now finding 2), 5/14 (sign-in throttling and
timing), 10 (no script CSP: the analytics loader adds `googletagmanager.com` and `clarity.ms` scripts; list them if a
CSP is added), 16 (`APP_SECRET` from `master`).
