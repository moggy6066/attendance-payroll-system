const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { verifyToken, authorize } = require('./middleware/auth');

const employeeRoutes = require('./routes/employeeRoutes');
const userRoutes = require('./routes/userRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const payrollRoutes = require('./routes/payrollRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const reportRoutes = require('./routes/reportRoutes');

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

app.use('/api/employees', employeeRoutes);
app.use('/api/users', userRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leave-requests', leaveRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/reports', reportRoutes);

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
