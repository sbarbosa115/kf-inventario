# Restructure: kf-inventory on the tacoma layout, same database

<!--
    PRD for docs/pdr/prd-restructure.md. Base branch feature/restructure (from origin/master). `split.py plan` reads
    the table under "## Split". Written 2026-10-05 from a read of master at 4b23610.
-->

## What it is for

The Klassic Fab inventory staff (one `user` table, roles `ROLE_ADMIN`, `ROLE_MANAGE_INVENTORY`, `ROLE_MANAGE_ORDERS`,
`ROLE_UPDATE_ORDERS`, `ROLE_MANAGE_CUSTOMERS`, `ROLE_MANAGE_USERS`, `ROLE_MANAGE_WAREHOUSES`, `ROLE_*_INVOICES`) keep
doing exactly what they do today under `/admin/…`: stock per warehouse, moves between warehouses, barcode add/remove,
incoming approvals, orders (by hand or from the WooCommerce webhook) with partial shipments, order PDFs/XLS and the
order email to the printer, invoices with PDFs, customers, users. Nothing changes for them except that the screens
become one React application; nothing changes for the production database at all.

The job of this feature is the engineering side: the repository takes the shape every other Symfony project of the
user has (`tacoma`): `backend/` with DDD/hexagonal bounded contexts, a JSON API under `/api/v1/` typed into the UI
through OpenAPI, a Feature-Sliced React SPA in TypeScript, Deptrac/PHPStan/ESLint/Vitest/Playwright, a standard Docker
stack, and a cPanel deploy script with a cron-drained Messenger queue.

## Plan

### Owning contexts (backend), and where every current class goes

`backend/src/<Context>/{Domain,Application,Infrastructure,UI}` plus `Shared`. Context names follow `dsfk`/`tacoma`.

