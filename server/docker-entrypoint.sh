#!/bin/sh
# Container start-up for the backend.
#   DB_MIGRATE=true (default) apply pending Prisma migrations (prisma migrate deploy)
#                   before starting. Migrations live in server/prisma/migrations and are
#                   applied in order, once each; nothing is ever applied with data loss.
#   RUN_SEED=true   run the initial seed once (first install only).
set -e

# Local Prisma CLI (never npx: it could download a package at start-up).
PRISMA=/app/node_modules/.bin/prisma

if [ "${DB_MIGRATE:-true}" = "true" ]; then
  echo "[entrypoint] applying database migrations (prisma migrate deploy)"
  if ! out=$("$PRISMA" migrate deploy 2>&1); then
    echo "$out"
    if echo "$out" | grep -q "P3005"; then
      cat <<'MSG'

[entrypoint] This database was created before migrations were introduced (prisma db push).
It must be "baselined" ONCE. Nothing in the database was changed. Steps (take a backup first):

  ./scripts/backup.sh     # or the pg_dump command in DOCKER.md
  # 1) The live schema must match the schema in this version (exit code 0 = identical):
  docker compose run --rm -e DB_MIGRATE=false backend sh -c '/app/node_modules/.bin/prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --exit-code'
  # 2) Mark the initial migration as already applied:
  docker compose run --rm -e DB_MIGRATE=false backend /app/node_modules/.bin/prisma migrate resolve --applied 0_init
  docker compose up -d

If step 1 prints differences, see "Moving to migrations" in DOCKER.md before continuing.
MSG
    fi
    exit 1
  fi
  echo "$out" | tail -n 3
fi

if [ "${RUN_SEED:-false}" = "true" ]; then
  echo "[entrypoint] running seed"
  node src/seed.js
fi

exec "$@"
