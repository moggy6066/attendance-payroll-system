const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { localDay } = require('./utils/date');

const prisma = new PrismaClient();

const defaultRoles = [
  { name: 'SUPER_ADMIN', description: 'Full system access' },
  { name: 'ADMIN', description: 'Administrative access' },
  { name: 'EMPLOYEE', description: 'Employee self service' }
];

const defaultDepartments = [
  'Human Resources',
  'Finance',
  'Operations',
  'Sales',
  'IT',
  'Management'
];

const employeeNames = [
  'Mohammed Al-Harbi',
  'Fatima Al-Zahrani',
  'Ali Ahmed',
  'Noura Saleh',
  'Khalid Omar',
  'Lina Hassan',
  'Omar Faris',
  'Salma Youssef',
  'Hassan Ibrahim',
  'Rania Mansour',
  'Yousef Al-Mansoor',
  'Sara Salem',
  'Abdullah Nabil',
  'Maha Khaled',
  'Ammar Rahman',
  'Noor Hamad',
  'Tariq Bahar',
  'Layla Nasser',
  'Faisal Qureshi',
  'Dana Ismail',
  'Ziad Sami',
  'Huda Fawzi',
  'Samir Ali',
  'Reem Hadi',
  'Anas Sayed'
];

async function seedRoles() {
  for (const role of defaultRoles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: { name: role.name, description: role.description }
    });
  }
}

async function seedDepartments() {
  for (const name of defaultDepartments) {
    await prisma.department.upsert({
      where: { name },
      update: {},
      create: { name }
    });
  }
}

async function seedDefaults() {
  const roleMap = await prisma.role.findMany();
  const roleByName = Object.fromEntries(roleMap.map((role) => [role.name, role]));

  const defaultUsers = [
    { email: 'superadmin@company.com', username: 'superadmin', password: 'SuperAdmin@123', role: 'SUPER_ADMIN', fullName: 'Super Admin' },
    { email: 'admin@company.com', username: 'admin', password: 'Admin@123', role: 'ADMIN', fullName: 'Admin User' },
    { email: 'employee@company.com', username: 'employee', password: 'Employee@123', role: 'EMPLOYEE', fullName: 'Employee User' }
  ];

  for (const user of defaultUsers) {
    const existingUser = await prisma.user.findUnique({ where: { email: user.email } });
    if (existingUser) continue;

    const employee = await prisma.employee.upsert({
      where: { email: user.email },
      update: {},
      create: {
        employeeNumber: `EMP-${user.username.toUpperCase()}`,
        fullName: user.fullName,
        email: user.email,
        phone: '+966500000000',
        salary: user.role === 'SUPER_ADMIN' ? 20000 : user.role === 'ADMIN' ? 15000 : 6500,
        hireDate: new Date('2020-01-01'),
        shiftStart: '08:00',
        shiftEnd: '17:00',
        jobTitle: user.role === 'SUPER_ADMIN' ? 'Super Administrator' : user.role === 'ADMIN' ? 'System Administrator' : 'Employee',
        status: 'ACTIVE',
        departmentId: (await prisma.department.findFirst({ where: { name: 'Management' } })).id
      }
    });

    const passwordHash = await bcrypt.hash(user.password, 10);
    await prisma.user.create({
      data: {
        username: user.username,
        email: user.email,
        passwordHash,
        roleId: roleByName[user.role].id,
        employeeId: employee.id,
        status: 'ACTIVE'
      }
    });
  }
}

