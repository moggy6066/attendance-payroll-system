const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { verifyToken, authorize } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

router.get('/attendance/daily', verifyToken, authorize(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
  try {
    const { date } = req.query;
    const d = new Date(date || new Date());
    d.setHours(0, 0, 0, 0);

    const attendance = await prisma.attendance.findMany({
      where: { date: d },
      include: { employee: { include: { department: true } } }
    });

    const summary = {
      total: attendance.length,
      present: attendance.filter(a => a.status === 'PRESENT').length,
      late: attendance.filter(a => a.status === 'LATE').length,
      absent: attendance.filter(a => a.status === 'ABSENT').length,
      onLeave: attendance.filter(a => a.status === 'ON_LEAVE').length
    };

    res.json({ summary, details: attendance });
  } catch (error) {
    res.status(500).json({ message: 'Failed to generate report', error: error.message });
  }
});

router.get('/attendance/monthly', verifyToken, authorize(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
  try {
    const { month, year } = req.query;
    const m = parseInt(month) || new Date().getMonth() + 1;
    const y = parseInt(year) || new Date().getFullYear();

    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 0);

    const attendance = await prisma.attendance.findMany({
      where: {
        date: { gte: startDate, lte: endDate }
      },
      include: { employee: { include: { department: true } } }
    });

    const byDepartment = {};
    attendance.forEach(a => {
      const dept = a.employee.department?.name || 'Unknown';
      if (!byDepartment[dept]) {
        byDepartment[dept] = { present: 0, late: 0, absent: 0, onLeave: 0 };
      }
      if (a.status === 'PRESENT') byDepartment[dept].present++;
      if (a.status === 'LATE') byDepartment[dept].late++;
      if (a.status === 'ABSENT') byDepartment[dept].absent++;
      if (a.status === 'ON_LEAVE') byDepartment[dept].onLeave++;
    });

    res.json({ period: `${m}/${y}`, byDepartment, total: attendance.length });
  } catch (error) {
    res.status(500).json({ message: 'Failed to generate report', error: error.message });
  }
});

router.get('/leaves/summary', verifyToken, authorize(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
  try {
    const { month, year } = req.query;
    const m = parseInt(month) || new Date().getMonth() + 1;
    const y = parseInt(year) || new Date().getFullYear();

    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 0);

    const leaves = await prisma.leaveRequest.findMany({
      where: {
        startDate: { lte: endDate },
        endDate: { gte: startDate }
      },
      include: { employee: true }
    });

    const summary = {
      pending: leaves.filter(l => l.status === 'PENDING').length,
      approved: leaves.filter(l => l.status === 'APPROVED').length,
      rejected: leaves.filter(l => l.status === 'REJECTED').length,
      byType: {
        annual: leaves.filter(l => l.type === 'ANNUAL').length,
        sick: leaves.filter(l => l.type === 'SICK').length,
        emergency: leaves.filter(l => l.type === 'EMERGENCY').length,
        unpaid: leaves.filter(l => l.type === 'UNPAID').length
      }
    };

    res.json(summary);
  } catch (error) {
    res.status(500).json({ message: 'Failed to generate report', error: error.message });
  }
});

router.get('/payroll/summary', verifyToken, authorize(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
  try {
    const { month, year } = req.query;
    const m = month || new Date().getMonth() + 1;
    const y = parseInt(year) || new Date().getFullYear();

    const payrolls = await prisma.payroll.findMany({
      where: { month: m.toString(), year: y },
      include: { employee: true }
    });

    const totalSalary = payrolls.reduce((acc, p) => acc + Number(p.netSalary), 0);
    const totalDeductions = payrolls.reduce((acc, p) => acc + Number(p.lateDeductions), 0);
    const paidCount = payrolls.filter(p => p.paid).length;

    res.json({
      period: `${m}/${y}`,
      totalRecords: payrolls.length,
      paidRecords: paidCount,
      totalSalary,
      totalDeductions,
      averageSalary: Math.round(totalSalary / payrolls.length)
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to generate report', error: error.message });
  }
});

router.get('/employees/by-department', verifyToken, authorize(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
  try {
    const departments = await prisma.department.findMany({
      include: {
        employees: {
          where: { status: 'ACTIVE' }
        }
      }
    });

    const report = departments.map(d => ({
      department: d.name,
      employeeCount: d.employees.length,
      employees: d.employees
    }));

    res.json(report);
  } catch (error) {
    res.status(500).json({ message: 'Failed to generate report', error: error.message });
  }
});

module.exports = router;
