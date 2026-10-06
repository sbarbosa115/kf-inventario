# Working on KF Inventory

Inventory, orders and invoices on Symfony + React, hosted on cPanel. Read `README.md` first (architecture, API
reference, data model decisions, known gaps) and, while it is open, `docs/pdr/prd-restructure.md` (the restructure:
its route map, its items and the decisions every item follows) and `docs/pdr/prd-shops-settings.md` (Settings, shop
connections, server-side table filters, the comment timeline).

Features are built with the `symfony-react-app` skill: plan, a worktree per feature, test-first, the gate
(`gate.sh`), a security audit, the smoke suite, a PR. The smoke suite (Playwright, `smoke.py`) **is** the regression
run: `docs/tests/ui-regression.md` is smoke-only since the 2026-10-06 baseline
(`docs/tests/runs/2026-10-06-baseline.md`), so there is no manual browser run while that baseline holds. A feature
adds its cases there as smoke tests (one test per case, its title starting with the case's ID); what only the outside
world can show goes in the README's "Not covered by the smoke suite".

## Running things

Everything runs in Docker; there is no PHP or Node on the host. Prefix commands:
`docker compose exec php php bin/console …`, `docker compose exec php composer test` (`composer test:prepare` first
on a new stack and after a migration), `docker compose exec node npm test`. The `node` service rebuilds the UI on
every save: check `docker compose logs node` instead of running a build. The smoke suite is `backend/e2e/smoke.sh`
(it **resets the stack's dev database** to the fixtures; its Playwright lanes, some side by side, are in
`backend/playwright.config.ts`). Every service has a CPU ceiling: keep one on any service you add
(`.claude/gate.d/compose-cpus` checks it).

## Rules that are easy to break

- **The production database must not change.** No migration that alters an existing table, no renamed table or
  column, no `doctrine:schema:update --force`, no committed `migrations:diff` output: the drift it proposes
  (`user.roles`, `warehouse.urls`) is known and stays. An entity's mapping changes only with the user's say-so;
  `SchemaInvarianceTest` and `.claude/gate.d/schema-drift` catch any change. A new table is the user's decision
  (shops-settings added seven, `docs/db/README.md`; the test lists them).
- **Production is a cPanel account:** PHP 8.4 + MySQL 8, no always-on processes. Background work is the Messenger
  queue in the database drained by a cron line (`deploy/cpanel-update.sh`). A new env var goes in
  `deploy/env.local.example`. Dates are written in America/Bogota time (the server's PHP setting): keep it so.
- **Roles are production's.** Each endpoint asks for the role its legacy page asked for (the README's API table);
  the role hierarchy in `security.yaml` is copied byte for byte. The UI shows what the API allows through `useCan()`
  (the session carries every reachable role).
- **The API is `snake_case`** (the serializer's name converter). PHP stays camelCase; do not add
  `#[SerializedName]`. The legacy pages build their own serializers and keep their camelCase JSON.
- **WooCommerce webhooks are per connection:** `/webhooks/shops/{token}` (public; the token names the connection, the
  `X-WC-Webhook-Signature` is required). The legacy URL `/admin/order/1H39j0jpQPsWL958v9R4` was removed (the user,
  2026-10-06): it is a public tombstone that always answers 410 `{status: false, error: "webhook_moved"}`, places and
  stores nothing and counts the hit (Settings › General, the Orders warning). Keep its route and its `PUBLIC_ACCESS`
  line; never import through it again.
- **The order email** takes its sender, printer address and cc from Settings › Email first, the env as the fallback
  (`MAILER_FROM_*`, `MAILER_PRINTER_ADDRESS`, `ordering.order_email.cc` = `sales@klassicfab.com`); subject "Order
  #<code> was created", the order PDF attached. Shop orders send it when their connection prints orders
  (each connection has a "prints orders" switch in Settings › Shop connections).
- **Secrets at rest** (SMTP password, shop keys, webhook secrets) are sealed with Settings' `SecretBox`
  (`APP_ENCRYPTION_KEY`, 64 hex): never a raw secret in an Output DTO, a log line or an exception message; Outputs say
  `has_password`/`has_keys` instead.
- **Screens are built from the kit only** (`@/shared/ui`; `docs/design/README.md` says which component when; the
  dev-only page `/admin/_kit` shows them all): `PageHeader` (one primary action), `Toolbar` with `FilterChips` /
  `SearchBox` / `WarehouseSwitch`, `DataTable` (at most one visible row action, the rest in its "⋯" `RowMenu`; card
  mode under 600 px), `StatusBadge` (never colour alone), `Money`/`Num`/`useFormat()` for every figure, `SlideOver` for
  details and quick edits, pages with `FormLayout` + `FormSection` + `ActionBar` for forms, `ConfirmModal` before a
  destructive or state-changing action, `useToast()` after a save, `Skeleton` while loading. Bootstrap 4 stays under
  it. Colours, type, space and z-index come from the tokens (`shared/ui/styles/tokens.css`, light and dark): a slice's
  own CSS uses `var(--kf-*)` only — no hex colour outside `tokens.css` (a test checks), no screen-local button or
  table styles. Danger is for destructive actions only; Cancel and Close are never red. Every string goes through
  `useTranslation()` under the slice's prefix, in **both** `locales/en/<prefix>.json` and `locales/es/<prefix>.json`
  (a test keeps their keys identical; the glossary is in `docs/design/README.md`). Smoke specs match link and button
  names with `exact: true` where the shell has a similar one ("Products", "Scan", "More").
