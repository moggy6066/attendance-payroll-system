# Upgrading an existing installation

Follow these steps on the machine/server where the system already runs with real data.

## 1. Back up the database

```bash
pg_dump "$DATABASE_URL" > backup-$(date +%F).sql
```

## 2. Rotate the JWT secret (required)

The old `JWT_SECRET` was committed to Git and is public. Generate a new one and put it in
`server/.env` (never commit this file):

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

```env
JWT_SECRET="<paste the generated value>"
APP_TIMEZONE="Africa/Cairo"
```

The server refuses to start if `JWT_SECRET` is missing or shorter than 32 characters.
Every user will need to log in again after the change.

## 3. Pull and install

```bash
git pull
npm install            # root (workspaces: server + client)
```

## 4. Check for duplicate attendance rows, then update the schema

The schema now enforces one attendance row per employee per day.

```bash
cd server
npm run check-duplicates      # report only — changes nothing
npm run fix-duplicates        # only if duplicates were found: merges each group into one row
npm run check-duplicates      # must say "No duplicate attendance rows"
npx prisma db push --accept-data-loss
npx prisma generate
```

`--accept-data-loss` is needed because Prisma always warns when a unique constraint is added.
With zero duplicates nothing is deleted. Never use it before `check-duplicates` is clean.

## 5. Build the client and restart

```bash
cd ../client && npm run build
cd ../server && npm start
```

## 6. Settings to review (Settings page)

- **Weekly days off**: default Friday + Saturday. Untick Saturday if the company works on Saturdays.
- **Public holidays**: one `YYYY-MM-DD` per line.
- **Automatic absence start date**: created automatically on the first start (= that day), so no
  absences are back-filled for the period before the upgrade.

## Automatic absence job

- Runs on server start and every hour.
- For each past working day (not weekend, not holiday, on/after the start date) every active employee
  without an attendance record gets `ABSENT`, or `ON_LEAVE` if an approved leave covers that day.
- Existing records are never overwritten. Disable with `ABSENCE_JOB=off` in `server/.env`.
- Manual run: `npm run mark-absences`, or the "تسجيل غياب من لم يحضر" button on the Attendance page.

## Known caveat for old data

Before this upgrade, attendance dates could be saved one day early when the server's own timezone
was not UTC. Records created before the upgrade are not shifted automatically; check a few old
check-ins against the expected day if exact historical dates matter.

## Tests

```bash
cd server && npm test     # unit tests, no database needed
```
