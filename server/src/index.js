const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { verifyToken, authorize } = require('./middleware/auth');
const { localDay, formatDay } = require('./utils/date');
const { startAbsenceScheduler } = require('./services/absence');

const employeeRoutes = require('./routes/employeeRoutes');
const userRoutes = require('./routes/userRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const payrollRoutes = require('./routes/payrollRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const reportRoutes = require('./routes/reportRoutes');

dotenv.config();

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('FATAL: JWT_SECRET is missing or too short (min 32 chars). Set it in server/.env — see server/.env.example.');
  process.exit(1);
}

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
      process.env.JWT_SECRET,
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
    const today = localDay();
    const weekStart = new Date(today.getTime() - 6 * 86400000);
    const [employeeCount, todayAttendance, leavePending, latestPayroll, departments, weekAttendance] = await Promise.all([
      prisma.employee.count({ where: { status: { in: ['ACTIVE', 'ON_LEAVE'] } } }),
      prisma.attendance.groupBy({ by: ['status'], where: { date: today }, _count: { _all: true } }),
      prisma.leaveRequest.count({ where: { status: 'PENDING' } }),
      prisma.payroll.findFirst({ orderBy: [{ year: 'desc' }, { generatedAt: 'desc' }], select: { month: true, year: true } }),
      prisma.department.count(),
      prisma.attendance.groupBy({ by: ['date'], where: { date: { gte: weekStart, lte: today }, status: { in: ['PRESENT', 'LATE'] } }, _count: { _all: true } })
    ]);

    const count = (status) => todayAttendance.find((a) => a.status === status)?._count._all || 0;
    const present = count('PRESENT');
    const late = count('LATE');
    const onLeave = count('ON_LEAVE');
    const recorded = todayAttendance.reduce((acc, a) => acc + a._count._all, 0);
    const absent = count('ABSENT') + Math.max(0, employeeCount - recorded);

    let totalPayroll = 0;
    if (latestPayroll) {
      const agg = await prisma.payroll.aggregate({ where: { month: latestPayroll.month, year: latestPayroll.year }, _sum: { netSalary: true } });
      totalPayroll = Number(agg._sum.netSalary || 0);
    }

    const last7Days = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(today.getTime() - i * 86400000);
      const row = weekAttendance.find((w) => w.date.getTime() === d.getTime());
      last7Days.push({ date: formatDay(d), present: row?._count._all || 0 });
    }

    return res.json({
      date: formatDay(today),
      totalEmployees: employeeCount,
      presentToday: present + late,
      absentToday: absent,
      lateEmployees: late,
      onLeaveToday: onLeave,
      pendingLeave: leavePending,
      totalPayroll,
      payrollPeriod: latestPayroll ? `${latestPayroll.month}/${latestPayroll.year}` : null,
      attendanceRate: employeeCount ? Math.round(((present + late) / employeeCount) * 100) : 0,
      departments,
      last7Days
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to load dashboard summary', error: error.message });
  }
});

const EDITABLE_SETTINGS = [
  'company_name',
  'attendance_radius_meters',
  'default_shift_start',
  'default_shift_end',
  'timezone',
  'weekend_days',
  'holidays',
  'absence_tracking_start'
];

app.get('/api/settings', verifyToken, authorize(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
  try {
    const settings = await prisma.setting.findMany({ orderBy: { key: 'asc' } });
    return res.json(settings);
  } catch (error) {
    return res.status(500).json({ message: 'Unable to load settings', error: error.message });
  }
});

// Body: { "company_name": "...", "default_shift_start": "08:00", ... }
app.put('/api/settings', verifyToken, authorize(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
  try {
    const body = req.body || {};
    const unknown = Object.keys(body).filter((k) => !EDITABLE_SETTINGS.includes(k));
    if (unknown.length) return res.status(400).json({ message: `Unknown settings: ${unknown.join(', ')}` });
    for (const key of ['default_shift_start', 'default_shift_end']) {
      if (body[key] !== undefined && !/^\d{1,2}:\d{2}$/.test(String(body[key]))) {
        return res.status(400).json({ message: `${key} must be HH:MM` });
      }
    }
    if (body.weekend_days !== undefined && !/^([0-6](,[0-6])*)?$/.test(String(body.weekend_days).replace(/\s/g, ''))) {
      return res.status(400).json({ message: 'weekend_days must be comma-separated day numbers 0-6 (0 = Sunday)' });
    }
    if (body.weekend_days !== undefined) body.weekend_days = String(body.weekend_days).replace(/\s/g, '');
    if (body.holidays !== undefined) {
      const items = String(body.holidays).split(/[\s,]+/).filter(Boolean);
      const bad = items.filter((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d));
      if (bad.length) return res.status(400).json({ message: `Invalid holiday dates: ${bad.join(', ')}` });
      body.holidays = items.join(',');
    }
    if (body.absence_tracking_start !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(body.absence_tracking_start))) {
      return res.status(400).json({ message: 'absence_tracking_start must be YYYY-MM-DD' });
    }
    if (body.attendance_radius_meters !== undefined && !(Number(body.attendance_radius_meters) > 0)) {
      return res.status(400).json({ message: 'attendance_radius_meters must be a positive number' });
    }
    for (const [key, value] of Object.entries(body)) {
      await prisma.setting.upsert({ where: { key }, update: { value: String(value) }, create: { key, value: String(value) } });
    }
    await prisma.auditLog.create({ data: { userId: req.user.userId, action: `Updated settings: ${Object.keys(body).join(', ')}`, ipAddress: req.ip } });
    const settings = await prisma.setting.findMany({ orderBy: { key: 'asc' } });
    return res.json(settings);
  } catch (error) {
    return res.status(500).json({ message: 'Unable to save settings', error: error.message });
  }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Unexpected server error', error: err.message });
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
  startAbsenceScheduler(prisma);
});
