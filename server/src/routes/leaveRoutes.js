const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { verifyToken, authorize } = require('../middleware/auth');
const { z } = require('zod');
const { parseDay, daysBetweenInclusive } = require('../utils/date');
const { applyApprovedLeave } = require('../services/absence');

const router = express.Router();
const prisma = new PrismaClient();

// Accepts 'YYYY-MM-DD' or ISO datetime. `days` is optional and computed when missing.
const createLeaveSchema = z.object({
  type: z.enum(['ANNUAL', 'SICK', 'EMERGENCY', 'UNPAID']),
  startDate: z.string().min(10),
  endDate: z.string().min(10),
  days: z.coerce.number().int().min(1).optional(),
  reason: z.string().trim().min(3),
  employeeId: z.string().optional() // admins may file on behalf of an employee
});

const employeeSelect = { select: { id: true, fullName: true, employeeNumber: true, department: { select: { name: true } } } };

router.post('/', verifyToken, authorize(['EMPLOYEE', 'ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const validation = createLeaveSchema.safeParse(req.body || {});
    if (!validation.success) {
      return res.status(400).json({ message: 'Invalid data', errors: validation.error.flatten() });
    }
    const data = validation.data;

    const start = parseDay(data.startDate);
    const end = parseDay(data.endDate);
    if (!start || !end) return res.status(400).json({ message: 'Invalid start or end date' });
    if (end < start) return res.status(400).json({ message: 'End date must be on or after start date' });

    const employeeId = req.user.role === 'EMPLOYEE' ? req.user.employeeId : data.employeeId || req.user.employeeId;
    if (!employeeId) return res.status(400).json({ message: 'No employee linked to this account' });
    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    const overlap = await prisma.leaveRequest.findFirst({
      where: { employeeId, status: { in: ['PENDING', 'APPROVED'] }, startDate: { lte: end }, endDate: { gte: start } }
    });
    if (overlap) return res.status(409).json({ message: 'An overlapping leave request already exists' });

    const leave = await prisma.leaveRequest.create({
      data: {
        employeeId,
        type: data.type,
        startDate: start,
        endDate: end,
        days: data.days || daysBetweenInclusive(start, end),
        reason: data.reason,
        status: 'PENDING',
        managerId: employee.managerId
      },
      include: { employee: employeeSelect }
    });

    if (employee.managerId) {
      await prisma.notification.create({
        data: {
          employeeId: employee.managerId,
          title: 'طلب إجازة جديد',
          message: `${employee.fullName} قدم طلب إجازة`,
          type: 'INFO'
        }
      });
    }

    res.status(201).json(leave);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create leave request', error: error.message });
  }
});

router.get('/', verifyToken, authorize(['EMPLOYEE', 'ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const { status, employeeId } = req.query;
    const filters = {};

    if (status) filters.status = status;
    if (req.user.role === 'EMPLOYEE') filters.employeeId = req.user.employeeId || '__none__';
    else if (employeeId) filters.employeeId = employeeId;

    const leaves = await prisma.leaveRequest.findMany({
      where: filters,
      include: { employee: employeeSelect },
      orderBy: { createdAt: 'desc' }
    });

    res.json(leaves);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch leave requests', error: error.message });
  }
});

async function decide(req, res, status) {
  const existing = await prisma.leaveRequest.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: 'Leave request not found' });
  if (existing.status !== 'PENDING') {
    return res.status(400).json({ message: `Leave request is already ${existing.status}` });
  }

  const leave = await prisma.leaveRequest.update({
    where: { id: req.params.id },
    data: { status, approvedBy: req.user.userId },
    include: { employee: employeeSelect }
  });

  const approved = status === 'APPROVED';
  const attendanceSync = approved ? await applyApprovedLeave(prisma, leave) : null;
  const reason = (req.body && req.body.reason) || 'لم يتم تحديد السبب';
  await prisma.notification.create({
    data: {
      employeeId: leave.employeeId,
      title: approved ? 'تم الموافقة على الإجازة' : 'تم رفض الإجازة',
      message: approved ? 'تم الموافقة على طلب الإجازة الخاص بك' : `تم رفض طلب الإجازة. السبب: ${reason}`,
      type: approved ? 'SUCCESS' : 'WARNING'
    }
  });

  await prisma.auditLog.create({
    data: {
      userId: req.user.userId,
      action: `${approved ? 'Approved' : 'Rejected'} leave for ${leave.employee.fullName}`,
      ipAddress: req.ip
    }
  });

  return res.json(attendanceSync ? { ...leave, attendanceSync } : leave);
}

router.put('/:id/approve', verifyToken, authorize(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    await decide(req, res, 'APPROVED');
  } catch (error) {
    res.status(500).json({ message: 'Failed to approve leave', error: error.message });
  }
});

router.put('/:id/reject', verifyToken, authorize(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    await decide(req, res, 'REJECTED');
  } catch (error) {
    res.status(500).json({ message: 'Failed to reject leave', error: error.message });
  }
});

module.exports = router;
