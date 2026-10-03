const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { verifyToken, authorize } = require('../middleware/auth');
const { z } = require('zod');

const router = express.Router();
const prisma = new PrismaClient();

const checkInOutSchema = z.object({
  employeeId: z.string(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  qrCode: z.string().optional()
});

router.post('/check-in', verifyToken, authorize(['EMPLOYEE', 'ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const validation = checkInOutSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: 'Invalid data', errors: validation.error.flatten() });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingAttendance = await prisma.attendance.findFirst({
      where: {
        employeeId: validation.data.employeeId,
        date: today
      }
    });

    if (existingAttendance?.checkIn) {
      return res.status(400).json({ message: 'Already checked in today' });
    }

    const shiftStart = new Date();
    shiftStart.setHours(8, 0, 0, 0);

    const now = new Date();
    const lateMinutes = now > shiftStart ? Math.floor((now - shiftStart) / 60000) : 0;
    const status = lateMinutes > 15 ? 'LATE' : 'PRESENT';

    const existing = await prisma.attendance.findFirst({
      where: { employeeId: validation.data.employeeId, date: today }
    });

    const attendance = existing
      ? await prisma.attendance.update({
          where: { id: existing.id },
          data: { checkIn: now, lateMinutes, status, ipAddress: req.ip, deviceInfo: req.headers['user-agent'], gpsLatitude: validation.data.latitude, gpsLongitude: validation.data.longitude, locationVerified: !!validation.data.latitude }
        })
      : await prisma.attendance.create({
          data: {
            employeeId: validation.data.employeeId,
            date: today,
            checkIn: now,
            lateMinutes,
            status,
            ipAddress: req.ip,
            deviceInfo: req.headers['user-agent'],
            gpsLatitude: validation.data.latitude,
            gpsLongitude: validation.data.longitude,
            locationVerified: !!validation.data.latitude
          }
        });

    res.json({ message: 'Check-in successful', attendance });
  } catch (error) {
    res.status(500).json({ message: 'Check-in failed', error: error.message });
  }
});

router.post('/check-out', verifyToken, authorize(['EMPLOYEE', 'ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const validation = checkInOutSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: 'Invalid data', errors: validation.error.flatten() });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await prisma.attendance.findFirst({
      where: {
        employeeId: validation.data.employeeId,
        date: today
      }
    });

    if (!attendance?.checkIn) {
      return res.status(400).json({ message: 'No check-in found for today' });
    }

    if (attendance.checkOut) {
      return res.status(400).json({ message: 'Already checked out today' });
    }

    const now = new Date();
    const shiftEnd = new Date();
    shiftEnd.setHours(17, 0, 0, 0);

    const workingHours = Math.floor((now - attendance.checkIn) / 3600000);
    const earlyDepartureMinutes = shiftEnd > now ? Math.floor((shiftEnd - now) / 60000) : 0;

    const updatedAttendance = await prisma.attendance.update({
      where: { id: attendance.id },
      data: {
        checkOut: now,
        workingHours,
        earlyDepartureMinutes,
        gpsLatitude: validation.data.latitude,
        gpsLongitude: validation.data.longitude
      }
    });

    res.json({ message: 'Check-out successful', attendance: updatedAttendance });
  } catch (error) {
    res.status(500).json({ message: 'Check-out failed', error: error.message });
  }
});

router.get('/employee/:employeeId', verifyToken, authorize(['EMPLOYEE', 'ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const filters = { employeeId: req.params.employeeId };

    if (startDate && endDate) {
      filters.date = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const attendance = await prisma.attendance.findMany({
      where: filters,
      orderBy: { date: 'desc' },
      take: 30
    });

    const stats = {
      present: attendance.filter(a => a.status === 'PRESENT').length,
      late: attendance.filter(a => a.status === 'LATE').length,
      absent: attendance.filter(a => a.status === 'ABSENT').length,
      onLeave: attendance.filter(a => a.status === 'ON_LEAVE').length
    };

    res.json({ attendance, stats });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch attendance', error: error.message });
  }
});

router.get('/', verifyToken, authorize(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const { date, status } = req.query;
    const filters = {};

    if (date) {
      const d = new Date(date);
      filters.date = d;
    }

    if (status) filters.status = status;

    const attendance = await prisma.attendance.findMany({
      where: filters,
      include: { employee: { include: { department: true } } },
      orderBy: { date: 'desc' }
    });

    res.json(attendance);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch attendance', error: error.message });
  }
});

module.exports = router;
