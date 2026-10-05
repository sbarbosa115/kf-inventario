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
| `Ordering` | `order`, `order_product`, `order_status`, `comment` | orders, partial shipments, PDFs/XLS, the printer email, WooCommerce |
| `Invoicing` | `invoice`, `invoice_item` | invoices and their PDF |
| `Audit` | `log` | the activity log (Shared's `ActivityLog` port) |
| `Shared` | `messenger_messages` | buses, domain errors, API plumbing, mail queue, PDF rendering |

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

## API reference

JSON under `/api/v1`, `snake_case`, errors as `{"error": "<code>", "message", "detail"?, "violations"?}`. Every
endpoint asks for the role its legacy page asked for (most accounts also hold `ROLE_USER`, which the API requires
first). Writes from another origin are refused (403).

| Method | Path | Role | Built by item |
|---|---|---|---|
| `POST` | `/api/v1/auth/login` | public | 0: `{username, password, remember_me?}` → the session; 401 `invalid_credentials` |
| `POST` | `/api/v1/auth/logout` | `ROLE_USER` | 0: 204 |
| `GET` | `/api/v1/auth/me` | `ROLE_USER` | 0: who is signed in, with every reachable role; 401 signed out |
| `GET` | `/api/v1/users` | `ROLE_MANAGE_USERS` | 1: every user by name, `UserOutput {id, name, username, email, roles, enabled}` (never the password) |
| `GET` | `/api/v1/users/{id}` | `ROLE_MANAGE_USERS` | 1: one user; 404 `user_not_found` |
| `POST` | `/api/v1/users` | `ROLE_MANAGE_USERS` | 1: `{name, username, email, password, roles, enabled}` → 201; the password is required, `roles` only the nine the screen assigns, else 422 |
| `PUT` | `/api/v1/users/{id}` | `ROLE_MANAGE_USERS` | 1: same body; a blank or missing `password` keeps the current hash; 404 `user_not_found` |
| `GET` | `/api/v1/warehouses` | `ROLE_USER` | 2: every warehouse by id, `WarehouseOutput {id, name, urls}` |
| `PUT` | `/api/v1/warehouses/{id}` | `ROLE_USER` | 2: `{name}` → `WarehouseOutput`; 404 `warehouse_not_found` |
| `GET` | `/api/v1/warehouses/{id}/stock` | `ROLE_MANAGE_INVENTORY` | 2: `?status=1` (default; `0` incoming) → list `StockOutput`, by product; 404 `warehouse_not_found` |
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
| `GET` | `/api/v1/customers` | `ROLE_MANAGE_CUSTOMERS` | 3 |
| `GET` | `/api/v1/customers/all` | `ROLE_MANAGE_CUSTOMERS`, `ROLE_CAN_CREATE_ORDERS`, `ROLE_CAN_UPDATE_ORDERS` or `ROLE_CAN_CREATE_INVOICES` | 3: every customer (`CustomerOutput[]`, those without an address too) for the order and invoice pickers; any role whose legacy form embedded the list |
| `GET` | `/api/v1/customers/{id}` | `ROLE_MANAGE_CUSTOMERS` | 3 |
| `POST` | `/api/v1/customers` | `ROLE_MANAGE_CUSTOMERS` | 3 |
| `PUT` | `/api/v1/customers/{id}` | `ROLE_MANAGE_CUSTOMERS` | 3 |
| `DELETE` | `/api/v1/customers/{id}` | `ROLE_MANAGE_CUSTOMERS` | 3 |
| `GET` | `/api/v1/locations` | `ROLE_USER` | 3 |
| `GET` | `/api/v1/orders` | `ROLE_CAN_READ_ORDERS` | 4: `?warehouse_id=` (required) → that warehouse's `OrderOutput[]`, newest first, orders without a customer included |
| `GET` | `/api/v1/orders/{id}` | `ROLE_CAN_READ_ORDERS` | 4: `OrderDetailOutput`; 404 `order_not_found` (also once deleted) |
| `POST` | `/api/v1/orders` | `ROLE_CAN_CREATE_ORDERS` | 4: `OrderInput` → 201 `OrderDetailOutput`; customer by id, else email, else phone (updated), or created; queues the printer email; 422 `order_without_products`, 404 `product_not_found`/`warehouse_not_found` |
| `PUT` | `/api/v1/orders/{id}` | `ROLE_CAN_UPDATE_ORDERS` | 4: `OrderInput` (its products replace the order's; comments untouched) → `OrderDetailOutput` |
| `POST` | `/api/v1/orders/{id}/status` | `ROLE_UPDATE_ORDERS` | 4: `{status: 1-6}` → `OrderDetailOutput` (a status history row; stock untouched) |
| `PUT` | `/api/v1/orders/{id}/comments` | `ROLE_USER` | 4: `{comments: [{id\|null, content}]}` → `{comments}`; a comment left out is detached from the order |
| `DELETE` | `/api/v1/orders/{id}` | `ROLE_CAN_DELETE_ORDERS` | 4: 204; lines deleted, comments and order soft-deleted |
| `POST` | `/api/v1/orders/sync` | `ROLE_CAN_SYNC_ORDERS` | 13: pulls the shop's waiting WooCommerce orders (REST API, `processing`, last 30 days) and places the new ones as the webhook does (same mapper, warehouse by `warehouse.urls`, printer rule) → 202 `{imported, skipped}`; an order whose shop id is already an order code in that warehouse (deleted ones too) is skipped, one that cannot be placed is skipped and logged; keys `WOO_COMMERCE_URL/_API_KEY/_API_SECRET` (one shop; none set → nothing pulled); 502 `order_sync_failed` when the shop cannot be read (nothing kept) |
| `GET` | `/api/v1/orders/{id}/partials` | `ROLE_USER` | 4: `OrderPartialsOutput` (the order's code, status and lines, shipped so far, pending, the warehouse's stock of the order's products: everything the getting-ready screen shows) |
| `POST` | `/api/v1/orders/{id}/partials` | `ROLE_USER` | 4: `{items: [{uuid, quantity}]}` → `OrderPartialsOutput`; the whole order in stock → status 5, else a partial (status 4); stock taken out; 409 `partial_exceeds_order`, 422 `insufficient_stock`, 404 `stock_not_found` (Inventory's `Stock::subtract`) |
| `GET` | `/api/v1/orders/{id}/pdf` | `ROLE_CAN_READ_ORDERS` | 4: `application/pdf` (`templates/pdf/order.html.twig`) |
| `GET` | `/api/v1/orders/{id}/remaining-pdf` | `ROLE_CAN_READ_ORDERS` | 4: `application/pdf`, what is left to ship |
| `GET` | `/api/v1/orders/{id}/xls` | `ROLE_USER` | 4: `application/vnd.ms-excel`, `file-upload-template-<code>.xls` (the legacy name) |
| `GET` | `/api/v1/invoices` | `ROLE_CAN_READ_INVOICES` | 5: `InvoiceOutput[]`, newest first, with customer, lines and their products |
| `GET` | `/api/v1/invoices/next-code` | `ROLE_CAN_CREATE_INVOICES` | 5: `{code}`: the newest invoice's code plus one (`INV-0001` → `INV-0002`, `X` → `X-1`), or the year and `0001` for the first |
| `GET` | `/api/v1/invoices/{id}` | `ROLE_CAN_READ_INVOICES` | 5: `InvoiceOutput`; 404 `invoice_not_found` |
| `POST` | `/api/v1/invoices` | `ROLE_CAN_CREATE_INVOICES` | 5: `InvoiceInput` → 201 `InvoiceOutput`; customer by `customer_id` or found/created from `customer` (as orders do); with no address typed, the customer's first is copied; line totals and `tax_rate` % tax worked out as before; 409 `invoice_code_taken` |
| `GET` | `/api/v1/invoices/{id}/pdf` | `ROLE_CAN_READ_INVOICES` | 5: `application/pdf` (`templates/pdf/invoice.html.twig`, the logo from `public/images/`) |
| `POST`/`GET` | `/admin/order/1H39j0jpQPsWL958v9R4` | public | 4: the WooCommerce webhook (URL and route name unchanged): warehouse by `X-WC-Webhook-Source` in `warehouse.urls`, printer email only for `ORDER_WEBHOOK_EMAIL_WAREHOUSE_ID`; always `{status: true}`, failures logged; with `WOO_COMMERCE_WEBHOOK_SECRET` set, a delivery without the shop's `X-WC-Webhook-Signature` is logged and not placed (empty by default: no check, as before) |

## Data model decisions

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
version, extensions, time zone (America/Bogota) and the email queue's cron line. Its header lists the one-time steps
of moving the existing account to this layout: the document root becomes `backend/public`, the settings move to
`backend/.env.local` (`deploy/env.local.example`), the cron line drains the email queue, and everyone signs in again
once.

The "Sync Orders" button reads the shop's WooCommerce REST API with `WOO_COMMERCE_URL`, `WOO_COMMERCE_API_KEY` and
`WOO_COMMERCE_API_SECRET` (read-only keys, one shop as before): the URL must be one of the receiving warehouse's
`urls` (the address its webhook comes from). With any of the three empty the button places nothing.

The webhook (`/admin/order/1H39j0jpQPsWL958v9R4`) is public, as before: its secret path and the
`X-WC-Webhook-Source` header are all that admit an order. Setting `WOO_COMMERCE_WEBHOOK_SECRET` to the webhook's secret
in the shop (WooCommerce › Settings › Advanced › Webhooks) makes it check WooCommerce's `X-WC-Webhook-Signature` too:
recommended, once the secret is copied from the shop (a wrong one refuses every order, logged as a warning).

## Known gaps

The security audit of the restructure (`docs/security/audits/2026-10-05-restructure.md`) left these for a decision:

- **`sync-comments`, partial shipments, the order XLS and the warehouses need only `ROLE_USER`** (as before, PRD
  decision 11): any account, an invoices-only one included, can record a partial shipment (stock out, order
  completed), replace an order's comments and rename a warehouse. Audit finding 1 (High): tighten or accept.
- **The WooCommerce webhook is admitted by its secret path and the `X-WC-Webhook-Source` header alone** unless
  `WOO_COMMERCE_WEBHOOK_SECRET` is set (then the shop's signature is required). Set it in production (audit finding 2).
  A delivery posted twice places two orders, as before (finding 15).
- No login throttling, and a disabled user can still sign in (as before; the user chose to keep both). Sign-in time
  tells whether a username exists (finding 14).
- No script/style Content-Security-Policy (the screens load Bootstrap, jQuery and Font Awesome from CDNs) and no HSTS
  header (set it in cPanel once HTTPS is confirmed); the other security headers are sent.
- `master` committed an `APP_SECRET` in `.env.dist`: give production a fresh one in `backend/.env.local` at cutover.
- The invoice roles are reached by no other role (as in production): an admin sees Invoices only when given them.
- English only: the i18n layer supports a second locale, none is written.
