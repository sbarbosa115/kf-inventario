# The database contract

Production's database must not change (`docs/pdr/prd-restructure.md`, "Database invariance"). Two files hold the
contract, both recorded from a MySQL 8.0 database built from `backend/migrations/` (no production dump was available,
so the migrations are the reference):

- `schema-from-migrations.sql`: `mysqldump --no-data` of that database (its first two lines are a header). A fresh stack must reproduce it byte for byte:
  `docker compose exec php composer test:prepare`, then
  `docker compose exec database mysqldump -uroot -proot --no-data --skip-comments --skip-dump-date app_test | sed 's/ AUTO_INCREMENT=[0-9]*//'`
  and compare with this file (after its two header lines).
- `backend/tests/Functional/Shared/baseline-drift.sql`: what Doctrine would change to match the mappings. It is the
  known drift (two columns mapped as `json` but created as `DC2Type:array`) and is never applied.
  `SchemaInvarianceTest` fails as soon as the mappings propose anything else; it runs with the suite and in the gate.

Never run `doctrine:schema:update --force` and never commit a `migrations:diff` that alters an existing table. A new
table is a decision for the user (the restructure added one: `messenger_messages`, for the order-email queue).

## Tables added by shops-settings

The user allowed new tables for `docs/pdr/prd-shops-settings.md` ("Answers from the user", 1): additive only, one
migration (`Version20261006000000`) that creates seven tables and foreign keys *from* them to `order`, `comment`,
`user` and `warehouse` (which adds nothing to those tables). `SchemaInvarianceTest` counts 23 entities and
`testNewTablesAreExactlyTheFeatureOnes` fails if any other table is mapped. `schema-from-migrations.sql` was
re-recorded with them (and with `messenger_messages`, which the restructure added after the first recording).

| Table | Context | Holds |
|---|---|---|
| `app_setting` | Settings | one row per setting (`email.dsn`, `analytics.ga4_id`, `webhooks.legacy_enabled`…); secrets sealed (`v1:…`) |
| `quick_phrase` | Settings | the comment box's quick phrases, ordered, `active` |
| `shop_connection` | Ordering | one WooCommerce shop: URL, sealed keys and webhook secret, warehouse, printer flag, capabilities, health |
| `shop_order_link` | Ordering | which shop (and shop order id) an order came from; remote and pushed status |
| `shop_delivery` | Ordering | the failed-deliveries inbox (body kept for Retry) |
| `shop_outbox` | Ordering | what the app writes back to a shop (order status, order note), with retries |
| `order_comment_meta` | Ordering | a comment's origin (app, shop, phrase), pin, shop note id, "sent to the shop" |

