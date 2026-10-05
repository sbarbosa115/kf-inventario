#!/usr/bin/env bash
# The smoke suite against this checkout's Docker stack: prepares the stack (e2e/prepare.sh), then runs Playwright in
# the e2e container. Arguments go to Playwright (a spec's name, -g "AUTH-01", --headed is not available in a container).
#
#   backend/e2e/smoke.sh                 everything
#   backend/e2e/smoke.sh orders          one spec
#   SMOKE_KEEP_DATA=1 backend/e2e/smoke.sh -g "AUTH-01"    without resetting the stack first
#
# The report is backend/e2e/.results/report.json (and html/); a failing test leaves its trace and a screenshot in
# backend/e2e/.results/artifacts.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

if [ -z "${SMOKE_KEEP_DATA:-}" ]; then
    backend/e2e/prepare.sh
fi
docker compose --profile e2e run --rm e2e npx playwright test "$@"
