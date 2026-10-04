const express = require('express');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { verifyToken, authorize } = require('../middleware/auth');
const { z } = require('zod');

const router = express.Router();
const prisma = new PrismaClient();

const createEmployeeSchema = z.object({
  employeeNumber: z.string().min(1),
  fullName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  nationalId: z.string().optional(),
  address: z.string().optional(),
  departmentId: z.string().optional(),
  managerId: z.string().optional(),
  jobTitle: z.string(),
  salary: z.coerce.number().min(0),
  hireDate: z.string().min(10),
  shiftStart: z.string().regex(/^\d{1,2}:\d{2}$/).default('08:00'),
  shiftEnd: z.string().regex(/^\d{1,2}:\d{2}$/).default('17:00'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'TERMINATED']).optional()
});

const safeUser = { select: { id: true, username: true, email: true, status: true, lastLogin: true } };
const emptyToUndefined = (obj) =>
  Object.fromEntries(Object.entries(obj || {}).map(([k, v]) => [k, v === '' || v === null ? undefined : v]));

const updateEmployeeSchema = createEmployeeSchema.partial();

router.get('/', verifyToken, authorize(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
  try {
    const { search, departmentId, status } = req.query;
    const filters = {};

    if (search) {
      filters.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { employeeNumber: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (departmentId) filters.departmentId = departmentId;
    if (status) filters.status = status;

    const employees = await prisma.employee.findMany({
      where: filters,
      include: { department: true, manager: { select: { id: true, fullName: true } }, user: safeUser },
      orderBy: { createdAt: 'desc' }
    });

    res.json(employees);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch employees', error: error.message });
  }
});

router.get('/:id', verifyToken, authorize(['SUPER_ADMIN', 'ADMIN', 'EMPLOYEE']), async (req, res) => {
  try {
    if (req.user.role === 'EMPLOYEE' && req.params.id !== req.user.employeeId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const employee = await prisma.employee.findUnique({
      where: { id: req.params.id },
      include: {
        department: true,
        manager: { select: { id: true, fullName: true } },
        directReports: { select: { id: true, fullName: true, jobTitle: true } },
        user: { select: { id: true, username: true, email: true, status: true, lastLogin: true } },
        attendance: { orderBy: { date: 'desc' }, take: 10 },
        leaveRequests: { orderBy: { createdAt: 'desc' }, take: 10 }
      }
    });

    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    res.json(employee);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch employee', error: error.message });
  }
});

router.post('/', verifyToken, authorize(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
  try {
    const validation = createEmployeeSchema.safeParse(emptyToUndefined(req.body));
    if (!validation.success) {
      return res.status(400).json({ message: 'Invalid data', errors: validation.error.flatten() });
    }

    const hire = new Date(validation.data.hireDate);
    if (Number.isNaN(hire.getTime())) return res.status(400).json({ message: 'Invalid hire date' });

    const duplicate = await prisma.employee.findFirst({
      where: { OR: [{ email: validation.data.email }, { employeeNumber: validation.data.employeeNumber }] }
    });
    if (duplicate) {
      return res.status(409).json({ message: 'Employee with this email or number already exists' });
    }
    const userWithEmail = await prisma.user.findUnique({ where: { email: validation.data.email.toLowerCase() } });
    if (userWithEmail) {
      return res.status(409).json({ message: 'A user account with this email already exists' });
    }

    const employee = await prisma.employee.create({
      data: {
        employeeNumber: validation.data.employeeNumber,
        fullName: validation.data.fullName,
        email: validation.data.email,
        phone: validation.data.phone,
        nationalId: validation.data.nationalId,
        address: validation.data.address,
        departmentId: validation.data.departmentId,
        managerId: validation.data.managerId,
        jobTitle: validation.data.jobTitle,
        salary: validation.data.salary,
        hireDate: hire,
        shiftStart: validation.data.shiftStart,
        shiftEnd: validation.data.shiftEnd,
        status: 'ACTIVE'
      },
      include: { department: true, manager: { select: { id: true, fullName: true } } }
    });

    const role = await prisma.role.findUnique({ where: { name: 'EMPLOYEE' } });
    const tempPassword = Math.random().toString(36).slice(-10);
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const user = await prisma.user.create({
      data: {
        username: `${validation.data.fullName.toLowerCase().replace(/\s+/g, '.')}.${employee.id.slice(0, 5)}`,
        email: validation.data.email.toLowerCase(),
        passwordHash,
        roleId: role.id,
        employeeId: employee.id,
        status: 'ACTIVE',
        forcePasswordChange: true
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: `Created employee: ${employee.fullName}`,
        ipAddress: req.ip,
        device: req.headers['user-agent']
      }
    });

    res.status(201).json({
      employee,
      user: { id: user.id, username: user.username, email: user.email },
      tempPassword
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create employee', error: error.message });
  }
});

router.put('/:id', verifyToken, authorize(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
  try {
    const validation = updateEmployeeSchema.safeParse(emptyToUndefined(req.body));
    if (!validation.success) {
      return res.status(400).json({ message: 'Invalid data', errors: validation.error.flatten() });
    }

    const existingEmployee = await prisma.employee.findUnique({
      where: { id: req.params.id },
      include: { user: true }
    });

    if (!existingEmployee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const updateData = { ...validation.data };
    if (updateData.hireDate) {
      updateData.hireDate = new Date(updateData.hireDate);
    }

    const employee = await prisma.employee.update({
      where: { id: req.params.id },
      data: updateData,
      include: { department: true, manager: { select: { id: true, fullName: true } } }
    });

    if (existingEmployee.user && updateData.email) {
      await prisma.user.update({
        where: { id: existingEmployee.user.id },
        data: { email: updateData.email.toLowerCase() }
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: `Updated employee: ${employee.fullName}`,
        ipAddress: req.ip,
        device: req.headers['user-agent']
      }
    });

    res.json(employee);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update employee', error: error.message });
  }
});

router.delete('/:id', verifyToken, authorize(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: req.params.id },
      include: { user: true }
    });

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    await prisma.employee.update({
      where: { id: req.params.id },
      data: { status: 'TERMINATED' }
    });

    if (employee.user) {
      await prisma.user.update({
        where: { id: employee.user.id },
        data: { status: 'INACTIVE' }
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: `Terminated employee: ${employee.fullName}`,
        ipAddress: req.ip,
        device: req.headers['user-agent']
      }
    });

    res.json({ message: 'Employee terminated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete employee', error: error.message });
  }
});

module.exports = router;
