const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');
const { verifyToken, authorize } = require('./middleware/auth');
const { z } = require('zod');
const bcrypt = require('bcryptjs');

dotenv.config();

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'Attendance system API is running', timestamp: new Date().toISOString() });
});

app.get('/api/dashboard/overview', verifyToken, authorize(['SUPER_ADMIN', 'ADMIN', 'EMPLOYEE']), async (req, res) => {
  try {
    const [employeeCount, presentToday, lateToday, leaveRequests, payrollSummary] = await Promise.all([
      prisma.employee.count(),
      prisma.attendance.count({ where: { status: 'PRESENT' } }),
      prisma.attendance.count({ where: { status: 'LATE' } }),
      prisma.leaveRequest.count({ where: { status: 'PENDING' } }),
      prisma.payroll.aggregate({
        _sum: { netSalary: true },
      }),
    ]);

    res.json({
      employeeCount,
      presentToday,
      lateToday,
      pendingLeaveRequests: leaveRequests,
      payrollTotal: Number(payrollSummary._sum.netSalary || 0),
      activeDepartments: 6,
      attendanceRate: 88,
    });
  } catch (error) {
    res.status(500).json({ message: 'Unable to load dashboard overview', error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });
  }

  const { email, password } = parsed.data;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { role: true, employee: true },
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ message: 'Account is inactive or locked' });
    }

    const token = require('jsonwebtoken').sign(
      { userId: user.id, role: user.role.name, employeeId: user.employeeId },
      process.env.JWT_SECRET || 'super-secret-key-change-me',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    await prisma.loginHistory.create({
      data: {
        userId: user.id,
        device: req.headers['user-agent'] || 'Unknown',
        browser: 'Web Browser',
        ipAddress: req.ip,
      },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role.name,
        employee: user.employee ? {
          id: user.employee.id,
          fullName: user.employee.fullName,
          departmentId: user.employee.departmentId,
        } : null,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Login failed', error: error.message });
  }
});

app.get('/api/users', verifyToken, authorize(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: { role: true, employee: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Unable to fetch users', error: error.message });
  }
});

app.get('/api/employees', verifyToken, authorize(['SUPER_ADMIN', 'ADMIN', 'EMPLOYEE']), async (req, res) => {
  try {
    const employees = await prisma.employee.findMany({
      include: { department: true, manager: true, user: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(employees);
  } catch (error) {
    res.status(500).json({ message: 'Unable to fetch employees', error: error.message });
  }
});

app.get('/api/departments', verifyToken, authorize(['SUPER_ADMIN', 'ADMIN', 'EMPLOYEE']), async (req, res) => {
  try {
    const departments = await prisma.department.findMany({
      include: { employees: true },
      orderBy: { name: 'asc' },
    });
    res.json(departments);
  } catch (error) {
    res.status(500).json({ message: 'Unable to fetch departments', error: error.message });
  }
});

app.get('/api/attendance', verifyToken, authorize(['SUPER_ADMIN', 'ADMIN', 'EMPLOYEE']), async (req, res) => {
  try {
    const attendance = await prisma.attendance.findMany({
      include: { employee: true },
      orderBy: { date: 'desc' },
      take: 30,
    });
    res.json(attendance);
  } catch (error) {
    res.status(500).json({ message: 'Unable to fetch attendance', error: error.message });
  }
});

app.get('/api/leave-requests', verifyToken, authorize(['SUPER_ADMIN', 'ADMIN', 'EMPLOYEE']), async (req, res) => {
  try {
    const leaveRequests = await prisma.leaveRequest.findMany({
      include: { employee: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(leaveRequests);
  } catch (error) {
    res.status(500).json({ message: 'Unable to fetch leave requests', error: error.message });
  }
});

app.get('/api/payroll', verifyToken, authorize(['SUPER_ADMIN', 'ADMIN', 'EMPLOYEE']), async (req, res) => {
  try {
    const payrolls = await prisma.payroll.findMany({
      include: { employee: true },
      orderBy: { generatedAt: 'desc' },
    });
    res.json(payrolls);
  } catch (error) {
    res.status(500).json({ message: 'Unable to fetch payroll', error: error.message });
  }
});

app.get('/api/reports/summary', verifyToken, authorize(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
  try {
    const summary = {
      attendanceByStatus: {
        present: await prisma.attendance.count({ where: { status: 'PRESENT' } }),
        late: await prisma.attendance.count({ where: { status: 'LATE' } }),
        absent: await prisma.attendance.count({ where: { status: 'ABSENT' } }),
        onLeave: await prisma.attendance.count({ where: { status: 'ON_LEAVE' } }),
      },
      leaveCounts: {
        pending: await prisma.leaveRequest.count({ where: { status: 'PENDING' } }),
        approved: await prisma.leaveRequest.count({ where: { status: 'APPROVED' } }),
        rejected: await prisma.leaveRequest.count({ where: { status: 'REJECTED' } }),
      },
    };
    res.json(summary);
  } catch (error) {
    res.status(500).json({ message: 'Unable to fetch report summary', error: error.message });
  }
});

app.get('/api/notifications', verifyToken, authorize(['SUPER_ADMIN', 'ADMIN', 'EMPLOYEE']), async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: 'Unable to fetch notifications', error: error.message });
  }
});

app.get('/api/settings', verifyToken, authorize(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
  try {
    const settings = await prisma.setting.findMany();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: 'Unable to fetch settings', error: error.message });
  }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Unexpected server error', error: err.message });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;
