const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { verifyToken, authorize } = require('../middleware/auth');
const { z } = require('zod');
const { monthRange } = require('../utils/date');

const router = express.Router();
const prisma = new PrismaClient();

// month accepts 10 or "10" (stored as string "10"); year accepts 2026 or "2026".
const createPayrollSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
  employeeIds: z.array(z.string()).optional()
});

const TOTAL_WORK_DAYS = 22; // average working days in a month
const employeeSelect = { select: { id: true, fullName: true, employeeNumber: true, department: { select: { name: true } } } };

async function calculatePayroll(employee, month, year) {
  const { start, end } = monthRange(month, year);

  const attendance = await prisma.attendance.findMany({
    where: { employeeId: employee.id, date: { gte: start, lte: end } }
  });

  const presentDays = attendance.filter((a) => a.status === 'PRESENT' || a.status === 'LATE').length;
  const lateDays = attendance.filter((a) => a.status === 'LATE').length;
  const absentDays = attendance.filter((a) => a.status === 'ABSENT').length;
  const overtimeMinutes = attendance.reduce((acc, a) => acc + (a.overtimeMinutes || 0), 0);

  const basicSalary = Number(employee.salary);
  const dailyRate = basicSalary / TOTAL_WORK_DAYS;
  const lateDeductions = lateDays * (dailyRate * 0.05) + absentDays * dailyRate;
  const netSalary = Math.max(0, basicSalary - lateDeductions);

  return {
    employeeId: employee.id,
    month: String(month),
    year,
    basicSalary,
    presentDays,
    absentDays,
    overtimeHours: Math.round((overtimeMinutes / 60) * 100) / 100,
    bonuses: 0,
    lateDeductions: Math.round(lateDeductions * 100) / 100,
    netSalary: Math.round(netSalary * 100) / 100,
    paid: false
  };
}

router.post('/generate', verifyToken, authorize(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
  try {
    const validation = createPayrollSchema.safeParse(req.body || {});
    if (!validation.success) {
      return res.status(400).json({ message: 'Invalid data', errors: validation.error.flatten() });
    }

    const { month, year, employeeIds } = validation.data;

    const employees = await prisma.employee.findMany({
      where: employeeIds && employeeIds.length > 0 ? { id: { in: employeeIds } } : { status: { in: ['ACTIVE', 'ON_LEAVE'] } }
    });

    const payrolls = [];
    let skipped = 0;
    for (const employee of employees) {
      const existing = await prisma.payroll.findFirst({
        where: { employeeId: employee.id, month: String(month), year }
      });
      if (existing) {
        skipped += 1;
        continue;
      }
      const payroll = await prisma.payroll.create({ data: await calculatePayroll(employee, month, year) });
      payrolls.push(payroll);
    }

    await prisma.auditLog.create({
      data: { userId: req.user.userId, action: `Generated payroll for ${month}/${year}`, ipAddress: req.ip }
    });

    res.json({ message: `Generated ${payrolls.length} payroll records`, generated: payrolls.length, skipped, payrolls });
  } catch (error) {
    res.status(500).json({ message: 'Failed to generate payroll', error: error.message });
  }
});

router.get('/', verifyToken, authorize(['SUPER_ADMIN', 'ADMIN', 'EMPLOYEE']), async (req, res) => {
  try {
    const { month, year, employeeId, paid } = req.query;
    const filters = {};

    if (month) filters.month = String(Number(month));
    if (year) filters.year = parseInt(year, 10);
    if (paid === 'true' || paid === 'false') filters.paid = paid === 'true';
    if (req.user.role === 'EMPLOYEE') filters.employeeId = req.user.employeeId || '__none__';
    else if (employeeId) filters.employeeId = employeeId;

    const payrolls = await prisma.payroll.findMany({
      where: filters,
      include: { employee: employeeSelect },
      orderBy: [{ year: 'desc' }, { generatedAt: 'desc' }]
    });

    res.json(payrolls);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch payroll', error: error.message });
  }
});

router.get('/:id', verifyToken, authorize(['SUPER_ADMIN', 'ADMIN', 'EMPLOYEE']), async (req, res) => {
  try {
    const payroll = await prisma.payroll.findUnique({
      where: { id: req.params.id },
      include: { employee: employeeSelect }
    });

    if (!payroll) return res.status(404).json({ message: 'Payroll not found' });
    if (req.user.role === 'EMPLOYEE' && payroll.employeeId !== req.user.employeeId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(payroll);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch payroll', error: error.message });
  }
});

router.put('/:id/mark-paid', verifyToken, authorize(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
  try {
    const existing = await prisma.payroll.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: 'Payroll not found' });

    const payroll = await prisma.payroll.update({
      where: { id: req.params.id },
      data: { paid: true },
      include: { employee: employeeSelect }
    });

    await prisma.notification.create({
      data: {
        employeeId: payroll.employeeId,
        title: 'تم صرف الراتب',
        message: `تم صرف راتب ${payroll.month}/${payroll.year}`,
        type: 'SUCCESS'
      }
    });

    res.json(payroll);
  } catch (error) {
    res.status(500).json({ message: 'Failed to mark payroll as paid', error: error.message });
  }
});

module.exports = router;