async function seedEmployees() {
  const departments = await prisma.department.findMany();
  const employeeRole = await prisma.role.findUnique({ where: { name: 'EMPLOYEE' } });

  for (let i = 0; i < employeeNames.length; i += 1) {
    const name = employeeNames[i];
    const email = `${name.toLowerCase().replace(/\s+/g, '.')}@company.com`;
    const dep = departments[i % departments.length];

    const existing = await prisma.employee.findUnique({ where: { email } });
    if (existing) continue;

    const employee = await prisma.employee.create({
      data: {
        employeeNumber: `EMP-${String(i + 1).padStart(4, '0')}`,
        fullName: name,
        nationalId: `100${String(i + 100000000)}`,
        phone: `+966500${String(i + 100000).padStart(6, '0')}`,
        email,
        address: `الرياض - حي ${i + 1}`,
        departmentId: dep.id,
        jobTitle: ['HR Specialist', 'Accountant', 'Operations Coordinator', 'Sales Representative', 'Software Engineer', 'Manager'][i % 6],
        salary: 3500 + i * 220,
        hireDate: new Date(2021, (i % 12), (i % 28) + 1),
        shiftStart: '08:00',
        shiftEnd: '17:00',
        status: i % 5 === 0 ? 'ON_LEAVE' : 'ACTIVE',
      }
    });

    const userExists = await prisma.user.findUnique({ where: { email } });
    if (!userExists) {
      const passwordHash = await bcrypt.hash('Employee@123', 10);
      await prisma.user.create({
        data: {
          username: `emp${String(i + 1).padStart(3, '0')}`,
          email,
          passwordHash,
          roleId: employeeRole.id,
          employeeId: employee.id,
          status: 'ACTIVE'
        }
      });
    }
  }
}

async function seedSettings() {
  const settings = [
    { key: 'company_name', value: 'نظام الحضور والانصراف', description: 'Company name' },
    { key: 'attendance_radius_meters', value: '120', description: 'GPS attendance radius in meters' },
    { key: 'default_shift_start', value: '08:00', description: 'Default shift start' },
    { key: 'default_shift_end', value: '17:00', description: 'Default shift end' },
    { key: 'late_threshold_minutes', value: '15', description: 'Late threshold' },
    { key: 'timezone', value: process.env.APP_TIMEZONE || 'Africa/Cairo', description: 'Timezone' }
  ];

  for (const setting of settings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting
    });
  }
}

// Sample attendance for the last 10 days (dates are calendar days in APP_TIMEZONE).
async function seedAttendance() {
  const employees = await prisma.employee.findMany({ take: 12, orderBy: { employeeNumber: 'asc' } });
  const today = localDay();

  for (let dayOffset = 1; dayOffset <= 10; dayOffset += 1) {
    const date = new Date(today.getTime() - dayOffset * 86400000);
    if (date.getUTCDay() === 5) continue; // Friday off
    for (let i = 0; i < employees.length; i += 1) {
      const employee = employees[i];
      const k = (i + dayOffset) % 7;
      const status = k === 0 ? 'ABSENT' : k === 3 ? 'LATE' : 'PRESENT';
      const lateMinutes = status === 'LATE' ? 20 + (i % 4) * 10 : 0;
      const overtimeMinutes = status === 'PRESENT' && i % 4 === 0 ? 45 : 0;
      // 08:00 Cairo is 05:00 or 06:00 UTC; use a fixed UTC+3 offset for sample data.
      const checkIn = status === 'ABSENT' ? null : new Date(date.getTime() + (5 * 60 + lateMinutes) * 60000);
      const checkOut = status === 'ABSENT' ? null : new Date(date.getTime() + (14 * 60 + overtimeMinutes) * 60000);

      await prisma.attendance.upsert({
        where: { employeeId_date: { employeeId: employee.id, date } },
        update: {},
        create: {
          employeeId: employee.id,
          date,
          checkIn,
          checkOut,
          workingHours: checkIn ? Math.floor((checkOut - checkIn) / 3600000) : null,
          lateMinutes,
          overtimeMinutes,
          status,
          deviceInfo: 'seed',
          ipAddress: '127.0.0.1'
        }
      });
    }
  }
}

async function main() {
  await seedRoles();
  await seedDepartments();
  await seedDefaults();
  await seedEmployees();
  await seedSettings();
  await seedAttendance();
  console.log('Database seed completed successfully.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
