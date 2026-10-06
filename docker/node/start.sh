#!/bin/sh
# The node service's start (docker-compose.yml): install the packages when package-lock.json changed since the last
# install (a stamp in node_modules), then watch and rebuild the UI on every save, or, with UI_WATCH=0, build once and
# stay up so `docker compose exec node …` (tests, lint) still works.
set -e

STAMP=node_modules/.package-lock.sha
WANT=$(sha256sum package-lock.json | cut -d' ' -f1)
if [ ! -d node_modules ] || [ "$(cat "$STAMP" 2>/dev/null)" != "$WANT" ]; then
    npm install
    echo "$WANT" > "$STAMP"
fi

if [ "${UI_WATCH:-1}" = "1" ]; then
    exec npm run watch
fi
npm run dev
echo "UI built once (UI_WATCH=0): run 'docker compose exec node npm run dev' after changing assets."
exec tail -f /dev/null