| Context | Entities (table) moved to `Domain/Model` | Takes over (current class → new home) |
|---|---|---|
| `Identity` | `User` (`user`) | `Repository/UserRepository` → `Domain/Repository/UserRepository` + `Infrastructure/Persistence/DoctrineUserRepository`; `Controller/UserController`, `Controller/SecurityController`, `Form/UserType` → `UI/Http/Controller/{SessionController,UserController}` + `Input/UserInput`; `Security/CustomAuthenticator` → deleted (dead: commented out in `security.yaml`, half-implemented); `Command/MigrateUserRolesCommand` → `UI/Cli/MigrateJsonColumnsCommand` (same name `app:migrate-user-roles`, kept: it is a data tool for the `roles`/`urls` columns) |
| `Inventory` | `Product` (`product`), `ProductWarehouse` (`product_warehouse`), `Warehouse` (`warehouse`) | `Services/ProductService` → `Application/Command/{UploadProducts,MoveStock,AddStock,RemoveStock,ApproveIncoming,CreateProduct,UpdateProduct,RenameWarehouse}` + handlers, `Application/Query/{Stock,Products,Warehouses}`; `Repository/{Product,ProductWarehouse,Warehouse}Repository`, `Repository/Utils/ProductUtils` → `Domain/Repository/*` + `Infrastructure/Persistence/Doctrine*Repository` (`ProductUtils::builtQueryByUuidOrCode` becomes `ProductRepository::findByUuidOrCode`); `Controller/{ProductController,WarehouseController}`, `Form/{ProductType,UploadProductsType,WarehouseType}` → `UI/Http/Controller/{ProductController,StockController,WarehouseController}` + `Input/*`; PhpSpreadsheet read/write → `Infrastructure/Spreadsheet/{ProductSheetReader,ProductTemplateWriter}` behind `Application/Port/{ProductSheetReader,ProductTemplateWriter}` |
| `Customers` | `Customer` (`customer`), `CustomerAddress` (`customer_address`), `Country` (`country`), `State` (`state`), `City` (`city`) | `Services/CustomerService` → `Application/Command/{SaveCustomer,DeleteCustomer}` + `Application/Service/CustomerRegistry` (the `addOrUpdate` find-by-id/email/phone logic, also what Ordering and Invoicing call) + `Application/Query/{Customers,Locations}`; the 5 repositories → ports + Doctrine adapters; `Controller/CustomerController` → `UI/Http/Controller/{CustomerController,LocationController}`; `Services/LocationManager.js` logic stays client-side |
| `Ordering` | `Order` (`order`), `OrderProduct` (`order_product`), `OrderStatus` (`order_status`), `Comment` (`comment`) | `Services/OrderService` → `Application/Command/{PlaceOrder,UpdateOrder,DeleteOrder,ChangeOrderStatus,SyncOrderComments,RecordPartialShipment}` + handlers, `Application/Query/{Orders,OrderPartials}`; `Services/CommentService` → inside `SyncOrderComments`; `Services/NotificationService` → `Application/EventHandler/SendOrderCreatedEmail` (on `Domain/Event/OrderPlaced`) + `Infrastructure/Mail/OrderCreatedMailer`; `EventListener/OrderListener` → `Infrastructure/Persistence/OrderStatusHistoryListener` (verbatim, same tags); `DataProviders/WooCommerceProvider` → `Infrastructure/WooCommerce/WebhookOrderMapper` + `UI/Http/Controller/WooCommerceWebhookController`; `Model/RemoveOrderInput`, `Model/OrderInput`, `Validator/Constraint/OrderExistById*`, `Form/OrderType` → deleted (replaced by Input DTOs; `OrderInput`/`OrderType` are unused today); `Controller/OrderController` → `UI/Http/Controller/{OrderController,OrderDocumentController,OrderPartialController}`; order PDFs stay Twig: `templates/order/pdf.html.twig`, `templates/order/remaining-pdf.html.twig` → `backend/templates/pdf/order.html.twig`, `pdf/order-remaining.html.twig` |
| `Invoicing` | `Invoice` (`invoice`), `InvoiceItem` (`invoice_item`) — `InvoiceLine` **deleted** (no table in any migration; its `inversedBy: 'lines'` points at a property `Invoice` does not have) | `Services/InvoiceService` → `Application/Command/CreateInvoice` + `Application/Query/Invoices` (incl. the suggested next code); `Repository/InvoiceRepository` → port + adapter; `Controller/InvoiceController`, `Form/InvoiceType` (unused) → `UI/Http/Controller/{InvoiceController,InvoiceDocumentController}`; `templates/invoice/pdf.html.twig` → `backend/templates/pdf/invoice.html.twig` |
| `Audit` | `Log` (`log`) | `Services/LogService` → `Infrastructure/Persistence/DoctrineActivityLog` implementing `Shared\Application\Port\ActivityLog::log(string $entity, string $event, array $detail = [])` (same `mb_strtolower($entity)`, same `json_encode($detail)`; the signed-in `User` from the token storage). No HTTP endpoint (write-only, as today) |
| `Shared` | — | buses, `DomainError` kinds, `Clock`, `ActivityLog` and `PdfRenderer` ports (`Services/PdfHandlerService` → `Shared/Infrastructure/Pdf/DompdfRenderer`, letter paper), `QueuedMailer`, API plumbing (`ApiException`, `ApiExceptionSubscriber`, `ApiResponse`, `ApiValidationException`, `InputMapper`, `OpenApi/ApiResponseDescriber`), `UI/Http/Security/{SameOriginWrites,JsonEntryPoint}`, `UI/Http/Spa/SpaController`, `UI/Cli/SmokePrepareCommand` |
| (not a context) | — | `DataFixtures/*` → `backend/src/DataFixtures/` (dsfk's place; dev/test seed, excluded from Deptrac); `Constraints/ClassHasAttribute` + `Validator/ClassHasAttributeValidator` → deleted (empty validator, unused); `Controller/DefaultController::testEmail` (`/admin/test-email`, sends to the cc list unauthenticated-by-role) → deleted; `Kernel.php` stays `App\Kernel` |

Cross-context Doctrine associations are **kept as mapped today** (see "Database invariance" §B.4): `Order→Customer`,
`Order→Warehouse`, `OrderProduct→Product`, `Comment→User`, `Invoice→Customer`, `InvoiceItem→Product`, `Log→User`, and
the inverse `OneToMany` sides (`Customer::$request`, `Warehouse::$orders`, `Product::$orderProducts`, `User::$log`,
`User::$comments`). Everything else between contexts goes through Application-layer services or ports:
Ordering → Customers (`CustomerRegistry::addOrUpdate`), Ordering → Inventory (`Stock::subtract`, `Products::byUuidOrCode`,
`Warehouses::byWebhookSource`), Invoicing → Customers and Inventory (`Products::byId`).

### FSD slices (frontend), one per current screen

`backend/assets/react/` with `app / pages / widgets / features / entities / shared`. Current `assets/js/**` is removed
by the item that replaces each screen; `assets/app.js`, `assets/bootstrap.js`, `assets/controllers*` (Stimulus, unused)
go in item 0.

| Current screen (Twig + React entry) | Page slice | Widgets / features / entities it owns |
|---|---|---|
| `security/login.html.twig` | `pages/login` | `entities/session` (me, login, logout, `SessionProvider`, `useCan(role)`), `features/sign-in` |
| `base.html.twig` (navbar, sidebar by role, flashes) | — | `widgets/app-shell` (sidebar visibility rules copied one-to-one from `base.html.twig`), `shared/ui` toasts |
| `product/index.html.twig` + `Products/Index/{Products,ConfirmSelectedProducts}.js` | `pages/products` | `widgets/stock-table` (warehouse picker + selectable table), `features/move-stock` (the modal with per-row quantity selects), `features/download-stock-sheet`, `entities/product`, `entities/warehouse` |
| `product/new.html.twig`, `product/edit.html.twig` (Symfony forms) | `pages/product-form` | — |
| `product/upload.html.twig` | `pages/products-upload` | `features/upload-products` |
| `product/bar-code.html.twig` + `Products/BarCode/View.js` | `pages/barcode-reader` | `features/scan-stock` (add/remove with confirm modals, exists-check per code) |
| `product/incoming.html.twig` + `Products/IncomingProducts/View.js` | `pages/incoming-stock` | `features/approve-incoming` |
| `warehouse/index.html.twig`, `warehouse/edit.html.twig` | `pages/warehouses` | `features/rename-warehouse` (edit in a modal: the form has one field) |
| `order/index.html.twig` + `Orders/Index/{Orders,DetailOrder}.js` | `pages/orders` | `widgets/order-table`, `widgets/order-detail` (modal: products tab, comments tab), `features/change-order-status`, `features/delete-order`, `features/sync-orders`, `features/edit-order-comments`, `entities/order` |
| `order/new.html.twig`, `order/edit.html.twig` + `Orders/New/ManageOrder.js` | `pages/order-form` | reuses `widgets/address-form`, `entities/customer`, `entities/product` |
| `order/getting-ready.html.twig` + `Orders/GettingReady/PartialHandler.js` | `pages/order-getting-ready` | `features/record-partial` (scanner input, three refusal modals) |
| `invoice/index.html.twig` + `Invoice/components/{InvoiceList,DetailInvoice}.js` | `pages/invoices` | `widgets/invoice-detail`, `entities/invoice` |
| `invoice/new.html.twig` + `Invoice/New/ManageInvoice.js` | `pages/invoice-form` | `features/add-all-products`, totals in `entities/invoice/lib` |
| `customer/index.html.twig` + `Customer/Index/Customers.js` | `pages/customers` | `features/delete-customer`, `entities/customer` |
| `customer/new|edit.html.twig` + `Customer/CustomerHandler/CustomerHandler.js`, `Services/LocationManager.js` | `pages/customer-form` | `widgets/address-form` (country/state/city creatable cascading selects; `LocationManager` → `entities/location/lib`), `entities/location` |
| `user/index|new|edit.html.twig` (Symfony forms) | `pages/users`, `pages/user-form` | `entities/user`, `shared/config/roles.ts` (the 9 assignable roles of `UserType`) |
| `Widgets/ConfirmModal.js` | — | `shared/ui/ConfirmModal` |

UI kit decision: `react-table` v6, `react-bootstrap4-modal`, jQuery/Popper/Bootstrap JS from CDNs, `startbootstrap-sb-admin`,
`moment`, `lodash`, `axios`, `downloadjs`, `prop-types` are dropped. Kept: `bootstrap@4` **CSS only** (so screens look the
same), `@fortawesome/fontawesome-free`, `react-select` (creatable selects). `shared/ui` provides `DataTable` (client-side
filter/sort/page, row selection), `Modal`, `ConfirmModal`, `Button`, `Field`, `Select`, `Toast`, `EmptyState`, `Loader`,
`PageCard`. Dates are formatted with `Intl.DateTimeFormat`.

### Nearest existing feature to copy the shape of

- Backend: `/home/sbarbosa/Development/tacoma/backend/src/Ordering` (controller → `InputMapper` → command bus → Output
  DTO + `#[ApiResponse]`), `src/Shared/*` copied as is, `src/Access/UI/Http/Security/{SameOriginWrites,JsonEntryPoint}`.
- Frontend: `tacoma/backend/assets/react/{shared/api,shared/i18n,entities/admin-session,entities/order,pages/admin-businesses}`.
- Configs: tacoma's `deptrac.yaml`, `deptrac.contexts.yaml`, `phpstan.dist.neon`, `eslint.config.mjs` + `eslint-fsd-boundaries.mjs`,
  `tsconfig.json`, `vitest.config.mts`, `playwright.config.ts`, `webpack.config.js`, `.php-cs-fixer.dist.php`, `phpunit.dist.xml`,
  `docker-compose.yml`, `docker/*`, `deploy/*`, `.github/workflows/ci.yml`, `.claude/gate.d/compose-cpus`.

### Left out on purpose (→ README "Known gaps")

- A Spanish UI: `translations/` has `messages.en.yaml` only; the i18n layer supports a second locale but none is written.
- ~~Implementing the WooCommerce pull sync~~ — now in scope as item 13 (user decision). Historical note: `OrderController::syncRemoteOrders` calls `WooCommerceProvider::syncOrders()`,
  which does not exist (the button answers 500 today); the `automattic/woocommerce` client is required but never used
  (open question 3). Only the webhook integration is real and is kept.
- `Order`, `Comment`, `OrderStatus` declare `#[ORM\PrePersist]/#[ORM\PreUpdate]` without `#[ORM\HasLifecycleCallbacks]`,
  so `modified_at` is never written. Kept as is (the entities move verbatim); fixing it writes a column that is empty today.
- `OrderStatusHistoryListener` flushes inside `postPersist/postUpdate` and adds an `order_status` row on every persist of a
  parent order, status changed or not. Kept verbatim; turning it into a domain event is a later change.
- Removing the inverse-side cross-context associations (`Customer::$request` etc.) and the `orphanRemoval` on them: they
  drive soft-deletes today (deleting a customer soft-deletes its orders through Gedmo), so they stay.
- Server-side pagination/search on the stock and orders lists: today they load one warehouse's rows and filter in the
  browser; this stays (bounded data, same UX). Customers keep their server pagination (100/page).
- PHPStan above level 6 (raise one level at a time afterwards); converting `float`/`decimal` money to a `Money` type.
- Aligning the `user.roles` / `warehouse.urls` column types with their `json` mapping (a schema change: out of scope).

## Database invariance

The production database is live and is not touched beyond **one new table** (`messenger_messages`, for the queue). The
model is kept byte-for-byte at the schema level; the checks below are run by the coordinator in item 0 and by every item
through a test.

### A. Facts found on master that the mechanism must account for

1. **Pre-existing drift.** The schema the migrations build is not what the mappings describe, and `doctrine:migrations:diff`
   on master is already **not empty**:
   - `user.roles` is `LONGTEXT … COMMENT '(DC2Type:array)'` (Version20181106153152) but mapped `type: 'json'`;
   - `warehouse.urls` likewise (Version20220514135034) vs `type: 'json'` (`MigrateUserRolesCommand` exists precisely
     because the mapping was changed without a column change);
   - `InvoiceLine` is mapped but no migration creates `invoice_line` (and its mapping is invalid: `inversedBy: 'lines'`).
   So the acceptance check cannot be "diff produces nothing": it is **"diff produces exactly the recorded baseline"**
   (`docs/db/baseline-drift.sql`), where the baseline is the drift of master minus the `invoice_line` lines once that dead
   entity is deleted, plus nothing else. The coordinator decides nothing about the drift itself: it stays, documented.
2. **The migrations cannot build a fresh database as they are**, which is why the current tests use SQLite +
   `doctrine:schema:create`: (a) 23 migrations call `$this->connection->getDatabasePlatform()->getName()`, removed in
   DBAL 4 (`doctrine/orm ^3.2` + `doctrine-bundle ^3` pull DBAL 4); (b) `Version20220514135034` runs
   `DROP TABLE migration_versions` without `IF EXISTS`, which fails where that old table never existed. Both guards are
   edited (**only those lines**: `abortIf(!$platform instanceof AbstractMySQLPlatform, …)` and `DROP TABLE IF EXISTS`),
   class names and every other `addSql` untouched, so production (where they already ran) is unaffected and a fresh
   MySQL can be built. The review rule for that commit: `git diff` shows only `abortIf`/`DROP TABLE IF EXISTS` lines.
3. **Nothing stores a PHP class name in data.** Checked: `log.entity` holds lower-cased labels (`customer`, `order`,
   `product`, `mail`), `log.detail` holds JSON of request payloads, `user.roles` and `warehouse.urls` hold JSON arrays of
   strings; no Gedmo Loggable, no discriminator maps, no `ManyToMany` join tables, no serialized objects, no DB-stored
   enums (statuses are `INT`). Sessions and remember-me cookies serialize the user class: moving `App\Entity\User`
   invalidates them **once** at cutover (everyone signs in again) and is harmless otherwise.
4. **Index and FK names** are hashes of table + column names (Doctrine's `_generateIdentifierName`), never of class names:
   a namespace move cannot change them. **Join column names** derive from association property names (`$customer` →
   `customer_id`): no owning-side property is renamed in this refactor.
5. The old dev database was MySQL **5.7.44** (`.idea/dataSources.local.xml`, `docker-compose.yml`, `doctrine.yaml`
   `server_version: '5.7'`). **Production runs MySQL 8.x and PHP 8.4** (answered by the user, 2026-10-05): the Docker
   image is `mysql:8.0` (overridable with `DB_IMAGE`), `serverVersion=8.0`, and the baseline (C2, C5) is recorded on
   MySQL 8.0 so the dev stack matches production.

### B. The mechanism

1. **Mapping config** (`backend/config/packages/doctrine.yaml`): `auto_mapping: false`; one `attribute` mapping per context,
   `dir: '%kernel.project_dir%/src/<Context>/Domain/Model'`, `prefix: 'App\<Context>\Domain\Model'`. Kept **unchanged**:
   `naming_strategy: doctrine.orm.naming_strategy.underscore` (not tacoma's `underscore_number_aware`), `charset: utf8mb4`,
   `default_table_options: {charset: utf8, collation: utf8_unicode_ci}`, the `softdeleteable` filter, `server_version`
   (now read from `DATABASE_URL`'s `serverVersion=8.0` as in tacoma). `gedmo.listener.softdeleteable` service kept
   as is in `services.yaml`.
2. **Explicit table names on every entity**: `#[ORM\Table(name: 'city')]`, `comment`, `country`, `customer_address`,
   `customer`, `log`, `order_product`, `order_status`, `product`, `product_warehouse`, `state`, `warehouse` added where
   the name was implicit; `` `order` ``, `` `user` ``, `invoice`, `invoice_item` already explicit and kept. Every
   `#[ORM\Column]`, `#[ORM\JoinColumn]`, association attribute, `#[Gedmo\SoftDeleteable]` and `#[ORM\HasLifecycleCallbacks]`
   is moved verbatim; `repositoryClass:` is dropped (no schema effect). Property names, types, lengths, nullability,
   `options`, `cascade`, `orphanRemoval`, `inversedBy/mappedBy` do not change. `InvoiceLine` is deleted.
3. **Migrations**: `backend/migrations/` keeps the directory, the `DoctrineMigrations` namespace and the file names
   (`doctrine_migrations.yaml` unchanged: `'DoctrineMigrations': '%kernel.project_dir%/migrations'`, default table
   `doctrine_migration_versions`), so the version names recorded in production (`DoctrineMigrations\Version2018…`) still
   match. The guard edits of §A.2 are the only changes to existing files. One new migration,
   `Version20261005000000.php` (created with `messenger:setup-transports --dump-sql` output), creates
   `messenger_messages` only (`MESSENGER_TRANSPORT_DSN=doctrine://default?auto_setup=0`, as tacoma).
4. **Cross-context associations stay mapped** because unmapping a `ManyToOne` would drop its FK and index from the
   schema Doctrine expects (a diff). `deptrac.contexts.yaml` has one layer `DomainModels`
   (`#^App\\[A-Za-z]+\\Domain\\Model\\#`) allowed to reference itself across contexts, with this reason written above
   it; the rest of each context obeys the strict `<Context>` / `<Context>Api` rules.
5. **Legacy code during the split**: until item 12 deletes it, `src/{Controller,Services,Form,Model,Repository,Validator,
   EventListener,DataProviders}` keep working against the moved entities (a `sed` of `App\Entity\` → the new FQCNs in
   item 0), so the Twig app is usable on the base branch while items are built. They sit in a Deptrac `Legacy` layer
   that may use anything, and in PHPStan's `excludePaths` with the reason "removed by item 12".

### C. The checks (what "the schema did not change" means, mechanically)

Run by the coordinator at the marked sub-steps of item 0, and encoded once as a test so every item and every merge
re-runs them:

| Check | Command (in `php`) | Expected |
|---|---|---|
| C1 fresh build | `doctrine:database:create --if-not-exists && doctrine:migrations:migrate -n` (dev **and** `--env=test`) | green on `mysql:8.0` |
| C2 recorded drift | `doctrine:schema:update --dump-sql --complete` → compare with `docs/db/baseline-drift.sql` | byte-identical (after 0.5: identical minus the `invoice_line` lines; after 0.4's migration: still identical — `messenger_messages` exists in both) |
| C3 mapping | `doctrine:schema:validate --skip-sync` | `[OK]` mapping (master fails on `InvoiceLine`; after 0.5 it passes) |
| C4 inventory | `doctrine:mapping:info` | exactly 16 entities, all under `App\*\Domain\Model` |
| C5 physical schema | `SHOW CREATE TABLE` for every table (`docker compose exec database mysqldump --no-data`) → `docs/db/schema-from-migrations.sql` | identical before and after the move (it cannot change, since only migrations touch it; this is the proof) |
| C6 guard test | `tests/Functional/Shared/SchemaInvarianceTest.php`: `SchemaTool::getUpdateSchemaSql($metadata, true)` on the test DB equals the lines of `docs/db/baseline-drift.sql` | green; also wired as `.claude/gate.d/schema-drift` so `gate.sh` fails on any mapping change by an item |
| C7 migrations status | `doctrine:migrations:status` | every version in `migrations/` recognised; none "not available" |

The deploy script (`deploy/cpanel-update.sh`) only runs committed migrations; `schema:update --force` and
`migrations:diff`-generated files are forbidden by the README and by C6.

## Contract (item 0)

Built by the coordinator alone on `feature/restructure`, in this order; each step ends with the verification named.

**0.1 Baseline, before anything moves.** On master's code: apply the §A.2 guard edits; bring up a throwaway `mysql:8.0`
(`docker run`), run C1, record C2 (`docs/db/baseline-drift.sql`, expected lines: `ALTER TABLE user CHANGE roles roles
JSON NOT NULL`, `ALTER TABLE warehouse CHANGE urls urls JSON NOT NULL`, `CREATE TABLE invoice_line …` + its FK/index),
C5 (`docs/db/schema-from-migrations.sql`), C3 (expect only the `InvoiceLine` mapping error), C4 (17). Commit:
`db: make the migrations runnable on DBAL 4 and record the schema baseline`. *Verify:* the two files exist, the diff of
`migrations/` touches only guard lines.

**0.2 Repository move.** `git mv` into `backend/`: `src config migrations templates translations tests public bin assets
composer.json composer.lock symfony.lock package.json webpack.config.js phpunit.xml.dist .env .env.dist .env.test`.
Delete from git: `Dockerfile`, `docker-compose.yml`, `Docker/`, `composer.phar`, `yarn.lock`, `.eslintrc.json`,
`public/error_log`, `public/php.ini`, `public/.user.ini`, `public/index.html`, `public/js/fos_js_routes.*`,
`public/bundles/*` (but not `public/js/fos_js_routes.*`: the legacy pages need them until item 12), `assets/app.js`, `assets/bootstrap.js`, `assets/controllers.json`, `assets/controllers/`,
`assets/styles/`; `.idea/` gitignored. Create: `docker-compose.yml` (php, worker, nginx, database `${DB_IMAGE:-mysql:8.0}`
with `--character-set-server=utf8 --collation-server=utf8_unicode_ci --default-authentication-plugin=mysql_native_password`,
node, mailpit, e2e profile; host ports `HTTP_PORT:-8080`, `DB_PORT:-3306`, `MAILPIT_PORT:-8025`; `cpus` on every service),
`docker/php/Dockerfile` (`php:8.4-fpm-alpine` + `pdo_mysql intl zip gd opcache`, composer), `docker/php/php.ini`,
`docker/nginx/default.conf` (root `/app/public`), `docker/node/start.sh`, `docker/mysql/init/10-test-database.sql`
(grant `app\_test%`), `.editorconfig`, root `.gitignore`, `README.md` (root, pointing at `backend/`), `CLAUDE.md`,
`.env.example` for host ports. `.env`: `DATABASE_URL="mysql://app:app@database:3306/app?serverVersion=8.0&charset=utf8mb4"`,
`MAILER_DSN=smtp://mailpit:1025`, `MESSENGER_TRANSPORT_DSN=doctrine://default?auto_setup=0`, the `MAILER_*` and
`WOO_COMMERCE_*` keys empty; real values in gitignored `.env.local`. *Verify:* `docker compose up -d`, `composer install`,
`bin/console about`, C1 on dev and test, C2 identical to baseline, `npm ci && npm run dev` builds the **old** entries and
the Twig app answers at `:8080/admin/login` (sign in with the fixtures' `sbarbosa115` / `123456` after
`doctrine:fixtures:load`; fix `WarehouseFixtures` which passes a string to `Warehouse::__construct(string, array)`).

**0.3 Tooling, then one style commit.** Composer: add `symfony/messenger`, `symfony/doctrine-messenger`, `symfony/clock`,
`symfony/runtime`; dev `phpstan/phpstan` + `extension-installer` + `phpstan-symfony/doctrine/phpunit`,
`deptrac/deptrac`, `dama/doctrine-test-bundle`, `nelmio/api-doc-bundle`; keep `friendsofsymfony/jsrouting-bundle` and
`willdurand/js-translation-bundle` (the legacy pages read `public/js/fos_js_routes.json` and the Bazinga translations; item 12 removes both), keep `automattic/woocommerce` (item 13 uses it); remove `phpmd/phpmd`,
`symfony/web-link`; keep `symfony/form` until item 12 (legacy pages). Configs copied from tacoma and adapted:
`.php-cs-fixer.dist.php`, `phpstan.dist.neon` (level **6**, `excludePaths` the legacy dirs with the reason),
`deptrac.yaml` (+ `Legacy` layer), `deptrac.contexts.yaml` (Identity, Inventory, Customers, Ordering, Invoicing, Audit,
Shared, `DomainModels`, `Legacy`; rules: Ordering → CustomersApi, InventoryApi; Invoicing → CustomersApi, InventoryApi;
all → Shared), `phpunit.dist.xml` (DAMA extension, `unit`/`functional` suites), `tests/bootstrap.php` (Dotenv only),
`tests/phpstan-object-manager.php`. Node: `package.json` rewritten (scripts `lint typecheck test test:e2e format
format:check api:types build watch dev`), `tsconfig.json`, `eslint.config.mjs` + `eslint-fsd-boundaries.mjs` (with the
`legacy` element for `assets/js/**`) + `eslint-google-rules.mjs`, `.prettierrc.json`, `.prettierignore`,
`vitest.config.mts`, `playwright.config.ts` (one project, desktop 1280×800 — this app is used on desktops with a barcode
scanner), `webpack.config.js` (new entry `app` → `assets/react/app/index.tsx`, alias `@`; the ten legacy entries kept
until item 12). Run the fixers once over everything, commit alone (`style: apply Symfony/Google code style`), hash in
`.git-blame-ignore-revs`. `.claude/gate.d/compose-cpus` and `schema-drift`. *Verify:* `gate.sh` PASS on every row.

**0.4 Shared kernel, security, Messenger, SPA shell (server side).** `src/Shared/*` as listed in the contexts table
(copied from tacoma; `Clock`, `DomainError` kinds, buses, `QueuedMailer`, `InputMapper`, `ApiResponse(+Describer)`,
`ApiExceptionSubscriber` for `/api/`), `Shared/Application/Port/{ActivityLog,PdfRenderer}`,
`Shared/Infrastructure/Pdf/DompdfRenderer`. `config/packages/messenger.yaml` (`command.bus` with `doctrine_transaction`;
transports `mail` (doctrine, queue `mail`, 3 retries), `failed`; `when@test` sync), `services.yaml` (`_instanceof` tags for
`CommandHandler`/`EventHandler`; excludes `*/Domain/Model`, `*/UI/Http/{Input,Output}`, `Shared/UI/Http/OpenApi`;
parameters `ordering.order_email.cc: ['sales@klassicfab.com']`, `ordering.webhook_email_warehouse_id: '%env(int:ORDER_WEBHOOK_EMAIL_WAREHOUSE_ID)%'`
default `1`), `serializer.yaml` (`name_converter: serializer.name_converter.camel_case_to_snake_case`), `framework.yaml`
(file sessions in `var/sessions`, `cookie_samesite: lax`, `cookie_httponly`), `nelmio_api_doc.yaml` (dev/test, `^/api/`),
`routes.yaml` (one `*_controllers` entry per context + `spa_controllers` last) and `config/routes/legacy_redirects.yaml`
(empty skeleton with a comment per item), `security.yaml`:

```yaml
security:
  password_hashers: { App\Identity\Domain\Model\User: bcrypt }      # same hasher: existing $2y$ hashes keep working
  providers: { database_users: { entity: { class: App\Identity\Domain\Model\User, property: username } } }
  role_hierarchy: # byte-identical to today's
  firewalls:
    dev: { pattern: ^/(_profiler|_wdt|build)/, security: false }
    main:
      lazy: true
      provider: database_users
      json_login: { check_path: api_auth_login, username_path: username, password_path: password,
                    success_handler: App\Identity\UI\Http\Security\LoginSuccessHandler,
                    failure_handler: App\Identity\UI\Http\Security\LoginFailureHandler }
      logout: { path: api_auth_logout }
      remember_me: { secret: '%kernel.secret%', lifetime: 604800, path: /, remember_me_parameter: remember_me }
      entry_point: App\Shared\UI\Http\Security\JsonEntryPoint
  access_control:
    - { path: ^/api/v1/auth/login$, roles: PUBLIC_ACCESS }
    - { path: ^/admin/order/1H39j0jpQPsWL958v9R4$, roles: PUBLIC_ACCESS }   # WooCommerce webhook, URL unchanged
    - { path: ^/api/, roles: ROLE_USER }
    - { path: ^/, roles: PUBLIC_ACCESS }                                    # the SPA shell and its build
```

Identity security classes (the handlers answering `SessionOutput` /
401 `invalid_credentials`), `Identity/UI/Http/Controller/SessionController` (`POST /api/v1/auth/login` for the schema,
`POST /api/v1/auth/logout` → 204, `GET /api/v1/auth/me` → `SessionOutput {id, username, name, email, roles}` where
`roles` are the **reachable** roles from `RoleHierarchyInterface`, so the UI can mirror `is_granted`),
`Shared/UI/Http/Security/SameOriginWrites` for `/api/` writes, `SpaController` (`/{path}` with requirement
`(?!api/|api$|_|admin/order/1H39j0jpQPsWL958v9R4$).*`, priority −100), `templates/spa.html.twig`. The `messenger_messages`
migration (§B.3). *Verify:* C1 dev+test, C2 still identical, `AuthApiTest` (login ok → shape; wrong password 401
`invalid_credentials`; `me` 401 signed out; logout 204; cross-origin POST → 403), `nelmio:apidoc:dump` works.

**0.5 Entities move (the critical step).** `git mv src/Entity/*.php` to the `Domain/Model` folders of §Plan; namespace
and `use` lines updated; §B.2 applied; `InvoiceLine.php` deleted; `doctrine.yaml` mappings; `sed` of `App\Entity\` in
`src/{Controller,Services,Form,Model,Repository,Validator,EventListener,DataProviders,DataFixtures}` and `tests/`;
`services.yaml` tags for `OrderListener` updated to the new entity FQCN. Commit alone. *Verify, in this order:* C3 `[OK]`,
C4 = 16, **C2 identical to baseline minus the `invoice_line` lines** (update `docs/db/baseline-drift.sql` to that, in
the same commit, and state why in its header), C5 unchanged, C7, `git diff -M --stat` shows renames only plus the
namespace/`Table` lines, the legacy Twig app still lists products, orders, customers at `:8080` and creates an order
(the `order_status` row appears). Then add `SchemaInvarianceTest` + `gate.d/schema-drift` (C6) and run `gate.sh`.

**0.6 Repository ports and adapters, Audit, Clock.** Per context `Domain/Repository/<Noun>Repository` (`get(int $id)`
throws the context's `NotFound`, `add()`, `remove()`, and exactly the finders the legacy services use:
`Products::byUuidOrCode`, `byCode`, `byUuids` (fixing the `implode` bug), `Stock::ofWarehouse(int, int $status)`,
`Stock::forOrder(Order)`, `Orders::ofWarehouse`, `Customers::page/count/all/byEmail/byPhone`,
`Locations::tree`, `Invoices::byCode/latest`, `Warehouses::all/byUrl`), `Infrastructure/Persistence/Doctrine*Repository`
(plain classes on `EntityManagerInterface`, not `ServiceEntityRepository`), `Audit/Infrastructure/Persistence/DoctrineActivityLog`,
`Shared/Infrastructure/Clock/SystemClock`. Legacy services untouched. *Verify:* container compiles, `composer deptrac`
clean, unit tests of the `DomainError` subclasses, phpunit green.

**0.7 The API contract.** Every endpoint of the route table below exists with its route name, `#[IsGranted]`, Input DTO,
Output DTO and `#[ApiResponse]`, answering `ApiException::notImplemented()` (501), except `auth/*` (done in 0.4).
Output DTOs: `SessionOutput`, `UserOutput`, `WarehouseOutput`, `StockOutput`, `ProductOutput`, `UploadResultOutput`,
`CustomerOutput`, `AddressOutput`, `CountryOutput/StateOutput/CityOutput`, `OrderOutput`, `OrderDetailOutput`,
`OrderCommentOutput`, `OrderPartialsOutput`, `InvoiceOutput`, `InvoiceItemOutput`, `NextInvoiceCodeOutput`. Input DTOs
with their constraints (choices: order status 1–6, source 1–2, payment method 1–2, product status 0–1, the 9 roles).
`ContractTest` asserts each route's role (403 for `ROLE_USER` where a role is required) and 501 otherwise.
`assets/types/openapi.json` + `api.d.ts` generated and committed. README "API reference" table with every row marked
`(item N)`. *Verify:* `openapi.json` lists every path; `npm run api:types`; `npm run typecheck`.

**0.8 The SPA shell.** `assets/react/app/{index.tsx,App.tsx,routes.tsx,providers/,styles/global.css}` — `routes.tsx`
holds **every** lazy route of the table below pointing at `@/pages/<slice>`; item 0 creates each page slice as a stub
(`pages/<slice>/index.ts` exporting a `ComingSoon` page) that its item replaces, so no two items edit `routes.tsx`.
`widgets/app-shell` (navbar with the signed-in email + Logout, sidebar: Products section (`ROLE_MANAGE_INVENTORY`:
Product list, Upload, Barcode reader, Incoming), Warehouses (`ROLE_MANAGE_WAREHOUSES`), Sales section: Orders
(`ROLE_UPDATE_ORDERS`), Invoices (`ROLE_UPDATE_INVOICES`), Customers (`ROLE_MANAGE_CUSTOMERS`), Admin: Users
(`ROLE_MANAGE_USERS`) — the same `is_granted` rules as `base.html.twig`), `entities/session`, `pages/login`,
`pages/not-found`, `shared/{api,i18n (en only),ui,lib,config,test}`. `shared/i18n/locales/en.json` seeded with
`common.*`, `nav.*`, `auth.*`, and one empty object per item prefix (`users`, `products`, `stock`, `customers`, `orders`,
`orderForm`, `gettingReady`, `invoices`). `e2e/{playwright.config, support/{test,signIn,mail}.ts, prepare.sh, smoke.sh,
auth.spec.ts}`; `docs/tests/ui-regression.md` baseline (Before you start, accounts: `sbarbosa115`/`123456` admin and a
new fixture user `inventory`/`123456` with `ROLE_MANAGE_INVENTORY` only; sections `1 Authentication and shell (AUTH, NAV)`,
`2 Products (INV)`, `3 Warehouses (WH)`, `4 Customers (CUS)`, `5 Orders (ORD)`, `6 Invoices (INVC)`, `7 Users (USR)`,
`8 Emails (MAIL)`, `9 WooCommerce webhook (HOOK)`, each empty section naming the item that fills it);
`Shared/UI/Cli/SmokePrepareCommand` (`app:smoke:prepare --seed` = fixtures + cache clear). *Verify:* `/admin/login` in the
browser, wrong password shows one generic message, the sidebar shows exactly today's entries per role, `npm test`
(app-shell, session, i18n), `e2e/auth.spec.ts` green (AUTH-01 – 05, NAV-01 – 03), no console errors.

**0.9 Deploy, CI, docs.** `deploy/cpanel-update.sh` (tacoma's, adapted: `~/kf-inventory`, `backend/`, checks
`MAILER_FROM_ADDRESS/MAILER_FROM_NAME/MAILER_PRINTER_ADDRESS/WOO_COMMERCE_*`, the one cron line
`flock -n ~/.kf-worker.lock <php> ~/kf-inventory/backend/bin/console messenger:consume mail --time-limit=55 --memory-limit=128M --env=prod --no-debug`,
`messenger:stop-workers` after a deploy, backup before a pending migration, the `serverVersion` check), `deploy/env.local.example`
(`APP_ENV=prod`, `APP_SECRET`, `DATABASE_URL` with `serverVersion=`, `DEFAULT_URI`, `MAILER_DSN`, `MAILER_FROM_ADDRESS`,
`MAILER_FROM_NAME`, `MAILER_PRINTER_ADDRESS`, `WOOCOMMERCE_<N>_URL/KEY/SECRET` (item 13), `ORDER_WEBHOOK_EMAIL_WAREHOUSE_ID=1`,
`MESSENGER_TRANSPORT_DSN=doctrine://default?auto_setup=0`), `deploy/htaccess-symfony.conf`, README sections
(Running it, Architecture table, API reference, Data model decisions — the drift and why it stays, Deploying to cPanel
with the cutover list: document root → `backend/public`, `.env.local`, run the script, add the cron line, everyone signs
in again, WooCommerce webhook URL unchanged), `docs/security/README.md` from the skill template, `.github/workflows/ci.yml`.
*Verify:* `gate.sh`, `dod.py --quick`, `split.py plan docs/pdr/prd-restructure.md`.

### The route map (every current route → its replacement)

Roles are **identical to today's** per endpoint (the two `ROLE_USER`-only groups included; see Decisions 11). Old GET
page URLs get a `301` in `config/routes/legacy_redirects.yaml`, added by the item that deletes the Twig page.

| Current | Role | New | Item |
|---|---|---|---|
| `GET /`, `GET /admin/` → redirect to products | — | SPA `/` → `/admin/products` (client redirect) | 0 |
| `GET/POST /admin/login` (`app_login`), `GET /logout` | public | SPA page `/admin/login`; `POST /api/v1/auth/login {username, password, remember_me?}` → `SessionOutput`; `POST /api/v1/auth/logout` → 204; `GET /api/v1/auth/me` | 0 |
| `GET /admin/test-email` | ROLE_USER | removed | 0 |
| `GET /admin/user/`, `/admin/user/new`, `/admin/user/edit/{user}` | ROLE_MANAGE_USERS | SPA `/admin/users`, `/admin/users/new`, `/admin/users/{id}/edit`; `GET /api/v1/users` (list `UserOutput {id, name, username, email, roles, enabled}`), `GET /api/v1/users/{id}`, `POST /api/v1/users` (201), `PUT /api/v1/users/{id}` (password optional: blank keeps the hash) | 1 |
| `GET /admin/warehouse/`, `/admin/warehouse/edit/{warehouse}`, `GET /admin/warehouse/all` | ROLE_USER | SPA `/admin/warehouses` (edit in a modal); `GET /api/v1/warehouses` (list `WarehouseOutput {id, name, urls}`), `PUT /api/v1/warehouses/{id} {name}` | 2 / 7 |
| `GET /admin/product/` , `GET /admin/product/all/{warehouse}/{status}` | ROLE_MANAGE_INVENTORY | SPA `/admin/products`; `GET /api/v1/warehouses/{id}/stock?status=1` (list `StockOutput {id, status, quantity, product_id, uuid, code, title, detail, price, warehouse: {id, name}}`) | 2 / 6 |
| `GET /admin/product/show/{code}` | ROLE_MANAGE_INVENTORY | `GET /api/v1/products/by-code/{code}` → `ProductOutput {id, uuid, code, title, detail, status, price, stock: [{warehouse_id, quantity}]}`, 404 `product_not_found` | 2 |
| `GET/POST /admin/product/new`, `/admin/product/edit/{uuid}` | ROLE_MANAGE_INVENTORY | SPA `/admin/products/new`, `/admin/products/{uuid}/edit`; `GET /api/v1/products/{uuid}`, `POST /api/v1/products` (201), `PUT /api/v1/products/{uuid}` (`{code, title, detail, status, price}`; same `NotEqualTo('·'/'CODE'/'PRODUCT')` rules) | 2 / 6 |
| `GET/POST /admin/product/upload` | ROLE_MANAGE_INVENTORY | SPA `/admin/products/upload`; `POST /api/v1/products/upload` multipart `file` (xls/xlsx) + `warehouse_id` → `UploadResultOutput {stored}`; 415 `unsupported_media`, 422 `invalid_spreadsheet` | 2 / 7 |
| `GET /admin/product/template/{all}` (+ `data[]`) | ROLE_MANAGE_INVENTORY | `GET /api/v1/products/template.xls?all=1` / `?uuid[]=…` (xls attachment; `findByUuids` bug fixed) | 2 / 6 / 7 |
| `POST /admin/product/move/{src}/{dst}` | ROLE_MANAGE_INVENTORY | `POST /api/v1/warehouses/{from}/moves/{to} {items: [{uuid|code, quantity}]}` → 204; 409 `same_warehouse`, 404 `stock_not_found`, 422 `insufficient_stock` (detail `{code, available}`) | 2 / 6 |
| `GET /admin/product/update/bar-code`, `POST …/{warehouse}/add`, `POST …/{warehouse}/remove` | ROLE_MANAGE_INVENTORY | SPA `/admin/products/barcode`; `POST /api/v1/warehouses/{id}/stock/add {items: [{code, quantity}]}` → 204; `POST /api/v1/warehouses/{id}/stock/remove` → 204, 422 `insufficient_stock` | 2 / 7 |
| `GET /admin/product/incoming`, `POST /admin/product/incoming/approve/{warehouse}` | ROLE_MANAGE_INVENTORY | SPA `/admin/products/incoming`; `POST /api/v1/warehouses/{id}/incoming/approve` → `{approved}` | 2 / 7 |
| `GET /admin/customer/?page=`, `GET /admin/customer/new`, `GET /admin/customer/edit/{customer}` | ROLE_MANAGE_CUSTOMERS | SPA `/admin/customers`, `/admin/customers/new`, `/admin/customers/{id}/edit`; `GET /api/v1/customers?page=&per_page=100` (page of `CustomerOutput {id, first_name, last_name, email, phone, addresses: [AddressOutput {id, address, zip_code, address_type, city: {id, name, state: {id, name, code, country: {id, name, code}}}}]}`), `GET /api/v1/customers/all` (pickers), `GET /api/v1/customers/{id}` | 3 / 8 |
| `POST /admin/customer/create`, `/admin/customer/update`, `DELETE /admin/customer/delete` (CSRF token) | ROLE_MANAGE_CUSTOMERS | `POST /api/v1/customers` (201), `PUT /api/v1/customers/{id}`, `DELETE /api/v1/customers/{id}` → 204 (soft delete through Gedmo, as today); 404 `customer_not_found` | 3 |
| (locations embedded in pages) | — | `GET /api/v1/locations` → list `CountryOutput {id, name, code, states: [{id, name, code, cities: [{id, name}]}]}` | 3 |
| `GET /admin/order/`, `GET /admin/order/all/{warehouse}` | ROLE_CAN_READ_ORDERS | SPA `/admin/orders`; `GET /api/v1/orders?warehouse_id=` (list `OrderOutput {id, code, status, source, payment_method, comment, created_at, warehouse: {id, name}, customer: {id, first_name, last_name, email, phone} | null, comments_count}`) | 4 / 9 |
| `GET /admin/order/detail/{order}` | ROLE_CAN_READ_ORDERS | `GET /api/v1/orders/{id}` → `OrderDetailOutput {…OrderOutput, customer with addresses, comments: [{id, content}], products: [{uuid, quantity, product: {code, title, detail}}]}` | 4 |
| `GET /admin/order/new`, `POST /admin/order/create` | ROLE_CAN_CREATE_ORDERS | SPA `/admin/orders/new`; `POST /api/v1/orders {code, status, source, payment_method, comment, warehouse_id, customer: {id?, first_name, last_name, email, phone, addresses: [...]}, products: [{uuid, quantity}], comments: [{content}]}` → 201 `OrderDetailOutput`; publishes `OrderPlaced` → the printer email on the `mail` queue; 422 `order_without_products` | 4 / 10 |
| `GET /admin/order/edit/{order}`, `POST /admin/order/update/{order}` | ROLE_CAN_UPDATE_ORDERS | SPA `/admin/orders/{id}/edit`; `PUT /api/v1/orders/{id}` → `OrderDetailOutput` | 4 / 10 |
| `POST /admin/order/edit/status/{order}/{status}` | ROLE_UPDATE_ORDERS | `POST /api/v1/orders/{id}/status {status: 1-6}` → `OrderDetailOutput` | 4 / 9 |
| `POST /admin/order/sync-comments/{order}` | ROLE_USER | `PUT /api/v1/orders/{id}/comments {comments: [{id|null, content}]}` → `{comments}` | 4 / 9 |
| `DELETE /admin/order/delete` (CSRF token) | ROLE_CAN_DELETE_ORDERS | `DELETE /api/v1/orders/{id}` → 204 (order products and comments hard-removed, order soft-deleted, same sequence) | 4 / 9 |
| `GET /admin/order/partial/getting-ready/{order}`, `GET /admin/order/partial/{order}`, `POST /admin/order/partial/{order}` | ROLE_USER | SPA `/admin/orders/{id}/getting-ready`; `GET /api/v1/orders/{id}/partials` → `OrderPartialsOutput {order_id, status, products_aggregate: [{uuid, quantity, product: {code}}], pending: [{uuid, quantity}], inventory: [StockOutput]}`; `POST /api/v1/orders/{id}/partials {items: [{uuid, quantity}]}` → same; 409 `partial_exceeds_order` (today a 500) | 4 / 10 |
| `GET /admin/order/pdf/{order}`, `GET /admin/order/pdf/remaining/{order}`, `GET /admin/order/xls/{order}` | ROLE_CAN_READ_ORDERS (xls: ROLE_USER) | `GET /api/v1/orders/{id}/pdf`, `/remaining-pdf` (`application/pdf`, same Twig), `/xls` (same headers/filename) — opened by the SPA in a new tab (cookie auth) | 4 |
| `/admin/order/sync` | ROLE_CAN_SYNC_ORDERS | `POST /api/v1/orders/sync` → 202 + the sync result (item 13 implements the WooCommerce REST pull; until it merges, 501 `order_sync_unavailable`) | 4, 13 / 9 |
| `POST|GET /admin/order/1H39j0jpQPsWL958v9R4` | public | **unchanged path**, `WooCommerceWebhookController` (warehouse by `X-WC-Webhook-Source` ∈ `warehouse.urls`; email only for warehouse `%ordering.webhook_email_warehouse_id%`; always `{status: true}`; unknown source logged) | 4 |
| `GET /admin/invoice/`, `GET /admin/invoice/all`, `GET /admin/invoice/detail/{invoice}` | ROLE_CAN_READ_INVOICES | SPA `/admin/invoices`; `GET /api/v1/invoices` (list `InvoiceOutput {id, code, customer, customer_address, comment, payment_method, items: [{id, description, quantity, unit_price, discount, total, product: {id, code} | null}], subtotal, tax_rate, tax_amount, total, created_at}`), `GET /api/v1/invoices/{id}` | 5 / 11 |
| `GET /admin/invoice/new`, `POST /admin/invoice/create` | ROLE_CAN_CREATE_INVOICES | SPA `/admin/invoices/new`; `GET /api/v1/invoices/next-code` → `{code}`; `POST /api/v1/invoices {code, payment_method, customer: {...} | id, customer_address, tax_rate, comment, items: [{product|null, description, quantity, unit_price, discount}]}` → 201; 409 `invoice_code_taken` (today 400) | 5 / 11 |
| `GET /admin/invoice/pdf/{invoice}` | ROLE_CAN_READ_INVOICES | `GET /api/v1/invoices/{id}/pdf` (same Twig, same logo lookup in `public/images/`) | 5 |
| `/translations/*` (Bazinga), `/js/routing` (FOSJsRouting) | — | removed; strings in `shared/i18n/locales/en.json`, paths in each `entities/*/api` | 0 |

### Regression-suite sections and i18n prefixes handed to items

| Item | Suite section / IDs | i18n prefix | CSS |
|---|---|---|---|
| 0 | 1 Authentication and shell: AUTH-01 – 05, NAV-01 – 03 | `common.*`, `nav.*`, `auth.*` | `app/styles/global.css`, `widgets/app-shell/ui/app-shell.css` |
| 1 | 7 Users: USR-01 – 06 | `users.*` | `pages/users/ui/users.css` |
| 4 | 9 WooCommerce webhook: HOOK-01 – 02 (manual, curl) | — | — |
| 6 | 2 Products: INV-01 – 08 | `products.*` | `pages/products/ui/products.css` |
| 7 | 2 Products: INV-09 – 16; 3 Warehouses: WH-01 – 03 | `stock.*` (`stock.upload`, `stock.barcode`, `stock.incoming`, `stock.warehouses`) | `pages/barcode-reader/ui/barcode.css` |
| 8 | 4 Customers: CUS-01 – 06 | `customers.*`, `address.*` | `widgets/address-form/ui/address-form.css` |
| 9 | 5 Orders: ORD-01 – 10 | `orders.*` | `pages/orders/ui/orders.css` |
| 10 | 5 Orders: ORD-11 – 18; 8 Emails: MAIL-01 – 02 | `orderForm.*`, `gettingReady.*` | `pages/order-getting-ready/ui/getting-ready.css` (the `row-selected-*` tints) |
| 11 | 6 Invoices: INVC-01 – 06 | `invoices.*` | `pages/invoice-form/ui/invoice-form.css` |

## Split

| # | Slug | Item | Owns (context / slice, files) | Tests first | Browser cases | Depends on | Model |
|---|---|---|---|---|---|---|---|
| 0 | contract | Repo move, Docker, Shared kernel, security, every entity moved with identical mapping, ports + adapters, API stubs + openapi/api.d.ts, SPA shell + login, tooling, deploy, docs | everything in "Contract (item 0)"; `docs/db/*`, `deploy/*`, `docker/*`, `src/Shared/**`, `src/*/Domain/Model/*`, `src/*/Domain/Repository/*`, `src/*/Infrastructure/Persistence/Doctrine*Repository.php`, `src/Audit/**`, `src/Identity/UI/Http/Security/*`, `SessionController`, all `UI/Http/{Input,Output}` DTOs and 501 controllers, `assets/react/{app,shared,widgets/app-shell,entities/session,pages/login,pages/not-found}`, page stubs, `e2e/{support,auth.spec.ts,prepare.sh,smoke.sh}`, `docs/tests/ui-regression.md` | `SchemaInvarianceTest`, `AuthApiTest`, `ContractTest` (route × role), `DomainError` unit tests, `app-shell`/`session`/`i18n` Vitest | AUTH-01 – 05, NAV-01 – 03 | — | — |
| 1 | identity | Users API and the Users screens | `Identity/Application/{Command/{CreateUser,UpdateUser}+Handlers,Query/Users}`, `Identity/UI/Http/Controller/UserController` (replaces the 501s), `Identity/UI/Cli/MigrateJsonColumnsCommand`; `pages/users`, `pages/user-form`, `entities/user`, `shared/config/roles.ts`; deletes `src/Controller/UserController.php`, `src/Form/UserType.php`, `templates/user/*`; redirects `/admin/user/*` | `UserApiTest` (list/create/update as `ROLE_MANAGE_USERS`, 403 as `ROLE_USER`, password blank keeps the hash, roles outside the 9 → 422), `UsersPage.test.tsx`, `UserForm.test.tsx` | USR-01 – 06 | 0 | sonnet |
| 2 | inventory-api | Stock, products, warehouses API (the rules of `ProductService`) | `Inventory/Application/**` (commands `UploadProducts, MoveStock, AddStock, RemoveStock, ApproveIncoming, CreateProduct, UpdateProduct, RenameWarehouse`, queries `Stock, Products, Warehouses`, ports `ProductSheetReader, ProductTemplateWriter`), `Inventory/Domain/Error/*` (`InsufficientStock` 422, `SameWarehouse` 409, `ProductNotFound`, `StockNotFound`, `WarehouseNotFound` 404, `InvalidSpreadsheet` 422), `Inventory/Infrastructure/Spreadsheet/*`, `Inventory/UI/Http/Controller/{ProductController,StockController,WarehouseController}`; README API rows; deletes no legacy file (the legacy pages still call them: item 12 does) | `StockApiTest` (move subtracts source / adds pending destination, same warehouse 409, more than available 422 with detail, add/remove by code, approve incoming flips status 0→1, list by status), `ProductApiTest` (by-code 404, create/update rules, template xls has the selected rows, upload xls stores and sums quantities as `ProductServiceTest` proves today), `WarehouseApiTest`, unit `ProductWarehouseTest` (`subQuantity` refusal) | — | 0 | opus |
| 3 | customers-api | Customers, addresses, locations API | `Customers/Application/**` (`SaveCustomer`, `DeleteCustomer`, `CustomerRegistry::addOrUpdate` with today's id → email → phone lookup and the find-or-create of country/state/city, queries `Customers`, `Locations`), `Customers/Domain/Error/CustomerNotFound`, `Customers/UI/Http/Controller/{CustomerController,LocationController}`; README API rows; deletes no legacy file (the legacy pages still call them: item 12 does) | `CustomerApiTest` (page 2 of 100, create with a new city/state/country creates them once, update replaces the address set, delete soft-deletes: row has `deleted_at`, GET → 404, 403 as `ROLE_USER`), `LocationApiTest` (tree shape), unit `CustomerRegistryTest` | — | 0 | sonnet |
| 4 | ordering-api | Orders API, partial shipments, PDFs/XLS, the printer email, the WooCommerce webhook | `Ordering/Application/**`, `Ordering/Domain/{Error/*,Event/OrderPlaced}`, `Ordering/Infrastructure/{Mail/OrderCreatedMailer,WooCommerce/WebhookOrderMapper,Persistence/OrderStatusHistoryListener}`, `Ordering/UI/Http/Controller/{OrderController,OrderPartialController,OrderDocumentController,WooCommerceWebhookController}`, `templates/pdf/order*.html.twig` (copies; the legacy `templates/order/pdf*.twig` stay for the legacy controller until item 12), `translations/messages.en.yaml` (keys kept; trimming to `notifications.*`, `order.pdf.*`, `order.xls.*`, `paytment_methods.*`, `comments`, `product.template.*`, `product.xls.*`, `invoice.pdf.*` is item 12's); **moves** `src/EventListener/OrderListener.php` to `Ordering/Infrastructure/Persistence/OrderStatusHistoryListener.php` (git mv, same tags in `services.yaml`: two listeners would write two status rows), and re-points the legacy `OrderController` webhook action at the new controller (the URL is one route); README rows; deletes no other legacy file (item 12 does) | `OrderApiTest` (ports `OrderControllerTest`/`OrderServiceTest`: create → status row, edit products, delete → 404 after, status change, comments sync), `OrderPartialApiTest` (ports `testPartialOrder`: aggregate/pending maths, second partial, third → 409), `OrderEmailTest` (one email to `MAILER_PRINTER_ADDRESS`, cc `sales@klassicfab.com`, subject `Order #<code> was created`, one PDF attachment `order-<id>.pdf`; none when the mailer params are empty, with a `log` row `mail`), `WebhookApiTest` (public, maps billing/shipping to two addresses, source matched on `warehouse.urls`, email only for warehouse 1, unknown source → 200 + log), `OrderDocumentsTest` (pdf/xls headers), unit `OrderTest` (`getAggregatePartials`, `getPendingOrderProductsQuantities`) | HOOK-01 – 02 | 0 | opus |
| 5 | invoicing-api | Invoices API and PDF | `Invoicing/Application/**` (`CreateInvoice`, `Invoices` incl. `nextCode()` with today's prefix/number rule), `Invoicing/Domain/Error/{InvoiceNotFound,InvoiceCodeTaken}`, `Invoicing/UI/Http/Controller/{InvoiceController,InvoiceDocumentController}`, `templates/pdf/invoice.html.twig`; README API rows; deletes no legacy file (the legacy pages still call them: item 12 does) | `InvoiceApiTest` (create with items, tax 6 % rounding as `InvoiceService`, duplicate code 409, customer by id vs payload, default address, next-code `20260001`/`INV-0002`/`X-1`, pdf headers, roles) | — | 0, 3 | sonnet |
| 6 | products-ui | Product list with selection, move-between-warehouses modal, download sheet, product form | `pages/products`, `pages/product-form`, `widgets/stock-table`, `features/move-stock`, `features/download-stock-sheet`, `entities/product`, `entities/warehouse`; deletes `assets/js/Products/{index.js,Index/*}`, `templates/product/{index,new,edit}.html.twig`, `src/Controller/ProductController.php` (its remaining actions moved by item 2), `src/Form/ProductType.php`, webpack entry `product`; redirects `/admin/product/`, `/admin/product/new`, `/admin/product/edit/{uuid}` | `StockTable.test.tsx` (warehouse switch reloads, select all, filter), `MoveStock.test.tsx` (quantity options 1..available, destination excludes source, posts `{items}`), `ProductForm.test.tsx` | INV-01 – 08 | 0, 2 | opus |
| 7 | stock-ui | Upload, barcode reader, incoming products, warehouses | `pages/products-upload`, `pages/barcode-reader`, `pages/incoming-stock`, `pages/warehouses`, `features/upload-products`, `features/scan-stock`, `features/approve-incoming`, `features/rename-warehouse`; deletes `assets/js/Products/{BarCode*,IncomingProducts*}`, `templates/product/{upload,bar-code,incoming}.html.twig`, `templates/warehouse/*`, `src/Controller/WarehouseController.php`, `src/Form/{UploadProductsType,WarehouseType}.php`, webpack entries `bar-code`, `incoming`; redirects `/admin/product/upload`, `/admin/product/update/bar-code`, `/admin/product/incoming`, `/admin/warehouse/*` | `ScanStock.test.tsx` (Enter adds, same code increments, exists-check states, confirm posts add/remove), `UploadProducts.test.tsx` (multipart, template links), `IncomingStock.test.tsx`, `Warehouses.test.tsx` | INV-09 – 16, WH-01 – 03 | 0, 2 | sonnet |
| 8 | customers-ui | Customers list (server pages) and form, the address widget | `pages/customers`, `pages/customer-form`, `widgets/address-form`, `features/delete-customer`, `entities/customer`, `entities/location`; deletes `assets/js/Customer/**`, `assets/js/Services/LocationManager.js`, `assets/js/Widgets/ConfirmModal.js`, `templates/customer/*`, `src/Controller/CustomerController.php`, webpack entries `customer*`; redirects `/admin/customer/*` | `AddressForm.test.tsx` (country → states → cities cascade, creatable new names with `id: null`, add/remove address), `Customers.test.tsx` (page links, delete confirm), `location.test.ts` (ports `LocationManager`) | CUS-01 – 06 | 0, 3 | sonnet |
| 9 | orders-ui | Orders list, status change, detail modal with comments, delete, sync, document links | `pages/orders`, `widgets/order-table`, `widgets/order-detail`, `features/{change-order-status,delete-order,sync-orders,edit-order-comments}`, `entities/order`; deletes `assets/js/Orders/{index.js,Index/*}`, `templates/order/index.html.twig`, webpack entry `order`; redirects `/admin/order/` | `OrderTable.test.tsx` (warehouse filter, status select → POST, status 5 navigates to getting-ready, buttons by `can*`), `OrderDetail.test.tsx` (tabs, comment add/save/remove → PUT), `DeleteOrder.test.tsx` | ORD-01 – 10 | 0, 4, 8 | opus |
| 10 | order-forms-ui | Order form (new/edit) and the getting-ready (partial) screen | `pages/order-form`, `pages/order-getting-ready`, `features/record-partial`; deletes `assets/js/Orders/{orderHandler.js,gettingReady.js,New/*,GettingReady/*}`, `templates/order/{new,edit,getting-ready}.html.twig`, webpack entries `order/*`; redirects `/admin/order/new`, `/admin/order/edit/{order}`, `/admin/order/partial/getting-ready/{order}` | `OrderForm.test.tsx` (valid only when customer, warehouse, a filled product, source, payment, status; warehouse locked once a product is filled; products reload per warehouse; create vs update), `RecordPartial.test.tsx` (ports `PartialHandler`: not-in-order / limit / inventory modals, +/−, `~` when complete, save disabled at status 5/6) | ORD-11 – 18, MAIL-01 – 02 | 0, 4, 6, 8 | opus |
| 11 | invoices-ui | Invoices list, detail modal, invoice form | `pages/invoices`, `pages/invoice-form`, `widgets/invoice-detail`, `features/add-all-products`, `entities/invoice`; deletes `assets/js/Invoice/**`, `templates/invoice/{index,new}.html.twig`, webpack entry `invoice`; redirects `/admin/invoice/*` | `InvoiceForm.test.tsx` (next code prefilled, product pick fills description/price, add all, subtotal/tax/total, at least one item, opens the PDF then goes to the list), `Invoices.test.tsx` | INVC-01 – 06 | 0, 5, 6, 8 | sonnet |
| 13 | woocommerce-sync | Real pull of orders from the WooCommerce REST API behind `POST /api/v1/orders/sync` | `Ordering/Application/Command/SyncRemoteOrders`+Handler, `Ordering/Application/Port/RemoteOrderSource`, `Ordering/Infrastructure/WooCommerce/RestRemoteOrderSource` (the `automattic/woocommerce` client), env rows in `deploy/env.local.example` and README; replaces item 4's 501 in `OrderController::sync` | `SyncOrdersApiTest` with a fake `RemoteOrderSource` (new remote orders created with customer + addresses, already-imported ones skipped, warehouse without credentials skipped, source error → 502 `order_sync_failed`, 403 without `ROLE_CAN_SYNC_ORDERS`), unit test of the idempotency key | ORD-19 – 20 | 0, 4 | opus |
| 12 | legacy-removal | Remove what is left of the Twig app and its tooling exceptions | `src/Controller/`, `src/Services/`, `src/Form/`, `templates/{base,form}/*`, `templates/*/` leftovers, `assets/js/`, `assets/css/`, legacy webpack entries, `symfony/form` + `twig` form theme deps if unused, `Legacy` layer in `deptrac*.yaml`, `excludePaths` in `phpstan.dist.neon`, `legacy` element in `eslint-fsd-boundaries.mjs`, `config/routes/legacy_redirects.yaml` final review, `Known gaps` and `Data model decisions` rows in README | the gate (`gate.sh`), `ContractTest` has no 501 left, `SchemaInvarianceTest` | — | 1, 6, 7, 9, 10, 11, 13 | haiku |

Waves: 1 → {1, 2, 3, 4}; 2 → {5, 6, 7, 8}; 3 → {9, 10, 11, 13}; 4 → {12}.

## Decisions

0. **Coordinator notes from item 0 (2026-10-05), binding on every item.**
   - Legacy PHP (`src/{Controller,Services,Form,Model,Repository,Validator,DataProviders,Command,Security,Constraints}`,
     `templates/<area>/`, `assets/js/`) keeps working until the screen that uses it is replaced. **API items delete no
     legacy file**; a UI item deletes the legacy controller actions, templates and JS entry of its screen; item 12
     deletes the rest (services, repositories, forms, and the `repositoryClass:` argument the moved entities keep for
     them). FOSJsRouting and Bazinga stay until item 12 (the legacy JS reads them).
   - The drift baseline is `backend/tests/Functional/Shared/baseline-drift.sql` (the php container mounts only
     `backend/`); `docs/db/README.md` explains the contract. `.claude/gate.d/schema-drift` runs the guard in `gate.sh`.
   - The old PHPUnit tests (broken on master: Symfony 4 test APIs) are in `backend/tests/Legacy`, a `legacy` suite that
     never runs by default. Read them for the behaviour to port; do not repair them.
   - The migrations do not match production exactly (`warehouse.url` was added outside them); the test and dev
     databases are built from them with three guard edits only. No production dump exists.
   - React stays 18 until item 12 (the legacy pages' `react-table` v6); item 12 moves to React 19 and to
     `splitEntryChunks()`.

1. **API prefix and casing.** `/api/v1/`, `snake_case` JSON (the serializer's name converter; PHP stays camelCase, no
   `#[SerializedName]`), ISO-8601 dates (`DATE_ATOM`), ids as integers (the tables' `INT` keys). Route names
   `api_<context>_<noun>_<verb>` (`api_orders_list`, `api_auth_login`). The webhook keeps its old name `order_create_webhook`.
2. **Errors.** Shape `{"error", "message", "detail"?, "violations"?}` from `ApiExceptionSubscriber`. Codes: Shared
   `validation_failed` 422, `invalid_json` 400, `unauthorized` 401, `forbidden` 403, `not_found` 404, `not_implemented` 501,
   `too_many_requests` 429; Identity `invalid_credentials`, `account_disabled` 401; Inventory `product_not_found`,
   `warehouse_not_found`, `stock_not_found` 404, `same_warehouse` 409, `insufficient_stock` 422 (`detail: {code, available}`),
   `invalid_spreadsheet` 422, `unsupported_media` 415; Customers `customer_not_found` 404; Ordering `order_not_found` 404,
   `order_without_products` 422, `partial_exceeds_order` 409, `order_sync_unavailable` 501, `order_sync_failed` 502; Invoicing `invoice_not_found`
   404, `invoice_code_taken` 409. The UI shows API errors by code through `shared/i18n` (`errors.<code>`).
3. **Auth for the SPA.** Same `user` table, same `bcrypt` hashes, same `roles` JSON, same `role_hierarchy`; session cookie
   (file sessions in `var/sessions`, `SameSite=Lax`, `HttpOnly`) + `json_login` at `POST /api/v1/auth/login`, `remember_me`
   kept (7 days). CSRF: the per-form tokens of the Twig deletes are replaced by `SameSite=Lax` plus the `SameOriginWrites`
   listener on every `/api/` write (403 from another origin). No login throttling and no `enabled` check at sign-in (user decision 2026-10-05: behaviour stays as today; both go to Known gaps).
4. **i18n.** Bazinga JS translations and FOSJsRouting are removed. UI strings live in `assets/react/shared/i18n/locales/en.json`
   (tacoma's `translator()`/`useTranslation()`, English only, keys by item prefix); `backend/translations/messages.en.yaml`
   keeps only what the server still renders (PDF templates, the order email subject/body, XLS headers and filenames),
   unchanged text. API paths are written in each `entities/*/api` module.
5. **PDFs and files.** PDFs and XLS stay server-rendered: Twig under `backend/templates/pdf/` + Dompdf (`PdfRenderer` port),
   PhpSpreadsheet for XLS, served by `GET /api/v1/...` endpoints with today's headers and filenames; the SPA opens them with
   `<a target="_blank">` (the session cookie authenticates). The product spreadsheet upload is `multipart/form-data` to
   `POST /api/v1/products/upload` (`InputMapper::form()` + the same MIME list; the controller passes the handler a path).
6. **Email.** `OrderPlaced` → `SendOrderCreatedEmail` after the commit → `QueuedMailer` on the `mail` doctrine transport
   (table `messenger_messages`, the only new table), drained by the `worker` service locally and by the cPanel cron line
   (every minute, `--time-limit=55`). Same sender (`MAILER_FROM_ADDRESS`/`NAME`), recipient (`MAILER_PRINTER_ADDRESS`),
   cc `sales@klassicfab.com` (parameter), subject `Order #%s was created`, text body, attachment `order-<id>.pdf`.
   Delivery is now up to ~60 s later and retried 3 times; a final failure lands in the `failed` transport
   (`messenger:failed:show`). Missing mailer params → no email and a `log` row `mail` as today.
7. **WooCommerce.** The webhook URL `/admin/order/1H39j0jpQPsWL958v9R4` does not change (public access rule, excluded from
   the SPA catch-all). "Email only when the warehouse id is 1" becomes `ORDER_WEBHOOK_EMAIL_WAREHOUSE_ID` (default 1).
   `POST /api/v1/orders/sync` **pulls orders from the WooCommerce REST API** (user decision 2026-10-05), built by item 13: per warehouse whose `urls` hold a WooCommerce source, credentials from env (`WOOCOMMERCE_<N>_URL/KEY/SECRET`, no table change), each remote order mapped by the same `WebhookOrderMapper` the webhook uses and skipped when an order with that remote id/code already exists (idempotent), same printer email rule. Item 4 leaves the endpoint answering 501 `order_sync_unavailable`; item 13 replaces it.
8. **Cutover of screens.** Each UI item deletes its Twig templates, legacy controller actions and JS entry in the same
   change, and adds `301` rows to `config/routes/legacy_redirects.yaml` for the old GET page URLs. The Twig `base.html.twig`
   and the remaining `assets/js` go in item 12. During the split the base branch serves both the SPA (`/admin/...` new
   paths) and the not-yet-replaced Twig pages (old paths).
9. **Bugs fixed on purpose** (each with a test): `ProductRepository::findByUuids` (`implode` makes the IN clause a single
   string: the "Update Selected Using Excel" download is empty unless one row is selected); `partial` on a completed order
   answers 409 instead of 500; `invoice_code_taken` is 409 instead of a 400 `{status: false}`; `/api/v1/customers/all` returns
   every customer (today's `findAllAsArray` inner-joins addresses, hiding customers without one from the order and invoice
   pickers); orders list left-joins the customer (today's inner join hides orders without one); `locations` no longer
   truncates to 100 countries when there are more than 1000. Everything else behaves as today.
10. **Lists.** Stock and orders return a warehouse's rows and the `DataTable` filters/pages in the browser (today's UX);
    customers paginate on the server (100/page) as today. A documented exception to §4.1's "lists paginate and accept `?q=`".
11. **Authorization stays per endpoint as today**, including the two loose groups: `sync-comments`, `partials`, order `xls`
    and the warehouses endpoints need only `ROLE_USER`. Written in the README's known gaps and raised in the security audit
    for a later decision; no item tightens them.
12. **Deptrac.** Layers as tacoma (`deptrac.yaml`), contexts as tacoma plus the `DomainModels` allowance (§B.4) and a
    temporary `Legacy` layer removed in item 12. The contexts baseline stays empty.
13. **Static analysis.** PHPStan level 6 for this refactor (legacy dirs excluded until item 12, with the reason), raised
    later; ESLint flat config + FSD boundaries with a `legacy` element for `assets/js/**` until item 12; the first fixer
    run is its own commit in `.git-blame-ignore-revs`.
14. **Tests.** PHPUnit against a MySQL `app_test` database built from the migrations (`dbname_suffix` + DAMA transactions),
    never SQLite (the migrations are MySQL-only, and the schema check needs the real engine). `tests/Support/{ApiTestCase,
    SignsIn}` (`loginUser()` with a user saved with the roles the test needs). Fixtures (`src/DataFixtures`) seed dev and
    the smoke stack only.
15. **Docker.** `DB_IMAGE` defaults to `mysql:8.0`, matching production's MySQL 8.x; the baseline is recorded on it. Every service has a
    `cpus` ceiling; host ports from the root `.env`.
16. **Models.** Item 6 and 7 could each be the other row of §2b.4; 6 is `opus` for the selection + per-row quantity modal
    state, 7 `sonnet` because each screen is a one-to-one port with the logic already written (risk: the barcode page; the
    agent is relaunched on opus if it fails the gate twice). Item 11 is `sonnet` for the same reason (its totals maths
    exists in `ManageInvoice.js`).

## Risks

- **The recorded drift is a trap for tooling.** `migrations:diff` will always propose the `roles`/`urls` changes; a
  generated migration applied by habit would alter production columns. `SchemaInvarianceTest` + `gate.d/schema-drift`
  catch any mapping change; the deploy script runs only committed migrations; the README forbids `schema:update --force`.
- **Fresh-DB build depends on the two guard edits** (§A.2). If a cPanel MariaDB is the real engine, `instanceof
  AbstractMySQLPlatform` still holds (MariaDB platforms extend it).
- **Production platform unknown** (DB engine/version, PHP version: the committed `public/.htaccess` selects `ea-php82`
  while `composer.json` requires PHP `^8.4` and Symfony 8). The deploy script refuses a mismatched `serverVersion` and a
  web PHP below 8.4, so this surfaces at the first deploy, not after.
- **Cutover** invalidates sessions and remember-me cookies once; the document root moves to `backend/public`; the cron
  line must exist or no order email leaves. All three are in the deploy checklist.
- **Queued email** changes timing (≤ 60 s) and failure handling (retries, `failed` queue) — agreed by the user, documented.
- **Legacy and new code coexist on the base branch** for the life of the split; a legacy `Repository/*` deleted by one
  API item while another item's legacy page still needs it would break that page. Mitigation: API items delete only the
  legacy files listed in their row; anything else goes to item 12.
- **React 19** with `react-select` ≥ 5.9 works; `react-table` v6 and `react-bootstrap4-modal` do not and are replaced.
- **Soft deletes**: every `get()` goes through the Gedmo filter, so a deleted order/customer is 404 as today; the delete
  sequence (hard-remove children, then soft-delete the aggregate) is copied exactly in the handlers.

## Answers from the user (2026-10-05)

1. Production runs **MySQL 8.x and PHP 8.4** → `mysql:8.0` in Docker, `serverVersion=8.0`; `public/.htaccess`'s `ea-php82` handler becomes `ea-php84`.
2. The `messenger_messages` table **may be added** (the only new table); order email goes through the queue.
3. The "Sync Orders" button gets a **real WooCommerce pull** → item 13.
4. Only the **plain bug fixes** of decision 9 go in. No `enabled` check at sign-in, no login throttling, permissions stay as today (decision 11).
5. Not asked, coordinator defaults: `InvoiceLine` is deleted from the code only (the deploy runs committed migrations only, so an `invoice_line` table in production, if any, is left untouched); old GET URLs (incl. `/admin/order/pdf/{id}`) get 301s to their replacements.

### Critical Files for Implementation
- /home/sbarbosa/Development/kf-inventory/config/packages/doctrine.yaml (becomes `backend/config/packages/doctrine.yaml`: per-context mappings, the naming strategy and table options that must not change)
- /home/sbarbosa/Development/kf-inventory/src/Entity/Order.php (the largest mapped aggregate and the one with cross-context associations, soft delete and the lifecycle quirk; the template for how every entity moves)
- /home/sbarbosa/Development/kf-inventory/migrations/Version20220514135034.php (the `DROP TABLE migration_versions` guard; with the `getName()` guards in the other 23 files, what makes a fresh DB buildable)
- /home/sbarbosa/Development/kf-inventory/config/packages/security.yaml (role hierarchy to copy byte-for-byte; the webhook public rule; replaced by the json_login firewall)
- /home/sbarbosa/Development/tacoma/backend/src/Shared/UI/Http/ApiExceptionSubscriber.php (with the rest of `tacoma/backend/src/Shared`, `deptrac*.yaml`, `docker-compose.yml` and `deploy/cpanel-update.sh`: the shape item 0 copies)