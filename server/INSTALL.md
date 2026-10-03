# Backend Installation Guide

## Prerequisites
- Node.js v16+
- PostgreSQL 12+

## Installation Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Create .env File
```bash
cp .env.example .env
```

Update the values in `.env`:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/hr_attendance_db?schema=public"
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="7d"
PORT=5000
CLIENT_URL="http://localhost:5173"
```

### 3. Setup Database

Create PostgreSQL database:
```bash
psql -U postgres -c "CREATE DATABASE hr_attendance_db;"
```

### 4. Initialize Prisma
```bash
npx prisma generate
npx prisma db push
```

### 5. Seed Sample Data
```bash
node src/seed.js
```

### 6. Start Server
```bash
npm run dev
```

Server will run on `http://localhost:5000`

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login

### Dashboard
- `GET /api/dashboard/summary` - Get dashboard summary

### Employees
- `GET /api/employees` - List all employees

### Users
- `GET /api/users` - List all users (Admin only)

### Attendance
- `GET /api/attendance` - List attendance records

### Leave Requests
- `GET /api/leave-requests` - List leave requests

### Payroll
- `GET /api/payroll` - List payroll records

### Reports
- `GET /api/reports/summary` - Get reports summary

### Settings
- `GET /api/settings` - Get system settings

## Environment Variables

| Variable | Description | Default |
|----------|-------------|----------|
| DATABASE_URL | PostgreSQL connection string | Required |
| JWT_SECRET | Secret key for JWT tokens | Required |
| JWT_EXPIRES_IN | Token expiration time | 7d |
| PORT | Server port | 5000 |
| CLIENT_URL | Frontend URL for CORS | http://localhost:5173 |

## Troubleshooting

### Error: connect ECONNREFUSED
**Solution**: Make sure PostgreSQL is running
```bash
psql -U postgres -c "SELECT 1"
```

### Error: Cannot find module
**Solution**: Reinstall dependencies
```bash
rm -rf node_modules
npm install
```

### Error: relation "User" does not exist
**Solution**: Run migrations
```bash
npx prisma db push
npx prisma migrate reset
node src/seed.js
```
