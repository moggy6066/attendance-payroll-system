// Shared fixtures for API tests. They need a real, disposable PostgreSQL database:
//   DATABASE_URL=postgresql://... npm run test:api --workspace server
// The database is migrated by `prisma migrate deploy` and its tables are emptied here.
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Random per run: nothing secret is stored in the repository.
process.env.JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

if (!process.env.DATABASE_URL) {
  throw new Error('API tests need DATABASE_URL pointing at a disposable PostgreSQL database.');
}

const prisma = new PrismaClient();
const PASSWORD = crypto.randomBytes(12).toString('base64url');

async function resetDb() {
  const tables = await prisma.$queryRaw`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length) {
    const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  }
}

async function createUser({ role, email, employee }) {
  const roleRow = await prisma.role.upsert({ where: { name: role }, update: {}, create: { name: role } });
  let emp = null;
  if (employee) {
    emp = await prisma.employee.create({
      data: {
        employeeNumber: employee.employeeNumber,
        fullName: employee.fullName,
        email,
        salary: employee.salary,
        hireDate: new Date('2025-01-01T00:00:00Z'),
        status: 'ACTIVE'
      }
    });
  }
  const user = await prisma.user.create({
    data: {
      username: email.split('@')[0],
      email,
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      roleId: roleRow.id,
      employeeId: emp ? emp.id : null,
      status: 'ACTIVE'
    }
  });
  return { user, employee: emp };
}

async function startServer() {
  const app = require('../src/index');
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;

  async function call(method, path, { token, body } = {}) {
    const res = await fetch(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = text; }
    return { status: res.status, body: json };
  }

  async function login(email) {
    const r = await call('POST', '/auth/login', { body: { email, password: PASSWORD } });
    if (r.status !== 200) throw new Error(`login failed for ${email}: ${r.status} ${JSON.stringify(r.body)}`);
    return r.body.token;
  }

  return { server, call, login, close: () => new Promise((r) => server.close(r)) };
}

module.exports = { prisma, resetDb, createUser, startServer };
