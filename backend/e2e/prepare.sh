#!/usr/bin/env bash
# Prepares this checkout's Docker stack for a smoke run (e2e/smoke.sh calls it): the database rebuilt from the
# migrations and loaded with the fixtures (accounts, warehouses, products, customers, orders, invoices), an empty mail
# catcher. Run from anywhere inside the repository.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

console() { docker compose exec -T php php bin/console "$@"; }

echo "· database: drop, create, migrate"
console doctrine:database:drop --force --if-exists -q
console doctrine:database:create -q
console doctrine:migrations:migrate -n -q

echo "· fixtures"
console app:smoke:prepare --seed -q

echo "· FLT-05's 1,240 customers (flt-0001@flt.test …)"
# One statement instead of 1,240 API calls (minutes): the spec seeds through the API only what is missing here.
digits='(SELECT 0 d UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9)'
console dbal:run-sql -q "INSERT INTO customer (first_name, last_name, email, phone)
  SELECT 'Flt', CONCAT('Seed ', LPAD(n, 4, '0')), CONCAT('flt-', LPAD(n, 4, '0'), '@flt.test'), CONCAT('300', LPAD(n, 7, '0'))
  FROM (SELECT a.d * 1000 + b.d * 100 + c.d * 10 + e.d + 1 AS n FROM $digits a, $digits b, $digits c, $digits e) seq
  WHERE n <= 1240 ORDER BY n"

echo "· worker, mail catcher, saved sessions"
# The worker keeps the old code and settings until it restarts.
docker compose up -d worker > /dev/null 2>&1
docker compose restart worker > /dev/null 2>&1
docker compose exec -T php sh -c 'wget -q -O /dev/null --method=DELETE http://mailpit:8025/api/v1/messages 2>/dev/null || curl -s -X DELETE http://mailpit:8025/api/v1/messages > /dev/null' || true
rm -rf backend/e2e/.results/auth
echo "· ready"
