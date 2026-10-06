# Shops, settings, table filters and order comments

<!--
    PRD for docs/pdr/prd-shops-settings.md. Base branch feature/shops-settings (from origin/main after the redesign
    merged, plus the two "every dialog centred" commits). Written 2026-10-06 from a read of the worktree at 19e9a92:
    backend/src/Ordering/**, Inventory/Domain/Model/Warehouse.php, config/services.yaml, .env, deploy/*, the five list
    endpoints and their React tables, shared/ui/DataTable.tsx, widgets/order-detail, tests/**, docs/**. `split.py plan`
    reads the table under "## Split".
-->

## What it is for

The **admin** (`ROLE_ADMIN`, `/admin/settings/**`) configures the application from inside it instead of from
`backend/.env.local`: the SMTP server and sender of the order email, Google Analytics 4 and Microsoft Clarity, the
four WooCommerce shops as **connections** (each with its own webhook URL, keys, warehouse and what the app may
write back to it), and the quick phrases the office uses in order comments. The **sales office and warehouse staff**
get server-side filters in the column headers of every table (products, orders, customers, invoices, users), usable
on a phone, and an order comment timeline with dates, authors, pins, quick phrases and the shop's own notes.

One PRD, **one PR**, built as parallel items (§2b). New database tables are allowed (additive migrations only);
existing production tables and columns still never change.

## Goals and how we will know

| Goal | Measure (regression run) |
|---|---|
| Find anything in any table without loading it all | Every list endpoint filters, sorts and pages on the server; a filter on 1,240 customers finds a customer on "page 13" (FLT-05); the URL holds the filters and a reload keeps them (FLT-08) |
| Filters usable with one thumb | At 390 px a "Filters · N" button opens a bottom sheet, every control ≥ 44 px, "Show N results" applies (FLT-10 – 12) |
| No more `.env.local` edits for day-to-day settings | SMTP, sender, printer, cc, analytics, shops and quick phrases are edited in Settings; env is only the fallback (SET-02 – 08) |
| Every shop is a first-class connection | Four connections, each with its own webhook URL + secret, keys, warehouse, printer flag, health and failed-deliveries inbox (SHOP-01 – 10, HOOK-03 – 06) |
| No shop order is lost silently | An order that cannot be placed is kept with its reason and retried from the inbox (SHOP-07 – 08); a shop still pointing at the legacy URL shows up as a warning (HOOK-06) |
| The shop learns what the office did | Processed → `processing`, Sent/Delivered → `completed`, queued and retried, failures visible (ORD-36 – 37) |
| Comments people can read | Timeline with author and date/time, shop notes interleaved, pinned notes on top and on the list, Enter sends, quick phrases (ORD-38 – 44) |
| Secrets safe | Passwords, consumer secrets and webhook secrets encrypted at rest with a key from env; never echoed except the webhook secret, never logged (security audit) |

## Non-goals

- No change to existing tables or columns (`warehouse.urls`, `order.source`, `comment.*` stay as they are); the
  invariance test and the drift gate keep guarding them and are extended to the new tables.
- No new roles: Settings is `ROLE_ADMIN`. The loose `ROLE_USER` endpoints of the README's known gaps stay as they are.
- No consent banner, no cookie policy page (internal tool, the user's decision).
- Write-back capabilities beyond **order status** and **order note**: stock, prices and customers are designed for
  (the capability list) but not built.
- No WooCommerce *product* sync, no pulling orders in statuses other than `processing` (as today) plus the modified
  ones of orders the app already holds (for their notes and remote status).
- PDFs, emails and spreadsheets keep their look and language.
- No real-phone run (the user's standing decision); phone cases run at 390 × 844 in the browser.

## Answers from the user (2026-10-06, binding)

1. **DB:** new tables allowed, additive migrations only; existing tables/columns never change; extend
   `SchemaInvarianceTest` to the new tables.
2. **Delivery:** one PRD, one PR, split into parallel items internally.
3. **Table search:** server-side over all records for every table (products/stock, orders, customers, invoices,
   users); the API list endpoints gain filter/sort/paging params (accepted API change). UI = demo option **"E ·
   Filters in the column headers"**: a filter row under the column names; text filter for plain columns; enum
   columns a multi-select dropdown (checkbox list with counts); dates a from–to range with Today / Last 7 days /
   Last 30 days; money a min–max with quick ranges; active filters also as removable chips + "Clear filters"; on
   phones a "Filters · N" button opens a bottom sheet with one section per column and "Show N results"; filters in
   the URL; 44 px targets; generic in the kit (`DataTable` column `filter` definitions), applied to every table.
4. **Settings section** for every `ROLE_ADMIN` (no new role).
   - **SMTP:** custom server in Settings; Settings win, `MAILER_DSN` is the fallback when empty; password encrypted,
     never shown back; "Send test email". Sender name/address, printer address and cc also editable, env fallback.
   - **Analytics:** GA4 Measurement ID + Clarity Project ID; when set both load on every signed-in page (not the
     sign-in page); no consent banner; SPA page views on navigation.
5. **Shop connections** (WordPress/WooCommerce, managed in Settings): name + site URL; REST consumer key/secret
   (encrypted); own webhook URL + signing secret per connection; active on/off; "Test connection" (REST reachable
   with the keys; webhook URL and secret shown to paste).
   - **The legacy single webhook URL `/admin/order/1H39j0jpQPsWL958v9R4` is replaced by per-connection URLs**
     (overrides CLAUDE.md's "never moves"; CLAUDE.md and README are updated; cutover checklist below; what the old
     URL answers after cutover is decided in Decisions 8).
   - **Orders configuration:** each connection → the warehouse its orders land in (replaces matching by
     `warehouse.urls`; the column is not altered), and whether it emails the printer (replaces
     `ORDER_WEBHOOK_EMAIL_WAREHOUSE_ID`, env as fallback while no connection exists).
   - **Order source names the shop for new orders only** (old orders keep Web/Phone); the link lives in a new table.
   - **Write-back is in this PR:** per connection a list of "things this app can update on the shop", each with a
     toggle; first: **order status** (Processed → `processing`; Sent and Delivered → `completed`; other local
     statuses do not touch the shop); designed so stock, notes… are added later. Failures never block the local
     change (queue + retry + visible in health).
   - **Smarter sync, all four:** (1) automatic catch-up ~15 min from the existing cron, the button becomes "Check
     now"; (2) only what's new (per connection, modified since the last successful pull); (3) connection health
     (last webhook, last import, last failure) in Settings and a warning on Orders; (4) failed deliveries inbox with
     Retry. "Sync shop orders" covers every active connection.
6. **Order comments:** demo option **"C · Pinned notes + quick phrases" on the timeline (A)**: timeline in the order
   panel (author, date/time; shop notes interleaved and marked); write box always at the bottom (Enter sends,
   Shift+Enter newline); optional "also send to <shop> as an order note" for orders from a connection (through the
   write-back capability list, second capability); any comment can be pinned (shown at the top of the order and as a
   line on the orders list); quick phrases (one tap adds a dated comment; list editable in Settings). Old comments
   without a date show the order's date marked approximate; new comments store date/time; comment metadata in a new
   table.
7. Dialogs stay centred (done on this branch). i18n EN + ES for every string (key parity), glossary in
   `docs/design/README.md`; tokens/kit only; dark theme; phones first-class.
8. Production is cPanel: no always-on process; background = Messenger doctrine queue drained by cron; the secrets
   encryption key comes from env (`deploy/env.local.example`); dates in America/Bogota.

---

## Current state (verified in the code)

- **Webhook.** `WooCommerceWebhookController` (`/admin/order/1H39j0jpQPsWL958v9R4`, GET+POST, public) checks one
  env secret (`WOO_COMMERCE_WEBHOOK_SECRET`, empty = no check) through `WooCommerceWebhookSignature`, then dispatches
  `ImportShopOrder(source, body)`. `ImportShopOrderHandler` finds the warehouse by `X-WC-Webhook-Source` in
  `warehouse.urls` (`Warehouses::byWebhookSource` → `DoctrineWarehouseRepository::findByUrl`, exact string match;
  the sync handler also tries with/without the trailing slash), refuses duplicates with `RemoteOrderKey`
  (warehouse id + shop order id = `order.code`, deleted orders included via plain SQL in
  `DoctrineImportedOrderCodes`), maps with `WebhookOrderMapper` (source `SOURCE_WEB`, payment credit card, customer
  from billing, two addresses, lines by SKU) and places through `PlaceOrderHandler`; the printer email only when
  `warehouseId === ORDER_WEBHOOK_EMAIL_WAREHOUSE_ID`. Any failure is logged and the shop always gets `{status: true}`.
  `SpaController` and `security.yaml` name the legacy path explicitly.
- **Sync.** `POST /api/v1/orders/sync` (`ROLE_CAN_SYNC_ORDERS`) → `SyncRemoteOrdersHandler` → `RemoteOrderSource`
  (`RestRemoteOrderSource`: the `automattic/woocommerce` client with the one env key set; `processing`, last 30
  days, 100 a page, 20 pages). One shop only. Tests use `FakeRemoteOrderSource` (`config/services_test.yaml`).
- **Status changes.** `ChangeOrderStatusHandler` sets the status and logs; `RecordPartialShipmentHandler` sets
  `STATUS_SENT` or `STATUS_PARTIAL` directly. No domain event is published for a status change today (only
  `OrderPlaced`). `OrderStatusHistoryListener` writes an `order_status` row on every persist/update.
- **Email.** `OrderCreatedMailer` takes `MAILER_FROM_ADDRESS/NAME`, `MAILER_PRINTER_ADDRESS` and the cc list
  (`ordering.order_email.cc`, hard-coded `sales@klassicfab.com` in `services.yaml`) as constructor args;
  `QueuedMailer` renders and dispatches `SendEmailMessage` on the `mail` doctrine transport; the transport is
  `MAILER_DSN` (`config/packages/mailer.yaml`). Cron: `messenger:consume mail --time-limit=55` every minute
  (`deploy/cpanel-update.sh` prints the line).
- **Comments.** `comment` **does have** nullable `created_at`, `modified_at`, `deleted_at` (migration
  `Version20190107014210`); the brief said it had no date. `Comment::__construct()` sets `createdAt` now, so every
  comment written by this app has a date; rows older than that migration (or written by legacy code before the
  constructor set it) may be NULL. `user_id` is nullable (`Version20190105180421`). The API exposes only
  `{id, content}` (`OrderCommentOutput`); `PUT /orders/{id}/comments` replaces the list (`SyncOrderCommentsHandler`
  detaches what is left out). `DeleteOrderHandler` soft-deletes comments (Gedmo).
- **Lists.** `GET /orders?warehouse_id=` returns a warehouse's whole list (`OrderOutput[]`); `GET
  /warehouses/{id}/stock` the whole stock; `GET /invoices` and `GET /users` everything; `GET /customers` pages
  (`{items, total, page, per_page}`, 100 max, no search). `DataTable` filters, sorts and pages in the browser
  (`searchValue`, `sortValue`, `pageSize`); `OrderTable` has client chips/search/date range; `CustomersPage` reads
  `?page=` from the URL and searches the loaded page only. `ApiResponse(page: true)` already describes the page
  shape for OpenAPI.
- **Analytics/CSP.** No script CSP (only `frame-ancestors 'none'` in `SecurityHeaders`); `spa.html.twig` has an
  inline theme script. `SpaController` is in Shared (uses no context).
- **Encryption.** None in the app; `APP_SECRET` is used for remember-me only. The PHP image is `php:8.4-fpm-alpine`
  (sodium and openssl are compiled in); the deploy script checks `pdo_mysql intl zip gd xmlreader mbstring curl`.
- **Deptrac.** Layers per context; contexts talk through `<Context>Api` (Application + Domain\Event); `Shared` uses
  nobody; `DomainModels` may reference each other. Adding a context = two layers + every ruleset row.
- **Tests/docs.** `SchemaInvarianceTest` asserts the drift baseline and **16 entities**; `ContractTest` lists every
  route × role; regression IDs in use: AUTH-08, NAV-06, DS-14, INV-30, WH-05, CUS-10, ORD-34, INVC-11, USR-09,
  MAIL-02, HOOK-02. Fixtures: warehouses Colombia (`https://colombia.test`), Usa, España; orders W00001 – W00012
  mixing sources/statuses; accounts `sbarbosa115` (admin), `inventory`, `invoices`, `sales`.

---

## Plan

- **Owning contexts (backend):**
  - **`Settings` (new context)** owns `app_setting` and `quick_phrase`: typed settings (`Email`, `Analytics`,
    `Webhooks` legacy toggle), the encryption port, the SMTP transport decoration, the test email, the public
    settings read. Justification: settings are not an order concern, and the mailer sits in Shared, which may use
    no context — so the transport that reads settings lives in `Settings/Infrastructure/Mail` and *decorates*
    Symfony's `mailer.transports`; nothing in Shared changes. Deptrac: layers `Settings` / `SettingsApi`;
    `Ordering`/`OrderingApi` may use `SettingsApi` (the order email's sender/printer/cc); nobody else needs it.
  - **`Ordering`** owns the shop connections and everything shop-shaped: `shop_connection`, `shop_order_link`,
    `shop_delivery`, `shop_outbox`, `order_comment_meta`. Justification: a connection exists to receive, pull and
    update *orders*; the import, sync, write-back and comment handlers are already Ordering's, and a separate
    `Integration` context would need Ordering's mapper, `PlaceOrderHandler` and repository on every path (a cycle
    under deptrac's `<Context>Api` rule). Sub-folders `Ordering/{Domain,Application,Infrastructure,UI}/Shop*` keep
    it readable. Warehouse resolution moves from `warehouse.urls` to `shop_connection.warehouse_id`.
  - **Inventory, Customers, Invoicing, Identity**: only their list queries/repositories (filters, sort, paging).
  - **Shared**: the list-query contract (`ListQuery`, parser, Doctrine applier) and the page Output shape.
- **FSD slices (frontend):** `shared/ui/filters/*` + `DataTable` extension (kit), `shared/lib/useListQuery.ts`,
  `shared/lib/analytics.ts`; `entities/settings`, `entities/shop-connection`, `entities/comment`; `pages/settings`
  (General, Email, Analytics, Shop connections, Quick phrases), `pages/shop-connection-form`,
  `pages/shop-deliveries`; `features/{test-email,test-shop-connection,retry-delivery,check-shop-orders,
  add-comment,pin-comment,quick-phrase}`; `widgets/{comment-timeline,shop-health}`; the five tables wired to the
  server (`widgets/stock-table`, `widgets/order-table`, `pages/customers`, `pages/invoices`, `pages/users`).
  Nav: "Settings" in the Admin group (`ROLE_ADMIN`), route `/admin/settings/*`.
- **Nearest existing feature to copy the shape of:** backend — item 13 of the restructure (`SyncRemoteOrders` +
  `RemoteOrderSource` port + `RestRemoteOrderSource` + `FakeRemoteOrderSource` in tests) for every shop call; the
  `OrderPlaced` → `SendOrderCreatedEmail` → `QueuedMailer` chain for the outbox; `CustomerController::page` for
  the page shape; `UserController` for a small CRUD. Frontend — `pages/users` + `pages/user-form` for Settings
  screens; `OrderTable` for a filtered table; `OrderComments` for the timeline's save path; `useRememberedWarehouse`
  for URL-backed state.
- **Left out on purpose (→ README "Known gaps"):** write-back of stock/prices; order pull for statuses other than
  `processing` (plus modified linked orders); a consent banner; `ROLE_USER`-only endpoints unchanged; the legacy
  env keys `WOO_COMMERCE_*` are removed from `env.local.example` (connections replace them; see cutover) — a stack
  with no connection pulls nothing, as a stack with empty keys does today; shop notes are read from WooCommerce at
  import and at each pull, not live.

---

## Data model (all new tables; `utf8mb4_unicode_ci`, InnoDB; one migration `Version20261006000000` in item 0)

| Table | Columns | Why |
|---|---|---|
| `app_setting` | `key` VARCHAR(100) PK · `value` LONGTEXT NULL · `encrypted` TINYINT(1) · `updated_at` DATETIME · `updated_by_id` INT NULL FK `user` | One row per setting (`email.dsn`, `email.from_address`, `email.from_name`, `email.printer_address`, `email.cc`, `analytics.ga4_id`, `analytics.clarity_id`, `webhooks.legacy_enabled`, `shops.last_pull_at`). Encrypted rows hold `v1:<nonce><ciphertext>` (Decisions 2). Typed access in `Settings/Domain/Model/{EmailSettings,AnalyticsSettings}`; the entity is `AppSetting` |
| `quick_phrase` | `id` INT PK AI · `text` VARCHAR(255) · `position` INT · `active` TINYINT(1) · `created_at` DATETIME | The quick phrases of the comment box, ordered, soft-hidden with `active` |
| `shop_connection` | `id` INT PK AI · `name` VARCHAR(100) UNIQUE · `site_url` VARCHAR(255) UNIQUE (normalised: https, lower-case host, no trailing slash) · `consumer_key` LONGTEXT (encrypted) · `consumer_secret` LONGTEXT (encrypted) · `webhook_token` VARCHAR(64) UNIQUE · `webhook_secret` LONGTEXT (encrypted) · `active` TINYINT(1) · `warehouse_id` INT FK `warehouse` · `email_printer` TINYINT(1) · `capabilities` JSON (`{"order_status": bool, "order_note": bool}`) · `pull_cursor` DATETIME NULL · `last_webhook_at`, `last_import_at`, `last_pull_at`, `last_pull_ok_at`, `last_failure_at` DATETIME NULL · `last_failure_code` VARCHAR(64) NULL · `last_failure` TEXT NULL · `created_at`, `updated_at` DATETIME | One WooCommerce shop. Health columns are written by the webhook, the pull and the pusher. `pull_cursor` = the newest `date_modified_gmt` of the last successful pull |
| `shop_order_link` | `order_id` INT PK FK `` `order` `` · `connection_id` INT FK `shop_connection` · `remote_order_id` VARCHAR(64) · `remote_status` VARCHAR(32) NULL · `pushed_status` VARCHAR(32) NULL · `created_at` DATETIME · UNIQUE(`connection_id`,`remote_order_id`) | Which shop an order came from (`order.source` stays `SOURCE_WEB`); the shop's status as last seen and as last pushed. `RemoteOrderKey` keeps working for orders imported before this (code = shop id in the warehouse) |
| `shop_delivery` | `id` INT PK AI · `connection_id` INT NULL FK · `kind` VARCHAR(16) (`webhook`,`pull`,`legacy`) · `remote_order_id` VARCHAR(64) NULL · `status` VARCHAR(16) (`placed`,`failed`,`discarded`) · `reason_code` VARCHAR(64) NULL (`bad_signature`,`unknown_product`,`no_warehouse`,`not_an_order`,`no_lines`,`duplicate`) · `reason` TEXT NULL · `payload` LONGTEXT (JSON) · `order_id` INT NULL FK · `attempts` INT · `received_at`, `last_attempt_at`, `resolved_at` DATETIME NULL · INDEX(`connection_id`,`status`) | The failed-deliveries inbox: every delivery that could not be placed, with its body, so an admin fixes the cause (creates the SKU, assigns the warehouse) and presses Retry. Placed deliveries are **not** stored (the order is the record); a refused signature stores no body (`payload` NULL, `reason_code` `bad_signature`) |
| `shop_outbox` | `id` INT PK AI · `connection_id` INT FK · `order_id` INT FK · `capability` VARCHAR(32) (`order_status`,`order_note`) · `payload` JSON · `status` VARCHAR(16) (`pending`,`sent`,`failed`) · `attempts` INT · `next_attempt_at` DATETIME NULL · `last_error` TEXT NULL · `created_at`, `sent_at` DATETIME NULL · INDEX(`status`,`next_attempt_at`) | What the app wants to write to a shop; the Messenger message carries only the row id. `failed` rows are shown in the connection's health with Retry |
| `order_comment_meta` | `comment_id` INT PK FK `comment` ON DELETE CASCADE · `origin` VARCHAR(16) (`app`,`shop`,`phrase`) · `pinned` TINYINT(1) · `pinned_at` DATETIME NULL · `pinned_by_id` INT NULL FK `user` · `connection_id` INT NULL FK · `remote_note_id` VARCHAR(64) NULL · `send_to_shop` TINYINT(1) · UNIQUE(`connection_id`,`remote_note_id`) | What `comment` cannot hold: pin state, where the comment came from (a shop note is a `comment` row with `user_id` NULL and `origin` `shop`), the shop note id (idempotent pulls) |

Messenger: a second queue **`shops`** on the same `messenger_messages` table (`queue_name`), retry 3 × (60 s × 5),
failed → `failed` transport. No new queue table.

**Invariance.** The migration only `CREATE TABLE`s (plus FKs to existing tables, which add nothing to them).
`SchemaInvarianceTest`: the entity count becomes **23** and the baseline stays the two drift lines; the test gains
`testNewTablesAreExactlyTheFeatureOnes()` asserting the set of table names mapped outside the 16 legacy ones equals
the seven above. `docs/db/schema-from-migrations.sql` is re-recorded (item 0) and `docs/db/README.md` lists the
seven tables as "added by shops-settings". `MigrateJsonColumnsCommand` untouched.

---

## API changes (all `/api/v1`, `snake_case`, roles as stated; README rows written by the item named)

### List query contract (item 0 shape, item 1 real implementation) — for `GET /orders`, `GET /warehouses/{id}/stock`, `GET /customers`, `GET /invoices`, `GET /users`

Query string: `page` (1…), `per_page` (1–100, default 25; `0` = every row, **stock only**, for the pickers of the
invoice form, order form and getting-ready screen), `sort` (`field` or `-field`, from the endpoint's allow-list),
`q` (one text over the endpoint's search columns), `filter[<field>]=<text>` (text columns, `LIKE %x%`, `%`/`_`
escaped), `filter[<field>][]=<v>` (enum columns, any of), `filter[<field>][from|to]=YYYY-MM-DD` (date columns,
Bogota days, both inclusive), `filter[<field>][min|max]=<decimal>` (money), `facets=<field>,<field>` (counts per
value of enum columns over the other filters). Unknown fields, sorts or values → 422 `validation_failed`
(`violations[].field = "filter.<field>"`). Response (every list, `ApiResponse(page: true)`):

```json
{"items": [...], "total": 1240, "page": 1, "per_page": 25,
 "facets": {"status": [{"value": "1", "count": 12}, ...]}}
```

| Endpoint | Role (unchanged) | Search `q` over | Filters | Sorts | Default |
|---|---|---|---|---|---|
| `GET /orders?warehouse_id=` (required, as today) | `ROLE_CAN_READ_ORDERS` | code, customer name, email | `code` text · `customer` text (name/email) · `status[]` (1–6) · `source[]` (`phone`, `web`, `shop:<id>`) · `created_at` date · `pinned` (`1`: has a pinned comment) | `code`, `customer`, `status`, `created_at` (default `-created_at`, tie `-id`) | as today |
| `GET /warehouses/{id}/stock?status=` | `ROLE_MANAGE_INVENTORY` | code, title, detail | `code`, `title`, `detail` text · `quantity` min/max · `price` money · `in_stock[]` (`yes`/`no`) | `code`, `title`, `quantity`, `price` (default `code`) | `per_page=0` allowed |
| `GET /customers` | `ROLE_MANAGE_CUSTOMERS` | first/last name, email, phone, city | `name`, `email`, `phone`, `city` text · `country[]` (country id) | `name`, `email`, `city` (default `-id`) | `/customers/all` unchanged |
| `GET /invoices` | `ROLE_CAN_READ_INVOICES` | code, customer name, email | `code`, `customer` text · `payment_method[]` · `created_at` date · `total` money · `walk_in[]` (`yes`/`no`) | `code`, `customer`, `created_at`, `total` (default `-created_at`) | — |
| `GET /users` | `ROLE_MANAGE_USERS` | name, username, email | `name`, `username`, `email` text · `roles[]` (the nine assignable) · `enabled[]` | `name`, `username`, `email` (default `name`) | — |

`OrderOutput`/`OrderDetailOutput` gain `shop: {id, name} | null` and `pinned_comment: {id, content, created_at} |
null`; `OrderCommentOutput` becomes `{id, content, created_at, approximate: bool, author: {id, name} | null, origin,
shop: {id, name} | null, pinned, pinned_at, pinned_by: {id, name} | null, sent_to_shop: bool}`.

### Settings (`ROLE_ADMIN` unless stated; item 3 builds, item 0 stubs with 501)

| Method | Path | Body / answer |
|---|---|---|
| `GET` | `/settings/public` | **`ROLE_USER`**: `{ga4_measurement_id, clarity_project_id}` (null when unset) |
| `GET` | `/settings/email` | `EmailSettingsOutput {dsn_host, dsn_port, dsn_user, has_password, encryption (`tls`/`ssl`/`none`), from_address, from_name, printer_address, cc: string[], source: {dsn: 'settings'\|'env'\|'none', from: …, printer: …, cc: …}}` — never the password or the raw DSN |
| `PUT` | `/settings/email` | `{host, port, user, password?, encryption, from_address, from_name, printer_address, cc[]}`; blank `password` keeps the stored one; every field empty → the setting is cleared (env fallback) → same Output. 422 on a bad address |
| `POST` | `/settings/email/test` | `{to}` → 202 `{queued: true}`: "KF Inventory test email" to `to`, through the effective transport, **synchronously** (`sync://`-like direct send, not the queue, so the admin sees the SMTP error): 502 `smtp_failed` with the server's message in `detail.reason` |
| `GET`/`PUT` | `/settings/analytics` | `{ga4_measurement_id, clarity_project_id}`; validated `^G-[A-Z0-9]{4,12}$` / `^[a-z0-9]{6,20}$`, empty clears |
| `GET`/`PUT` | `/settings/webhooks` | `{legacy_enabled: bool, legacy_hits_since: int, legacy_last_hit_at}` (the cutover switch, Decisions 8) |
| `GET` | `/settings/quick-phrases` | **`ROLE_USER`** (the comment box reads it): `QuickPhraseOutput[] {id, text, position, active}` (active only unless `?all=1`, admin) |
| `POST`/`PUT`/`DELETE` | `/settings/quick-phrases[/{id}]` | `{text, active}` → 201/200/204; `PUT /settings/quick-phrases/order {ids[]}` |

### Shop connections (`ROLE_ADMIN`; item 5a builds, 5b adds pull/push/outbox; item 0 stubs)

| Method | Path | Body / answer |
|---|---|---|
| `GET` | `/shops` | `ShopConnectionOutput[] {id, name, site_url, active, warehouse: {id, name}, email_printer, capabilities: {order_status, order_note}, webhook_url, has_keys, health: {last_webhook_at, last_import_at, last_pull_at, last_pull_ok_at, last_failure_at, last_failure_code, last_failure, failed_deliveries: n, failed_pushes: n}}` |
| `GET` | `/shops/{id}` | one; 404 `shop_not_found` |
| `POST` | `/shops` | `{name, site_url, consumer_key, consumer_secret, warehouse_id, email_printer, active, capabilities}` → 201 with `webhook_secret` **once** (generated server-side, 32 bytes hex) and `webhook_url`; 409 `shop_url_taken` / `shop_name_taken`; 404 `warehouse_not_found`; 422 `shop_url_invalid` (not https, private host, Decisions 4) |
| `PUT` | `/shops/{id}` | same body; blank `consumer_key`/`consumer_secret` keep the stored ones |
| `POST` | `/shops/{id}/webhook-secret` | rotates the signing secret → `{webhook_secret, webhook_url}` (shown to paste) |
| `GET` | `/shops/{id}/webhook-secret` | `{webhook_secret, webhook_url}` (admins may re-read it: it is the shop's paste value; the consumer secret is never readable) |
| `POST` | `/shops/{id}/test` | `TestResultOutput {rest: {ok, store_name?, wc_version?, can_write: bool, error?}, webhook_url, webhook_secret_set: true}`; keys from the body when given (testing before saving) else stored; 15 s timeout; never throws (the result says) |
| `DELETE` | `/shops/{id}` | 204; refused 409 `shop_has_orders` when links exist → deactivate instead |
| `GET` | `/shops/{id}/deliveries?status=failed` | page of `ShopDeliveryOutput {id, kind, remote_order_id, status, reason_code, reason, received_at, attempts, order: {id, code}\|null, summary: {customer, lines: [{sku, quantity}]}}` (list contract) |
| `GET` | `/shops/{id}/deliveries/{dId}` | with `payload` (the JSON body) |
| `POST` | `/shops/{id}/deliveries/{dId}/retry` | re-runs the import from the stored body → `ShopDeliveryOutput` (`placed` with `order`, or still `failed` with the new reason) |
| `POST` | `/shops/{id}/deliveries/{dId}/discard` | `status` `discarded` |
| `GET` | `/shops/{id}/outbox?status=failed` | `ShopOutboxOutput[] {id, capability, order: {id, code}, payload, status, attempts, last_error, created_at}` |
| `POST` | `/shops/{id}/outbox/{oId}/retry` | re-queues → `pending` |
| `POST` | `/orders/sync` (**kept**, `ROLE_CAN_SYNC_ORDERS`) | "Check now": pulls every active connection → 202 `{imported, skipped, failed, connections: [{id, name, imported, skipped, error?}]}`; a connection that cannot be read fails **that connection only** (recorded in its health), the others go on; 502 `order_sync_failed` only when every connection failed |
| `POST`/`GET` | **`/webhooks/shops/{token}`** (public) | the per-connection webhook: `X-WC-Webhook-Signature` **required** (HMAC-SHA256 of the raw body with the connection's secret, constant-time) → `{status: true}` on any accepted delivery (placed, duplicate or kept in the inbox); unknown token → 404 `{status: false}` (nothing stored); bad signature → 401 `{status: false}` + inbox row `bad_signature` (no body) + health; inactive connection → 200 + inbox row `inactive`; GET (WooCommerce's ping when a webhook is saved) → 200 `{status: true}` |
| `POST`/`GET` | `/admin/order/1H39j0jpQPsWL958v9R4` (legacy, public) | **while `webhooks.legacy_enabled`** (default on after the migration): today's behaviour (warehouse by `warehouse.urls`, env secret), plus a `shop_delivery` row of kind `legacy` only on failure and a hit counter; **once off**: 410 `{status: false, error: "webhook_moved"}`, counter + `last_hit_at`, a warning in Settings › Shop connections and on Orders |

### Comments (item 7 builds; item 0 stubs)

| Method | Path | Body / answer |
|---|---|---|
| `GET` | `/orders/{id}/comments` | `ROLE_CAN_READ_ORDERS`: `{comments: OrderCommentOutput[]}` oldest first; dateless legacy comments carry the order's `created_at` with `approximate: true` |
| `POST` | `/orders/{id}/comments` | `ROLE_USER` (as the PUT): `{content, send_to_shop?: bool, phrase_id?: int}` → 201 the comment; `send_to_shop` only when the order is linked and the connection's `order_note` capability is on (else 422 `shop_note_unavailable`); enqueues an `order_note` outbox row |
| `POST`/`DELETE` | `/orders/{id}/comments/{cId}/pin` | `ROLE_USER`: pins/unpins → the comment; only one pinned comment per order (pinning another unpins the previous) |
| `PUT` | `/orders/{id}/comments` | **kept** for the order form's edit path; its handler now writes `order_comment_meta` (`origin` `app`) for new ones |

ContractTest gains one row per endpoint above (item 0). README API table rows: item 1 (five list rows rewritten),
item 3 (settings rows), 5a/5b (shops rows + webhook rows), 7 (comments rows), 9 (final pass).

---

## Security

- **Secrets at rest.** `Settings/Application/Port/SecretBox {seal(string): string, open(string): string}`;
  implementation `Settings/Infrastructure/Crypto/SodiumSecretBox` with `sodium_crypto_secretbox` (XSalsa20-Poly1305,
  random 24-byte nonce, output `v1:` + base64(nonce‖ciphertext)); key = `APP_ENCRYPTION_KEY` (64 hex chars, 32 bytes;
  `deploy/env.local.example` shows `php -r 'echo bin2hex(random_bytes(32));'`). A missing/short key refuses to boot
  the settings services with a clear message (dev `.env` ships a fixed dev key; the smoke stack uses it). `ext-sodium`
  added to `composer.json` and to the deploy script's extension list. Sealed: SMTP password (inside the DSN),
  consumer key + secret, webhook secret. Outputs never carry a password or consumer secret (`has_password`,
  `has_keys`); logs never (the WooCommerce client's exception message is logged as today — it does not carry keys).
  Key rotation: `app:settings:rekey --old-key=` command (item 3) re-seals every row.
- **Webhooks.** Per-connection unguessable path token (32 bytes hex) **and** a required HMAC signature with a
  per-connection secret, compared with `hash_equals`; the raw body is signed, not the parsed JSON; bodies over 1 MB
  refused (413) before parsing; unknown tokens answer 404 without storing anything (no amplification into the inbox);
  the legacy URL dies with the cutover switch (410). Signature failures are counted in health (a shop whose secret
  changed is visible), never retried.
- **SSRF on shop URLs** (test connection, pull, push): `site_url` must be `https://` (http allowed only when
  `APP_ENV=dev`, for the local fixtures), host must not resolve to loopback, private, link-local or multicast ranges
  (checked with `gethostbynamel` at save and at each call), no redirects followed, 15 s timeout, only
  `/wp-json/wc/v3/...` paths built by the app (the URL from the row is never concatenated with request input).
  Implemented once in `Ordering/Infrastructure/WooCommerce/SafeShopHttp` and used by every call.
- **Analytics.** IDs validated by regex at save; the loader (`shared/lib/analytics.ts`) injects `<script
  src="https://www.googletagmanager.com/gtag/js?id=<id>">` and Clarity's loader with the ID only as a string
  argument/URL param (never `innerHTML`); loaded only inside `AppShell` (signed-in), never on `/admin/login`; no CSP
  exists today for scripts (README known gap) so no header change; if one is added later the two origins are listed.
- **Access.** Every `/settings/*` and `/shops/*` endpoint `#[IsGranted('ROLE_ADMIN')]` except `/settings/public`
  and `GET /settings/quick-phrases` (`ROLE_USER`); UI entry through `useCan('ROLE_ADMIN')`; `SameOriginWrites` covers
  the writes; the test-email endpoint is limited to one call per 10 s per user (a `TooManyAttempts` 429 from a
  cache lock) so it cannot be used to spam.
- **Inbox payloads** hold customer PII (shop orders): admin-only, `payload` returned only by the detail endpoint,
  rows older than 90 days deleted by the pull command.
- **Write-back keys** need Read/Write permission in WooCommerce; "Test connection" reports `can_write` (a `HEAD`-like
  `GET /orders?per_page=1` cannot prove write access, so the app checks the key's `permissions` via
  `GET /system_status`… which is admin-only; decision: report `can_write` as "unknown" unless a push succeeded; the
  first failed push with 401 marks the connection "keys are read-only" in health). Recorded in the audit.
- **Logging.** Who changed which setting (key, not value) → `log` rows through `ActivityLog` (`settings`,
  `shop_connection`); webhook refusals → monolog warning with token prefix only.

---

## Screen proposals

Every screen is built from the kit (`docs/design/README.md`), EN/ES, light/dark, 390 px.

1. **Column filters on every table** (items 0 + 2). `DataTable` gets `serverSide` mode: props `total`, `page`,
   `perPage`, `query: ListQuery`, `onQueryChange`, `facets`; a column gets `filter?: TextFilter | EnumFilter |
   DateFilter | MoneyFilter` (`{type: 'enum', field, options: [{value, label}], counts?}` etc.) and `sortField?`.
   Desktop (≥ 600 px): a **filter row under the header row** (`role="row"` inside `thead`): text columns an
   `<input type="search">` (debounced 300 ms, Enter applies at once); enum columns a `FilterDropdown` button
   ("Status · 2") opening a popover with a checkbox list and counts from `facets`, "Clear"; date columns a
   `DateRangeFilter` popover (two `<input type="date">`, quick picks Today / Last 7 days / Last 30 days / This
   month); money/number a `RangeFilter` (min/max, quick ranges "Under $100", "$100 – $500", "Over $500" for money;
   "0", "1 – 10", "Over 10" for quantities). Above the table an `ActiveFilters` strip: one removable chip per
   filter ("Status: Created, Processed ×", "Created: Oct 1 – Oct 6 ×") + "Clear filters"; the `SearchBox` of the
   `Toolbar` stays as the free-text `q`. Sorting by header click sends `sort`. Pager: "1 – 25 of 1,240", Previous /
   Next, per-page 25 / 50 / 100. **Phone (< 600 px, card mode):** the filter row is hidden; the toolbar shows one
   button **"Filters · N"** (N active) opening a `FilterSheet` (bottom sheet, `role="dialog"`, drag handle, body
   scrolls, 44 px rows): one collapsible section per filterable column with the same controls stacked (checkbox
   lists, two date inputs + quick picks, two numeric inputs + quick ranges), sticky footer "Show N results" (N from a
   debounced `total`-only request, `per_page=1`) and "Clear". Sort on phones: a "Sort" select in the sheet. State:
   `useListQuery(defaults)` keeps the whole query in the URL (`?q=&sort=-created_at&filter[status][]=1&page=2`) and
   resets `page` when a filter changes; a reload or a shared link restores it. Loading: skeleton rows keep the
   previous rows' height; the active filters stay visible. Empty: "Nothing matches these filters." + "Clear
   filters". The five tables: **Products** (code, title, detail text; quantity range; price money; in-stock enum;
   KPIs now come from a `GET …?per_page=1&facets=in_stock` + the server's `total` and a `totals: {units, value}`
   field the stock endpoint adds; the stock sheet download of "every ticked product" still works per page) ·
   **Orders** (order text, customer text, source/shop enum with counts, status enum with counts — the status
   chips of the toolbar are kept as a shortcut writing the same `filter[status]` —, created date range, comments:
   a "Pinned only" toggle) · **Customers** (name, email, phone, city text; country enum; the "Search this page"
   label becomes "Search customers") · **Invoices** (invoice text, customer text, payment method enum, date range,
   total money range, walk-in enum) · **Users** (name/username/email text, roles enum with counts, enabled enum;
   the Active/Inactive chips kept). `/admin/_kit` shows every filter control (DS-15 – 16).
2. **Settings** (item 4; `/admin/settings`, `PageHeader` "Settings", tabs as a `nav` of links: General · Email ·
   Analytics · Shop connections · Quick phrases; on phones the tabs scroll horizontally). **General** (`/admin/settings`):
   read-only facts — app version (git short hash from `composer.json`/`APP_VERSION` env, optional), time zone
   America/Bogota, where email leaves from (Settings / env fallback / not configured), the legacy webhook switch
   with its hit counter and "Turn off the old webhook URL" (`ConfirmModal`: "Shops still posting there will get 410
   and their orders will not be placed. Do this after every shop points at its connection."). **Email**
   (`/admin/settings/email`): `FormLayout` narrow; section "SMTP server" (host, port, user, `PasswordField`
   "Leave blank to keep the current password", encryption select, a muted line "When empty, `MAILER_DSN` from the
   server is used" with the env host shown), section "Sender and recipients" (from address, from name, printer
   address, cc list as chips input), `ActionBar` Save; secondary "Send test email" opens a `SlideOver` (centred)
   with a `to` field prefilled with the admin's email and the result inline (success: "Sent through
   smtp.example.com"; failure: the server's message). **Analytics** (`/admin/settings/analytics`): two fields with
   help ("G-XXXXXXX from GA4 › Admin › Data streams"; "the Project ID from Clarity › Settings"), a status line
   "Loads on every signed-in page for everyone; not on the sign-in page; no consent banner (internal tool)". Save →
   toast; the loader picks the new IDs on the next navigation. **Quick phrases** (`/admin/settings/phrases`): a
   list with inline add ("Add phrase" input + Enter), rename inline, active switch, move up/down (▲▼ buttons, 44 px;
   no drag), delete with confirm; a preview of the comment box's phrase bar. 
3. **Shop connections** (item 6; `/admin/settings/shops`): cards (one per connection, as the warehouses screen):
   name, site URL (mono), `StatusBadge` Active / Inactive, warehouse, "prints orders" chip, **health** lines (last
   webhook · last order imported · last check · last failure in danger with its reason), counters "3 failed
   deliveries" (link) and "1 failed update" (link), ⋯ menu (Edit, Test connection, Failed deliveries, Deactivate /
   Activate, Delete). Primary "Add connection". Empty state explains the cutover ("Create one connection per shop,
   paste its webhook URL and secret in WooCommerce, test, then turn off the old webhook URL in General"). A warning
   banner when the legacy URL received hits since it was turned off. **Connection form**
   (`/admin/settings/shops/new`, `/admin/settings/shops/:id`; `FormLayout columns={2}` ≥ 1280): section
   "Shop" (name, site URL, active switch); section "WooCommerce REST API" (consumer key, consumer secret as
   `PasswordField`s, "blank keeps the saved keys", help "WooCommerce › Settings › Advanced › REST API, permission
   Read/Write"); section "Orders" (warehouse select — "replaces the shop addresses of the warehouse", email the
   printer switch); section "What this app may update on the shop" — a list of capabilities with a switch each:
   "Order status (Processed → processing, Sent and Delivered → completed)", "Order notes (comments marked 'also
   send to the shop')"; section "Webhook" (after save): the webhook URL and the signing secret, each with a Copy
   button, "Rotate secret" (confirm), and the WooCommerce steps ("Settings › Advanced › Webhooks › Add: Topic
   *Order created*, Delivery URL = this URL, Secret = this secret, API version v3"); `ActionBar` Save · Cancel ·
   secondary **"Test connection"** (runs with the fields as typed; result card: store name + WooCommerce version, or
   the error; "Webhook: paste the URL and secret above"). **Failed deliveries** (`/admin/settings/shops/:id/
   deliveries`): a filtered table (status enum, received date range, text on remote id/customer) of inbox rows:
   Received, Shop order #, Customer, Lines (sku × qty), Reason (`StatusBadge` danger + text: "Unknown product
   KF-99", "No warehouse", "Bad signature"), ⋯ (View body, Retry, Discard); row click opens a centred `SlideOver` with
   the body (mono, scrollable) and the same actions; Retry → toast "Order 5501 placed" and the row leaves the
   failed filter. **Orders page integration:** the `ShopHealth` widget above the table — one collapsible warning
   line when any active connection has a failure newer than its last success, failed deliveries, failed pushes, or
   legacy hits ("Kfvintage: 2 orders could not be placed · Fix in Settings"); the "Sync shop orders" button becomes
   **"Check now"** (secondary; toast "3 orders imported from 2 shops, 1 skipped; Kfvintage could not be read");
   the Source column shows the shop's name with the globe icon for linked orders (Web / Phone otherwise) and the
   order detail header the same; the source/shop filter lists each shop.
4. **Comment timeline** (item 8; `widgets/comment-timeline` replaces `features/edit-order-comments` in the order
   detail; the order form keeps its comments field as today). Pinned comment first in an accent-soft card with a
   pin icon and "Unpin"; then the timeline oldest → newest, each entry: avatar initials, author name ("Shop ·
   Kfvintage" with a store icon for `origin` `shop`; "Quick phrase" marker for `phrase`), `dateTime` (with "≈" and
   title "Approximate: the order's date" when `approximate`), the text (whitespace kept), a ⋯ (Pin / Unpin; Edit
   and Remove stay for `app` comments through the existing PUT); "Sent to the shop" check mark when
   `sent_to_shop`. Sticky bottom **write box**: a phrase bar (`QuickPhrases`, horizontally scrollable chips, one tap
   = posts that phrase at once), a textarea that grows (1–5 rows; Enter sends, Shift+Enter newline; on phones the
   Send button is the way, `enterKeyHint="send"`), a checkbox "Also send to Kfvintage as an order note" visible only
   for linked orders whose connection has `order_note` on, a Send button (`primary`, `loading`). After send the
   entry appears at the bottom with a flash, the box clears and keeps focus; a failure stays inline with the text
   kept. **Orders list:** the Comments column becomes "Notes": the pinned comment's first line (truncated, title
   full) under a pin icon, else the count; card mode shows the pinned line under the title. The detail opens on the
   timeline when the Notes cell is tapped.

### Phone and handheld

Filters via the bottom sheet (the only way under 600 px); the Settings tabs scroll; connection cards stack; the
timeline's write box sits above the tab bar (`--kf-shell-bottom`); every control 44 px; no horizontal page scroll
(DS-03 extended to `/admin/settings/*`).

### Copy and glossary (added to `docs/design/README.md` by item 0; binding)

| English | Spanish |
|---|---|
| Settings · General · Email · Analytics · Shop connections · Quick phrases | Configuración · General · Correo · Analítica · Conexiones con tiendas · Frases rápidas |
| SMTP server · Sender · Printer address · Copy to (cc) · Send test email · Sent through {{host}} | Servidor SMTP · Remitente · Dirección de la impresora · Con copia (cc) · Enviar correo de prueba · Enviado por {{host}} |
| Connection · Add connection · Test connection · Webhook URL · Signing secret · Rotate secret · Copy · Active · Inactive | Conexión · Agregar conexión · Probar conexión · URL del webhook · Secreto de firma · Rotar el secreto · Copiar · Activa · Inactiva |
| Check now · Failed deliveries · Retry · Discard · Reason · Connection health · Last webhook · Last order imported · Last check · Last failure · The old webhook URL | Buscar ahora · Entregas fallidas · Reintentar · Descartar · Motivo · Estado de la conexión · Último webhook · Último pedido importado · Última revisión · Último error · La URL anterior del webhook |
| What this app may update on the shop · Order status · Order notes | Qué puede actualizar esta aplicación en la tienda · Estado del pedido · Notas del pedido |
| Filters · Filters · {{n}} · Show {{n}} results · Clear filters · Sort · Today · Last 7 days · Last 30 days · This month · From · To · Min · Max · Under {{amount}} · Over {{amount}} · {{from}} – {{to}} of {{total}} · Rows per page | Filtros · Filtros · {{n}} · Mostrar {{n}} resultados · Quitar filtros · Ordenar · Hoy · Últimos 7 días · Últimos 30 días · Este mes · Desde · Hasta · Mín. · Máx. · Menos de {{amount}} · Más de {{amount}} · {{from}} – {{to}} de {{total}} · Filas por página |
| Notes · Pin · Unpin · Pinned · Send · Also send to {{shop}} as an order note · Shop note · Quick phrase · Approximate date (the order's) · Write a note… | Notas · Fijar · Desfijar · Fijada · Enviar · Enviar también a {{shop}} como nota del pedido · Nota de la tienda · Frase rápida · Fecha aproximada (la del pedido) · Escriba una nota… |
| Source: Web / Phone / {{shop}} | Origen: Web / Teléfono / {{shop}} |

---

## Contract (item 0)

Built by the coordinator alone on `feature/shops-settings`, in this order; each sub-step ends with the verification
named. Item 0 leaves every screen working as today (the lists answer the new page shape and the tables read it) and
the whole smoke suite green before wave 1.

**0.1 Schema.** The seven entities (`Settings/Domain/Model/{AppSetting,QuickPhrase}`,
`Ordering/Domain/Model/{ShopConnection,ShopOrderLink,ShopDelivery,ShopOutbox,OrderCommentMeta}`) with explicit
`#[ORM\Table]`, the Doctrine mapping block for `Settings` in `doctrine.yaml`, migration `Version20261006000000`
(CREATE TABLE × 7, FKs, indexes; `down()` drops them), the `shops` Messenger transport (`messenger.yaml`, retry 3 ×
60 s × 5, `sync://` in test), `APP_ENCRYPTION_KEY` in `.env` (dev value), `.env.test`, `deploy/env.local.example`,
`ext-sodium` in `composer.json`, `sodium` in the deploy script's extension list. `SchemaInvarianceTest` → 23
entities + the new-tables assertion; `docs/db/schema-from-migrations.sql` re-recorded; `docs/db/README.md` lists
the tables. *Verify:* `composer test:prepare` on dev and test; `SchemaInvarianceTest` green; `gate.sh`
(`schema-drift`) green; `doctrine:migrations:migrate` then `down` then `up` on a scratch database.

**0.2 Deptrac and the Settings skeleton.** `deptrac.contexts.yaml`: layers `Settings` / `SettingsApi`, every
ruleset row updated (`Ordering` and `OrderingApi` get `SettingsApi`). `Settings/Application/Port/SecretBox` +
`Settings/Infrastructure/Crypto/SodiumSecretBox` (+ unit test: round trip, tamper detected, wrong key refused,
`v1:` prefix); `Settings/Domain/Repository/{SettingRepository,QuickPhraseRepository}` + Doctrine adapters;
`Settings/Application/Query/{EmailSettings,AnalyticsSettings,WebhookSettings,QuickPhrases}` reading rows with env
fallback (`EmailSettings::effective()` → DSN, from, printer, cc with `source` per value); `Settings/Application/
Command/{SaveEmailSettings,SaveAnalyticsSettings,SaveWebhookSettings,SaveQuickPhrase,DeleteQuickPhrase,
ReorderQuickPhrases}` + handlers (small enough for item 0; item 3 adds the transport, the test email and rekey).
`Ordering/Application/Port/OrderEmailSettings` (sender, printer, cc) implemented in
`Ordering/Infrastructure/Settings/SettingsOrderEmailSettings` over `SettingsApi`; `OrderCreatedMailer` reads the
port instead of constructor args (`services.yaml` block removed). *Verify:* `composer deptrac` green;
`OrderEmailTest` green with the env fallback (settings empty) and with a settings row (printer from settings wins).

**0.3 The list-query contract.** `Shared/Application/Query/ListQuery` (page, perPage, sort, q, filters as typed
value objects: `TextFilter`, `AnyOfFilter`, `DateRangeFilter`, `NumberRangeFilter`), `Shared/UI/Http/ListQueryParser`
(query string → `ListQuery` against a `ListSchema` allow-list: fields, types, sorts, search columns, max per page,
`allowAll`), `Shared/Infrastructure/Persistence/ListQueryApplier` (applies to a `QueryBuilder` with bound parameters,
LIKE escaping, Bogota day boundaries, facets through `GROUP BY` queries), `Shared/UI/Http/Output/PageOutput`
shape + `ApiResponse(page: true)` gains `facets`. The five controllers parse the query and answer the page shape
**with the filtering done in memory over today's arrays** (a walking skeleton: correct, slow; item 1 moves it into
SQL and adds facets); `per_page=0` on stock. `assets/react/entities/*/api` list functions take a `ListQuery` and
return `Page<T>`; `useListQuery` (`shared/lib`) maps the URL ↔ `ListQuery`; `DataTable` gets `serverSide` props
and the `filter` column type, `shared/ui/filters/{FilterRow,FilterDropdown,DateRangeFilter,RangeFilter,
ActiveFilters,FilterSheet,Pager}` with Vitest files; the kit page shows them. The five tables are switched to
server mode **without filters yet** (page + sort + `q` only, their current chips/search mapped onto `filter`/`q`
so no label changes) — item 2 adds the filter row and the sheet. OpenAPI dumped, `api.d.ts` regenerated.
*Verify:* `ListQueryParserTest` (every type, bad field 422, escaping), `ListQueryApplierTest` (SQL with bound
params), the kit's Vitest; **the whole smoke suite green** (the specs' locators untouched).

**0.4 Shops and comments stubs.** `Ordering/Domain/Model/ShopConnection` behaviour (`webhookUrl()`, `can(string
$capability)`, `recordWebhook/Import/Pull/Failure(...)`), `Ordering/Domain/Repository/{ShopConnectionRepository,
ShopDeliveryRepository,ShopOutboxRepository,ShopOrderLinkRepository,CommentMetaRepository}` + Doctrine adapters,
ports `Ordering/Application/Port/{ShopGateway (REST: storeInfo, ordersModifiedSince, orderNotes, updateOrderStatus,
addOrderNote), ShopOutboxQueue (enqueue), ShopOrderLinks}` with a `FakeShopGateway` in tests
(`services_test.yaml`), the domain event `OrderStatusChanged(orderId, status)` published by
`ChangeOrderStatusHandler` and `RecordPartialShipmentHandler` with a **no-op handler** (item 5b replaces it), every
Output/Input DTO of the shops and comments endpoints, the controllers answering 501 `not_implemented` (routes,
roles, `ContractTest` rows), the public route `/webhooks/shops/{token}` excluded from `SpaController`'s pattern and
`PUBLIC_ACCESS` in `security.yaml` (501 until 5a), `WebhookSettings::legacyEnabled()` read by the legacy
controller (true → today's path; false → 410 + counter). `OrderOutput.shop`/`pinned_comment` and the new
`OrderCommentOutput` fields answered from the link/meta tables (null/absent for every existing row).
*Verify:* `ContractTest` green (new rows 501, roles right); `WebhookApiTest` green with the toggle on; a new test
proves 410 with it off; `OrderApiTest` green with the new fields.

**0.5 Frontend skeleton.** Route `/admin/settings/*` with `pages/settings` tabs (General works: facts + legacy
switch; the other tabs are stubs "Built by item 4/6"), nav entry "Settings" (`nav.settings`, `ROLE_ADMIN`,
`fa-sliders`), `entities/{settings,shop-connection,comment}` API modules typed from `api.d.ts`,
`shared/lib/analytics.ts` (`useAnalytics()` reading `/settings/public`, no-op while both null) mounted in
`AppShell`, i18n prefixes **`settings`, `shops`, `comments`, `filters`** created empty in both languages
(`locales/{en,es}/<prefix>.json`, registered in `index.ts`) plus the glossary rows above in `docs/design/README.md`,
CSS files `pages/settings/ui/settings.css`, `widgets/comment-timeline/ui/comment-timeline.css`,
`shared/ui/filters/filters.css` (item 0's). *Verify:* `AppShell.test.tsx` (Settings only for admins), `npm test`,
`gate.sh`; sign in as `inventory`: no Settings entry and `/admin/settings` shows the not-found page.

**0.6 Regression stubs, deploy, docs.** `docs/tests/ui-regression.md`: sections `11. Settings (SET)`, `12. Shop
connections (SHOP)`, `13. Table filters (FLT)`, DS-15 – 16 in section 10, SET-01 in 11, and one stub subsection per
item with its ID range and owner comment (ORD, HOOK, MAIL stubs in their sections). `deploy/cpanel-update.sh`: the
cron line becomes `flock -n ~/.kf-worker.lock sh -c 'console app:shops:pull --if-due; console messenger:consume mail
shops --time-limit=50 --memory-limit=128M'` (every minute; the pull runs when a connection is due, ~15 min), the
`sodium` check, a warning when `APP_ENCRYPTION_KEY` is missing (`fail`, like `APP_SECRET`); `app:shops:pull` exists
as a stub that exits 0 (5b fills it). `CLAUDE.md`: the webhook rule rewritten ("per-connection URLs under
`/webhooks/shops/{token}`; the legacy URL answers 410 once the switch is off"), the order-email rule ("Settings
first, env fallback"), a rule for secrets (`SecretBox`, never a raw secret in an Output or a log). `README.md`:
architecture row for `Settings`, "Data model decisions" paragraph for the seven tables, API rows marked "item N".
*Verify:* `split.py plan docs/pdr/prd-shops-settings.md` prints the waves; `gate.sh`; `dod.py --quick`; the whole
smoke suite green on the base commit the items are cut from.

### Ownership (who may edit what; an item that needs another's file stops and reports a missed dependency)

| Files | Owner |
|---|---|
| `src/Shared/**`, `src/Settings/Domain/**`, `src/Settings/Infrastructure/{Persistence,Crypto}/**`, `src/Ordering/Domain/Model/Shop*`, `src/Ordering/Domain/Model/OrderCommentMeta.php`, `src/Ordering/Domain/Repository/*`, `src/Ordering/Infrastructure/Persistence/Doctrine{ShopConnection,ShopDelivery,ShopOutbox,ShopOrderLink,CommentMeta}Repository.php`, every `UI/Http/{Input,Output}` DTO of the new endpoints, `migrations/Version20261006000000.php`, `config/**`, `deptrac*.yaml`, `composer.json`, `deploy/**`, `.env*`, `tests/Functional/Shared/**`, `tests/Support/**`, `assets/react/{app,shared}/**`, `widgets/app-shell/**`, `pages/settings/ui/SettingsPage.tsx` (tabs shell + General), `entities/{settings,shop-connection,comment}/**`, `locales/{en,es}/{common,nav,errors,filters}.json`, `docs/design/**`, `docs/db/**`, `docs/tests/ui-regression.md` (sections 10–13 headings and every stub), `CLAUDE.md`, `README.md` (structure; items add rows) | 0 |
| `src/{Inventory,Customers,Invoicing,Identity}/Infrastructure/Persistence/*` (list queries), `src/*/Application/Query/{Stock,Customers,Invoices,Users,Orders}.php`, `src/Ordering/Infrastructure/Persistence/DoctrineOrderRepository.php`, the five list controller actions, their README rows, `tests/Functional/*/…ListApiTest.php` | 1 |
| `shared/ui/DataTable.tsx`, `shared/ui/filters/**`, `shared/lib/useListQuery.ts` (**after item 0**: item 2 owns their evolution), `widgets/stock-table/**`, `widgets/order-table/**`, `pages/customers/**`, `pages/invoices/**`, `pages/users/**`, `locales/{en,es}/{products,customers,invoices,users}.json` (filter keys), `orders.json` **filter and column keys only**, `e2e/{products,customers,invoices,users}.spec.ts` (updated locators), `e2e/filters.spec.ts` | 2 |
| `src/Settings/Application/**`, `src/Settings/Infrastructure/Mail/**`, `src/Settings/UI/**`, `src/Settings/UI/Cli/RekeySettingsCommand.php`, `src/Ordering/Infrastructure/Settings/**`, `tests/Functional/Settings/**`, README settings rows | 3 |
| `pages/settings/ui/{EmailSettings,AnalyticsSettings,QuickPhrases}*.tsx`, `features/test-email/**`, `features/quick-phrase/**` (admin editing part), `locales/{en,es}/settings.json`, `e2e/settings.spec.ts` | 4 |
| `src/Ordering/Application/{Command/Shop*,Command/ImportShopOrder*,Command/RetryShopDelivery*,Query/Shops*,Port/Shop*}`, `src/Ordering/Infrastructure/WooCommerce/**` (incl. `SafeShopHttp`, `RestShopGateway`), `src/Ordering/UI/Http/Controller/{ShopConnectionController,ShopWebhookController,WooCommerceWebhookController}.php`, `src/Ordering/UI/Http/Security/**`, `tests/Functional/Ordering/{Shop*,Webhook*}Test.php`, `e2e/webhook.spec.ts` | 5a |
| `src/Ordering/Application/{Command/PullShopOrders*,Command/PushShopUpdate*,Command/SyncRemoteOrders*,EventHandler/PushOrderStatusToShop.php,EventHandler/QueueShopNote.php}`, `src/Ordering/UI/Cli/PullShopsCommand.php`, `src/Ordering/UI/Http/Controller/ShopOutboxController.php`, `OrderController::sync`, `tests/Functional/Ordering/{Pull,Push,Outbox,SyncOrders}*Test.php`, `e2e/orders-sync.spec.ts` | 5b |
| `pages/settings/ui/ShopConnections*.tsx`, `pages/shop-connection-form/**`, `pages/shop-deliveries/**`, `features/{test-shop-connection,retry-delivery,check-shop-orders}/**`, `widgets/shop-health/**`, `features/sync-orders/**` (becomes Check now), `pages/orders/ui/OrdersPage.tsx`, `entities/order/ui/OrderBadges.tsx` (shop name), `locales/{en,es}/shops.json`, `orders.json` **sync/shop keys only**, `e2e/shops.spec.ts`, `e2e/orders.spec.ts` (sync/shop locators) | 6 |
| `src/Ordering/Application/Command/{AddOrderComment,PinOrderComment,UnpinOrderComment,SyncOrderComments}*`, `src/Ordering/Application/Query/OrderComments.php`, `src/Ordering/UI/Http/Controller/OrderCommentController.php`, `OrderPresenter::comments/pinned`, `tests/Functional/Ordering/OrderCommentsApiTest.php` | 7 |
| `widgets/comment-timeline/**`, `widgets/order-detail/**`, `features/{add-comment,pin-comment}/**`, `features/quick-phrase/ui/QuickPhrases.tsx` (the bar), `features/edit-order-comments/**` (deleted or reduced to the form's path), `locales/{en,es}/comments.json`, `orders.json` **detail/comments keys only**, `e2e/comments.spec.ts` | 8 |
| `README.md` final pass (API table, known gaps, deploy paragraph), `docs/pdr/prd-shops-settings.md` cutover section ticked, `deploy/cpanel-update.sh` header steps, `docs/security/audits/<date>-shops-settings.md` skeleton | 9 |
| CSS: each slice its own `ui/<slice>.css` with tokens only | the slice's item |

Three items touch `orders.json`: the key groups are disjoint by name (`filters.*`/`columns.*` → 2, `sync.*`/
`shop.*` → 6, `detail.*`/`comments.*`/`notes.*` → 8); the coordinator merges the file.

### Regression cases (section numbers; smoke = Playwright in the named spec, else by hand)

- **Item 0:** DS-15 every filter control on `/admin/_kit`, light and dark, 44 px on phone (smoke part: present and
  operable; by hand: look) · DS-16 the filter sheet at 390 traps focus, Escape closes, "Show N results" applies
  (smoke) · SET-01 Settings entry only for `ROLE_ADMIN`; `/admin/settings` for `inventory` is not found (smoke,
  `settings.spec.ts` skeleton).
- **Item 2 (FLT-01 – 12, `filters.spec.ts`):** FLT-01 orders: text filter on Order finds `W00007` across pages
  (smoke) · FLT-02 status multi-select with counts narrows and the chips strip shows "Status: Created, Processed"
  (smoke) · FLT-03 created date range with "Last 30 days" (smoke) · FLT-04 products: price "Over $500" + quantity
  range (smoke) · FLT-05 customers: the seeded 1,240 customers; filter email finds one on a late page; pager "1 –
  25 of 1,240" (smoke) · FLT-06 invoices: total range + payment method (smoke) · FLT-07 users: roles multi-select
  with counts (smoke) · FLT-08 the URL holds the filters; reload and a pasted link restore them; "Clear filters"
  empties the URL (smoke) · FLT-09 sorting by a header sends `sort` and the arrow follows (smoke) · FLT-10 at 390
  the filter row is absent, "Filters · 0" opens the sheet, a status tick updates "Show N results", apply closes
  (smoke) · FLT-11 the sheet's date quick picks and money ranges (manual) · FLT-12 Spanish labels of every filter and
  of the chips (manual).
- **Item 4 (SET-02 – 08, `settings.spec.ts`):** SET-02 General shows where email leaves from (env) and the legacy
  switch (smoke) · SET-03 Email: save host/port/user/password; the password field is blank afterwards and the
  answer says `has_password` (smoke) · SET-04 "Send test email" to the admin arrives in Mailpit through the custom
  server — the stack's Mailpit as the custom SMTP (smoke) · SET-05 a wrong host answers the SMTP error inline, nothing
  saved (smoke) · SET-06 Analytics IDs saved; after navigation the two script tags exist on `/admin/orders` and not on
  `/admin/login`; external requests blocked by route interception (smoke) · SET-07 Quick phrases: add, rename,
  reorder, deactivate; the comment box shows active ones in order (smoke) · SET-08 validation: a bad GA id is
  refused in place (smoke).
- **Item 5a (HOOK-03 – 06, `webhook.spec.ts`, curl in the doc):** HOOK-03 a delivery to `/webhooks/shops/{token}`
  with the right signature places the order in the connection's warehouse, links it, the source reads the shop's
  name, the printer email only when the connection says so (smoke) · HOOK-04 wrong signature → 401 + inbox row
  `bad_signature` + health `last_failure` (smoke) · HOOK-05 unknown SKU → 200, inbox row `unknown_product` with the
  body; after creating the product, Retry places it (smoke: API) · HOOK-06 legacy URL: on → placed as before; off →
  410 and the counter; the warning on Orders (smoke).
- **Item 5b (ORD-35 – 37, `orders-sync.spec.ts` with the fake gateway):** ORD-35 "Check now" pulls every active
  connection, only orders modified since the cursor, answers per connection; one failing shop does not stop the
  others (smoke) · ORD-36 marking a linked order Processed enqueues `order_status` → the fake shop receives
  `processing`; Sent (via getting ready) → `completed`; Created/Completed/Partial touch nothing (smoke) · ORD-37 a
  push that fails three times lands in the outbox as failed, shown in health, Retry re-queues (smoke: API).
- **Item 6 (SHOP-01 – 10, `shops.spec.ts`):** SHOP-01 create a connection (the dev stack's fake shop URL
  `http://fake-shop.test`, allowed in dev): webhook URL and secret shown with Copy (smoke) · SHOP-02 Test connection
  with bad keys says why, with good keys names the store (smoke, fake gateway) · SHOP-03 edit keeps keys when blank
  (smoke) · SHOP-04 deactivate: deliveries kept in the inbox as `inactive` (smoke: API + UI) · SHOP-05 health lines
  and counters after HOOK-04/05 (smoke) · SHOP-06 failed deliveries table filters, detail body, Retry, Discard
  (smoke) · SHOP-07 the Orders warning line links to the right connection (smoke) · SHOP-08 Check now toast per
  connection (smoke) · SHOP-09 source filter lists the shops and the Source column names them (smoke) · SHOP-10 the
  whole flow in Spanish at 390 (manual).
- **Item 8 (ORD-38 – 44, `comments.spec.ts`):** ORD-38 timeline shows author, date/time; a legacy dateless comment
  (seeded) shows the order's date marked approximate (smoke) · ORD-39 Enter sends, Shift+Enter newline, the box keeps
  focus (smoke) · ORD-40 pin: card on top, line in the list's Notes column, pinning another unpins (smoke) · ORD-41
  quick phrase one tap adds a dated comment (smoke) · ORD-42 "Also send to the shop" on a linked order enqueues an
  order note; the fake shop receives it; the entry shows "Sent to the shop" (smoke) · ORD-43 shop notes pulled from
  the fake shop appear interleaved and marked, once (smoke) · ORD-44 timeline at 390, dark, Spanish (manual).
- **Items 3 and 7 (API):** MAIL-03 the order email uses the settings' sender/printer/cc, env when empty
  (`OrderEmailTest`, no browser) · MAIL-04 a `mail` queue message after changing SMTP settings goes through the new
  server (functional test with a spy transport).

## Split

| # | Slug | Item | Owns (context / slice, files) | Tests first | Browser cases | Depends on | Model |
|---|---|---|---|---|---|---|---|
| 0 | contract | Seven tables + migration, Settings context skeleton, SecretBox, deptrac, list-query contract (parser, applier, page shape, in-memory skeleton on the five lists), DataTable server mode + filter kit, useListQuery, shops/comments ports, DTOs and 501 routes, OrderStatusChanged event + no-op, legacy webhook switch, Settings page shell + nav, analytics loader, i18n prefixes, regression stubs, deploy script, docs | as the Ownership table's row 0 | the Contract's tests (each 0.x lists its own) | DS-15 – 16, SET-01 | — | — |
| 1 | list-api | Server-side filters, sort, paging and facets in SQL for orders, stock, customers, invoices, users | `src/{Inventory,Customers,Invoicing,Identity}/Infrastructure/Persistence/*` list queries, `DoctrineOrderRepository`, the five `Application/Query`, the five list actions, README rows | `OrdersListApiTest` (status/source/shop/date/pinned filters, facets, sort allow-list, 422 on unknown field, LIKE escaping), `StockListApiTest` (per_page=0, totals, ranges), `CustomersListApiTest` (1,240 seeded rows, city/country), `InvoicesListApiTest` (money range, walk-in), `UsersListApiTest` (roles facet), `ListQueryApplierTest` extended | — | 0 | opus |
| 2 | tables-ui | Filter row, dropdowns with counts, date/money ranges, chips strip, phone sheet, pager and URL state on the five tables | `shared/ui/DataTable.tsx`, `shared/ui/filters/**`, `shared/lib/useListQuery.ts`, `widgets/stock-table`, `widgets/order-table`, `pages/{customers,invoices,users}`, `locales/{en,es}/{products,customers,invoices,users}.json` + `orders.json` filter/column keys, `e2e/filters.spec.ts`, the four list specs' locators | `DataTable.test.tsx` (filter row per type, chips, sheet roles, pager), `useListQuery.test.ts` (URL ↔ query, page reset), `FilterSheet.test.tsx` (focus trap, "Show N"), `OrderTable.test.tsx`/`StockTable.test.tsx` (server queries sent, KPIs from totals) | FLT-01 – 12 | 0, 1 | opus |
| 3 | settings-api | Email/analytics/webhook settings commands hardened, SMTP transport decoration with env fallback, test email (sync, 502 with reason, 429), quick phrases CRUD, rekey command, settings activity log | `src/Settings/Application/**`, `src/Settings/Infrastructure/Mail/SettingsMailTransport.php`, `src/Settings/UI/**`, `src/Ordering/Infrastructure/Settings/**`, `tests/Functional/Settings/**`, README settings rows | `EmailSettingsApiTest` (save, password hidden, blank keeps, env fallback sources, 403 non-admin), `TestEmailApiTest` (spy transport: sent through settings host; failure 502 detail; 429), `SettingsMailTransportTest` (chooses settings DSN, else env), `AnalyticsSettingsApiTest` (regex), `QuickPhrasesApiTest` (order, active, ROLE_USER read), `RekeyCommandTest`, `OrderEmailTest` (MAIL-03) | — | 0 | opus |
| 4 | settings-ui | Email, Analytics and Quick phrases tabs; Send test email panel; analytics loader wired to the saved IDs | `pages/settings/ui/{EmailSettings,AnalyticsSettings,QuickPhrases}*.tsx`, `features/test-email`, `features/quick-phrase` (admin part), `locales/{en,es}/settings.json`, `e2e/settings.spec.ts` | `EmailSettings.test.tsx` (sources shown, blank password kept, save toast), `TestEmailPanel.test.tsx` (result inline), `AnalyticsSettings.test.tsx` (validation), `QuickPhrases.test.tsx` (add/rename/reorder/deactivate), `analytics.test.ts` (loads once, page_view on navigation, never on login) | SET-02 – 08 | 0, 3 | sonnet |
| 5a | shops-api | Connections CRUD + Test connection (SafeShopHttp, SSRF guard), per-connection webhook (token + required HMAC), import through connections (warehouse, printer flag, link row), failed-deliveries inbox + Retry/Discard, health writes, legacy URL path + counter, shop notes at import | as the Ownership row 5a | `ShopConnectionApiTest` (create answers secret once, url normalised/taken, private host 422, blank keys kept, delete refused with links, 403 non-admin), `ShopWebhookApiTest` (placed + linked + shop name in OrderOutput, printer by flag, bad signature 401 + inbox, unknown token 404, inactive kept, duplicate not placed, >1 MB 413), `ShopDeliveriesApiTest` (unknown SKU kept, retry after product created places it, discard), `LegacyWebhookApiTest` (on: as before; off: 410 + counter), `SafeShopHttpTest` (blocked ranges, no redirects), `TestConnectionApiTest` (fake gateway ok/failed) | HOOK-03 – 06 | 0 | opus |
| 5b | shops-sync-api | Catch-up pull (`app:shops:pull --if-due`, modified_after cursor, notes of modified linked orders, 90-day inbox purge), "Check now" over every active connection, write-back outbox (status mapping, note capability), `shops` queue consumer with retries, outbox endpoints, `PushOrderStatusToShop` replacing the no-op | as the Ownership row 5b | `PullShopOrdersTest` (cursor advances only on success, only new, one failing shop isolated, notes imported once, fallback to 30 days without cursor), `PushShopUpdateTest` (Processed→processing, Sent/Delivered→completed, others nothing, inactive/capability-off nothing, 3 failures → failed + health, retry endpoint), `SyncOrdersApiTest` rewritten (per-connection result, 502 only when all fail), `PullShopsCommandTest` (`--if-due` honours 15 min) | ORD-35 – 37 | 0, 5a | opus |
| 6 | shops-ui | Shop connections cards + form + Test connection + webhook paste block, failed deliveries screen, Orders health warning, Check now, shop name in Source column/filter | as the Ownership row 6 | `ShopConnections.test.tsx` (cards, health, counters, menu), `ShopConnectionForm.test.tsx` (sections, blank keys, capabilities switches, test result card, copy buttons), `ShopDeliveries.test.tsx` (filters, body panel, retry toast), `ShopHealth.test.tsx` (banner rules), `CheckNowButton.test.tsx` (per-connection toast) | SHOP-01 – 10 | 0, 2, 5a | opus |
| 7 | comments-api | Timeline query (dates, approximate, author, origin, shop, pin), add comment (phrase, send to shop → outbox), pin/unpin (one per order), PUT path writes meta, `pinned_comment` on list/detail | as the Ownership row 7 | `OrderCommentsApiTest` (ordering, approximate = order date for NULL created_at, author name, shop note shape, add → 201 with date, phrase origin, send_to_shop 422 when not linked/capability off, pin replaces previous, ROLE rules), `OrderApiTest` (pinned_comment on list) | — | 0 | opus |
| 8 | comments-ui | Comment timeline in the order detail, write box (Enter/Shift+Enter, phrases, send-to-shop), pin, Notes column with the pinned line | as the Ownership row 8 | `CommentTimeline.test.tsx` (entries, approximate mark, shop marker, pin card), `AddComment.test.tsx` (Enter sends, Shift+Enter newline, failure keeps text, focus kept), `QuickPhrases.test.tsx` (one tap posts), `OrderTable.test.tsx` (Notes column pinned line) | ORD-38 – 44 | 0, 2, 5a, 7 | opus |
| 9 | docs-cutover | README final pass (API table, known gaps, deploy paragraph), CLAUDE.md check, cutover checklist ticked in this PRD, audit file skeleton, env.local.example final (WOO_COMMERCE_* removed with the migration note) | as the Ownership row 9 | — | — | 1, 2, 3, 4, 5a, 5b, 6, 7, 8 | haiku |

Waves (what `split.py plan` prints): 1 → {1, 3, 5a, 7}; 2 → {2, 4, 5b}; 3 → {6, 8}; 4 → {9}. Four stacks at once
fits wave 1 exactly; in wave 2 start 5b with 2 and 4; wave 3 starts when 2 and 5a/5b/7 are merged. Each item writes
its cases in its ID range (the simple ones as smoke tests in its own spec), updates only its own spec's locators,
never runs the whole suite (the coordinator runs it once at the barrier).

## Decisions

1. **Contexts.** A new `Settings` context (app settings, quick phrases, encryption, SMTP transport); shop
   connections, links, deliveries, outbox and comment metadata are **Ordering's**. The mailer stays in Shared and
   is reached by *decorating* `mailer.transports` from `Settings/Infrastructure/Mail` (Shared stays
   dependency-free); Ordering reads sender/printer/cc through its own port over `SettingsApi`.
2. **Encryption.** `sodium_crypto_secretbox` with `APP_ENCRYPTION_KEY` (32 bytes hex) from env; ciphertext
   `v1:` + base64(nonce‖box); a missing key fails fast in prod (deploy script), dev ships a fixed key in `.env`;
   `app:settings:rekey` for rotation. Rejected: `APP_SECRET` as the key (rotating it signs everyone out and it
   was once committed), openssl AES-GCM (works too; sodium is one call with no mode/IV choices).
3. **Settings precedence.** A setting row wins when it holds a value; empty → env (`MAILER_DSN`,
   `MAILER_FROM_*`, `MAILER_PRINTER_ADDRESS`, the `ordering.order_email.cc` parameter) → "not configured" (no email,
   a `mail` log row, as today). The Email tab says which source each value comes from.
4. **Shop URLs.** Stored normalised (`https://host[/path]`, no trailing slash); the webhook no longer matches
   `X-WC-Webhook-Source` (the header is only logged): the token in the path identifies the connection. `http://` is
   allowed only in `dev` (fixtures and the fake shop). Private/loopback hosts refused everywhere (SSRF).
5. **Signature required** on per-connection webhooks (no "empty secret = no check" as the legacy URL had): the
   secret is generated by the app and pasted into WooCommerce, so it always exists.
6. **Idempotency.** New: `shop_order_link` UNIQUE(connection, remote id); kept: `RemoteOrderKey` over
   `order.code` in the warehouse (covers orders imported before this feature and deleted ones). Both are checked
   before placing. A duplicate answers 200 and stores nothing (as today, logged).
7. **Inbox stores failures only**; a placed delivery's record is the order + its link. Reasons are codes
   (`unknown_product`…) with a human text; Retry re-runs the same import from the stored body, so fixing the cause
   (create the SKU, set the warehouse, activate the connection) is all an admin does.
8. **The legacy URL after cutover: 410 Gone** `{status: false, error: "webhook_moved"}`, behind the
   `webhooks.legacy_enabled` switch (on by default after the migration so nothing breaks at deploy; the checklist
   turns it off after the four shops are re-pointed and verified). Why 410 and not 200: a 200 would hide a shop that
   was never re-pointed; a non-2xx shows in WooCommerce's delivery log and, after its own retries, WooCommerce
   disables that webhook — which is the right end state for a dead URL. The hit counter and the Orders warning
   make the mistake visible on our side too. While the switch is on, the legacy path works exactly as today.
9. **Order source.** `order.source` stays `SOURCE_WEB` for shop orders; the shop is the link row; the UI shows the
   shop's name for linked orders, "Web"/"Phone" otherwise. Filter values `phone`, `web` (unlinked web), `shop:<id>`.
10. **Write-back** goes through a domain event `OrderStatusChanged` (published by the status command and by the
    partial-shipment handler when it sets Sent) → an event handler that writes an outbox row and dispatches
    `PushShopUpdate(outboxId)` on the `shops` queue. Mapping: 2 → `processing`, 5 and 6 → `completed`, else nothing;
    the same remote status is not pushed twice (`pushed_status`). Failures: 3 retries (1, 5, 25 min), then `failed`
    + health + Retry. The local change never waits for the shop. Capabilities are a JSON map on the connection with
    a PHP enum `ShopCapability {OrderStatus, OrderNote}` so a third one is one case + one pusher method.
11. **Catch-up pull.** One cron line (every minute) runs `app:shops:pull --if-due` (a connection is due 15 min
    after its `last_pull_at`; `flock` prevents overlap; the command exits at once when nothing is due) and then the
    queue consumer for `mail` and `shops` with `--time-limit=50`. Rejected: Symfony Scheduler (needs a long-running
    worker or a checkpoint store; more moving parts on cPanel). The pull reads `orders?status=processing&
    modified_after=<cursor>` (WooCommerce ≥ 5.8) and, for linked orders modified since the cursor in any status,
    their `notes` (customer notes become `shop` comments, keyed by note id) and `status` (→ `remote_status`); the
    cursor advances to the newest `date_modified_gmt` seen **only on success**; without a cursor the first pull
    uses today's 30-day window. "Check now" runs the same handler for every active connection regardless of
    `--if-due`.
12. **Lists.** One contract for the five lists (`ListQuery`); allow-lists per endpoint; facets only for enum
    columns and only when asked; `per_page` 25 by default, 100 max, `0` only on stock (bounded, the pickers need
    it). The orders list keeps `warehouse_id` as a required param (the warehouse is the screen's scope, not a
    filter). Item 0 ships the shape with in-memory filtering so item 2 can build while item 1 writes the SQL.
13. **Filters UI.** Column filters are the primary UI; the toolbar chips that exist (order status, user
    active/inactive, product in stock) are kept as shortcuts that write the same filter (no label changes, the
    specs stay green); the free-text `SearchBox` is `q`. Under 600 px the filter row is not rendered at all (not
    hidden by CSS) and the sheet is the UI. Everything is in the URL; nothing in `localStorage` (filters are
    per-visit, the warehouse stays remembered as today).
14. **Comments.** New comments are plain `comment` rows (dated by the constructor) + a meta row; legacy rows with
    `created_at` NULL show the order's `created_at` with `approximate: true` (the brief assumed no date column;
    the column exists, so nothing is back-filled). Shop notes are `comment` rows with `user_id` NULL, `origin`
    `shop`, the connection and the note id in meta. One pinned comment per order. The order form's `PUT` path stays
    for editing; the timeline adds with `POST`. `features/edit-order-comments` is reduced to what the form needs or
    deleted by item 8.
15. **Analytics** load from the browser after `/settings/public` (not injected into Twig): Shared stays untouched,
    the sign-in page never loads them, and no CSP work is needed now. `page_view` is sent on every route change by
    `useAnalytics()` in the shell; no user id is sent (Open question 4).
16. **Models.** 1 opus (five contexts of SQL with allow-lists, escaping and facets: a mistake is an injection or a
    wrong page). 2 opus (real client state: URL sync, sheet, debounced counts). 3 opus (transport decoration,
    encryption, a synchronous test send with error surfacing). 4 sonnet (forms on the kit with the API ready;
    escalate per §2b.4 if the analytics loader test fights it). 5a/5b opus (external API, signatures, queue +
    retries, SSRF). 6 opus (three screens plus the Orders page, test-connection flow and health rules). 7 opus
    (timeline merge rules, pin invariant, outbox port). 8 opus (keyboard rules, optimistic add, pinned card, list
    column). 9 haiku (docs).
17. **Playwright and shops.** The smoke stack never calls a real shop: `services_test.yaml` binds `ShopGateway` to
    `FakeShopGateway` (replaces `FakeRemoteOrderSource`), and the dev/smoke stack gets a tiny **fake shop** route
    only in `dev` (`/_fake-shop/wp-json/wc/v3/...`, `Ordering/UI/Http/Controller/FakeShopController` behind
    `kernel.debug`), so SHOP-01/02, HOOK-03 – 05 and ORD-35 – 37/42 – 43 run end to end in the browser with
    `http://localhost:<port>/_fake-shop` as the site URL (dev allows http). Seeded by `app:smoke:prepare`: one
    connection "Fake shop" → warehouse Colombia, prints orders, both capabilities on; one legacy dateless comment on
    W00003.
18. **Cases by hand vs smoke:** everything listed as smoke runs in the named spec; manual: DS-15 look, FLT-11/12,
    SHOP-10, ORD-44, and the real-shop cutover steps (production only).

19. **Coordinator note (item 0, 0.1):** the new entities name their table options (`utf8mb4_unicode_ci`) and map
    their foreign keys as associations to the existing entities (unidirectional: nothing is added to `Order`,
    `Comment`, `User` or `Warehouse`), so the migration is exactly what Doctrine proposes for them; `pinned_at`,
    `created_at`… are `datetime_immutable` (a `DATETIME` like the others). `shop_delivery.payload` is nullable (a
    refused signature keeps no body). The Settings keys also include `webhooks.legacy_hits` and
    `webhooks.legacy_last_hit_at` (the counter of Decisions 8). The compose `worker` consumes `mail shops`.
20. **Coordinator note (item 0, 0.3):** the in-memory skeleton (`Shared\UI\Http\InMemoryList`) already answers
    `facets` and the stock `totals` (same semantics as `ListQueryApplier`), so item 2 builds against real counts while
    item 1 moves each list into SQL; `ListQueryApplier` is tested on MySQL (`ListQueryApplierTest`) and ready for
    item 1 (`ListMapping`: DQL per field, closures for `source`/`pinned`, enum value maps). A default sort may be
    outside the sort allow-list (customers: `-id`). The tables keep their labels (Decisions 13): the customers page
    keeps 100 a page (the UI's default, so `per_page=100` is sent) and "Search this page"; the Products KPIs and chip
    counts come from a second request (`per_page=1&facets=in_stock` + `totals`); the order status chips from the
    `status` facet; the users chips from an `enabled` facet. Two behaviours the server cannot keep are mapped: typing
    the "Walk-in customer" label (4 letters or more) in the invoices search asks for `filter[walk_in][]=yes`
    (`pages/invoices/lib/invoiceSearch.ts`; INVC-07 searches "walk-in"); the users search no longer matches role names
    (the roles filter of item 2 replaces it). The filtered-to-nothing state keeps "Show all" (the specs use it). The
    specs that read a list endpoint now read `items` (with `per_page=0`/`filter[code]`): the API shape changed, no
    locator did. `RowMenu` and the filter popovers follow their button when the page scrolls or the list under them
    changes size, instead of closing (a debounced search narrowing the list closed ORD-03's status menu), and a popover
    opens above its button when there is more room there.
21. **Coordinator note (item 0, 0.4):** `GET /settings/public`, `GET /settings/email` and `GET`/`PUT /settings/webhooks`
    answer for real from item 0 (the General tab and the analytics loader need them; their queries/commands are 0.2's;
    `tests/Functional/Settings/SettingsShellApiTest.php`); every other settings, shops, outbox and comments route and
    `/webhooks/shops/{token}` answer 501 whatever the body (the stubs map no input; the Input DTOs exist). Output shapes:
    `ShopConnectionOutput.webhook_secret` is null except in the answer that created the connection;
    `ShopDeliveryDetailOutput` is the row plus `payload` (flat); `ShopTestResultOutput.rest.can_write` is null until a
    write proved it; `POST /orders/sync` declares `SyncResultOutput | ShopsSyncResultOutput` until 5b answers only the
    second (the spec still expects `{imported, skipped}`). `OrderStatusChanged` is published for every status the two
    handlers set (Partial included; the mapping ignores it); its no-op handler is already named
    `Application/EventHandler/PushOrderStatusToShop.php` (5b fills it). `ContractTest`'s item column takes "ss-N".
    `FakeShopGateway` (tests) knows shops by site URL, keys, orders, notes, failures (401 = read-only keys) and records
    the writes; `RemoteOrderSource`/`FakeRemoteOrderSource` stay until 5b rewrites the sync. The dev fixtures
    (`src/DataFixtures/ShopFixtures.php`) seed "Fake shop" (`http://nginx/_fake-shop` — PHP reaches the dev stack as
    `nginx`; the fake shop route itself is 5a's — Colombia, prints orders, both capabilities) with fixed token, keys and
    webhook secret as class constants, and make W00003's existing comment dateless (no comment is added, so the counts
    the specs read are unchanged). `app:shops:pull` exists as a no-op (5b).
22. **Coordinator note (item 0, 0.5):** `locales/{en,es}/settings.json` holds the shell's and General's keys
    (`settings.title`, `tabsLabel`, `tabs.*`, `pending`, `general.*`); item 4 adds `settings.email.*`,
    `settings.analytics.*`, `settings.phrases.*` and the coordinator merges the file. Each later tab is a stub file
    next to the shell (`pages/settings/ui/{EmailSettings,AnalyticsSettings,QuickPhrases,ShopConnections}.tsx`): items 4
    and 6 replace the file, not `SettingsPage.tsx`. The routes `/admin/settings/shops/new`, `/admin/settings/shops/:id`
    and `/admin/settings/shops/:id/deliveries` exist (stub slices `pages/shop-connection-form`, `pages/shop-deliveries`
    for item 6), so no item edits `app/routes.tsx`. A non-admin gets the not-found page through `app/providers/
    RequireRole`. The analytics loader reads `/settings/public` on each change of path, so saved IDs load on the next
    navigation.

23. **Coordinator note (item 2):** Customers page 25 rows by default (25/50/100), not the 100 of note 20, so the pager
    shows on realistic data (FLT-05 reads "1 – 25 of 1,240"). The list dropdowns apply each tick at once (no
    Done/Clear footer: Escape or a click outside closes them, "Clear filters" clears). Orders, invoices: the toolbar
    date fields are gone, the Created/Date column's range replaces them. Customers gain a Country column, invoices a
    Payment column, each with a list filter. A server table filtered to nothing keeps its header and filter row.

## Risks

- **Cutover gap.** Between the deploy and re-pointing the shops, the legacy URL must keep working: the switch
  defaults to on and the checklist turns it off last. A shop re-pointed before its connection exists gets 404s →
  create the connection first (the checklist's order).
- **`modified_after` support** depends on the shops' WooCommerce version (≥ 5.8); the pull falls back to the
  30-day `after` window when the shop rejects the param (Open question 1).
- **Write permission.** Today's keys are read-only (README): pushes will fail with 401 until Read/Write keys are
  pasted; the health shows "keys are read-only" (first 401) so it is not silent.
- **Sodium on cPanel.** ea-php84 ships `sodium` as a package; the deploy script fails early if it is missing;
  fallback plan: swap `SodiumSecretBox` for an openssl AES-256-GCM adapter behind the same port (one class).
- **List SQL performance.** `order` joins customer and comments; facets add one `GROUP BY` per asked column;
  `customer` has 1,240 rows in production — fine; the stock KPIs move to `SUM()` on the server. Indexes exist on
  the FKs; `code`/`email` LIKE searches scan (acceptable at this size; noted in the audit as a later index).
- **Spec churn.** The five list tables change internally but keep their labels (Decision 13); item 2 owns the four
  list specs' locators and the coordinator runs the suite at the barrier.
- **`orders.json` and `OrderTable` touched by items 2, 6 and 8**: key groups are disjoint; items 6 and 8 depend
  on 2 so they edit a merged `OrderTable` (6: Source cell + health; 8: Notes column) — the coordinator merges 6 and
  8 in that order and resolves `OrderTable.tsx` by hand if both touched the columns array.
- **Timeline volume.** A shop with many customer notes: the pull stores only *customer* notes (not system notes).
- **Analytics in dev** fire real hits when IDs are set on a dev stack; the smoke stack keeps them empty and SET-06
  blocks the external requests by interception.

## Cutover checklist (production; item 9 writes it into `deploy/cpanel-update.sh`'s header and README)

1. Before deploying: generate `APP_ENCRYPTION_KEY` and add it to `backend/.env.local`; create Read/Write REST keys
   in each of the four shops (WooCommerce › Settings › Advanced › REST API); note each shop's current webhook secret.
2. Deploy (`cpanel-update.sh`: backup, the one migration, the new cron line replaces the old one — remove the old
   line in cPanel › Cron Jobs). The legacy webhook keeps working (switch on).
3. Settings › Email: enter the SMTP server (or leave empty to keep `MAILER_DSN`), sender, printer, cc; "Send test
   email" to yourself.
4. Settings › Shop connections: **create the four connections** (name, URL, keys, warehouse = the one whose `urls`
   held that shop, "prints orders" = the one that was `ORDER_WEBHOOK_EMAIL_WAREHOUSE_ID`, capability "Order status"
   on when the shop should be updated); "Test connection" each.
5. In each shop: WooCommerce › Settings › Advanced › Webhooks › the "Order created" webhook → Delivery URL = the
   connection's URL, Secret = the connection's secret, API v3, Save (WooCommerce pings the URL: the connection's
   `last_webhook_at` moves).
6. Verify: place a test order in each shop (or use "Check now"): it appears in Orders with the shop's name; the
   printer email arrives for the printing connection; health shows "last order imported".
7. Settings › General: **turn off the old webhook URL**. Watch the hit counter for a day: any hit means a shop was
   not re-pointed (step 5 again).
8. Remove `WOO_COMMERCE_URL/_API_KEY/_API_SECRET/_WEBHOOK_SECRET` and `ORDER_WEBHOOK_EMAIL_WAREHOUSE_ID` from
   `backend/.env.local` (optional; they are no longer read once a connection exists / the switch is off).
9. Settings › Analytics: paste the GA4 and Clarity IDs. Settings › Quick phrases: add the office's phrases.

## Open questions for the user

None left. The four questions the plan raised were answered on 2026-10-06:

1. **WooCommerce version:** all four shops run 5.8 or newer, so the pull uses the `modified_after` cursor. The
   30-day window stays only for a connection's first pull (no cursor yet).
2. **Shop notes in the timeline:** customer notes only (the checkout note and notes sent to the customer); system
   notes (payments, status changes) are not imported.
3. **Failed-delivery retention:** 90 days, then purged by the pull command.
4. **Analytics identity:** anonymous; no user id, hashed or not, is sent to GA4 or Clarity.

## Acceptance

`dod.py` green; `SchemaInvarianceTest` green with 23 entities and the unchanged drift baseline; `gate.sh` (deptrac
with the `Settings` layers, PHPStan 6, ESLint, tsc, schema-drift, compose-cpus); the whole PHPUnit and Vitest suites;
the security audit file with the SSRF, signature and encryption checks *tried* (curl against the webhook with a bad
signature, a private-host URL refused, a settings row that reads `v1:` in the database); the whole smoke suite
(the existing specs plus `filters`, `settings`, `shops`, `comments`, updated `webhook` and `orders-sync`) green;
the manual cases (DS-15, FLT-11 – 12, SHOP-10, ORD-44) at 1440 and 390, EN and ES, light and dark; before/after
screenshots of the five tables, Settings tabs, a connection, the inbox and the timeline in `docs/design/after/`;
README API table complete; the cutover checklist in the deploy script header.
