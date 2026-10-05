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

echo "· worker, mail catcher, saved sessions"
# The worker keeps the old code and settings until it restarts.
docker compose up -d worker > /dev/null 2>&1
docker compose restart worker > /dev/null 2>&1
docker compose exec -T php sh -c 'wget -q -O /dev/null --method=DELETE http://mailpit:8025/api/v1/messages 2>/dev/null || curl -s -X DELETE http://mailpit:8025/api/v1/messages > /dev/null' || true
rm -rf backend/e2e/.results/auth
echo "· ready"
