const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { verifyToken, authorize } = require('../middleware/auth');
const { z } = require('zod');
const bcrypt = require('bcryptjs');

const router = express.Router();
const prisma = new PrismaClient();

const createUserSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  roleId: z.string(),
  employeeId: z.string().optional()
});

router.get('/', verifyToken, authorize(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
  try {
    const { search, status, role } = req.query;
    const filters = {};

    if (search) {
      filters.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (status) filters.status = status;
    if (role) filters.role = { name: role };

    const users = await prisma.user.findMany({
      where: filters,
      include: { role: true, employee: true },
      orderBy: { createdAt: 'desc' }
    });

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch users', error: error.message });
  }
});

router.post('/', verifyToken, authorize(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
  try {
    const validation = createUserSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: 'Invalid data', errors: validation.error.flatten() });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: validation.data.email }
    });

    if (existingUser) {
      return res.status(409).json({ message: 'User with this email already exists' });
    }

    const tempPassword = Math.random().toString(36).slice(-10);
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const user = await prisma.user.create({
      data: {
        username: validation.data.username,
        email: validation.data.email,
        passwordHash,
        roleId: validation.data.roleId,
        employeeId: validation.data.employeeId,
        status: 'ACTIVE',
        forcePasswordChange: true
      },
      include: { role: true, employee: true }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: `Created user: ${user.username}`,
        ipAddress: req.ip,
        device: req.headers['user-agent']
      }
    });

    res.status(201).json({
      user: { id: user.id, username: user.username, email: user.email },
      tempPassword
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create user', error: error.message });
  }
});

router.put('/:id', verifyToken, authorize(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
  try {
    const { roleId, status } = req.body;

    if (req.user.role === 'ADMIN' && roleId) {
      const targetRole = await prisma.role.findUnique({ where: { id: roleId } });
      if (targetRole?.name === 'SUPER_ADMIN') {
        return res.status(403).json({ message: 'Cannot assign Super Admin role' });
      }
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { ...(roleId && { roleId }), ...(status && { status }) },
      include: { role: true, employee: true }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: `Updated user: ${user.username}`,
        ipAddress: req.ip,
        device: req.headers['user-agent']
      }
    });

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update user', error: error.message });
  }
});

router.post('/:id/reset-password', verifyToken, authorize(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
  try {
    const tempPassword = Math.random().toString(36).slice(-10);
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { passwordHash, forcePasswordChange: true },
      include: { role: true }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: `Reset password for user: ${user.username}`,
        ipAddress: req.ip,
        device: req.headers['user-agent']
      }
    });

    res.json({ user, tempPassword });
  } catch (error) {
    res.status(500).json({ message: 'Failed to reset password', error: error.message });
  }
});

router.delete('/:id', verifyToken, authorize(['SUPER_ADMIN']), async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    await prisma.user.delete({ where: { id: req.params.id } });

    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: `Deleted user: ${user.username}`,
        ipAddress: req.ip,
        device: req.headers['user-agent']
      }
    });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete user', error: error.message });
  }
});

module.exports = router;
