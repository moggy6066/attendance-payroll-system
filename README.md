# attendance-payroll-system

نظام متكامل لإدارة الحضور والانصراف، الرواتب، الإجازات، الموظفين، المستخدمين، التقارير والإعدادات.

## Stack
- Frontend: React + Vite + Tailwind CSS
- Backend: Node.js + Express.js
- Database: PostgreSQL + Prisma ORM
- Auth: JWT + RBAC

## Default accounts
- Super Admin: superadmin@company.com / SuperAdmin@123
- Admin: admin@company.com / Admin@123
- Employee: employee@company.com / Employee@123

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
