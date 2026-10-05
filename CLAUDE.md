# Working on KF Inventory

Inventory, orders and invoices on Symfony + React, hosted on cPanel. Read `README.md` first (architecture, API
reference, data model decisions, known gaps) and, while it is open, `docs/pdr/prd-restructure.md` (the restructure:
its route map, its items and the decisions every item follows).

Features are built with the `symfony-react-app` skill: plan, a worktree per feature, test-first, the gate
(`gate.sh`), a security audit, the smoke suite (Playwright, green before anything is checked by hand), the manual
browser run of the cases left for a person, a PR.

## Running things

Everything runs in Docker; there is no PHP or Node on the host. Prefix commands:
`docker compose exec php php bin/console …`, `docker compose exec php composer test` (`composer test:prepare` first
on a new stack and after a migration), `docker compose exec node npm test`. The `node` service rebuilds the UI on
every save: check `docker compose logs node` instead of running a build. The smoke suite is `backend/e2e/smoke.sh`
(it **resets the stack's dev database** to the fixtures). Every service has a CPU ceiling: keep one on any service
you add (`.claude/gate.d/compose-cpus` checks it).

## Rules that are easy to break

- **The production database must not change.** No migration that alters an existing table, no renamed table or
  column, no `doctrine:schema:update --force`, no committed `migrations:diff` output: the drift it proposes
  (`user.roles`, `warehouse.urls`) is known and stays. An entity's mapping changes only with the user's say-so;
  `SchemaInvarianceTest` and `.claude/gate.d/schema-drift` catch any change. A new table is the user's decision.
- **Production is a cPanel account:** PHP 8.4 + MySQL 8, no always-on processes. Background work is the Messenger
  queue in the database drained by a cron line (`deploy/cpanel-update.sh`). A new env var goes in
  `deploy/env.local.example`. Dates are written in America/Bogota time (the server's PHP setting): keep it so.
- **Roles are production's.** Each endpoint asks for the role its legacy page asked for (the README's API table);
  the role hierarchy in `security.yaml` is copied byte for byte. The UI shows what the API allows through `useCan()`
  (the session carries every reachable role).
- **The API is `snake_case`** (the serializer's name converter). PHP stays camelCase; do not add
  `#[SerializedName]`. The legacy pages build their own serializers and keep their camelCase JSON.
- **The WooCommerce webhook URL** (`/admin/order/1H39j0jpQPsWL958v9R4`) is configured in the shops: it never moves.
- **The order email** goes to `MAILER_PRINTER_ADDRESS` with `sales@klassicfab.com` in cc (`ordering.order_email.cc`),
  subject "Order #<code> was created", the order PDF attached. Webhook orders send it only for warehouse
  `ORDER_WEBHOOK_EMAIL_WAREHOUSE_ID`.
- **Screens look like the legacy ones:** Bootstrap 4 CSS, Font Awesome, the dark SB Admin shell. Build lists with
  `DataTable`, dialogs with `Modal`/`ConfirmModal`, form fields with `Field`, frames with `PageCard`
  (`@/shared/ui`); every string through `useTranslation()` under the slice's i18n prefix.
- **Legacy code is the reference, not a place for new code.** `src/{Controller,Services,Form,Repository,…}`,
  `templates/<area>`, `assets/js` and `tests/Legacy` stay as they were until the item that replaces a screen
  deletes what only that screen used (item 12 deletes the rest). Read them for the behaviour to keep.
