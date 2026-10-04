const express = require('express');
const ExcelJS = require('exceljs');
const { renderTablePdf } = require('../utils/pdf');
const { PrismaClient } = require('@prisma/client');
const { verifyToken, authorize } = require('../middleware/auth');
const { localDay, parseDay, monthRange, formatDay, APP_TIMEZONE } = require('../utils/date');

const router = express.Router();
const prisma = new PrismaClient();
const ADMINS = ['SUPER_ADMIN', 'ADMIN'];

const STATUS_AR = { PRESENT: 'حاضر', LATE: 'متأخر', ABSENT: 'غائب', ON_LEAVE: 'إجازة' };
const LEAVE_TYPE_AR = { ANNUAL: 'سنوية', SICK: 'مرضية', EMERGENCY: 'طارئة', UNPAID: 'بدون راتب' };
const LEAVE_STATUS_AR = { PENDING: 'قيد المراجعة', APPROVED: 'موافق عليها', REJECTED: 'مرفوضة' };

function timeInZone(date) {
  if (!date) return '';
  return new Intl.DateTimeFormat('en-GB', { timeZone: APP_TIMEZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
}

// ---------- report builders (shared by JSON endpoints and Excel export) ----------

async function dailyAttendance(query) {
  const day = parseDay(query.date) || localDay();
  const attendance = await prisma.attendance.findMany({
    where: { date: day },
    include: { employee: { include: { department: true } } },
    orderBy: { checkIn: 'asc' }
  });
  const activeEmployees = await prisma.employee.count({ where: { status: { in: ['ACTIVE', 'ON_LEAVE'] } } });
  const summary = {
    date: formatDay(day),
    total: attendance.length,
    present: attendance.filter((a) => a.status === 'PRESENT').length,
    late: attendance.filter((a) => a.status === 'LATE').length,
    absent: attendance.filter((a) => a.status === 'ABSENT').length,
    onLeave: attendance.filter((a) => a.status === 'ON_LEAVE').length,
    notRecorded: Math.max(0, activeEmployees - attendance.length)
  };
  const details = attendance.map((a) => ({
    id: a.id,
    employeeNumber: a.employee.employeeNumber,
    fullName: a.employee.fullName,
    department: a.employee.department?.name || '',
    date: formatDay(a.date),
    checkIn: timeInZone(a.checkIn),
    checkOut: timeInZone(a.checkOut),
    status: a.status,
    lateMinutes: a.lateMinutes || 0,
    overtimeMinutes: a.overtimeMinutes || 0
  }));
  return { summary, details };
}

async function monthlyAttendance(query) {
  const { month, year, start, end } = monthRange(query.month, query.year);
  const attendance = await prisma.attendance.findMany({
    where: { date: { gte: start, lte: end } },
    include: { employee: { include: { department: true } } }
  });
  const byDepartment = {};
  attendance.forEach((a) => {
    const dept = a.employee.department?.name || 'بدون قسم';
    if (!byDepartment[dept]) byDepartment[dept] = { present: 0, late: 0, absent: 0, onLeave: 0, lateMinutes: 0 };
    const d = byDepartment[dept];
    if (a.status === 'PRESENT') d.present++;
    if (a.status === 'LATE') d.late++;
    if (a.status === 'ABSENT') d.absent++;
    if (a.status === 'ON_LEAVE') d.onLeave++;
    d.lateMinutes += a.lateMinutes || 0;
  });
  return { period: `${month}/${year}`, byDepartment, total: attendance.length };
}

// Per-employee summary: absence, lateness, overtime, worked hours.
async function employeeAttendanceSummary(query) {
  const { month, year, start, end } = monthRange(query.month, query.year);
  const employees = await prisma.employee.findMany({
    where: { status: { not: 'TERMINATED' }, ...(query.departmentId ? { departmentId: query.departmentId } : {}) },
    include: {
      department: true,
      attendance: { where: { date: { gte: start, lte: end } } },
      leaveRequests: { where: { status: 'APPROVED', startDate: { lte: end }, endDate: { gte: start } } }
    },
    orderBy: { employeeNumber: 'asc' }
  });

  const rows = employees.map((e) => {
    const att = e.attendance;
    const workedMinutes = att.reduce((acc, a) => {
      if (a.checkIn && a.checkOut) return acc + Math.max(0, Math.floor((a.checkOut - a.checkIn) / 60000));
      return acc;
    }, 0);
    const leaveDays = e.leaveRequests.reduce((acc, l) => {
      const s = l.startDate < start ? start : l.startDate;
      const en = l.endDate > end ? end : l.endDate;
      return acc + Math.round((en - s) / 86400000) + 1;
    }, 0);
    return {
      employeeId: e.id,
      employeeNumber: e.employeeNumber,
      fullName: e.fullName,
      department: e.department?.name || '',
      presentDays: att.filter((a) => a.status === 'PRESENT').length,
      lateDays: att.filter((a) => a.status === 'LATE').length,
      absentDays: att.filter((a) => a.status === 'ABSENT').length,
      leaveDays,
      totalLateMinutes: att.reduce((acc, a) => acc + (a.lateMinutes || 0), 0),
      totalOvertimeMinutes: att.reduce((acc, a) => acc + (a.overtimeMinutes || 0), 0),
      totalEarlyDepartureMinutes: att.reduce((acc, a) => acc + (a.earlyDepartureMinutes || 0), 0),
      workedHours: Math.round((workedMinutes / 60) * 10) / 10
    };
  });

  const totals = rows.reduce(
    (acc, r) => {
      acc.absentDays += r.absentDays;
      acc.lateDays += r.lateDays;
      acc.totalLateMinutes += r.totalLateMinutes;
      acc.totalOvertimeMinutes += r.totalOvertimeMinutes;
      return acc;
    },
    { absentDays: 0, lateDays: 0, totalLateMinutes: 0, totalOvertimeMinutes: 0 }
  );

  return { period: `${month}/${year}`, totals, rows };
}

async function leavesSummary(query) {
  const { month, year, start, end } = monthRange(query.month, query.year);
  const leaves = await prisma.leaveRequest.findMany({
    where: { startDate: { lte: end }, endDate: { gte: start } },
    include: { employee: true },
    orderBy: { startDate: 'asc' }
  });
  return {
    period: `${month}/${year}`,
    pending: leaves.filter((l) => l.status === 'PENDING').length,
    approved: leaves.filter((l) => l.status === 'APPROVED').length,
    rejected: leaves.filter((l) => l.status === 'REJECTED').length,
    byType: {
      annual: leaves.filter((l) => l.type === 'ANNUAL').length,
      sick: leaves.filter((l) => l.type === 'SICK').length,
      emergency: leaves.filter((l) => l.type === 'EMERGENCY').length,
      unpaid: leaves.filter((l) => l.type === 'UNPAID').length
    },
    details: leaves.map((l) => ({
      id: l.id,
      employeeNumber: l.employee.employeeNumber,
      fullName: l.employee.fullName,
      type: l.type,
      startDate: formatDay(l.startDate),
      endDate: formatDay(l.endDate),
      days: l.days,
      status: l.status,
      reason: l.reason
    }))
  };
}

async function payrollSummary(query) {
  const { month, year } = monthRange(query.month, query.year);
  const payrolls = await prisma.payroll.findMany({
    where: { month: String(month), year },
    include: { employee: { include: { department: true } } },
    orderBy: { employee: { employeeNumber: 'asc' } }
  });
  const totalSalary = payrolls.reduce((acc, p) => acc + Number(p.netSalary), 0);
  const totalBasic = payrolls.reduce((acc, p) => acc + Number(p.basicSalary), 0);
  const totalDeductions = payrolls.reduce((acc, p) => acc + Number(p.lateDeductions), 0);
  return {
    period: `${month}/${year}`,
    totalRecords: payrolls.length,
    paidRecords: payrolls.filter((p) => p.paid).length,
    totalBasic: Math.round(totalBasic * 100) / 100,
    totalSalary: Math.round(totalSalary * 100) / 100,
    totalDeductions: Math.round(totalDeductions * 100) / 100,
    averageSalary: payrolls.length ? Math.round(totalSalary / payrolls.length) : 0,
    details: payrolls.map((p) => ({
      id: p.id,
      employeeNumber: p.employee.employeeNumber,
      fullName: p.employee.fullName,
      department: p.employee.department?.name || '',
      basicSalary: Number(p.basicSalary),
      presentDays: p.presentDays,
      absentDays: p.absentDays,
      overtimeHours: Number(p.overtimeHours),
      deductions: Number(p.lateDeductions),
      netSalary: Number(p.netSalary),
      paid: p.paid
    }))
  };
}

async function employeesByDepartment() {
  const departments = await prisma.department.findMany({
    include: { employees: { where: { status: 'ACTIVE' }, orderBy: { employeeNumber: 'asc' } } },
    orderBy: { name: 'asc' }
  });
  return departments.map((d) => ({
    department: d.name,
    employeeCount: d.employees.length,
    employees: d.employees.map((e) => ({
      id: e.id,
      employeeNumber: e.employeeNumber,
      fullName: e.fullName,
      email: e.email,
      jobTitle: e.jobTitle,
      hireDate: formatDay(e.hireDate)
    }))
  }));
}

// ---------- JSON endpoints ----------

function jsonRoute(path, builder) {
  router.get(path, verifyToken, authorize(ADMINS), async (req, res) => {
    try {
      res.json(await builder(req.query));
    } catch (error) {
      res.status(500).json({ message: 'Failed to generate report', error: error.message });
    }
  });
}

jsonRoute('/attendance/daily', dailyAttendance);
jsonRoute('/attendance/monthly', monthlyAttendance);
jsonRoute('/attendance/employees', employeeAttendanceSummary);
jsonRoute('/leaves/summary', leavesSummary);
jsonRoute('/payroll/summary', payrollSummary);
jsonRoute('/employees/by-department', employeesByDepartment);

// ---------- Excel export ----------

const EXPORTS = {
  'attendance-daily': {
    title: 'الحضور اليومي',
    build: async (q) => (await dailyAttendance(q)).details,
    columns: [
      ['employeeNumber', 'رقم الموظف', 14],
      ['fullName', 'الاسم', 26],
      ['department', 'القسم', 20],
      ['date', 'التاريخ', 12],
      ['checkIn', 'الدخول', 10],
      ['checkOut', 'الخروج', 10],
      ['status', 'الحالة', 10, (v) => STATUS_AR[v] || v],
      ['lateMinutes', 'دقائق التأخير', 14],
      ['overtimeMinutes', 'دقائق إضافية', 14]
    ]
  },
  'attendance-monthly': {
    title: 'الحضور الشهري حسب القسم',
    build: async (q) =>
      Object.entries((await monthlyAttendance(q)).byDepartment).map(([department, d]) => ({ department, ...d })),
    columns: [
      ['department', 'القسم', 24],
      ['present', 'حضور', 10],
      ['late', 'تأخير', 10],
      ['absent', 'غياب', 10],
      ['onLeave', 'إجازة', 10],
      ['lateMinutes', 'إجمالي دقائق التأخير', 20]
    ]
  },
  'attendance-employees': {
    title: 'الغياب والتأخير والإضافي',
    build: async (q) => (await employeeAttendanceSummary(q)).rows,
    columns: [
      ['employeeNumber', 'رقم الموظف', 14],
      ['fullName', 'الاسم', 26],
      ['department', 'القسم', 20],
      ['presentDays', 'أيام الحضور', 12],
      ['lateDays', 'أيام التأخير', 12],
      ['absentDays', 'أيام الغياب', 12],
      ['leaveDays', 'أيام الإجازة', 12],
      ['totalLateMinutes', 'دقائق التأخير', 14],
      ['totalOvertimeMinutes', 'دقائق إضافية', 14],
      ['totalEarlyDepartureMinutes', 'دقائق انصراف مبكر', 18],
      ['workedHours', 'ساعات العمل', 12]
    ]
  },
  leaves: {
    title: 'الإجازات',
    build: async (q) => (await leavesSummary(q)).details,
    columns: [
      ['employeeNumber', 'رقم الموظف', 14],
      ['fullName', 'الاسم', 26],
      ['type', 'النوع', 12, (v) => LEAVE_TYPE_AR[v] || v],
      ['startDate', 'من', 12],
      ['endDate', 'إلى', 12],
      ['days', 'الأيام', 8],
      ['status', 'الحالة', 14, (v) => LEAVE_STATUS_AR[v] || v],
      ['reason', 'السبب', 30]
    ]
  },
  payroll: {
    title: 'الرواتب',
    build: async (q) => (await payrollSummary(q)).details,
    columns: [
      ['employeeNumber', 'رقم الموظف', 14],
      ['fullName', 'الاسم', 26],
      ['department', 'القسم', 20],
      ['basicSalary', 'الراتب الأساسي', 14],
      ['presentDays', 'أيام الحضور', 12],
      ['absentDays', 'أيام الغياب', 12],
      ['overtimeHours', 'ساعات إضافية', 12],
      ['deductions', 'الخصومات', 12],
      ['netSalary', 'الصافي', 14],
      ['paid', 'تم الصرف', 10, (v) => (v ? 'نعم' : 'لا')]
    ]
  },
  employees: {
    title: 'الموظفين حسب القسم',
    build: async () =>
      (await employeesByDepartment()).flatMap((d) => d.employees.map((e) => ({ department: d.department, ...e }))),
    columns: [
      ['department', 'القسم', 22],
      ['employeeNumber', 'رقم الموظف', 14],
      ['fullName', 'الاسم', 26],
      ['email', 'البريد', 30],
      ['jobTitle', 'المسمى', 22],
      ['hireDate', 'تاريخ التعيين', 14]
    ]
  }
};

// GET /export/:type?format=xlsx|pdf  (default xlsx)
router.get('/export/:type', verifyToken, authorize(ADMINS), async (req, res) => {
  const spec = EXPORTS[req.params.type];
  if (!spec) {
    return res.status(404).json({ message: `Unknown report. Available: ${Object.keys(EXPORTS).join(', ')}` });
  }
  const format = String(req.query.format || 'xlsx').toLowerCase();
  if (!['xlsx', 'pdf'].includes(format)) return res.status(400).json({ message: 'format must be xlsx or pdf' });
  try {
    const rows = await spec.build(req.query);
    const { month, year } = monthRange(req.query.month, req.query.year);
    const isDaily = req.params.type === 'attendance-daily';
    const suffix = isDaily ? formatDay(parseDay(req.query.date) || localDay()) : `${year}-${String(month).padStart(2, '0')}`;
    const filename = `${req.params.type}-${suffix}.${format}`;
    const cell = (row, [key, , , fmt]) => (fmt ? fmt(row[key]) : row[key]);

    if (format === 'pdf') {
      const company = await prisma.setting.findUnique({ where: { key: 'company_name' } });
      const period = req.params.type === 'employees' ? '' : isDaily ? `التاريخ: ${suffix}` : `الفترة: ${suffix}`;
      const doc = renderTablePdf({
        title: spec.title,
        subtitle: [company?.value, period, `عدد السجلات: ${rows.length}`].filter(Boolean).join('   |   '),
        columns: spec.columns.map((col) => ({ header: col[1], width: col[2], value: (row) => cell(row, col) })),
        rows,
        footer: `تم الإنشاء ${formatDay(localDay())}`
      });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      doc.pipe(res);
      return undefined;
    }

    const workbook = new ExcelJS.Workbook();
    workbook.created = new Date();
    const sheet = workbook.addWorksheet(spec.title.slice(0, 31), { views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }] });
    sheet.columns = spec.columns.map(([key, header, width]) => ({ key, header, width }));
    rows.forEach((row) => {
      const out = {};
      spec.columns.forEach((col) => {
        out[col[0]] = cell(row, col);
      });
      sheet.addRow(out);
    });
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    return res.end();
  } catch (error) {
    return res.status(500).json({ message: 'Failed to export report', error: error.message });
  }
});

module.exports = router;
