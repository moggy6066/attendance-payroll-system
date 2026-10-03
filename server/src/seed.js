const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

const roles = [
  { name: 'SUPER_ADMIN', description: 'Full system access' },
  { name: 'ADMIN', description: 'Administrative access' },
  { name: 'EMPLOYEE', description: 'Employee self-service access' },
];

const permissions = [
  'manage_users',
  'manage_employees',
  'manage_departments',
  'manage_attendance',
  'manage_leave',
  'manage_payroll',
  'view_dashboard',
  'manage_reports',
  'manage_settings',
  'api_access',
  'employee_self_service',
];

async function ensureRolesAndPermissions() {
  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: { name: role.name, description: role.description },
    });
  }

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { name: permission },
      update: {},
      create: { name: permission, description: permission },
    });
  }
}

async function createDefaultUsers() {
  const defaultUsers = [
    {
      username: 'superadmin',
      email: 'superadmin@company.com',
      password: 'SuperAdmin@123',
      roleName: 'SUPER_ADMIN',
      fullName: 'Super Admin',
    },
    {
      username: 'admin',
      email: 'admin@company.com',
      password: 'Admin@123',
      roleName: 'ADMIN',
      fullName: 'Admin User',
    },
    {
      username: 'employee',
      email: 'employee@company.com',
      password: 'Employee@123',
      roleName: 'EMPLOYEE',
      fullName: 'Employee User',
    },
  ];

  for (const item of defaultUsers) {
    const role = await prisma.role.findUnique({ where: { name: item.roleName } });
    const exists = await prisma.user.findUnique({ where: { email: item.email } });

    if (!exists) {
      const passwordHash = await bcrypt.hash(item.password, 10);
      const employee = await prisma.employee.upsert({
        where: { email: item.email },
        create: {
          employeeNumber: `EMP-${item.roleName.toLowerCase()}`,
          fullName: item.fullName,
          email: item.email,
          phone: '+966500000000',
          salary: 12000,
          hireDate: new Date('2020-01-01'),
          shiftStart: '08:00',
          shiftEnd: '17:00',
          status: 'ACTIVE',
          jobTitle: item.roleName === 'SUPER_ADMIN' ? 'Super Administrator' : item.roleName === 'ADMIN' ? 'System Administrator' : 'Employee',
        },
        update: {},
      });

      await prisma.user.create({
        data: {
          username: item.username,
          email: item.email,
          passwordHash,
          roleId: role.id,
          employeeId: employee.id,
          status: 'ACTIVE',
          forcePasswordChange: false,
        },
      });
    }
  }
}

async function seedDepartments() {
  const departments = ['Human Resources', 'Finance', 'Operations', 'Sales', 'IT', 'Management'];
  for (const department of departments) {
    await prisma.department.upsert({
      where: { name: department },
      update: {},
      create: { name: department },
    });
  }
}

async function seedEmployees() {
  const employeeNames = [
    'Mohammed Al-Harbi', 'Fatima Al-Zahrani', 'Ali Ahmed', 'Noura Saleh', 'Khalid Omar',
    'Lina Hassan', 'Omar Faris', 'Salma Youssef', 'Hassan Ibrahim', 'Rania Mansour',
    'Yousef Al-Mansoor', 'Sara Salem', 'Abdullah Nabil', 'Maha Khaled', 'Ammar Rahman',
    'Noor Hamad', 'Tariq Bahar', 'Layla Nasser', 'Faisal Qureshi', 'Dana Ismail',
    'Ziad Sami', 'Huda Fawzi', 'Samir Ali', 'Reem Hadi', 'Anas Sayed'
  ];

  const departments = await prisma.department.findMany();

  for (let index = 0; index < employeeNames.length; index += 1) {
    const name = employeeNames[index];
    const dep = departments[index % departments.length];
    const email = `${name.toLowerCase().replace(/\s+/g, '.')}@company.com`;

    const employee = await prisma.employee.upsert({
      where: { email },
      update: {},
      create: {
        employeeNumber: `EMP-${String(index + 1).padStart(4, '0')}`,
        fullName: name,
        nationalId: `100${String(index + 100000000 + 1).slice(0, 9)}`,
        phone: `+9665${String(10000000 + index).slice(0, 8)}`,
        email,
        address: `مدينة الرياض - حي ${index + 1}`,
        departmentId: dep.id,
        jobTitle: ['HR Specialist', 'Accountant', 'Operations Coordinator', 'Sales Representative', 'Software Engineer', 'Manager'][index % 6],
        salary: 3500 + (index * 250),
        hireDate: new Date(2021, index % 12, (index % 28) + 1),
        shiftStart: '08:00',
        shiftEnd: '17:00',
        status: index % 5 === 0 ? 'ON_LEAVE' : 'ACTIVE',
      },
    });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      const role = await prisma.role.findUnique({ where: { name: 'EMPLOYEE' } });
      const passwordHash = await bcrypt.hash('Employee@123', 10);
      await prisma.user.create({
        data: {
          username: `emp${String(index + 1).padStart(3, '0')}`,
          email,
          passwordHash,
          roleId: role.id,
          employeeId: employee.id,
          status: 'ACTIVE',
        },
      });
    }
  }
}

async function seedSettings() {
  const settings = [
    { key: 'company_name', value: 'نظام الحضور والانصراف', description: 'Company name' },
    { key: 'attendance_radius_meters', value: '120', description: 'GPS attendance radius in meters' },
    { key: 'timezone', value: 'Asia/Riyadh', description: 'Default timezone' },
    { key: 'late_threshold_minutes', value: '15', description: 'Late threshold' },
    { key: 'default_shift_start', value: '08:00', description: 'Default shift start' },
    { key: 'default_shift_end', value: '17:00', description: 'Default shift end' },
  ];

  for (const item of settings) {
    await prisma.setting.upsert({
      where: { key: item.key },
      update: { value: item.value, description: item.description },
      create: item,
    });
  }
}

async function seedSampleAttendance() {
  const employees = await prisma.employee.findMany({ take: 10 });
  const today = new Date();

  for (const employee of employees) {
    await prisma.attendance.upsert({
      where: { id: `sample-${employee.id}` },
      update: {},
      create: {
        id: `sample-${employee.id}`,
        employeeId: employee.id,
        date: today,
        checkIn: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 8, 15),
        checkOut: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 16, 40),
        workingHours: 8,
        overtimeMinutes: 30,
        lateMinutes: 15,
        earlyDepartureMinutes: 0,
        status: 'LATE',
        deviceInfo: 'Chrome on Windows',
        ipAddress: '127.0.0.1',
      },
    });
  }
}

async function main() {
  await ensureRolesAndPermissions();
  await seedDepartments();
  await seedEmployees();
  await createDefaultUsers();
  await seedSettings();
  await seedSampleAttendance();
  console.log('Seed completed successfully');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

module.exports = {
  issueToken: (user) => jwt.sign({ userId: user.id, role: user.roleName }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' }),
};
