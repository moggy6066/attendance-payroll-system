#!/bin/sh
# Container start-up for the backend.
#   DB_PUSH=true  (default) apply the Prisma schema before starting. Never uses
#                 --accept-data-loss: if the change could lose data (e.g. the unique
#                 attendance constraint while duplicates exist) the container stops
#                 with instructions instead of touching the data.
#   RUN_SEED=true run the demo/initial seed once (first install only; not idempotent).
set -e

if [ "${DB_PUSH:-true}" = "true" ]; then
  echo "[entrypoint] applying database schema (prisma db push)"
  if ! npx prisma db push --skip-generate; then
    cat <<'MSG'

[entrypoint] Schema update was NOT applied. Nothing in the database was changed.
If this is an upgrade, the new unique (employee, day) attendance rule needs a check first:

  docker compose run --rm -e DB_PUSH=false backend npm run check-duplicates
  docker compose run --rm -e DB_PUSH=false backend npm run fix-duplicates      # only if duplicates were found
  docker compose run --rm -e DB_PUSH=false backend npx prisma db push --skip-generate --accept-data-loss
  docker compose up -d

See DOCKER.md for the full upgrade procedure (take a backup first).
MSG
    exit 1
  fi
fi

if [ "${RUN_SEED:-false}" = "true" ]; then
  echo "[entrypoint] running seed"
  node src/seed.js
fi

exec "$@"
