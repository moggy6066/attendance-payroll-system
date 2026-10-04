#!/usr/bin/env node
// Finds (and optionally merges) duplicate attendance rows — same employee, same date.
// Run this BEFORE `npx prisma db push` on an existing database: the schema now has
// @@unique([employeeId, date]) and the push fails while duplicates exist.
//
//   node scripts/attendance-duplicates.js            # report only, changes nothing
//   node scripts/attendance-duplicates.js --fix      # merge each group into one row
//
// Merge rule per group: keep the row with a check-in (earliest created first), set its
// checkIn to the earliest check-in and checkOut to the latest check-out of the group,
// keep the "best" status (PRESENT > LATE > ON_LEAVE > ABSENT), delete the other rows.
// Everything runs in one transaction. Take a database backup first (pg_dump).

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const FIX = process.argv.includes('--fix');
const RANK = { PRESENT: 4, LATE: 3, ON_LEAVE: 2, ABSENT: 1 };

async function main() {
  const groups = await prisma.$queryRaw`
    SELECT "employeeId", "date"::text AS day, COUNT(*)::int AS n
    FROM "Attendance"
    GROUP BY "employeeId", "date"
    HAVING COUNT(*) > 1
    ORDER BY day`;

  if (!groups.length) {
    console.log('No duplicate attendance rows.');
    console.log('Safe to run: npx prisma db push --accept-data-loss');
    console.log('(Prisma always warns when adding a unique constraint; with zero duplicates nothing is deleted.)');
    return;
  }

  const extra = groups.reduce((a, g) => a + g.n - 1, 0);
  console.log(`Found ${groups.length} employee/day groups with duplicates (${extra} extra rows):`);
  for (const g of groups.slice(0, 50)) console.log(`  employee ${g.employeeId}  ${g.day}  x${g.n}`);
  if (groups.length > 50) console.log(`  ... and ${groups.length - 50} more`);

  if (!FIX) {
    console.log('\nNothing changed. Back up the database, then re-run with --fix to merge them.');
    return;
  }

  let deleted = 0;
  await prisma.$transaction(async (tx) => {
    for (const g of groups) {
      const rows = await tx.$queryRaw`
        SELECT id, "checkIn", "checkOut", status::text AS status, "lateMinutes", "overtimeMinutes"
        FROM "Attendance"
        WHERE "employeeId" = ${g.employeeId} AND "date" = ${g.day}::date
        ORDER BY ("checkIn" IS NULL), "createdAt"`;
      const [keep, ...rest] = rows;
      const checkIns = rows.map((r) => r.checkIn).filter(Boolean).sort((a, b) => a - b);
      const checkOuts = rows.map((r) => r.checkOut).filter(Boolean).sort((a, b) => b - a);
      const status = rows.map((r) => r.status).sort((a, b) => (RANK[b] || 0) - (RANK[a] || 0))[0];
      await tx.attendance.update({
        where: { id: keep.id },
        data: {
          checkIn: checkIns[0] || null,
          checkOut: checkOuts[0] || null,
          status,
          lateMinutes: Math.min(...rows.map((r) => r.lateMinutes ?? 0)),
          overtimeMinutes: Math.max(...rows.map((r) => r.overtimeMinutes ?? 0))
        }
      });
      await tx.attendance.deleteMany({ where: { id: { in: rest.map((r) => r.id) } } });
      deleted += rest.length;
    }
  }, { timeout: 120000 });
  console.log(`\nMerged ${groups.length} groups, deleted ${deleted} duplicate rows. Re-run without --fix to confirm, then: npx prisma db push --accept-data-loss`);
}

main()
  .catch((e) => {
    console.error('Failed:', e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
