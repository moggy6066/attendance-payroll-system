const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { verifyToken, authorize } = require('../middleware/auth');
const { z } = require('zod');

const router = express.Router();
const prisma = new PrismaClient();

const createDepartmentSchema = z.object({
  name: z.string().min(2),
  managerId: z.string().optional()
});

router.get('/', verifyToken, authorize(['SUPER_ADMIN', 'ADMIN', 'EMPLOYEE']), async (req, res) => {
  try {
    const departments = await prisma.department.findMany({
      include: { employees: true, manager: true },
      orderBy: { name: 'asc' }
    });

    res.json(departments);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch departments', error: error.message });
  }
});

router.post('/', verifyToken, authorize(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
  try {
    const validation = createDepartmentSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: 'Invalid data', errors: validation.error.flatten() });
    }

    const existing = await prisma.department.findUnique({
      where: { name: validation.data.name }
    });

    if (existing) {
      return res.status(409).json({ message: 'Department already exists' });
    }

    const department = await prisma.department.create({
      data: validation.data,
      include: { employees: true, manager: true }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: `Created department: ${department.name}`,
        ipAddress: req.ip
      }
    });

    res.status(201).json(department);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create department', error: error.message });
  }
});

router.put('/:id', verifyToken, authorize(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
  try {
    const { name, managerId } = req.body;

    const department = await prisma.department.update({
      where: { id: req.params.id },
      data: { ...(name && { name }), ...(managerId && { managerId }) },
      include: { employees: true, manager: true }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: `Updated department: ${department.name}`,
        ipAddress: req.ip
      }
    });

    res.json(department);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update department', error: error.message });
  }
});

router.delete('/:id', verifyToken, authorize(['SUPER_ADMIN']), async (req, res) => {
  try {
    const department = await prisma.department.findUnique({
      where: { id: req.params.id },
      include: { employees: true }
    });

    if (!department) return res.status(404).json({ message: 'Department not found' });

    if (department.employees.length > 0) {
      return res.status(400).json({ message: 'Cannot delete department with employees' });
    }

    await prisma.department.delete({ where: { id: req.params.id } });

    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: `Deleted department: ${department.name}`,
        ipAddress: req.ip
      }
    });

    res.json({ message: 'Department deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete department', error: error.message });
  }
});

module.exports = router;
