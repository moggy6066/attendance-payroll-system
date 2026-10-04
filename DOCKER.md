# Running with Docker

Stack: `postgres` (data in the `postgres_data` volume) + `backend` (Node/Express/Prisma)
+ `frontend` (nginx serving the built React app and proxying `/api` to the backend).
Only the frontend is published: `http://<host>:8080` (change with `APP_PORT`).

All commands run from the repository root (the folder with `docker-compose.yml`).

## First install (empty database)

```bash
cp .env.docker.example .env
sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$(openssl rand -hex 64)/" .env
sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(openssl rand -hex 24)/" .env
sed -i "s/^RUN_SEED=.*/RUN_SEED=true/" .env        # create roles + initial users once

docker compose up -d --build
docker compose logs -f backend                     # wait for "Server listening"

sed -i "s/^RUN_SEED=.*/RUN_SEED=false/" .env       # never seed twice
docker compose up -d backend
```

Log in with the seeded admin and **change its password immediately** (Profile page).

## Upgrading an existing Docker installation (old docker-compose.yml)

The old compose file had the JWT secret hard-coded (now public in Git history), published
Postgres on port 5432 with password `postgres`, and served the app on port 5173.

```bash
# 0. While the OLD stack is still running: back up the database
mkdir -p backups
docker compose exec -T postgres pg_dump -U postgres -d hr_attendance_db | gzip > backups/before-upgrade-$(date +%F).sql.gz
ls -lh backups/                                    # must not be empty / tiny

# 1. Get the new code
git pull

# 2. Create .env. The existing volume keeps its OLD password, so keep "postgres" for now.
cp .env.docker.example .env
sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$(openssl rand -hex 64)/" .env
sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=postgres/" .env

# 3. Build the new images and start only the database
docker compose down
docker compose build
docker compose up -d postgres

# 4. Duplicate attendance check (required before the new unique rule)
docker compose run --rm -e DB_PUSH=false backend npm run check-duplicates
#    only if duplicates were found:
docker compose run --rm -e DB_PUSH=false backend npm run fix-duplicates
docker compose run --rm -e DB_PUSH=false backend npm run check-duplicates   # must say "No duplicate"
docker compose run --rm -e DB_PUSH=false backend npx prisma db push --skip-generate --accept-data-loss

# 5. Start everything
docker compose up -d
docker compose logs -f backend                     # "Server listening" = OK
```

The app is now on port **8080** (not 5173). Everyone has to log in again (new JWT secret).

### 6. Change the database password (recommended)

```bash
NEWPW=$(openssl rand -hex 24)
docker compose exec postgres psql -U postgres -c "ALTER USER postgres PASSWORD '$NEWPW';"
sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$NEWPW/" .env
docker compose up -d backend
```

If the old stack ran on an internet-facing server, port 5432 was open with password `postgres`;
treat that database as possibly accessed and review the users list.

If the backend container stops with "Schema update was NOT applied", it is step 4: nothing was
changed in the database.

## Day-to-day

```bash
docker compose ps
docker compose logs --tail=100 backend
docker compose exec -T postgres pg_dump -U postgres -d hr_attendance_db | gzip > backups/$(date +%F).sql.gz
docker compose run --rm -e DB_PUSH=false backend npm run mark-absences
```

Restore a backup (replaces current data):

```bash
gunzip -c backups/FILE.sql.gz | docker compose exec -T postgres psql -U postgres -d hr_attendance_db
```

## Environment (.env)

| Variable | Default | Notes |
|---|---|---|
| `JWT_SECRET` | required | `openssl rand -hex 64`; the server refuses to start if it is short |
| `POSTGRES_PASSWORD` | required | hex only (used inside the DB URL) |
| `APP_PORT` | 8080 | host port of the web app |
| `APP_TIMEZONE` | Africa/Cairo | calendar day for attendance/absences |
| `ABSENCE_JOB` | on | automatic absence marking |
| `DB_PUSH` | true | apply schema at start; never forces data loss |
| `RUN_SEED` | false | first install only |

For HTTPS put a reverse proxy (Caddy, nginx, Traefik) in front of port 8080 and set
`CLIENT_URL` to the public URL.

## Access without a domain

The app has logins and payroll data: do **not** leave plain `http://IP:8080` open to the internet.

### A) Office / home network only (simplest)
Keep `APP_BIND=0.0.0.0`, open `http://<server-LAN-IP>:8080` from devices on the same network,
and make sure port 8080 is **not** forwarded on the router.

### B) VPS, reachable from anywhere — HTTPS with a free sslip.io name (recommended)
`203-0-113-10.sslip.io` always resolves to `203.0.113.10`, so Caddy can get a real
Let's Encrypt certificate without buying a domain.

```bash
IP=$(curl -s https://api.ipify.org); HOST="$(echo $IP | tr . -).sslip.io"; echo $HOST
sed -i "s/^SITE_ADDRESS=.*/SITE_ADDRESS=$HOST/" .env
sed -i "s|^CLIENT_URL=.*|CLIENT_URL=https://$HOST|" .env
sed -i "s/^APP_BIND=.*/APP_BIND=127.0.0.1/" .env        # 8080 no longer public

# firewall (Ubuntu ufw): only SSH, 80, 443
sudo ufw allow OpenSSH && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw enable

docker compose --profile https up -d
docker compose logs -f caddy        # wait for "certificate obtained successfully"
```

Open `https://<HOST>`. Use `--profile https` on every later `up`/`down` command.
Note: Docker publishes ports through its own iptables rules, bypassing ufw — that is why
`APP_BIND=127.0.0.1` matters.

### C) Only a few people, no open ports at all — Tailscale
Install Tailscale on the server and on each user's phone/laptop, keep `APP_BIND=0.0.0.0`,
block 8080 in the cloud firewall, and open `http://<server-tailscale-ip>:8080`
(traffic is encrypted by Tailscale).
