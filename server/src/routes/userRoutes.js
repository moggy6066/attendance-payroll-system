const express = require('express');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { verifyToken, authorize } = require('../middleware/auth');
const { z } = require('zod');

const router = express.Router();
const prisma = new PrismaClient();

const ROLES = ['SUPER_ADMIN', 'ADMIN', 'EMPLOYEE'];
const STATUSES = ['ACTIVE', 'INACTIVE', 'LOCKED', 'PENDING'];

const publicUser = {
  id: true,
  username: true,
  email: true,
  status: true,
  lastLogin: true,
  forcePasswordChange: true,
  employeeId: true,
  createdAt: true,
  updatedAt: true,
  role: { select: { name: true } },
  employee: { select: { id: true, fullName: true, employeeNumber: true, jobTitle: true, phone: true, hireDate: true, shiftStart: true, shiftEnd: true, department: { select: { name: true } } } }
};

const flatten = (u) => (u ? { ...u, role: u.role?.name } : u);

const createSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(ROLES).default('EMPLOYEE'),
  employeeId: z.string().optional().nullable()
});

const updateSchema = z.object({
  username: z.string().min(3).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  role: z.enum(ROLES).optional(),
  status: z.string().optional(),
  employeeId: z.string().optional().nullable()
});

async function roleIdFor(name) {
  const role = await prisma.role.findUnique({ where: { name } });
  if (!role) throw Object.assign(new Error(`Role ${name} not found`), { status: 400 });
  return role.id;
}

// List users
router.get('/', verifyToken, authorize(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
  try {
    const users = await prisma.user.findMany({ select: publicUser, orderBy: { createdAt: 'asc' } });
    return res.json(users.map(flatten));
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch users', error: error.message });
  }
});

// Current user
router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.userId }, select: publicUser });
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json(flatten(user));
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch user', error: error.message });
  }
});

// Change own password
router.put('/me/password', verifyToken, async (req, res) => {
  const schema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8) });
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ message: 'New password must be at least 8 characters', errors: parsed.error.flatten() });
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) return res.status(404).json({ message: 'User not found' });
    const ok = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
    if (!ok) return res.status(400).json({ message: 'Current password is incorrect' });
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(parsed.data.newPassword, 10), forcePasswordChange: false }
    });
    return res.json({ message: 'Password updated' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update password', error: error.message });
  }
});

// Get one user
router.get('/:id', verifyToken, authorize(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: publicUser });
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json(flatten(user));
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch user', error: error.message });
  }
});

// Create user
router.post('/', verifyToken, authorize(['SUPER_ADMIN']), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid data', errors: parsed.error.flatten() });
  const { username, email, password, role, employeeId } = parsed.data;
  try {
    const user = await prisma.user.create({
      data: {
        username,
        email: email.toLowerCase(),
        passwordHash: await bcrypt.hash(password, 10),
        roleId: await roleIdFor(role),
        employeeId: employeeId || null
      },
      select: publicUser
    });
    return res.status(201).json(flatten(user));
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ message: 'Username, email or employee already in use' });
    return res.status(error.status || 500).json({ message: 'Failed to create user', error: error.message });
  }
});

// Update user
router.put('/:id', verifyToken, authorize(['SUPER_ADMIN']), async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid data', errors: parsed.error.flatten() });
  const { password, role, status, email, ...rest } = parsed.data;
  if (status && !STATUSES.includes(status)) return res.status(400).json({ message: `Invalid status. Allowed: ${STATUSES.join(', ')}` });
  try {
    const data = { ...rest };
    if (email) data.email = email.toLowerCase();
    if (status) data.status = status;
    if (password) data.passwordHash = await bcrypt.hash(password, 10);
    if (role) data.roleId = await roleIdFor(role);
    const user = await prisma.user.update({ where: { id: req.params.id }, data, select: publicUser });
    return res.json(flatten(user));
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ message: 'User not found' });
    if (error.code === 'P2002') return res.status(409).json({ message: 'Username, email or employee already in use' });
    return res.status(error.status || 500).json({ message: 'Failed to update user', error: error.message });
  }
});

// Delete user
router.delete('/:id', verifyToken, authorize(['SUPER_ADMIN']), async (req, res) => {
  if (req.params.id === req.user.userId) return res.status(400).json({ message: 'You cannot delete your own account' });
  try {
    await prisma.user.delete({ where: { id: req.params.id } });
    return res.json({ message: 'User deleted' });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ message: 'User not found' });
    if (error.code === 'P2003') return res.status(409).json({ message: 'User has related records (login history, notifications, audit logs). Set status to INACTIVE instead.' });
    return res.status(500).json({ message: 'Failed to delete user', error: error.message });
  }
});

module.exports = router;
