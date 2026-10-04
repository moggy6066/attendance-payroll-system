const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { verifyToken, authorize } = require('../middleware/auth');
const { z } = require('zod');
const { localDay, parseDay, localMinutesOfDay, hhmmToMinutes } = require('../utils/date');
const { runAbsenceJob, markAbsencesForDay, loadCalendar } = require('../services/absence');

const router = express.Router();
const prisma = new PrismaClient();

const LATE_GRACE_MINUTES = 15;

const checkInOutSchema = z.object({
  employeeId: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  qrCode: z.string().optional()
});

// Employees can only act on their own record; admins may pass any employeeId.
function resolveEmployeeId(req, requested) {
  if (req.user.role === 'EMPLOYEE') return req.user.employeeId || null;
  return requested || req.user.employeeId || null;
}

async function shiftFor(employee) {
  const settings = await prisma.setting.findMany({
    where: { key: { in: ['default_shift_start', 'default_shift_end'] } }
  });
  const byKey = Object.fromEntries(settings.map((s) => [s.key, s.value]));
  return {
    start: hhmmToMinutes(employee.shiftStart || byKey.default_shift_start, 8 * 60),
    end: hhmmToMinutes(employee.shiftEnd || byKey.default_shift_end, 17 * 60)
  };
}

router.post('/check-in', verifyToken, authorize(['EMPLOYEE', 'ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const validation = checkInOutSchema.safeParse(req.body || {});
    if (!validation.success) {
      return res.status(400).json({ message: 'Invalid data', errors: validation.error.flatten() });
    }

    const employeeId = resolveEmployeeId(req, validation.data.employeeId);
    if (!employeeId) return res.status(400).json({ message: 'No employee linked to this account' });

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    const now = new Date();
    const today = localDay(now);

    const existing = await prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId, date: today } }
    });
    if (existing?.checkIn) {
      return res.status(400).json({ message: 'Already checked in today' });
    }

    const shift = await shiftFor(employee);
    const nowMinutes = localMinutesOfDay(now);
    const lateMinutes = Math.max(0, nowMinutes - shift.start);
    const status = lateMinutes > LATE_GRACE_MINUTES ? 'LATE' : 'PRESENT';

    const attendance = await prisma.attendance.upsert({
      where: { employeeId_date: { employeeId, date: today } },
      update: { checkIn: now, lateMinutes, status },
      create: {
        employeeId,
        date: today,
        checkIn: now,
        lateMinutes,
        status,
        ipAddress: req.ip,
        deviceInfo: req.headers['user-agent'],
        gpsLatitude: validation.data.latitude,
        gpsLongitude: validation.data.longitude,
        locationVerified: validation.data.latitude !== undefined
      }
    });

    res.json({ message: 'Check-in successful', attendance });
  } catch (error) {
    res.status(500).json({ message: 'Check-in failed', error: error.message });
  }
});

router.post('/check-out', verifyToken, authorize(['EMPLOYEE', 'ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const validation = checkInOutSchema.safeParse(req.body || {});
    if (!validation.success) {
      return res.status(400).json({ message: 'Invalid data', errors: validation.error.flatten() });
    }

    const employeeId = resolveEmployeeId(req, validation.data.employeeId);
    if (!employeeId) return res.status(400).json({ message: 'No employee linked to this account' });

    const now = new Date();
    const today = localDay(now);

    const attendance = await prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId, date: today } },
      include: { employee: true }
    });

    if (!attendance?.checkIn) {
      return res.status(400).json({ message: 'No check-in found for today' });
    }
    if (attendance.checkOut) {
      return res.status(400).json({ message: 'Already checked out today' });
    }

    const shift = await shiftFor(attendance.employee);
    const nowMinutes = localMinutesOfDay(now);
    const workedMinutes = Math.max(0, Math.floor((now - attendance.checkIn) / 60000));
    const earlyDepartureMinutes = Math.max(0, shift.end - nowMinutes);
    const overtimeMinutes = Math.max(0, nowMinutes - shift.end);

    const updated = await prisma.attendance.update({
      where: { id: attendance.id },
      data: {
        checkOut: now,
        workingHours: Math.floor(workedMinutes / 60),
        earlyDepartureMinutes,
        overtimeMinutes,
        gpsLatitude: validation.data.latitude ?? attendance.gpsLatitude,
        gpsLongitude: validation.data.longitude ?? attendance.gpsLongitude
      }
    });

    res.json({ message: 'Check-out successful', attendance: updated });
  } catch (error) {
    res.status(500).json({ message: 'Check-out failed', error: error.message });
  }
});

// Today's record for the logged-in employee (used by the check-in card).
router.get('/today', verifyToken, async (req, res) => {
  try {
    if (!req.user.employeeId) return res.json({ attendance: null });
    const attendance = await prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId: req.user.employeeId, date: localDay() } }
    });
    res.json({ attendance });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch attendance', error: error.message });
  }
});

router.get('/employee/:employeeId', verifyToken, authorize(['EMPLOYEE', 'ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    if (req.user.role === 'EMPLOYEE' && req.params.employeeId !== req.user.employeeId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { startDate, endDate } = req.query;
    const filters = { employeeId: req.params.employeeId };
    const from = parseDay(startDate);
    const to = parseDay(endDate);
    if (from || to) {
      filters.date = {};
      if (from) filters.date.gte = from;
      if (to) filters.date.lte = to;
    }

    const attendance = await prisma.attendance.findMany({
      where: filters,
      orderBy: { date: 'desc' },
      take: from || to ? undefined : 60
    });

    const stats = {
      present: attendance.filter((a) => a.status === 'PRESENT').length,
      late: attendance.filter((a) => a.status === 'LATE').length,
      absent: attendance.filter((a) => a.status === 'ABSENT').length,
      onLeave: attendance.filter((a) => a.status === 'ON_LEAVE').length
    };

    res.json({ attendance, stats });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch attendance', error: error.message });
  }
});

router.get('/', verifyToken, authorize(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const { date, from, to, status, departmentId, employeeId } = req.query;
    const filters = {};

    const day = parseDay(date);
    const start = parseDay(from);
    const end = parseDay(to);
    if (day) filters.date = day;
    else if (start || end) {
      filters.date = {};
      if (start) filters.date.gte = start;
      if (end) filters.date.lte = end;
    }

    if (status) filters.status = status;
    if (employeeId) filters.employeeId = employeeId;
    if (departmentId) filters.employee = { departmentId };

    const attendance = await prisma.attendance.findMany({
      where: filters,
      include: { employee: { select: { id: true, fullName: true, employeeNumber: true, department: { select: { name: true } } } } },
      orderBy: [{ date: 'desc' }, { checkIn: 'asc' }],
      take: 1000
    });

    res.json(attendance);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch attendance', error: error.message });
  }
});

// POST /mark-absences  body: { date?: 'YYYY-MM-DD' }
// Without a date: runs the same catch-up as the hourly job. With a date: marks that single past day
// (ignores absence_tracking_start, still skips weekends/holidays and never overwrites records).
router.post('/mark-absences', verifyToken, authorize(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const { date } = req.body || {};
    if (!date) return res.json(await runAbsenceJob(prisma));
    const day = parseDay(date);
    if (!day) return res.status(400).json({ message: 'date must be YYYY-MM-DD' });
    if (day >= localDay()) return res.status(400).json({ message: 'Only past days can be marked (the day is still running).' });
    const calendar = await loadCalendar(prisma);
    return res.json(await markAbsencesForDay(prisma, day, calendar));
  } catch (error) {
    return res.status(500).json({ message: 'Failed to mark absences', error: error.message });
  }
});

module.exports = router;
