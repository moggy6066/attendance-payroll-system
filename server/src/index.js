const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { verifyToken, authorize } = require('./middleware/auth');

dotenv.config();
const app = express();
const prisma = new PrismaClient();
const port = process.env.PORT || 5000;

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(morgan('dev'));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'Attendance system API is running', timestamp: new Date().toISOString() });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: String(email).toLowerCase() },
      include: { role: true, employee: true }
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ message: 'Account is not active.' });
    }

    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role.name,
        employeeId: user.employeeId,
        email: user.email,
      },
      process.env.JWT_SECRET || 'super-secret-key-change-me',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role.name,
        employee: user.employee
      }
    });
  } catch (error) {
    return res.status(500).json({ message: 'Login failed', error: error.message });
  }
});

app.get('/api/users', verifyToken, authorize(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: { role: true, employee: true },
      orderBy: { createdAt: 'desc' }
    });
    return res.json(users);
  } catch (error) {
    return res.status(500).json({ message: 'Unable to load users', error: error.message });
  }
});

app.get('/api/dashboard/summary', verifyToken, authorize(['SUPER_ADMIN', 'ADMIN', 'EMPLOYEE']), async (req, res) => {
  try {
    const [employeeCount, presentCount, lateCount, absentCount, leavePending, totalPayroll] = await Promise.all([
      prisma.employee.count(),
      prisma.attendance.count({ where: { status: 'PRESENT' } }),
      prisma.attendance.count({ where: { status: 'LATE' } }),
      prisma.attendance.count({ where: { status: 'ABSENT' } }),
      prisma.leaveRequest.count({ where: { status: 'PENDING' } }),
      prisma.payroll.aggregate({ _sum: { netSalary: true } })
    ]);

    return res.json({
      totalEmployees: employeeCount,
      presentToday: presentCount,
      absentToday: absentCount,
      lateEmployees: lateCount,
      pendingLeave: leavePending,
      totalPayroll: Number(totalPayroll._sum.netSalary || 0),
      attendanceRate: 88,
      departments: 6
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to load dashboard summary', error: error.message });
  }
});

app.get('/api/employees', verifyToken, authorize(['SUPER_ADMIN', 'ADMIN', 'EMPLOYEE']), async (req, res) => {
  try {
    const employees = await prisma.employee.findMany({
      include: { department: true, manager: true, user: true },
      orderBy: { createdAt: 'desc' }
    });
    return res.json(employees);
  } catch (error) {
    return res.status(500).json({ message: 'Unable to load employees', error: error.message });
  }
});

app.get('/api/departments', verifyToken, authorize(['SUPER_ADMIN', 'ADMIN', 'EMPLOYEE']), async (req, res) => {
  try {
    const departments = await prisma.department.findMany({
      include: { employees: true },
      orderBy: { name: 'asc' }
    });
    return res.json(departments);
  } catch (error) {
    return res.status(500).json({ message: 'Unable to load departments', error: error.message });
  }
});

app.get('/api/attendance', verifyToken, authorize(['SUPER_ADMIN', 'ADMIN', 'EMPLOYEE']), async (req, res) => {
  try {
    const attendance = await prisma.attendance.findMany({
      include: { employee: true },
      orderBy: { date: 'desc' },
      take: 30
    });
    return res.json(attendance);
  } catch (error) {
    return res.status(500).json({ message: 'Unable to load attendance data', error: error.message });
  }
});

app.get('/api/leave-requests', verifyToken, authorize(['SUPER_ADMIN', 'ADMIN', 'EMPLOYEE']), async (req, res) => {
  try {
    const leaveRequests = await prisma.leaveRequest.findMany({
      include: { employee: true },
      orderBy: { createdAt: 'desc' }
    });
    return res.json(leaveRequests);
  } catch (error) {
    return res.status(500).json({ message: 'Unable to load leave requests', error: error.message });
  }
});

app.get('/api/payroll', verifyToken, authorize(['SUPER_ADMIN', 'ADMIN', 'EMPLOYEE']), async (req, res) => {
  try {
    const payroll = await prisma.payroll.findMany({
      include: { employee: true },
      orderBy: { generatedAt: 'desc' }
    });
    return res.json(payroll);
  } catch (error) {
    return res.status(500).json({ message: 'Unable to load payroll', error: error.message });
  }
});

app.get('/api/reports/summary', verifyToken, authorize(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
  try {
    const [present, late, absent, onLeave, pendingLeave, approvedLeave] = await Promise.all([
      prisma.attendance.count({ where: { status: 'PRESENT' } }),
      prisma.attendance.count({ where: { status: 'LATE' } }),
      prisma.attendance.count({ where: { status: 'ABSENT' } }),
      prisma.attendance.count({ where: { status: 'ON_LEAVE' } }),
      prisma.leaveRequest.count({ where: { status: 'PENDING' } }),
      prisma.leaveRequest.count({ where: { status: 'APPROVED' } })
    ]);

    return res.json({
      attendanceByStatus: { present: present, late: late, absent: absent, onLeave: onLeave },
      leaveStatus: { pending: pendingLeave, approved: approvedLeave }
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to load reports', error: error.message });
  }
});

app.get('/api/settings', verifyToken, authorize(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
  try {
    const settings = await prisma.setting.findMany();
    return res.json(settings);
  } catch (error) {
    return res.status(500).json({ message: 'Unable to load settings', error: error.message });
  }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Unexpected server error', error: err.message });
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
