const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { verifyToken, authorize } = require('../middleware/auth');
const { z } = require('zod');

const router = express.Router();
const prisma = new PrismaClient();

const createLeaveSchema = z.object({
  type: z.enum(['ANNUAL', 'SICK', 'EMERGENCY', 'UNPAID']),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  days: z.number().min(1),
  reason: z.string().min(5)
});

router.post('/', verifyToken, authorize(['EMPLOYEE', 'ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const validation = createLeaveSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: 'Invalid data', errors: validation.error.flatten() });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.userId }, include: { employee: true } });
    if (!user?.employee) return res.status(400).json({ message: 'Employee not found' });

    const leave = await prisma.leaveRequest.create({
      data: {
        employeeId: user.employee.id,
        type: validation.data.type,
        startDate: new Date(validation.data.startDate),
        endDate: new Date(validation.data.endDate),
        days: validation.data.days,
        reason: validation.data.reason,
        status: 'PENDING',
        managerId: user.employee.managerId
      },
      include: { employee: true }
    });

    await prisma.notification.create({
      data: {
        employeeId: user.employee.managerId,
        title: 'طلب إجازة جديد',
        message: `${user.employee.fullName} قدم طلب إجازة`,
        type: 'INFO'
      }
    });

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
    if (employeeId) filters.employeeId = employeeId;

    const leaves = await prisma.leaveRequest.findMany({
      where: filters,
      include: { employee: true },
      orderBy: { createdAt: 'desc' }
    });

    res.json(leaves);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch leave requests', error: error.message });
  }
});

router.put('/:id/approve', verifyToken, authorize(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const leave = await prisma.leaveRequest.update({
      where: { id: req.params.id },
      data: { status: 'APPROVED', approvedBy: req.user.userId },
      include: { employee: true }
    });

    await prisma.notification.create({
      data: {
        employeeId: leave.employeeId,
        title: 'تم الموافقة على الإجازة',
        message: 'تم الموافقة على طلب الإجازة الخاص بك',
        type: 'SUCCESS'
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: `Approved leave for ${leave.employee.fullName}`,
        ipAddress: req.ip
      }
    });

    res.json(leave);
  } catch (error) {
    res.status(500).json({ message: 'Failed to approve leave', error: error.message });
  }
});

router.put('/:id/reject', verifyToken, authorize(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const { reason } = req.body;

    const leave = await prisma.leaveRequest.update({
      where: { id: req.params.id },
      data: { status: 'REJECTED', approvedBy: req.user.userId },
      include: { employee: true }
    });

    await prisma.notification.create({
      data: {
        employeeId: leave.employeeId,
        title: 'تم رفض الإجازة',
        message: `تم رفض طلب الإجازة. السبب: ${reason || 'لم يتم تحديد السبب'}`,
        type: 'WARNING'
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: `Rejected leave for ${leave.employee.fullName}`,
        ipAddress: req.ip
      }
    });

    res.json(leave);
  } catch (error) {
    res.status(500).json({ message: 'Failed to reject leave', error: error.message });
  }
});

module.exports = router;
