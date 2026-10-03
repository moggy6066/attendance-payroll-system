const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { verifyToken, authorize } = require('../middleware/auth');
const { z } = require('zod');

const router = express.Router();
const prisma = new PrismaClient();

const createPayrollSchema = z.object({
  month: z.string(),
  year: z.number(),
  employeeIds: z.array(z.string()).optional()
});

async function calculatePayroll(employeeId, month, year) {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return null;

  const startDate = new Date(year, parseInt(month) - 1, 1);
  const endDate = new Date(year, parseInt(month), 0);

  const attendance = await prisma.attendance.findMany({
    where: {
      employeeId,
      date: { gte: startDate, lte: endDate }
    }
  });

  const leaves = await prisma.leaveRequest.findMany({
    where: {
      employeeId,
      startDate: { lte: endDate },
      endDate: { gte: startDate },
      status: 'APPROVED'
    }
  });

  const presentDays = attendance.filter(a => a.status === 'PRESENT').length;
  const lateDays = attendance.filter(a => a.status === 'LATE').length;
  const absentDays = attendance.filter(a => a.status === 'ABSENT').length;
  const leaveDays = leaves.reduce((acc, l) => acc + l.days, 0);
  const totalWorkDays = 22; // Average working days in a month

  const basicSalary = Number(employee.salary);
  const dailyRate = basicSalary / totalWorkDays;
  const lateDeductions = lateDays * (dailyRate * 0.05);
  const absentDeductions = absentDays * dailyRate;
  const netSalary = basicSalary - lateDeductions - absentDeductions;

  return {
    employeeId,
    month,
    year,
    basicSalary,
    presentDays,
    absentDays,
    overtimeHours: 0,
    bonuses: 0,
    lateDeductions,
    netSalary: Math.max(0, netSalary),
    paid: false
  };
}

router.post('/generate', verifyToken, authorize(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
  try {
    const validation = createPayrollSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: 'Invalid data', errors: validation.error.flatten() });
    }

    const { month, year, employeeIds } = validation.data;

    let employees;
    if (employeeIds && employeeIds.length > 0) {
      employees = await prisma.employee.findMany({
        where: { id: { in: employeeIds } }
      });
    } else {
      employees = await prisma.employee.findMany({
        where: { status: 'ACTIVE' }
      });
    }

    const payrolls = [];
    for (const employee of employees) {
      const payrollData = await calculatePayroll(employee.id, month, year);
      if (payrollData) {
        const existing = await prisma.payroll.findFirst({
          where: {
            employeeId: employee.id,
            month,
            year
          }
        });

        if (!existing) {
          const payroll = await prisma.payroll.create({
            data: payrollData
          });
          payrolls.push(payroll);
        }
      }
    }

    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: `Generated payroll for ${month}/${year}`,
        ipAddress: req.ip
      }
    });

    res.json({ message: `Generated ${payrolls.length} payroll records`, payrolls });
  } catch (error) {
    res.status(500).json({ message: 'Failed to generate payroll', error: error.message });
  }
});

router.get('/', verifyToken, authorize(['SUPER_ADMIN', 'ADMIN', 'EMPLOYEE']), async (req, res) => {
  try {
    const { month, year, employeeId } = req.query;
    const filters = {};

    if (month) filters.month = month;
    if (year) filters.year = parseInt(year);
    if (employeeId) filters.employeeId = employeeId;

    const payrolls = await prisma.payroll.findMany({
      where: filters,
      include: { employee: true },
      orderBy: { generatedAt: 'desc' }
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
      include: { employee: true }
    });

    if (!payroll) return res.status(404).json({ message: 'Payroll not found' });

    res.json(payroll);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch payroll', error: error.message });
  }
});

router.put('/:id/mark-paid', verifyToken, authorize(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
  try {
    const payroll = await prisma.payroll.update({
      where: { id: req.params.id },
      data: { paid: true }
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
