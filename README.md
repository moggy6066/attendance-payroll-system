# attendance-payroll-system

Complete Enterprise HR, Attendance, Payroll, Leave Management and User Management System - Arabic Language Support with RTL

## Features
- React 18 + Vite + Tailwind CSS frontend
- Node.js + Express.js backend
- PostgreSQL + Prisma ORM
- JWT authentication with RBAC
- Arabic (RTL) responsive UI
- Attendance, leave, payroll, employees, departments, users, reports, notifications
- Seeded data for 25 employees and default accounts

## Setup
```bash
npm install
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:5000/api

## Default credentials
- Super Admin: superadmin@company.com / SuperAdmin@123
- Admin: admin@company.com / Admin@123
- Employee: employee@company.com / Employee@123

## Production notes
- Copy `.env.example` to `.env` in `server` folder
- Configure PostgreSQL connection string
- Run Prisma migration or db push:
```bash
cd server
npm run db:push
npm run generate
npm run seed
```
