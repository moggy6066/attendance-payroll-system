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

## Backend setup
```bash
cd server
cp .env.example .env
npx prisma generate
npx prisma db push
node src/seed.js
```

## Application URLs
- Frontend: http://localhost:5173
- Backend: http://localhost:5000

## Notes
The app is built to work in Arabic RTL mode with responsive UI, dark mode support, protected routes and role-based access control.
