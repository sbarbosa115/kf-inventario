# The database contract

Production's database must not change (`docs/pdr/prd-restructure.md`, "Database invariance"). Two files hold the
contract, both recorded from a MySQL 8.0 database built from `backend/migrations/` (no production dump was available,
so the migrations are the reference):

- `schema-from-migrations.sql`: `mysqldump --no-data` of that database. A fresh stack must reproduce it byte for byte:
  `docker compose exec php composer test:prepare`, then
  `docker compose exec database mysqldump -uroot -proot --no-data --skip-comments --skip-dump-date app_test | sed 's/ AUTO_INCREMENT=[0-9]*//'`
  and compare with this file (after its two header lines).
- `backend/tests/Functional/Shared/baseline-drift.sql`: what Doctrine would change to match the mappings. It is the
  known drift (two columns mapped as `json` but created as `DC2Type:array`) and is never applied.
  `SchemaInvarianceTest` fails as soon as the mappings propose anything else; it runs with the suite and in the gate.

Never run `doctrine:schema:update --force` and never commit a `migrations:diff` that alters an existing table. A new
table is a decision for the user (the restructure added one: `messenger_messages`, for the order-email queue).
