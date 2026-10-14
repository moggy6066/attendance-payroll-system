// Empties the test database and creates the users the E2E tests log in with.
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { FIXTURE_FILE } from './fixtures.js';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const pw = () => randomBytes(12).toString('base64url');

async function createUser(prisma, u, roleId, n) {
  const employee = u.fullName
    ? await prisma.employee.create({
        data: {
          employeeNumber: `E2E${n}`,
          fullName: u.fullName,
          email: u.email,
          salary: 10000,
          hireDate: new Date('2025-01-01T00:00:00Z')
        }
      })
    : null;
  await prisma.user.create({
    data: {
      username: u.email.split('@')[0],
      email: u.email,
      passwordHash: await bcrypt.hash(u.password, 4),
      roleId,
      employeeId: employee ? employee.id : null,
      status: 'ACTIVE',
      forcePasswordChange: Boolean(u.forcePasswordChange)
    }
  });
}

export default async function globalSetup() {
  if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) {
    throw new Error('E2E tests need DATABASE_URL (disposable, migrated PostgreSQL) and JWT_SECRET.');
  }
  const prisma = new PrismaClient();
  try {
    const tables = await prisma.$queryRaw`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
    if (tables.length) {
      const list = tables.map((t) => '"public"."' + t.tablename + '"').join(', ');
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
    }

    const users = {
      admin: { email: 'admin@e2e.local', password: pw(), role: 'ADMIN' },
      employee: { email: 'emp@e2e.local', password: pw(), role: 'EMPLOYEE', fullName: 'موظف الاختبار' },
      newcomer: {
        email: 'new@e2e.local',
        password: pw(),
        role: 'EMPLOYEE',
        fullName: 'موظف جديد',
        forcePasswordChange: true
      }
    };

    // Roles first (unique names), then all users in parallel.
    const roleNames = [...new Set(Object.values(users).map((u) => u.role))];
    const roles = Object.fromEntries(
      await Promise.all(
        roleNames.map(async (name) => [
          name,
          await prisma.role.upsert({ where: { name }, update: {}, create: { name } })
        ])
      )
    );
    await Promise.all(Object.values(users).map((u, i) => createUser(prisma, u, roles[u.role].id, i + 1)));
    writeFileSync(FIXTURE_FILE, JSON.stringify(users), { mode: 0o600 });
  } finally {
    await prisma.$disconnect();
  }
}
