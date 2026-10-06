# KF Inventory

Inventory, orders and invoices for Klassic Fab's warehouses: stock per warehouse, moves between them, a barcode
reader, incoming approvals, orders typed by hand or received from the WooCommerce shops (with partial shipments,
PDFs and the printer's email), invoices, customers and users.

A Symfony 8 API (`backend/src`, DDD bounded contexts) and a React app (`backend/assets/react`, Feature-Sliced
Design), run in Docker locally and on a cPanel account in production. **The production database must not change**:
read "Data model decisions" before touching an entity or a migration.

## Running it locally

Everything runs in Docker; there is no PHP or Node on the host.

```bash
cp .env.example .env                        # only for a second stack (a worktree): its own host ports
docker compose up -d --build
docker compose exec php composer install
docker compose exec php php bin/console doctrine:migrations:migrate -n
docker compose exec php php bin/console app:smoke:prepare --seed     # the fixtures: accounts, warehouses, products…
```

- The app: `http://localhost:8080/admin/login` (or `HTTP_PORT`), as `sbarbosa115` / `123456` (more accounts in
  `docs/tests/ui-regression.md`).
- Emails: Mailpit at `http://localhost:8025` (or `MAILPIT_PORT`); the `worker` service drains the email queue.
- The `node` service rebuilds the UI on every save: `docker compose logs node` says whether it compiled.
- Your own settings (WooCommerce keys…) go in `backend/.env.local`, never in the committed `backend/.env`.

### Tests and checks

```bash
docker compose exec php composer test:prepare          # the test database, from the migrations (once, and after one)
docker compose exec php composer test                  # PHPUnit: unit + functional (MySQL, each test rolled back)
docker compose exec node npm test                      # Vitest
backend/e2e/smoke.sh                                   # the smoke suite (Playwright); resets the dev database
python3 ~/.claude/skills/symfony-react-app/scripts/gate.sh --fix   # style, PHPStan, Deptrac, ESLint, tsc, schema
```

The gate includes `.claude/gate.d/schema-drift`: the mappings may propose only the recorded drift
(`docs/db/README.md`).

## Architecture

| Context (`backend/src/…`) | Owns (tables) | |
|---|---|---|
| `Identity` | `user` | sign-in (JSON login, session cookie), users |
| `Inventory` | `product`, `product_warehouse`, `warehouse` | products, stock per warehouse, moves, the stock spreadsheet |
| `Customers` | `customer`, `customer_address`, `country`, `state`, `city` | customers, addresses, the locations tree |
| `Ordering` | `order`, `order_product`, `order_status`, `comment`; `shop_connection`, `shop_order_link`, `shop_delivery`, `shop_outbox`, `order_comment_meta` | orders, partial shipments, PDFs/XLS, the printer email, the WooCommerce shop connections (webhooks, pull, write-back, failed-deliveries inbox), comment pins and shop notes |
| `Settings` | `app_setting`, `quick_phrase` | Settings › Email/Analytics/General (env as the fallback), quick phrases, the secrets' encryption (`SecretBox`) |
| `Invoicing` | `invoice`, `invoice_item` | invoices and their PDF |
| `Audit` | `log` | the activity log (Shared's `ActivityLog` port) |
| `Shared` | `messenger_messages` | buses, domain errors, API plumbing (the list-query contract: `ListQuery`, `ListQueryParser`, `ListQueryApplier`, the page shape), mail queue, PDF rendering |

Each context has `Domain` (models, repository ports, errors, events), `Application` (commands + handlers, queries,
ports), `Infrastructure` (Doctrine adapters, mail, spreadsheets) and `UI/Http` (controllers, Input and Output DTOs).
Deptrac enforces the layers (`deptrac.yaml`) and which context may use which (`deptrac.contexts.yaml`); the only
cross-context references outside the `Application` layers are the Doctrine associations the production schema has
(`DomainModels`) and the Customers/Inventory HTTP DTOs an order or invoice reuses.

The React app (`backend/assets/react`): `app` (router, providers), `pages` (one per route), `widgets`, `features`,
`entities`, `shared` (API client, generated types `assets/types/api.d.ts`, i18n, UI kit). ESLint enforces the FSD
import rules (`eslint-fsd-boundaries.mjs`). The API's types come from its OpenAPI schema:

```bash
docker compose exec php php bin/console nelmio:apidoc:dump --format=json > backend/assets/types/openapi.json
docker compose exec node npm run -s api:types
```

### Design system

The screens are built from one kit, `@/shared/ui`, on design tokens (`shared/ui/styles/tokens.css`, light and dark)
with Bootstrap 4 underneath: `docs/design/README.md` lists the tokens, which component to use when, the copy rules and
the English/Spanish glossary; the dev-only page `/admin/_kit` shows every component. The UI is in English and Spanish
(the top bar's EN/ES, remembered per browser; first visit follows the browser), light, dark or the system's theme, and
works on a 390 px phone (drawer, bottom tab bar, lists as cards). Money is in US dollars, dates in Bogotá time. The
camera reads barcodes where the page is served over HTTPS (or `localhost`).

## API reference

JSON under `/api/v1`, `snake_case`, errors as `{"error": "<code>", "message", "detail"?, "violations"?}`. Every
endpoint asks for the role its legacy page asked for (most accounts also hold `ROLE_USER`, which the API requires
first; Settings and shops: `ROLE_ADMIN`). Writes from another origin are refused (403).

**Lists** (`GET /orders`, `/warehouses/{id}/stock`, `/customers`, `/invoices`, `/users`) follow one contract
(`docs/pdr/prd-shops-settings.md`, "List query contract"): `page`, `per_page` (25 by default, 100 at most; `0` = every
row, stock only), `sort` (`field`/`-field` from the endpoint's allow-list), `q`, `filter[<field>]` by column type
(text, `[]` any of, `[from|to]` Bogotá days, `[min|max]`), `facets=<enum fields>` → `{items, total, page, per_page,
facets?}` (stock adds `totals: {units, value}`); an unknown field, sort or value is a 422 on `filter.<field>`. They
filter, sort, page and count in SQL (`Shared\Infrastructure\Persistence\ListQueryApplier`, every value a bound
parameter, `%`/`_` matching themselves; facets one `GROUP BY` or `SUM(CASE …)` per asked column, over every filter but
its own); the rows below marked "ss-N" are shops-settings' items (501 `not_implemented` until built).

| Method | Path | Role | Built by item |
|---|---|---|---|
| `POST` | `/api/v1/auth/login` | public | 0: `{username, password, remember_me?}` → the session; 401 `invalid_credentials` |
| `POST` | `/api/v1/auth/logout` | `ROLE_USER` | 0: 204 |
| `GET` | `/api/v1/auth/me` | `ROLE_USER` | 0: who is signed in, with every reachable role; 401 signed out |
| `GET` | `/api/v1/users` | `ROLE_MANAGE_USERS` | 1, ss-1: a page of `UserOutput {id, name, username, email, roles, enabled}` (never the password), by `name`; `q` over name, username, email; filters `name`, `username`, `email`, `roles[]` (the nine assignable; any of), `enabled[]` `yes`/`no`; sorts `name`, `username`, `email`; facets `roles`, `enabled` |
| `GET` | `/api/v1/users/{id}` | `ROLE_MANAGE_USERS` | 1: one user; 404 `user_not_found` |
| `POST` | `/api/v1/users` | `ROLE_MANAGE_USERS` | 1: `{name, username, email, password, roles, enabled}` → 201; the password is required, `roles` only the nine the screen assigns, else 422 |
| `PUT` | `/api/v1/users/{id}` | `ROLE_MANAGE_USERS` | 1: same body; a blank or missing `password` keeps the current hash; 404 `user_not_found` |
| `GET` | `/api/v1/warehouses` | `ROLE_USER` | 2: every warehouse by id, `WarehouseOutput {id, name, urls}` |
| `PUT` | `/api/v1/warehouses/{id}` | `ROLE_USER` | 2: `{name}` → `WarehouseOutput`; 404 `warehouse_not_found` |
| `GET` | `/api/v1/warehouses/{id}/stock` | `ROLE_MANAGE_INVENTORY` | 2, ss-1: `?status=1` (default; `0` incoming) → a page of `StockOutput` by `code`, plus `totals {units, value}` over every row the filters keep; `per_page=0` every row (the pickers); `q` over code, title, detail; filters `code`, `title`, `detail`, `quantity` and `price` `[min\|max]`, `in_stock[]` `yes`/`no`; sorts `code`, `title`, `quantity`, `price`; facet `in_stock`; 404 `warehouse_not_found` |
| `POST` | `/api/v1/warehouses/{from}/moves/{to}` | `ROLE_MANAGE_INVENTORY` | 2: `{items: [{uuid\|code, quantity}]}` → 204, arrives incoming; 409 `same_warehouse`, 404 `product_not_found`/`stock_not_found`, 422 `insufficient_stock` (`detail: {code, available}`) |
| `POST` | `/api/v1/warehouses/{id}/stock/add` | `ROLE_MANAGE_INVENTORY` | 2: `{items: [{code, quantity}]}` → 204 (unknown codes skipped) |
| `POST` | `/api/v1/warehouses/{id}/stock/remove` | `ROLE_MANAGE_INVENTORY` | 2: `{items: [{code, quantity}]}` → 204; 404 `stock_not_found`, 422 `insufficient_stock` |
| `POST` | `/api/v1/warehouses/{id}/incoming/approve` | `ROLE_MANAGE_INVENTORY` | 2: → `{approved}` (rows flipped to in stock) |
| `GET` | `/api/v1/products/by-code/{code}` | `ROLE_MANAGE_INVENTORY` | 2: `ProductOutput` with `stock: [{warehouse_id, quantity, status}]`; 404 `product_not_found` |
| `GET` | `/api/v1/products/{uuid}` | `ROLE_MANAGE_INVENTORY` | 2: `ProductOutput`; 404 `product_not_found` |
| `POST` | `/api/v1/products` | `ROLE_MANAGE_INVENTORY` | 2: `{code, title, detail?, status?, price?}` → 201 `ProductOutput`; 422 (code `·`/`CODE`, title `PRODUCT`) |
| `PUT` | `/api/v1/products/{uuid}` | `ROLE_MANAGE_INVENTORY` | 2: as `POST` → `ProductOutput`; 404 `product_not_found` |
| `POST` | `/api/v1/products/upload` | `ROLE_MANAGE_INVENTORY` | 2: multipart `file` (xls/xlsx) + `warehouse_id` → `{stored}`; 415 `unsupported_media`, 422 `invalid_spreadsheet`, 404 `warehouse_not_found` |
| `GET` | `/api/v1/products/template.xls` | `ROLE_MANAGE_INVENTORY` | 2: `?all=1` or `?uuid[]=…` → `Products.xls` (header alone with neither) |
| `GET` | `/api/v1/customers` | `ROLE_MANAGE_CUSTOMERS` | 3, ss-1: a page of `CustomerOutput` (with every address), newest first (`-id`); `q` over name, email, phone, city; filters `name`, `email`, `phone`, `city` (the first address's, as the list shows it), `country[]` (country ids, any address); sorts `name`, `email`, `city`; facet `country` |
| `GET` | `/api/v1/customers/all` | `ROLE_MANAGE_CUSTOMERS`, `ROLE_CAN_CREATE_ORDERS`, `ROLE_CAN_UPDATE_ORDERS` or `ROLE_CAN_CREATE_INVOICES` | 3: every customer (`CustomerOutput[]`, those without an address too) for the order and invoice pickers; any role whose legacy form embedded the list |
| `GET` | `/api/v1/customers/{id}` | `ROLE_MANAGE_CUSTOMERS` | 3 |
| `POST` | `/api/v1/customers` | `ROLE_MANAGE_CUSTOMERS` | 3 |
| `PUT` | `/api/v1/customers/{id}` | `ROLE_MANAGE_CUSTOMERS` | 3 |
| `DELETE` | `/api/v1/customers/{id}` | `ROLE_MANAGE_CUSTOMERS` | 3 |
| `GET` | `/api/v1/locations` | `ROLE_USER` | 3 |
| `GET` | `/api/v1/orders` | `ROLE_CAN_READ_ORDERS` | 4, ss-1: `?warehouse_id=` (required, 422 without) → a page of that warehouse's `OrderOutput`, newest first (`-created_at`, ties `-id`), orders without a customer included; `q` over code, customer name, email; filters `code`, `customer` (name or email), `status[]` 1–6, `source[]` `phone`/`web` (a web order no connection brought)/`shop:<id>`, `created_at` `[from\|to]`, `pinned[]` `1`; sorts `code`, `customer`, `status`, `created_at`; facets `status`, `source`, `pinned` |
| `GET` | `/api/v1/orders/{id}` | `ROLE_CAN_READ_ORDERS` | 4: `OrderDetailOutput`; 404 `order_not_found` (also once deleted) |
| `POST` | `/api/v1/orders` | `ROLE_CAN_CREATE_ORDERS` | 4: `OrderInput` → 201 `OrderDetailOutput`; customer by id, else email, else phone (updated), or created; queues the printer email; 422 `order_without_products`, 404 `product_not_found`/`warehouse_not_found` |
| `PUT` | `/api/v1/orders/{id}` | `ROLE_CAN_UPDATE_ORDERS` | 4: `OrderInput` (its products replace the order's; comments untouched) → `OrderDetailOutput` |
| `POST` | `/api/v1/orders/{id}/status` | `ROLE_UPDATE_ORDERS` | 4: `{status: 1-6}` → `OrderDetailOutput` (a status history row; stock untouched) |
| `PUT` | `/api/v1/orders/{id}/comments` | `ROLE_USER` | 4: `{comments: [{id\|null, content}]}` → `{comments}` (the timeline's order); a comment left out is detached from the order and loses its pin; a new one gets its `order_comment_meta` row (`app`, ss-7) |
| `DELETE` | `/api/v1/orders/{id}` | `ROLE_CAN_DELETE_ORDERS` | 4: 204; lines deleted, comments and order soft-deleted |
| `POST` | `/api/v1/orders/sync` | `ROLE_CAN_SYNC_ORDERS` | ss-5b: "Check now": the catch-up pull of every active shop connection, due or not, each in its own transaction → 202 `ShopsSyncResultOutput {imported, skipped, failed, connections: [{id, name, imported, skipped, error}]}` (by name). A pull reads the shop's orders modified since the connection's cursor (`modified_after`; no cursor yet: the last 30 days) in any status: the new `processing` ones are placed as the webhook places them (the connection's warehouse and printer switch, linked; an order the app holds is skipped, one that cannot be placed is skipped into the failed-deliveries inbox, kind `pull`); linked orders get their shop status and their **customer** notes (once each, as `shop` comments). The cursor moves to the newest `date_modified_gmt` only when the shop answered; a shop that cannot be read fails that connection only (`error`, health `pull_failed`); 502 `order_sync_failed` only when every connection failed. The cron line runs the same pull with `bin/console app:shops:pull --if-due` (a connection 15 min after its last pull; the inbox rows older than 90 days are deleted) |
| `GET` | `/api/v1/orders/{id}/partials` | `ROLE_USER` | 4: `OrderPartialsOutput` (the order's code, status and lines, shipped so far, pending, the warehouse's stock of the order's products: everything the getting-ready screen shows) |
| `POST` | `/api/v1/orders/{id}/partials` | `ROLE_USER` | 4: `{items: [{uuid, quantity}]}` → `OrderPartialsOutput`; the whole order in stock → status 5, else a partial (status 4); stock taken out; 409 `partial_exceeds_order`, 422 `insufficient_stock`, 404 `stock_not_found` (Inventory's `Stock::subtract`) |
| `GET` | `/api/v1/orders/{id}/pdf` | `ROLE_CAN_READ_ORDERS` | 4: `application/pdf` (`templates/pdf/order.html.twig`) |
| `GET` | `/api/v1/orders/{id}/remaining-pdf` | `ROLE_CAN_READ_ORDERS` | 4: `application/pdf`, what is left to ship |
| `GET` | `/api/v1/orders/{id}/xls` | `ROLE_USER` | 4: `application/vnd.ms-excel`, `file-upload-template-<code>.xls` (the legacy name) |
| `GET` | `/api/v1/invoices` | `ROLE_CAN_READ_INVOICES` | 5, ss-1: a page of `InvoiceOutput`, newest first (`-created_at`), with customer, lines and their products; `q` over code, customer name, email; filters `code`, `customer` (name or email), `payment_method[]`, `created_at` `[from\|to]`, `total` `[min\|max]`, `walk_in[]` `yes` (no customer)/`no`; sorts `code`, `customer`, `created_at`, `total`; facets `payment_method`, `walk_in` |
| `GET` | `/api/v1/invoices/next-code` | `ROLE_CAN_CREATE_INVOICES` | 5: `{code}`: the newest invoice's code plus one (`INV-0001` → `INV-0002`, `X` → `X-1`), or the year and `0001` for the first |
| `GET` | `/api/v1/invoices/{id}` | `ROLE_CAN_READ_INVOICES` | 5: `InvoiceOutput`; 404 `invoice_not_found` |
| `POST` | `/api/v1/invoices` | `ROLE_CAN_CREATE_INVOICES` | 5: `InvoiceInput` → 201 `InvoiceOutput`; customer by `customer_id` or found/created from `customer` (as orders do); with no address typed, the customer's first is copied; line totals and `tax_rate` % tax worked out as before; 409 `invoice_code_taken` |
| `GET` | `/api/v1/invoices/{id}/pdf` | `ROLE_CAN_READ_INVOICES` | 5: `application/pdf` (`templates/pdf/invoice.html.twig`, the logo from `public/images/`) |
| `GET` | `/api/v1/settings/public` | `ROLE_USER` | ss-0: `PublicSettingsOutput {ga4_measurement_id, clarity_project_id}` (null when unset) |
| `GET` | `/api/v1/settings/email` | `ROLE_ADMIN` | ss-0: `EmailSettingsOutput` (never the password: `has_password`; `source` per value: settings, env, none) |
| `PUT` | `/api/v1/settings/email` | `ROLE_ADMIN` | ss-3: `{host, port, user, password?, encryption, from_address, from_name, printer_address, cc[]}` → `EmailSettingsOutput`. The server is stored as one DSN sealed with `APP_ENCRYPTION_KEY`; a blank password keeps the saved one **for the same host only**; every field empty clears it (env fallback); 422 on a bad address or a host that is more than a host name. Every email then leaves through it (`SettingsMailTransport` decorates `mailer.transports`), read at send time |
| `POST` | `/api/v1/settings/email/test` | `ROLE_ADMIN` | ss-3: `{to}` → 202 `{queued: true, host}`, sent at once through the effective server (not the queue); 502 `smtp_failed` with the server's message in `detail.reason`; 429 `test_email_too_soon` (one per 10 s per user) |
| `GET`/`PUT` | `/api/v1/settings/analytics` | `ROLE_ADMIN` | ss-3: `{ga4_measurement_id, clarity_project_id}`; `^G-[A-Z0-9]{4,12}$` / `^[a-z0-9]{6,20}$` (422 otherwise), empty turns that tool off |
| `GET` | `/api/v1/settings/webhooks` | `ROLE_ADMIN` | ss-0: `{legacy_hits, legacy_last_hit_at}`: what reached the old webhook URL (the 410 tombstone) since the deploy; read-only |
| `GET` | `/api/v1/settings/quick-phrases` | `ROLE_USER` | ss-3: `QuickPhraseOutput[] {id, text, position, active}`, the active ones by position; `?all=1` every one (admins only; anyone else still gets the active ones) |
| `POST`/`PUT`/`DELETE` | `/api/v1/settings/quick-phrases[/{id}]`, `PUT …/order` | `ROLE_ADMIN` | ss-3: `{text, active}` → 201 (at the end) / 200 / 204; `PUT …/order {ids[]}`: those first, the others after → every phrase; 404 `quick_phrase_not_found`. Settings changes are logged (`log`, entity `settings`) by key, never by value. Key rotation: `bin/console app:settings:rekey --old-key=<previous APP_ENCRYPTION_KEY>` re-seals every stored secret (settings and shop connections), all or nothing |
| `GET` | `/api/v1/shops[/{id}]` | `ROLE_ADMIN` | ss-5a: `ShopConnectionOutput[]` by name / one (404 `shop_not_found`): site URL, warehouse, printer switch, capabilities, `webhook_url`, `has_keys` (never the keys), `health` with the failed deliveries and pushes; `webhook_secret` null |
| `POST` | `/api/v1/shops` | `ROLE_ADMIN` | ss-5a: `ShopConnectionInput` → 201 with `webhook_secret` (generated, shown once) and `webhook_url` (`/webhooks/shops/<token>`); URL stored normalised; 409 `shop_url_taken`/`shop_name_taken`, 404 `warehouse_not_found`, 422 `shop_url_invalid` (not https outside dev, a host that is or resolves to a private/loopback/reserved address; `detail.reason`) |
| `PUT` | `/api/v1/shops/{id}` | `ROLE_ADMIN` | ss-5a: same body; a blank `consumer_key`/`consumer_secret` keeps the saved one while the site (scheme, host, port) stays the same; moved to another site, both are required (422 on `consumer_key`) |
| `DELETE` | `/api/v1/shops/{id}` | `ROLE_ADMIN` | ss-5a: 204 with its inbox; 409 `shop_has_orders` when orders came from it (deactivate it) |
| `GET`/`POST` | `/api/v1/shops/{id}/webhook-secret` | `ROLE_ADMIN` | ss-5a: `{webhook_secret, webhook_url}` to paste in WooCommerce; POST rotates the secret first |
| `POST` | `/api/v1/shops/{id}/test` | `ROLE_ADMIN` | ss-5a: `ShopTestInput` (URL/keys as typed; blank → saved, on the saved site only: for another site both keys must be typed) → always 200 `ShopTestResultOutput {rest: {ok, store_name, wc_version, can_write (null: unknown), error}, webhook_url, webhook_secret_set}`; through `SafeShopHttp` (https, no internal address, no redirect, 15 s) |
| `GET` | `/api/v1/shops/{id}/deliveries[/{dId}]` | `ROLE_ADMIN` | ss-5a: the failed-deliveries inbox, a page newest first (`?status=failed` or `filter[status][]`, `filter[kind][]`, `filter[reason_code][]`, `filter[received_at]`, `q` over the shop order number and customer) of `ShopDeliveryOutput` (summary: customer, lines); the detail adds `payload` (the body); 404 `delivery_not_found` (also another connection's) |
| `POST` | `/api/v1/shops/{id}/deliveries/{dId}/retry` · `…/discard` | `ROLE_ADMIN` | ss-5a: Retry runs the import again from the stored body → `placed` with its order, or `failed` with the new reason and one more attempt; Discard → `discarded` |
| `GET` | `/api/v1/shops/{id}/outbox` | `ROLE_ADMIN` | ss-5b: the write-back of a connection, newest first, `?status=` `failed` (the default) / `pending` / `sent` (422 otherwise) → `ShopOutboxOutput[] {id, capability, order: {id, code}, payload, status, attempts, last_error, created_at}`. A status change of a linked order (by hand, or Sent by getting ready) writes an `order_status` row when the connection is active with `order_status` on: Processed → `processing`, Sent and Delivered → `completed`, others nothing, never the status last pushed again; "also send to the shop" writes an `order_note` row (a **private** note on the shop). Each row is pushed by the `shops` queue (`PushShopUpdate`), tried again 1 and 5 min later, `failed` at the third failure (health `push_failed`, counted in `failed_pushes`); a 401 marks the health `keys_read_only` at once; 404 `shop_not_found` |
| `POST` | `/api/v1/shops/{id}/outbox/{oId}/retry` | `ROLE_ADMIN` | ss-5b: queues the row again, due now → `ShopOutboxOutput` (`pending` until the worker sends it; one try, `failed` again if it fails); a row already sent is answered as it is; 404 `outbox_not_found` (also another connection's) |
| `GET` | `/api/v1/orders/{id}/comments` | `ROLE_CAN_READ_ORDERS` | ss-7: `{comments: OrderCommentOutput[]}` oldest first (same date: as written); a legacy comment without a date carries the order's with `approximate: true`; `author` null and `shop` named for a shop note (`origin` `shop`); 404 `order_not_found` |
| `POST` | `/api/v1/orders/{id}/comments` | `ROLE_USER` | ss-7: `{content, send_to_shop?, phrase_id?}` → 201 `OrderCommentOutput` (signed by you, dated now; `origin` `phrase` for an active phrase, else `app`); `send_to_shop` writes an `order_note` row in `shop_outbox` for the `shops` queue, 422 `shop_note_unavailable` when the order is not from a connection or it is inactive or has `order_note` off (nothing written); 404 `order_not_found`/`quick_phrase_not_found`; 422 blank `content` |
| `POST`/`DELETE` | `/api/v1/orders/{id}/comments/{cId}/pin` | `ROLE_USER` | ss-7: pins / unpins → `OrderCommentOutput`; one pinned comment per order (pinning another unpins the previous); the list's and detail's `pinned_comment`; 404 `comment_not_found` (also another order's comment) |
| `POST`/`GET` | `/webhooks/shops/{token}` | public | ss-5a: a connection's webhook. `X-WC-Webhook-Signature` (base64 HMAC-SHA256 of the raw body with the connection's secret) required. 200 `{status: true}` when placed in the connection's warehouse (linked, printed when the connection prints, the checkout note as a shop comment), a duplicate (nothing stored) or kept in the inbox (unknown SKU, inactive connection…); 401 `{status: false}` + inbox row `bad_signature` (no body) + health; 404 for an unknown token (nothing stored); 413 over 1 MB; GET and WooCommerce's `webhook_id=` ping → 200 |
| `POST`/`GET` | `/admin/order/1H39j0jpQPsWL958v9R4` | public | The old WooCommerce webhook, removed (the user, 2026-10-06): a tombstone that always answers 410 `{status: false, error: "webhook_moved"}`, places nothing, keeps no body and counts the hit (`/settings/webhooks`, the warning on Orders and in Shop connections). The shops post to their connection's URL. Inbox rows of kind `legacy` written before the removal are still listed |

## Data model decisions

- **shops-settings added seven tables** (the user's decision, `docs/pdr/prd-shops-settings.md`, "Data model"): one
  additive migration, `Version20261006000000`, creates `app_setting`, `quick_phrase` (Settings), `shop_connection`,
  `shop_order_link`, `shop_delivery`, `shop_outbox` and `order_comment_meta` (Ordering), with foreign keys *from* them
  to `order`, `comment`, `user` and `warehouse`. No existing table or column changes: a shop order keeps `order.source`
  = web and its shop is the link row; a comment's pin and origin live in its meta row. Secrets in them are sealed
  (`v1:` + base64, `APP_ENCRYPTION_KEY`).

- **The production schema does not change.** The restructure moved every entity into its context with its table,
  columns, keys and associations as they were (explicit `#[ORM\Table]` on each), kept the migrations' directory,
  namespace and class names (production records them), and added one table, `messenger_messages`, for the email
  queue. `docs/db/README.md` holds the contract and how it is checked; `SchemaInvarianceTest` fails on any change.
- **The recorded drift stays.** `user.roles` and `warehouse.urls` are mapped as `json` but were created as
  `DC2Type:array` (`LONGTEXT`); Doctrine proposes changing them, and that is never applied. Never run
  `doctrine:schema:update --force`, never commit a `migrations:diff` that alters an existing table.
- **The migrations are not production's history.** `warehouse.url` was added to production outside them; a guard in
  `Version20220514135034` creates it on a fresh database. Three guard edits make them run on DBAL 4; nothing else in
  them changed.
- **Associations across contexts stay mapped** (an order's customer, warehouse and products…): unmapping one would
  drop its foreign key from the schema Doctrine expects.

## Deploying to a cPanel account

`deploy/cpanel-update.sh` pulls, installs, builds the UI, backs the database up before any pending migration,
migrates, warms the cache, appends the front-controller rules to `backend/public/.htaccess`, and checks the PHP
version, extensions (`sodium` included), `APP_ENCRYPTION_KEY`, the time zone (America/Bogota) and the cron line. Its
header lists the one-time steps of moving the existing account to this layout: the document root becomes
`backend/public`, the settings move to `backend/.env.local` (`deploy/env.local.example`), and everyone signs in again
once. The cron line (every minute) runs `app:shops:pull --if-due` (the shops' catch-up pull) and then drains the
`mail` and `shops` queues, under one `flock`; the script prints it and says when the old mail-only line must be
replaced.

For the shops-settings feature (the legacy WooCommerce webhook is replaced by per-connection webhooks): before
deploying, generate `APP_ENCRYPTION_KEY`; deploy (the migration creates the shop tables). From then on the old URL
(`/admin/order/1H39j0jpQPsWL958v9R4`) answers 410 and places nothing, so right after the deploy create the four
connections in Settings › Shop connections (name, shop URL, REST keys, warehouse, printer switch), re-point each
shop's webhook to its connection's URL and secret, and press "Check now": a connection's first pull reads the last 30
days of `processing` orders, which recovers the orders placed in the gap. Watch the old URL's hit counter (Settings ›
General) stay at 0. The full checklist is in `docs/pdr/prd-shops-settings.md` (`Cutover checklist`) and in
`deploy/cpanel-update.sh`'s header.

Shop webhooks are `/webhooks/shops/{token}`, public, and require the connection's HMAC-SHA256 signature.

## What behaves differently from the Twig app

Everything else does what the legacy pages did (roles included). On purpose, each with a test:

- Fixed: "Update Selected Using Excel" downloads every ticked product; customers without an address are in the
  pickers; orders without a customer are in the list; a partial shipment on a sent order is refused (409) instead of
  a 500; a taken invoice code is a 409; Move to Warehouse moves every ticked row with the quantity shown; approving
  incoming stock adds it to the row in stock; a stock sheet that is not the template is refused; naming a customer by
  id leaves them unchanged; a WooCommerce order delivered twice is placed once; WooCommerce orders reuse the
  countries, states and cities that exist.
- New: Sync Orders pulls the shop's waiting orders (it was a dead button); the order email goes through a queue
  (delivered within a minute by the cron line, retried); each shop has its own signed webhook URL (the old single URL
  answers 410); security headers; spreadsheet cells that start with `=` are written as text.
- Everyone signs in again once after the cutover; old page addresses redirect to the new ones.

## Known gaps

- Production may already hold two in-stock rows of one product in one warehouse: the legacy "Approve all" kept the
  approved row beside the one in stock (fixed: approval now adds to the row in stock). Lookups read the first row, so
  such a product can show its stock twice and refuse a removal it could cover. Find them before or after the cutover
  with `SELECT product_id, warehouse_id, COUNT(*) FROM product_warehouse WHERE status = 1 GROUP BY 1, 2 HAVING
  COUNT(*) > 1` and merge them by hand (sum the quantities into the oldest row, delete the others).
- Failed deliveries and writes to shops are kept in memory (a bounded inbox: failed deliveries older than 90 days,
  failed pushes older than a week, are purged by the pull and push commands; the count in health is live).
- "Also send to <shop> as an order note" writes a queued `order_note` row to the outbox, but the shop's capability to
  receive notes must be enabled in its connection settings (each connection has an "Order notes" toggle in Settings ›
  Shop connections).
- Non-admins see shop names in the Source filter only for shops on the current page of results (the full list is
  admin-only); unlinked orders show Web or Phone.
- A new shop connection must be saved before "Test connection" will work (the test runs against the connection's
  stored keys and URL).
- **`sync-comments`, partial shipments, the order XLS and the warehouses need only `ROLE_USER`** (as before, PRD
  decision 11): any account, an invoices-only one included, can record a partial shipment (stock out, order
  completed), replace an order's comments and rename a warehouse. Audit finding 1 (High): accepted by the user on
  2026-10-05, same as legacy.
- **Between the deploy and re-pointing a shop, its webhook deliveries get 410** (the old URL was removed, not kept
  during a cutover: the user, 2026-10-06; this closes shops-settings audit finding 2, an unsigned delivery to the old
  URL was imported). WooCommerce retries and then disables that webhook; the orders are not lost: "Check now" (or the
  cron pull) reads the last 30 days of `processing` orders on a connection's first pull. `warehouse.urls` is no longer
  read (the column stays).
- A connection's webhook token is in the server's access log and, on a request that errors, in `var/log` (only its
  secret, never logged, makes a delivery valid); the token cannot be rotated, only the secret (shops-settings audit,
  findings 3 and 7). Pinning or unpinning a comment answers it to any signed-in user, as the order form's comment
  `PUT` does (finding 5, within the accepted `ROLE_USER` order writes).
- No login throttling, and a disabled user can still sign in (as before; the user chose to keep both). Sign-in time
  tells whether a username exists (finding 14).
- No script/style Content-Security-Policy (the screens load Bootstrap, jQuery and Font Awesome from CDNs) and no HSTS
  header (set it in cPanel once HTTPS is confirmed): deferred by the user; the other security headers are sent.
- `master` committed an `APP_SECRET` in `.env.dist`: give production a fresh one in `backend/.env.local` at cutover.
- The invoice roles are reached by no other role (as in production): an admin sees Invoices only when given them.
- The redesign (`docs/pdr/prd-redesign.md`): PDFs, spreadsheets and emails stay English and keep their look; the
  Spanish texts are ours (one proofreading pass, no native review); the KF mark is a trace of a 180 px PNG until a vector file arrives;
  the camera works only over HTTPS (or `localhost`), so it is not available on the dev stack opened from a phone by IP,
  and it was not tried on real phones (the user's decision; the tests use a fake detector); the customers search covers
  the current page only (the API pages without searching). An order is Sent only when one shipment covers all of it, as
  before: the shipment that completes a partial order leaves it Partial. `app:smoke:prepare --seed` alone cannot empty
  a database that holds partial-shipment child orders (a foreign key): reset with `backend/e2e/prepare.sh` (drop, migrate, seed) instead.
