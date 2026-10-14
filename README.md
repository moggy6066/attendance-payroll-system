# attendance-payroll-system

نظام متكامل لإدارة الحضور والانصراف، الرواتب، الإجازات، الموظفين، المستخدمين، التقارير والإعدادات.

## Stack
- Frontend: React + Vite + Tailwind CSS
- Backend: Node.js + Express.js
- Database: PostgreSQL + Prisma ORM
- Auth: JWT + RBAC

## First admin account
There are no default passwords. `npm run seed --workspace server` creates the first
super admin from `ADMIN_EMAIL` and `ADMIN_PASSWORD` (at least 12 characters) in `server/.env`.
Demo users (`SEED_DEMO=true`, never in production) use `DEMO_PASSWORD` — see `server/.env.example`.

## Install
```bash
npm install
npm run dev
```

## Local database (Docker)
```bash
docker compose -f docker-compose.dev.yml up -d   # PostgreSQL on 127.0.0.1:5432 (postgres/postgres)
```
Use `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/hr_attendance_db?schema=public"` in `server/.env`.

## Backend setup
```bash
cd server
cp .env.example .env
npx prisma generate
npx prisma migrate deploy
node src/seed.js
```

Before seeding, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` (min. 12 characters) in `server/.env`.
For local demo data add `SEED_DEMO=true` (ignored in production; demo password `Demo@12345` or `DEMO_PASSWORD`).

## Application URLs
- Frontend: http://localhost:5173
- Backend: http://localhost:5000

## Notes
The app is built to work in Arabic RTL mode with responsive UI, dark mode support, protected routes and role-based access control.
